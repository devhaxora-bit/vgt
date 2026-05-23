export type LedgerParty = {
    name: string;
    code: string;
    type: string;
    gstin?: string | null;
    address?: string | null;
    branch_code?: string | null;
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

type SectionPage =
    | { kind: 'cns'; rows: CnsRow[]; isLast: boolean; rowCapacity: number; isCoverPage: boolean }
    | { kind: 'bills'; rows: BillRow[]; isLast: boolean; rowCapacity: number; isCoverPage: boolean }
    | { kind: 'payments'; rows: PaymentRow[]; isLast: boolean; rowCapacity: number; isCoverPage: boolean };

const fmtNum = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const fmt = (value: number) => fmtNum.format(value || 0);
const safe = (value: string | number | null | undefined) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const titleText = (value: string | null | undefined) => safe(String(value ?? '').trim() || '-');

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

/** Rows per page when the company header + summary are shown (page 1 only). */
const CNS_ROWS_COVER = 5;
const BILL_ROWS_COVER = 7;
const PAYMENT_ROWS_COVER = 9;

/** Rows per page on continuation pages (no company header). */
const CNS_ROWS_CONT = 15;
const BILL_ROWS_CONT = 17;
const PAYMENT_ROWS_CONT = 19;

const paginateSection = <T>(
    rows: T[],
    coverSize: number,
    contSize: number,
    isFirstDocumentPage: { value: boolean },
): { pages: T[][]; isFirstDocumentPage: { value: boolean } } => {
    const pages: T[][] = [];
    let index = 0;
    while (index < rows.length) {
        const size = isFirstDocumentPage.value ? coverSize : contSize;
        pages.push(rows.slice(index, index + size));
        index += size;
        isFirstDocumentPage.value = false;
    }
    return { pages, isFirstDocumentPage };
};

const buildSectionPages = (payload: PartyLedgerReportPayload): SectionPage[] => {
    const firstPageFlag = { value: true };

    const cnsChunked = paginateSection(payload.cnsRows, CNS_ROWS_COVER, CNS_ROWS_CONT, firstPageFlag).pages;
    const billChunked = paginateSection(payload.billRows, BILL_ROWS_COVER, BILL_ROWS_CONT, firstPageFlag).pages;
    const paymentChunked = paginateSection(
        payload.paymentRows,
        PAYMENT_ROWS_COVER,
        PAYMENT_ROWS_CONT,
        firstPageFlag,
    ).pages;

    let useCoverCapacity = true;
    let isFirstDocPage = true;
    const withCapacity = <T>(
        chunks: T[][],
        coverCap: number,
        contCap: number,
        kind: SectionPage['kind'],
    ): SectionPage[] => chunks.map((rows, index, pages) => {
        const rowCapacity = useCoverCapacity ? coverCap : contCap;
        const isCoverPage = isFirstDocPage;
        useCoverCapacity = false;
        isFirstDocPage = false;
        return {
            kind,
            rows,
            isLast: index === pages.length - 1,
            rowCapacity,
            isCoverPage,
        } as SectionPage;
    });

    return [
        ...withCapacity(cnsChunked, CNS_ROWS_COVER, CNS_ROWS_CONT, 'cns'),
        ...withCapacity(billChunked, BILL_ROWS_COVER, BILL_ROWS_CONT, 'bills'),
        ...withCapacity(paymentChunked, PAYMENT_ROWS_COVER, PAYMENT_ROWS_CONT, 'payments'),
    ];
};

const activeBillTotals = (rows: BillRow[]) => rows
    .filter((row) => row.status === 'ACTIVE')
    .reduce((totals, row) => ({
        cnCount: totals.cnCount + Number(row.cnCount || 0),
        cnTotal: totals.cnTotal + Number(row.cnTotal || 0),
        billed: totals.billed + Number(row.billedAmount || 0),
        paid: totals.paid + Number(row.paidAmount || 0),
        balance: totals.balance + Number(row.balance || 0),
    }), { cnCount: 0, cnTotal: 0, billed: 0, paid: 0, balance: 0 });

const activePaymentTotal = (rows: PaymentRow[]) => rows
    .filter((row) => row.status === 'ACTIVE')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

const statusClass = (status: string) => {
    if (status === 'BILLED' || status === 'ACTIVE') return 'ok';
    if (status === 'CANCELLED') return 'bad';
    if (status === 'REVERSED') return 'warn';
    return 'wait';
};

const blankRows = (count: number, cells: number) => Array.from({ length: count }, () => `
    <tr class="blank-row">${Array.from({ length: cells }, () => '<td>&nbsp;</td>').join('')}</tr>
`).join('');

const cnsTable = (
    payload: PartyLedgerReportPayload,
    rows: CnsRow[],
    isLast: boolean,
    rowCapacity: number,
    isCoverPage: boolean,
) => {
    const totalUnbilled = payload.cnsRows.filter((row) => row.billStatus !== 'BILLED').length;
    const totalBilled = payload.cnsRows.filter((row) => row.billStatus === 'BILLED').length;
    const cnsTotal = payload.cnsRows.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);

    return `
        <div class="section-head">
            <span>A. CNS Ledger Details</span>
            <span>${payload.cnsRows.length} CNS | ${totalBilled} billed | ${totalUnbilled} unbilled</span>
        </div>
        <table class="items-table cns-table">
            <thead>
                <tr>
                    <th style="width:5%;">CNS<br/>No</th>
                    <th style="width:7%;">Date</th>
                    <th style="width:13%;">Invoice<br/>No</th>
                    <th style="width:8%;">Vehicle no.</th>
                    <th style="width:11%;">Loading<br/>Station</th>
                    <th style="width:11%;">Destination</th>
                    <th style="width:7%;">CNS<br/>Total</th>
                    <th style="width:7%;">Bill<br/>Status</th>
                    <th style="width:12%;">Bill Ref</th>
                    <th style="width:7%;">Bill<br/>Amt.</th>
                    <th style="width:6%;">Received</th>
                    <th style="width:6%;">Balance</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row) => `
                    <tr>
                        <td class="center">${titleText(row.cnNo)}</td>
                        <td class="center">${titleText(row.date)}</td>
                        <td class="center">${titleText(row.invoiceNo)}</td>
                        <td class="center">${titleText(row.vehicleNo)}</td>
                        <td class="center">${titleText(row.loadingStation)}</td>
                        <td class="center">${titleText(row.destination)}</td>
                        <td class="amount">${fmt(row.totalAmount)}</td>
                        <td class="status-cell ${statusClass(row.billStatus)}">${safe(row.billStatus)}</td>
                        <td>${titleText(row.billedOnBill)}</td>
                        <td class="amount">${fmt(row.billAmount)}</td>
                        <td class="amount">${fmt(row.billPaidAmount)}</td>
                        <td class="amount">${fmt(row.billBalance)}</td>
                    </tr>
                `).join('')}
                ${isCoverPage ? '' : blankRows(Math.max(0, rowCapacity - rows.length), 12)}
                ${isLast ? `
                    <tr class="total-row">
                        <td class="total-label">TOTAL</td>
                        <td colspan="5"></td>
                        <td class="amount">${fmt(cnsTotal)}</td>
                        <td colspan="5"></td>
                    </tr>
                ` : ''}
            </tbody>
        </table>
    `;
};

const billTable = (
    payload: PartyLedgerReportPayload,
    rows: BillRow[],
    isLast: boolean,
    rowCapacity: number,
    isCoverPage: boolean,
) => {
    const totals = activeBillTotals(payload.billRows);
    const activeCount = payload.billRows.filter((row) => row.status === 'ACTIVE').length;
    return `
        <div class="section-head">
            <span>B. Billing Records</span>
            <span>${payload.billRows.length} bills | ${activeCount} active</span>
        </div>
        <table class="items-table bill-table">
            <thead>
                <tr>
                    <th style="width:14%;">Bill No</th>
                    <th style="width:8%;">Date</th>
                    <th style="width:24%;">CNS Covered</th>
                    <th style="width:6%;">CNS</th>
                    <th style="width:11%;">CNS Total</th>
                    <th style="width:11%;">Billed</th>
                    <th style="width:9%;">Paid</th>
                    <th style="width:9%;">Balance</th>
                    <th style="width:8%;">Status</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row) => `
                    <tr>
                        <td>${titleText(row.billNo)}</td>
                        <td class="center">${titleText(row.date)}</td>
                        <td>${titleText(row.coveredCns)}</td>
                        <td class="amount">${fmt(row.cnCount)}</td>
                        <td class="amount">${fmt(row.cnTotal)}</td>
                        <td class="amount">${fmt(row.billedAmount)}</td>
                        <td class="amount">${fmt(row.paidAmount)}</td>
                        <td class="amount">${fmt(row.balance)}</td>
                        <td class="status-cell ${statusClass(row.status)}">${titleText(row.status)}</td>
                    </tr>
                `).join('')}
                ${isCoverPage ? '' : blankRows(Math.max(0, rowCapacity - rows.length), 9)}
                ${isLast ? `
                    <tr class="total-row">
                        <td class="total-label">ACTIVE TOTAL</td>
                        <td></td>
                        <td></td>
                        <td class="count">${fmt(totals.cnCount)}</td>
                        <td class="amount">${fmt(totals.cnTotal)}</td>
                        <td class="amount">${fmt(totals.billed)}</td>
                        <td class="amount">${fmt(totals.paid)}</td>
                        <td class="amount">${fmt(totals.balance)}</td>
                        <td></td>
                    </tr>
                ` : ''}
            </tbody>
        </table>
    `;
};

const paymentTable = (
    payload: PartyLedgerReportPayload,
    rows: PaymentRow[],
    isLast: boolean,
    rowCapacity: number,
    isCoverPage: boolean,
) => `
    <div class="section-head">
        <span>C. Payment Receipts</span>
        <span>${payload.paymentRows.length} receipts | Active received ${fmt(activePaymentTotal(payload.paymentRows))}</span>
    </div>
    <table class="items-table payment-table">
        <thead>
            <tr>
                <th style="width:10%;">Date</th>
                <th style="width:12%;">Mode</th>
                <th style="width:18%;">Reference</th>
                <th style="width:42%;">Linked Bills</th>
                <th style="width:11%;">Amount</th>
                <th style="width:7%;">Status</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map((row) => `
                <tr>
                    <td class="center">${titleText(row.date)}</td>
                    <td class="center">${titleText(row.mode)}</td>
                    <td>${titleText(row.reference)}</td>
                    <td>${titleText(row.linkedBills)}</td>
                    <td class="amount">${fmt(row.amount)}</td>
                    <td class="status-cell ${statusClass(row.status)}">${titleText(row.status)}</td>
                </tr>
            `).join('')}
            ${isCoverPage ? '' : blankRows(Math.max(0, rowCapacity - rows.length), 6)}
            ${isLast ? `
                <tr class="total-row">
                    <td class="total-label">ACTIVE TOTAL</td>
                    <td colspan="3"></td>
                    <td class="amount">${fmt(activePaymentTotal(payload.paymentRows))}</td>
                    <td></td>
                </tr>
            ` : ''}
        </tbody>
    </table>
`;

const sectionTable = (payload: PartyLedgerReportPayload, page: SectionPage) => {
    if (page.kind === 'cns') {
        return cnsTable(payload, page.rows, page.isLast, page.rowCapacity, page.isCoverPage);
    }
    if (page.kind === 'bills') {
        return billTable(payload, page.rows, page.isLast, page.rowCapacity, page.isCoverPage);
    }
    return paymentTable(payload, page.rows, page.isLast, page.rowCapacity, page.isCoverPage);
};

const summaryTiles = (summary: LedgerSummary) => `
    <div class="summary-grid">
        <div class="summary-tile"><span>Total CNS</span><strong>${fmt(summary.totalCnsAmount)}</strong><small>${summary.totalCnsCount} consignments</small></div>
        <div class="summary-tile good"><span>Billed CNS</span><strong>${fmt(summary.billedCnsAmount)}</strong><small>${summary.billedCnsCount} billed</small></div>
        <div class="summary-tile warning"><span>Unbilled</span><strong>${fmt(summary.unbilledCnsAmount)}</strong><small>${summary.unbilledCnsCount} pending</small></div>
        <div class="summary-tile"><span>Total Billed</span><strong>${fmt(summary.totalBilledAmount)}</strong><small>Active bills</small></div>
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
                <span>Type:</span> ${titleText(payload.party.type)}
                <span>Branch:</span> ${titleText(payload.party.branch_code)}
                <span>GSTIN:</span> ${titleText(payload.party.gstin)}
            </div>
        </div>
        <div class="right-block">
            <div class="meta-row"><div class="meta-label">Report :</div><div class="meta-value">Party Ledger</div></div>
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
            ${isCoverPage ? reportCoverHtml(payload, logoUrl) : ''}
            <div class="section-wrap">${sectionTable(payload, page)}</div>
            <div class="footer-row">
                <span>${titleText(payload.party.name)}</span>
                <span>Page ${pageIndex + 1} of ${pageCount}</span>
            </div>
        </div>
    </div>
`;
};

const htmlDocument = (payload: PartyLedgerReportPayload, pages: SectionPage[], logoUrl: string) => `<!DOCTYPE html>
<html>
<head>
<title>${titleText(payload.party.code)} Party Ledger</title>
<style>
@page { size: A4 landscape; margin: 5mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
.page { width: 287mm; height: 200mm; max-height: 200mm; margin: 0 auto; padding: 0; background: #fff; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: auto; }
.sheet { border: 1.2px solid #1d2f7a; height: 100%; display: flex; flex-direction: column; overflow: visible; }
.header-band, .detail-grid, .summary-grid, .section-wrap, .footer-row { flex-shrink: 0; }
.page--continuation .section-head { margin-top: 0; }
.header-band { border-bottom: 1.2px solid #1d2f7a; display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; column-gap: 8px; padding: 7px 12px 5px; }
.header-logo { display: flex; align-items: center; justify-content: flex-start; }
.header-logo img { width: 102px; max-width: 100%; filter: grayscale(1) contrast(1.6) brightness(0.2); object-fit: contain; }
.header-copy { text-align: center; }
.header-title { font-size: 16px; font-weight: 800; letter-spacing: 0.2px; color: #17308b; }
.header-line { display: flex; justify-content: center; gap: 34px; font-size: 11px; font-weight: 700; margin-top: 3px; line-height: 1.3; }
.header-line.contact { display: inline-block; margin-top: 3px; margin-bottom: 5px; padding: 0 6px 5px; border-bottom: 1.2px solid #1d2f7a; }
.header-pan { text-align: right; font-size: 11px; font-weight: 800; line-height: 1.35; }
.header-pan span { color: #1d2f7a; }
.detail-grid { display: grid; grid-template-columns: 56% 44%; min-height: 63px; border-bottom: 1.2px solid #1d2f7a; }
.party-block { border-right: 1.2px solid #1d2f7a; display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 7px 10px; min-width: 0; }
.party-name { font-size: 12px; font-weight: 800; text-transform: uppercase; overflow-wrap: anywhere; line-height: 1.2; }
.party-line { font-size: 9.6px; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
.party-line span { margin-left: 8px; color: #1d2f7a; font-weight: 800; }
.party-line span:first-child { margin-left: 0; }
.right-block { display: grid; grid-template-rows: repeat(3, 1fr); }
.meta-row { display: grid; grid-template-columns: 27% 73%; border-bottom: 1.2px solid #1d2f7a; min-height: 21px; }
.meta-row:last-child { border-bottom: none; }
.meta-label { border-right: 1.2px solid #1d2f7a; display: flex; align-items: center; padding: 3px 6px; color: #1d2f7a; font-size: 9.5px; font-weight: 800; }
.meta-value { display: flex; align-items: center; justify-content: center; min-width: 0; padding: 3px 6px; font-size: 10.2px; font-weight: 800; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.summary-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5px; padding: 8px; border-bottom: 1.2px solid #1d2f7a; align-items: stretch; }
.summary-tile { min-width: 0; min-height: 42px; border: 1px solid rgba(29, 47, 122, 0.55); background: rgba(29, 47, 122, 0.08); padding: 5px 6px 4px; overflow: visible; display: flex; flex-direction: column; justify-content: flex-start; gap: 1px; }
.summary-tile span, .summary-tile small { display: block; line-height: 1.35; overflow: visible; white-space: nowrap; }
.summary-tile span { color: #1d2f7a; font-size: 8px; font-weight: 800; text-transform: uppercase; }
.summary-tile strong { display: block; color: #111; font-size: 11px; font-weight: 800; line-height: 1.35; overflow: visible; white-space: nowrap; }
.summary-tile small { color: #4c5675; font-size: 7.5px; font-weight: 700; line-height: 1.3; }
.summary-tile.good { background: rgba(61, 166, 104, 0.11); }
.summary-tile.warning { background: rgba(255, 207, 84, 0.22); }
.summary-tile.danger { background: rgba(235, 93, 93, 0.12); }
.section-head { margin: 8px 0 0; border-top: 1.2px solid #1d2f7a; border-bottom: 1.2px solid #1d2f7a; background: rgba(29, 47, 122, 0.12); display: flex; justify-content: space-between; gap: 8px; padding: 7px 8px; color: #1d2f7a; font-size: 10.6px; font-weight: 800; text-transform: uppercase; line-height: 1.35; flex-shrink: 0; }
.section-head span { overflow: visible; }
.items-table { width: 100%; border-collapse: collapse; table-layout: fixed; border-bottom: 1.2px solid #1d2f7a; }
.items-table th, .items-table td { border-right: 1.2px solid #1d2f7a; border-bottom: 1.2px solid #1d2f7a; padding: 4px 4px 5px; vertical-align: middle; overflow: hidden; }
.items-table th:last-child, .items-table td:last-child { border-right: none; }
.items-table thead th { color: #1d2f7a; background: rgba(29, 47, 122, 0.12); text-align: center; font-size: 9.6px; font-weight: 800; line-height: 1.22; padding-top: 6px; padding-bottom: 7px; }
.items-table tbody td { min-height: 19px; height: 19px; color: #111; font-size: 8.8px; font-weight: 700; line-height: 1.15; white-space: nowrap; text-overflow: ellipsis; }
.items-table tbody td.status-cell { text-align: center; vertical-align: middle; font-size: 7.5px; font-weight: 800; color: #1d2f7a; background: rgba(29, 47, 122, 0.08); padding: 3px 4px; white-space: nowrap; }
.items-table tbody td.status-cell.ok { color: #11653d; background: rgba(41, 171, 105, 0.14); }
.items-table tbody td.status-cell.bad { color: #a32727; background: rgba(221, 81, 81, 0.13); }
.items-table tbody td.status-cell.warn { color: #8b5a08; background: rgba(235, 174, 55, 0.18); }
.items-table tbody td.status-cell.wait { color: #8b5a08; background: rgba(235, 174, 55, 0.18); }
.cns-table tbody td:nth-child(3),
.cns-table tbody td:nth-child(5),
.cns-table tbody td:nth-child(6),
.cns-table tbody td:nth-child(9),
.bill-table tbody td:nth-child(3),
.payment-table tbody td:nth-child(3),
.payment-table tbody td:nth-child(4) { height: auto; white-space: normal; word-break: break-word; overflow-wrap: anywhere; overflow: hidden; text-overflow: clip; vertical-align: top; padding-top: 3px; padding-bottom: 3px; }
.cns-table tbody td:nth-child(3) { word-break: break-all; }
.bill-table tbody td, .payment-table tbody td { font-size: 9.2px; }
.items-table .center { text-align: center; }
.items-table .amount { text-align: right; padding-right: 6px; font-variant-numeric: tabular-nums; }
.items-table .count { text-align: center; font-variant-numeric: tabular-nums; }
.blank-row td { font-weight: 400; background: #fff; }
.total-row td { height: 23px; background: rgba(29, 47, 122, 0.12); color: #111; font-size: 9.7px; font-weight: 800; }
.total-label { color: #1d2f7a !important; }
.footer-row { margin-top: auto; border-top: 1.2px solid #1d2f7a; display: flex; justify-content: space-between; gap: 8px; padding: 6px 9px; color: #1d2f7a; font-size: 8.7px; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
.footer-row span { overflow: hidden; text-overflow: ellipsis; }
</style>
</head>
<body>
${pages.map((page, index) => pageHtml(payload, page, logoUrl, index, pages.length)).join('')}
</body>
</html>`;

export const downloadPartyLedgerReportPdf = async (payload: PartyLedgerReportPayload): Promise<void> => {
    const pages = buildSectionPages(payload);
    if (pages.length === 0) throw new Error('No ledger rows found for this report');

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
        doc.write(htmlDocument(payload, pages, logoUrl));
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
            const canvas = await html2canvas(page, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: page.scrollWidth,
                height: page.scrollHeight,
                windowWidth: page.scrollWidth,
                windowHeight: page.scrollHeight,
            });
            if (index > 0) pdf.addPage('a4', 'landscape');
            const imgWidthMm = 287;
            const imgHeightMm = Math.min(200, (canvas.height / canvas.width) * imgWidthMm);
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, 5, imgWidthMm, imgHeightMm, undefined, 'FAST');
        }

        const partyCode = String(payload.party.code || 'ledger').replace(/[^a-zA-Z0-9_-]/g, '') || 'ledger';
        const period = payload.periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
        pdf.save(`${partyCode}-ledger-${period}.pdf`);
    } finally {
        iframe.remove();
    }
};
