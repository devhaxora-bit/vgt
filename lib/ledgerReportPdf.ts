import { formatBranchLabel as formatBranch } from '@/lib/formatBranchLabel';

export type LedgerParty = {
    name: string;
    code: string;
    gstin?: string | null;
    address?: string | null;
    branch_code?: string | null;
    branch_name?: string | null;
};

export type LedgerSummary = {
    openingBalance: number;
    totalCnsCount: number;
    totalCnsAmount: number;
    billedCnsCount: number;
    billedCnsAmount: number;
    unbilledCnsCount: number;
    unbilledCnsAmount: number;
    totalBilledAmount: number;
    totalPaid: number;
    outstanding: number;
    overbilledAmount: number;
    totalBilledCount?: number;
};

export type CnsRow = {
    cnNo: string;
    date: string;
    invoiceNo: string;
    vehicleNo: string;
    route: string;
    loadingStation: string;
    destination: string;
    chargeWeight: string;
    rate: number;
    basis: string;
    freight: number;
    detention: number;
    loading: number;
    unloading: number;
    extraKm: number;
    trafficChallan: number;
    otherCharges: number;
    totalAmount: number;
    billedOnBill: string | null;
    billStatus: 'BILLED' | 'UNBILLED' | 'CANCELLED';
    billAmount: number;
    billPaidAmount: number;
    billBalance: number;
};

export type BillRow = {
    billNo: string;
    date: string;
    coveredCns: string;
    cnCount: number;
    cnTotal: number;
    billedAmount: number;
    paidAmount: number;
    balance: number;
    status: string;
};

export type PaymentRow = {
    date: string;
    mode: string;
    reference: string;
    linkedBills: string;
    amount: number;
    status: string;
};

export type LedgerCnsFilter = 'all' | 'billed' | 'unbilled';

export type PartyLedgerReportPayload = {
    party: LedgerParty;
    periodLabel: string;
    generatedAt: string;
    summary: LedgerSummary;
    cnsRows: CnsRow[];
    billRows: BillRow[];
    paymentRows: PaymentRow[];
    sections?: unknown;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const sumCnsAmount = (rows: CnsRow[]) =>
    roundMoney(rows.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0));

type DistinctBillTotals = {
    billed: number;
    paid: number;
    balance: number;
    billCount: number;
};

/** Dedup bills from cnsRows by bill_ref_no so a bill spanning multiple CNs is counted once.
 *  Rows without a bill_ref fall back to a per-row key so their amounts are still counted
 *  (this avoids silently dropping a real bill amount when ref_no is missing in legacy data). */
const sumDistinctBillTotalsFromCnsRows = (rows: CnsRow[]): DistinctBillTotals => {
    const bills = new Map<string, { billed: number; paid: number; balance: number }>();

    rows.forEach((row, index) => {
        if (row.billStatus !== 'BILLED') return;
        const refKey = String(row.billedOnBill ?? '').trim();
        const dedupKey = refKey || `__row_${index}`;
        if (bills.has(dedupKey)) return;
        bills.set(dedupKey, {
            billed: Number(row.billAmount || 0),
            paid: Number(row.billPaidAmount || 0),
            balance: Number(row.billBalance || 0),
        });
    });

    let billed = 0;
    let paid = 0;
    let balance = 0;
    bills.forEach((entry) => {
        billed += entry.billed;
        paid += entry.paid;
        balance += entry.balance;
    });

    return {
        billed: roundMoney(billed),
        paid: roundMoney(paid),
        balance: roundMoney(balance),
        billCount: bills.size,
    };
};

/** Restrict PDF CNS rows and summary counts to billed, unbilled, or all. */
export const applyLedgerCnsFilter = (
    payload: PartyLedgerReportPayload,
    filter: LedgerCnsFilter,
): PartyLedgerReportPayload => {
    if (filter === 'all') return payload;

    const cnsRows = filter === 'billed'
        ? payload.cnsRows.filter((row) => row.billStatus === 'BILLED')
        : payload.cnsRows.filter((row) => row.billStatus !== 'BILLED');

    const billedRows = cnsRows.filter((row) => row.billStatus === 'BILLED');
    const unbilledRows = cnsRows.filter((row) => row.billStatus !== 'BILLED');
    const filterSuffix = filter === 'billed' ? ' · Billed CNS' : ' · Unbilled CNS';
    const distinctTotals = sumDistinctBillTotalsFromCnsRows(cnsRows);

    return {
        ...payload,
        periodLabel: `${payload.periodLabel}${filterSuffix}`,
        cnsRows,
        summary: {
            ...payload.summary,
            totalCnsCount: cnsRows.length,
            totalCnsAmount: sumCnsAmount(cnsRows),
            billedCnsCount: billedRows.length,
            billedCnsAmount: sumCnsAmount(billedRows),
            unbilledCnsCount: unbilledRows.length,
            unbilledCnsAmount: sumCnsAmount(unbilledRows),
            totalBilledAmount: distinctTotals.billed,
            totalPaid: distinctTotals.paid,
            outstanding: roundMoney(payload.summary.openingBalance + distinctTotals.billed - distinctTotals.paid),
            totalBilledCount: distinctTotals.billCount,
        },
    };
};

type SectionPage = {
    rows: CnsRow[];
    isLast: boolean;
    isCoverPage: boolean;
    blankCount: number;
};

const CNS_TABLE_COLUMNS = 11;
const PAGE_LAYOUT_BUFFER_PX = 6;

const fmtNum = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const fmt = (value: number) => fmtNum.format(value || 0);
const safe = (value: string | number | null | undefined) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const titleText = (value: string | null | undefined) => safe(String(value ?? '').trim() || '-');

const partyBranchLabel = (party: LedgerParty) =>
    formatBranch(party.branch_code, party.branch_name);

const loadLogo = async (): Promise<string> => {
    try {
        const res = await fetch('/vgt_logo.png');
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject();
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return `${window.location.origin}/vgt_logo.png`;
    }
};

/** PDF omits cancelled bills — those CNS rows appear as unbilled with no bill amounts. */
const preparePdfPayload = (payload: PartyLedgerReportPayload): PartyLedgerReportPayload => {
    const normalizedRows = payload.cnsRows.map((row) => {
        if (row.billStatus !== 'CANCELLED') return row;
        return {
            ...row,
            billedOnBill: null,
            billStatus: 'UNBILLED' as const,
            billAmount: 0,
            billPaidAmount: 0,
            billBalance: 0,
        };
    });

    const cnsRows = normalizedRows;

    const billedRows = cnsRows.filter((row) => row.billStatus === 'BILLED');
    const unbilledRows = cnsRows.filter((row) => row.billStatus !== 'BILLED');

    // Derive every summary number from cnsRows so that the cover-page tiles, the
    // TOTAL row at the bottom of the CNS table, and the per-row cells above them
    // are guaranteed to add up. This collapses edge cases like:
    //   - a bill covering multiple CNs (dedup by bill_ref_no so it's counted once)
    //   - a bill that lives outside the date range but still covers in-range CNs
    //   - cancelled bills (normalized to UNBILLED above with zero amounts)
    //   - bills shown in the table but missing from the upstream summary cache
    const totalCnsAmount = sumCnsAmount(cnsRows);
    const billedCnsAmount = sumCnsAmount(billedRows);
    const unbilledCnsAmount = sumCnsAmount(unbilledRows);
    const distinctTotals = sumDistinctBillTotalsFromCnsRows(cnsRows);
    const openingBalance = Number(payload.summary.openingBalance || 0);

    return {
        ...payload,
        cnsRows,
        billRows: payload.billRows.filter((row) => row.status !== 'CANCELLED'),
        summary: {
            ...payload.summary,
            openingBalance,
            totalCnsCount: cnsRows.length,
            totalCnsAmount,
            billedCnsCount: billedRows.length,
            billedCnsAmount,
            unbilledCnsCount: unbilledRows.length,
            unbilledCnsAmount,
            totalBilledAmount: distinctTotals.billed,
            totalPaid: distinctTotals.paid,
            outstanding: roundMoney(openingBalance + distinctTotals.billed - distinctTotals.paid),
            totalBilledCount: distinctTotals.billCount,
        },
    };
};

const billStatusCell = (row: CnsRow) => {
    if (row.billStatus === 'BILLED') {
        const billNo = String(row.billedOnBill ?? '').trim() || 'BILLED';
        return `<td class="status-cell ok">${titleText(billNo)}</td>`;
    }
    return `<td class="status-cell wait">UNBILLED</td>`;
};

const cnsTableHeadHtml = () => `
    <thead>
        <tr>
            <th style="width:5%;">CNS<br/>No</th>
            <th style="width:7%;">Date</th>
            <th style="width:13%;">Invoice<br/>No</th>
            <th style="width:8%;">Vehicle no.</th>
            <th style="width:11%;">Loading<br/>Station</th>
            <th style="width:11%;">Destination</th>
            <th style="width:8%;">CNS<br/>Amount</th>
            <th style="width:12%;">Bill<br/>No</th>
            <th style="width:8%;">Bill<br/>Amt.</th>
            <th style="width:6%;">Received</th>
            <th style="width:6%;">Balance</th>
        </tr>
    </thead>
`;

type BillCellMeta = {
    showMergedCells: boolean;
    rowSpan: number;
};

const computeBillCellMeta = (rows: CnsRow[]): BillCellMeta[] => {
    const meta: BillCellMeta[] = rows.map(() => ({ showMergedCells: true, rowSpan: 1 }));
    let index = 0;

    while (index < rows.length) {
        const current = rows[index];
        const billNo = String(current.billedOnBill ?? '').trim();
        const isBilled = current.billStatus === 'BILLED' && billNo.length > 0;

        if (!isBilled) {
            index += 1;
            continue;
        }

        let end = index + 1;
        while (end < rows.length) {
            const next = rows[end];
            const nextBillNo = String(next.billedOnBill ?? '').trim();
            if (next.billStatus === 'BILLED' && nextBillNo === billNo) {
                end += 1;
                continue;
            }
            break;
        }

        const span = end - index;
        meta[index] = { showMergedCells: true, rowSpan: span };
        for (let follow = index + 1; follow < end; follow += 1) {
            meta[follow] = { showMergedCells: false, rowSpan: 0 };
        }

        index = end;
    }

    return meta;
};

const cnsDataRowHtml = (row: CnsRow, billMeta: BillCellMeta) => `
    <tr class="cns-data-row">
        <td class="center">${titleText(row.cnNo)}</td>
        <td class="center">${titleText(row.date)}</td>
        <td class="center">${titleText(row.invoiceNo)}</td>
        <td class="center">${titleText(row.vehicleNo)}</td>
        <td class="center">${titleText(row.loadingStation)}</td>
        <td class="center">${titleText(row.destination)}</td>
        <td class="amount">${fmt(row.totalAmount)}</td>
        ${billMeta.showMergedCells ? billStatusCell(row).replace('<td ', `<td rowspan="${billMeta.rowSpan}" `) : ''}
        ${billMeta.showMergedCells ? `<td rowspan="${billMeta.rowSpan}" class="amount">${fmt(row.billAmount)}</td>` : ''}
        ${billMeta.showMergedCells ? `<td rowspan="${billMeta.rowSpan}" class="amount" style="color:#11653d;">${fmt(row.billPaidAmount)}</td>` : ''}
        ${billMeta.showMergedCells ? `<td rowspan="${billMeta.rowSpan}" class="amount" style="color:#a32727;">${fmt(row.billBalance)}</td>` : ''}
    </tr>
`;

const blankRows = (count: number, cells: number) => Array.from({ length: count }, () => `
    <tr class="blank-row">${Array.from({ length: cells }, () => '<td>&nbsp;</td>').join('')}</tr>
`).join('');

const measureTbodyBudget = (pageEl: HTMLElement) => {
    const sectionWrap = pageEl.querySelector<HTMLElement>('.section-wrap');
    const sectionHead = pageEl.querySelector<HTMLElement>('.section-head');
    const thead = pageEl.querySelector<HTMLElement>('.items-table thead');
    if (!sectionWrap || !sectionHead || !thead) return 0;
    return Math.max(
        0,
        sectionWrap.offsetHeight - sectionHead.offsetHeight - thead.offsetHeight - PAGE_LAYOUT_BUFFER_PX,
    );
};

const measureLedgerPages = (
    doc: Document,
    rows: CnsRow[],
): SectionPage[] => {
    if (rows.length === 0) return [];

    const coverBudget = measureTbodyBudget(doc.getElementById('measure-cover-page') as HTMLElement) || 280;
    const contBudget = measureTbodyBudget(doc.getElementById('measure-cont-page') as HTMLElement) || 620;
    const rowEls = Array.from(doc.querySelectorAll<HTMLTableRowElement>('#measure-all-rows .cns-data-row'));
    const rowHeights = rowEls.map((el) => el.offsetHeight);
    const blankRowEl = doc.querySelector<HTMLTableRowElement>('#measure-blank-row');
    const totalRowEl = doc.querySelector<HTMLTableRowElement>('#measure-total-row');
    const blankRowHeight = Math.max(blankRowEl?.offsetHeight || 20, 1);
    const totalRowHeight = totalRowEl?.offsetHeight || 23;

    const pages: SectionPage[] = [];
    let rowIndex = 0;
    let isCoverPage = true;

    while (rowIndex < rows.length) {
        const budget = Math.max(isCoverPage ? coverBudget : contBudget, blankRowHeight);
        const pageRows: CnsRow[] = [];
        let usedHeight = 0;

        while (rowIndex < rows.length) {
            const rowHeight = rowHeights[rowIndex] ?? blankRowHeight;
            const isFinalRow = rowIndex === rows.length - 1;
            const reserveTotal = isFinalRow ? totalRowHeight : 0;

            if (pageRows.length > 0 && usedHeight + rowHeight + reserveTotal > budget) {
                break;
            }

            pageRows.push(rows[rowIndex]);
            usedHeight += rowHeight;
            rowIndex += 1;
        }

        const isLast = rowIndex >= rows.length;
        const remaining = budget - usedHeight - (isLast ? totalRowHeight : 0);
        const blankCount = Math.max(0, Math.floor(remaining / blankRowHeight));

        pages.push({
            rows: pageRows,
            isLast,
            isCoverPage,
            blankCount,
        });
        isCoverPage = false;
    }

    return pages;
};

const cnsTable = (
    payload: PartyLedgerReportPayload,
    rows: CnsRow[],
    isLast: boolean,
    blankCount: number,
) => {
    const allRows = payload.cnsRows;
    const billMeta = computeBillCellMeta(rows);
    // Derive totals from cnsRows so the TOTAL row is always the literal sum of the
    // CNS Amount / Bill Amt cells above. Each bill is counted once (dedup by
    // bill_ref_no) because the cell is rendered once via rowspan for multi-CN bills.
    const totalCnsAmount = sumCnsAmount(allRows);
    const distinctTotals = sumDistinctBillTotalsFromCnsRows(allRows);
    const totalBillAmt = distinctTotals.billed;
    const totalReceived = distinctTotals.paid;
    const totalBalance = roundMoney(Math.max(totalBillAmt - totalReceived, 0));

    return `
        ${sectionHeadHtml(payload)}
        <table class="items-table cns-table">
            ${cnsTableHeadHtml()}
            <tbody>
                ${rows.map((row, index) => cnsDataRowHtml(row, billMeta[index])).join('')}
                ${blankRows(blankCount, CNS_TABLE_COLUMNS)}
                ${isLast ? `
                    <tr class="total-row">
                        <td class="total-label">TOTAL</td>
                        <td colspan="5"></td>
                        <td class="amount">${fmt(totalCnsAmount)}</td>
                        <td class="center" style="font-size:9.5px; font-weight:800; color:#1d2f7a;">${distinctTotals.billCount} bills</td>
                        <td class="amount">${fmt(totalBillAmt)}</td>
                        <td class="amount" style="color:#11653d;">${fmt(totalReceived)}</td>
                        <td class="amount" style="color:#a32727;">${fmt(totalBalance)}</td>
                    </tr>
                ` : ''}
            </tbody>
        </table>
    `;
};

const sectionTable = (payload: PartyLedgerReportPayload, page: SectionPage) =>
    cnsTable(payload, page.rows, page.isLast, page.blankCount);

const summaryTiles = (summary: LedgerSummary) => `
    <div class="summary-grid">
        <div class="summary-tile"><span>Total CNS Amount</span><strong>${fmt(summary.totalCnsAmount)}</strong><small>${summary.totalCnsCount} consignments</small></div>
        <div class="summary-tile warning"><span>Unbilled</span><strong>${fmt(summary.unbilledCnsAmount)}</strong><small>${summary.unbilledCnsCount} pending</small></div>
        <div class="summary-tile"><span>Total Billed</span><strong>${fmt(summary.totalBilledAmount)}</strong><small>${summary.totalBilledCount ?? 0} bills</small></div>
        <div class="summary-tile"><span>Total Paid</span><strong>${fmt(summary.totalPaid)}</strong><small>Receipts</small></div>
        <div class="summary-tile danger"><span>Outstanding</span><strong>${fmt(summary.outstanding)}</strong><small>Opening ${fmt(summary.openingBalance)}</small></div>
    </div>
`;

const reportCoverHtml = (payload: PartyLedgerReportPayload, logoUrl: string) => `
    <div class="header-band">
        <div class="header-logo"><img src="${safe(logoUrl)}" alt="VGT Logo" /></div>
        <div class="header-copy">
            <div class="header-title">VISAKHA GOLDEN TRANSPORT</div>
            <div class="header-line">
                <span>D. NO. 8-19-58/A, GOPAL NAGAR, NEAR BANK COLONY, VIZIANAGARAM, ANDHRA PRADESH - 535003</span>
            </div>
            <div class="header-line contact">Contact:9392223404,8756314575 Email:vsp@visakhagolden.com</div>
        </div>
        <div class="header-pan"><span>PAN NO:</span><br/>AAWFV7670H</div>
    </div>
    <div class="detail-grid">
        <div class="party-block">
            <div class="party-name">${titleText(payload.party.name)}</div>
            <div class="party-line">${titleText(payload.party.address)}</div>
            <div class="party-line">
                <span>Code:</span> ${titleText(payload.party.code)}
                <span>GSTIN:</span> ${titleText(payload.party.gstin)}
            </div>
            <div class="party-line party-branch-line">
                <span>Branch:</span> ${titleText(partyBranchLabel(payload.party))}
            </div>
        </div>
        <div class="right-block">
            <div class="meta-row"><div class="meta-label">Report :</div><div class="meta-value">Party Ledger</div></div>
            <div class="meta-row"><div class="meta-label">Branch :</div><div class="meta-value">${titleText(partyBranchLabel(payload.party))}</div></div>
            <div class="meta-row"><div class="meta-label">Period :</div><div class="meta-value">${titleText(payload.periodLabel)}</div></div>
            <div class="meta-row"><div class="meta-label">Generated :</div><div class="meta-value">${titleText(payload.generatedAt)}</div></div>
        </div>
    </div>
    ${summaryTiles(payload.summary)}
`;

const pageHtml = (
    payload: PartyLedgerReportPayload,
    page: SectionPage,
    logoUrl: string,
    pageIndex: number,
    pageCount: number,
) => {
    const isCoverPage = pageIndex === 0;
    return `
    <div class="page${isCoverPage ? ' page--cover' : ' page--continuation'}">
        <div class="sheet">
            ${isCoverPage ? `<div class="cover-block">${reportCoverHtml(payload, logoUrl)}</div>` : ''}
            <div class="section-wrap${isCoverPage ? ' section-wrap--cover' : ' section-wrap--cont'}">${sectionTable(payload, page)}</div>
            <div class="footer-row">
                <span class="footer-party">${titleText(payload.party.name)} · ${titleText(partyBranchLabel(payload.party))}</span>
                <span class="footer-page">Page ${pageIndex + 1} of ${pageCount}</span>
            </div>
        </div>
    </div>
`;
};

const sectionHeadHtml = (payload: PartyLedgerReportPayload) => {
    const totalUnbilled = payload.cnsRows.filter((row) => row.billStatus !== 'BILLED').length;
    const totalBilled = payload.cnsRows.filter((row) => row.billStatus === 'BILLED').length;
    return `
        <div class="section-head">
            <span>A. CNS Ledger Details</span>
            <span>${payload.cnsRows.length} CNS | ${totalBilled} billed | ${totalUnbilled} unbilled</span>
        </div>
    `;
};

const reportStyles = () => `
@page { size: A4 landscape; margin: 5mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
.page { width: 287mm; height: 200mm; max-height: 200mm; margin: 0 auto; padding: 0 0 1.5mm; background: #fff; page-break-after: always; overflow: hidden; box-sizing: border-box; }
.page:last-child { page-break-after: auto; }
.sheet { border: 1.2px solid #1d2f7a; height: 100%; max-height: 100%; display: grid; grid-template-rows: 1fr 12mm; overflow: hidden; box-sizing: border-box; }
.page--cover .sheet { grid-template-rows: auto 1fr 12mm; }
.cover-block { min-height: 0; overflow: visible; }
.header-band, .detail-grid, .summary-grid { flex-shrink: 0; }
.section-wrap { min-height: 0; height: 100%; overflow: hidden; display: flex; flex-direction: column; }
.section-wrap .section-head { flex-shrink: 0; }
.section-wrap .items-table { width: 100%; }
.page--continuation .section-head { margin-top: 0; }
.header-band { border-bottom: 1.2px solid #1d2f7a; display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; column-gap: 8px; padding: 7px 12px 5px; }
.header-logo { display: flex; align-items: center; justify-content: flex-start; }
.header-logo img { width: 102px; max-width: 100%; filter: grayscale(1) contrast(1.6) brightness(0.2); object-fit: contain; }
.header-copy { text-align: center; }
.header-title { font-size: 17px; font-weight: 800; letter-spacing: 0.2px; color: #17308b; }
.header-line { display: flex; justify-content: center; gap: 34px; font-size: 12px; font-weight: 700; margin-top: 3px; line-height: 1.3; }
.header-line.contact { display: inline-block; margin-top: 3px; margin-bottom: 5px; padding: 0 6px 5px; border-bottom: 1.2px solid #1d2f7a; }
.header-pan { text-align: right; font-size: 12px; font-weight: 800; line-height: 1.35; }
.header-pan span { color: #1d2f7a; }
.detail-grid { display: grid; grid-template-columns: 56% 44%; min-height: 84px; border-bottom: 1.2px solid #1d2f7a; }
.party-block { border-right: 1.2px solid #1d2f7a; display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 7px 10px; min-width: 0; }
.party-name { font-size: 13px; font-weight: 800; text-transform: uppercase; overflow-wrap: anywhere; line-height: 1.2; }
.party-line { font-size: 10.6px; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
.party-line span { margin-left: 8px; color: #1d2f7a; font-weight: 800; }
.party-line span:first-child { margin-left: 0; }
.right-block { display: grid; grid-template-rows: repeat(4, 1fr); }
.party-branch-line { color: #1d2f7a; font-weight: 800; }
.meta-row { display: grid; grid-template-columns: 27% 73%; border-bottom: 1.2px solid #1d2f7a; min-height: 21px; }
.meta-row:last-child { border-bottom: none; }
.meta-label { border-right: 1.2px solid #1d2f7a; display: flex; align-items: center; padding: 2px 6px 4px; color: #1d2f7a; font-size: 10.5px; font-weight: 800; }
.meta-value { display: flex; align-items: center; justify-content: center; min-width: 0; padding: 2px 6px 4px; font-size: 11.2px; font-weight: 800; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.summary-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; padding: 8px; border-bottom: 1.2px solid #1d2f7a; align-items: stretch; }
.summary-tile { min-width: 0; min-height: 42px; border: 1px solid rgba(29, 47, 122, 0.55); background: rgba(29, 47, 122, 0.08); padding: 5px 6px 4px; overflow: visible; display: flex; flex-direction: column; justify-content: flex-start; gap: 1px; }
.summary-tile span, .summary-tile small { display: block; line-height: 1.35; overflow: visible; white-space: nowrap; }
.summary-tile span { color: #1d2f7a; font-size: 9px; font-weight: 800; text-transform: uppercase; }
.summary-tile strong { display: block; color: #111; font-size: 12px; font-weight: 800; line-height: 1.35; overflow: visible; white-space: nowrap; }
.summary-tile small { color: #4c5675; font-size: 8.5px; font-weight: 700; line-height: 1.3; }
.summary-tile.good { background: rgba(61, 166, 104, 0.11); }
.summary-tile.warning { background: rgba(255, 207, 84, 0.22); }
.summary-tile.danger { background: rgba(235, 93, 93, 0.12); }
.section-head { margin: 8px 0 0; border-top: 1.2px solid #1d2f7a; border-bottom: 1.2px solid #1d2f7a; background: rgba(29, 47, 122, 0.12); display: flex; justify-content: space-between; gap: 8px; padding: 7px 8px; color: #1d2f7a; font-size: 11.6px; font-weight: 800; text-transform: uppercase; line-height: 1.35; flex-shrink: 0; }
.section-head span { overflow: visible; }
.items-table { width: 100%; border-collapse: collapse; table-layout: fixed; border-bottom: 1.2px solid #1d2f7a; }
.items-table th, .items-table td { border-right: 1.2px solid #1d2f7a; border-bottom: 1.2px solid #1d2f7a; padding: 4px 4px 5px; vertical-align: middle; overflow: hidden; }
.items-table th:last-child, .items-table td:last-child { border-right: none; }
.items-table thead th { color: #1d2f7a; background: rgba(29, 47, 122, 0.12); text-align: center; font-size: 10.6px; font-weight: 800; line-height: 1.22; padding-top: 6px; padding-bottom: 7px; }
.items-table tbody td { min-height: 19px; height: 19px; color: #111; font-size: 9.8px; font-weight: 700; line-height: 1.15; white-space: nowrap; text-overflow: ellipsis; }
.items-table tbody td.status-cell { text-align: center; vertical-align: middle; font-size: 8.5px; font-weight: 800; color: #1d2f7a; background: rgba(29, 47, 122, 0.08); padding: 3px 4px; white-space: nowrap; }
.items-table tbody td.status-cell.ok { color: #11653d; background: rgba(41, 171, 105, 0.14); }
.items-table tbody td.status-cell.bad { color: #a32727; background: rgba(221, 81, 81, 0.13); }
.items-table tbody td.status-cell.warn { color: #8b5a08; background: rgba(235, 174, 55, 0.18); }
.items-table tbody td.status-cell.wait { color: #8b5a08; background: rgba(235, 174, 55, 0.18); }
.cns-table tbody td:nth-child(3),
.cns-table tbody td:nth-child(5),
.cns-table tbody td:nth-child(6),
.cns-table tbody td:nth-child(8) { height: auto; white-space: normal; word-break: break-word; overflow-wrap: anywhere; overflow: hidden; text-overflow: clip; vertical-align: top; padding-top: 3px; padding-bottom: 3px; }
.cns-table tbody td:nth-child(3) { word-break: break-all; }
.items-table .center { text-align: center; }
.items-table .amount { text-align: right; padding-right: 6px; font-variant-numeric: tabular-nums; }
.items-table .count { text-align: center; font-variant-numeric: tabular-nums; }
.blank-row td { font-weight: 400; background: #fff; height: 20px; min-height: 20px; }
.total-row td { height: 25px; background: rgba(29, 47, 122, 0.12); color: #111; font-size: 12.2px; font-weight: 900; padding-top: 5px; padding-bottom: 6px; border-bottom: 2px solid #1d2f7a; }
.total-label { color: #1d2f7a !important; font-size: 11px; }
.footer-row { border-top: 1.2px solid #1d2f7a; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 2.5mm 10px 3.2mm; color: #1d2f7a; font-size: 9.2px; font-weight: 800; line-height: 1.45; text-transform: uppercase; overflow: visible; box-sizing: border-box; }
.footer-party { flex: 1 1 auto; min-width: 0; white-space: normal; overflow: visible; overflow-wrap: anywhere; line-height: 1.45; padding-bottom: 1px; }
.footer-page { flex: 0 0 auto; white-space: nowrap; line-height: 1.45; padding-bottom: 1px; }
#measure-root { position: absolute; left: -20000px; top: 0; width: 287mm; visibility: hidden; pointer-events: none; }
`;

const measurementHtml = (
    payload: PartyLedgerReportPayload,
    rows: CnsRow[],
    logoUrl: string,
) => {
    const billMeta = computeBillCellMeta(rows);
    return `<!DOCTYPE html>
<html>
<head>
<style>${reportStyles()}</style>
</head>
<body>
<div id="measure-root">
    <div class="page page--cover" id="measure-cover-page">
        <div class="sheet">
            <div class="cover-block">${reportCoverHtml(payload, logoUrl)}</div>
            <div class="section-wrap">
                ${sectionHeadHtml(payload)}
                <table class="items-table cns-table">${cnsTableHeadHtml()}<tbody></tbody></table>
            </div>
            <div class="footer-row"><span>&nbsp;</span><span>&nbsp;</span></div>
        </div>
    </div>
    <div class="page page--continuation" id="measure-cont-page">
        <div class="sheet">
            <div class="section-wrap">
                ${sectionHeadHtml(payload)}
                <table class="items-table cns-table">${cnsTableHeadHtml()}<tbody></tbody></table>
            </div>
            <div class="footer-row"><span>&nbsp;</span><span>&nbsp;</span></div>
        </div>
    </div>
    <table class="items-table cns-table" style="width:287mm">
        ${cnsTableHeadHtml()}
        <tbody id="measure-all-rows">
            ${rows.map((row, index) => cnsDataRowHtml(row, billMeta[index])).join('')}
            <tr class="blank-row" id="measure-blank-row">${Array.from({ length: CNS_TABLE_COLUMNS }, () => '<td>&nbsp;</td>').join('')}</tr>
            <tr class="total-row" id="measure-total-row">
                <td class="total-label">TOTAL</td>
                <td colspan="5"></td>
                <td class="amount">0</td>
                <td></td>
                <td class="amount">0</td>
                <td class="amount">0</td>
                <td class="amount">0</td>
            </tr>
        </tbody>
    </table>
</div>
</body>
</html>`;
};

const htmlDocument = (payload: PartyLedgerReportPayload, pages: SectionPage[], logoUrl: string) => `<!DOCTYPE html>
<html>
<head>
<title>${titleText(payload.party.code)} Party Ledger</title>
<style>
${reportStyles()}
</style>
</head>
<body>
${pages.map((page, index) => pageHtml(payload, page, logoUrl, index, pages.length)).join('')}
</body>
</html>`;

export const downloadPartyLedgerReportPdf = async (
    payload: PartyLedgerReportPayload,
    cnsFilter: LedgerCnsFilter = 'all',
): Promise<void> => {
    const pdfPayload = preparePdfPayload(applyLedgerCnsFilter(payload, cnsFilter));
    if (pdfPayload.cnsRows.length === 0) throw new Error('No ledger rows found for this report');

    const logoUrl = await loadLogo();
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '297mm';
    iframe.style.height = '210mm';
    document.body.appendChild(iframe);

    try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) throw new Error('Failed to create ledger export document');

        doc.open();
        doc.write(measurementHtml(pdfPayload, pdfPayload.cnsRows, logoUrl));
        doc.close();

        await Promise.all(Array.from(doc.images).map((image) => {
            if (image.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
                image.onload = () => resolve();
                image.onerror = () => resolve();
            });
        }));
        await new Promise((resolve) => setTimeout(resolve, 150));

        const pages = measureLedgerPages(doc, pdfPayload.cnsRows);
        if (pages.length === 0) throw new Error('No ledger rows found for this report');

        doc.open();
        doc.write(htmlDocument(pdfPayload, pages, logoUrl));
        doc.close();

        await Promise.all(Array.from(doc.images).map((image) => {
            if (image.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
                image.onload = () => resolve();
                image.onerror = () => resolve();
            });
        }));
        await new Promise((resolve) => setTimeout(resolve, 250));

        const pageElements = Array.from(doc.querySelectorAll<HTMLElement>('.page'));
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
        ]);
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });

        for (let index = 0; index < pageElements.length; index++) {
            const page = pageElements[index];
            const captureWidth = page.offsetWidth;
            const captureHeight = page.offsetHeight;
            const canvas = await html2canvas(page, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: captureWidth,
                height: captureHeight,
                windowWidth: captureWidth,
                windowHeight: captureHeight,
            });
            if (index > 0) pdf.addPage('a4', 'landscape');
            const imgWidthMm = 287;
            const imgHeightMm = 198;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, 5.5, imgWidthMm, imgHeightMm, undefined, 'FAST');
        }

        const partyCode = String(payload.party.code || 'ledger').replace(/[^a-zA-Z0-9_-]/g, '') || 'ledger';
        const period = payload.periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
        pdf.save(`${partyCode}-ledger-${period}.pdf`);
    } finally {
        iframe.remove();
    }
};
