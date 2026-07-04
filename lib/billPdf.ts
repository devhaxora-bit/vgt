import type { BillingVehicleCancelItem } from '@/lib/billingVehicleCancel';
import { PDF_HEADER_LOGO_IMG_CSS, PDF_HEADER_TITLE_COLOR, PDF_TABLE_HEADER_BG, PDF_TABLE_HEADER_TEXT_COLOR } from '@/lib/pdfLogo';

export type BillPdfDetailRow = {
    cnNo: string;
    isFreightIncluded?: boolean;
    date: string;
    invoiceNo: string;
    vehicleNo: string;
    loadingStation: string;
    deliveryStation: string;
    chargeWt: string;
    rate: string;
    freight: string;
    unloading: string;
    detention: string;
    extraKm: string;
    loading: string;
    otherCharges: string;
    totalAmount: string;
};

export type BillPdfPayload = {
    logoUrl: string;
    partyName: string;
    addressLine1: string;
    addressStateLine: string;
    partyGstin: string | null;
    branchDisplay: string;
    billRefNo: string;
    billRefFallback: string;
    billingDate: string;
    displayTotal: number;
    amountWords: string;
    narrationHtml: string;
    detailRows: BillPdfDetailRow[];
    vehicleCancelItems: BillingVehicleCancelItem[];
    status: string;
};

type BillPrintableRow =
    | { kind: 'detail'; row: BillPdfDetailRow }
    | { kind: 'vehicle-cancel'; item: BillingVehicleCancelItem };

type BillPageSlice = {
    rows: BillPrintableRow[];
    isFirst: boolean;
    isLast: boolean;
    blankCount: number;
};

const BILL_TABLE_COLUMNS = 15;
const PAGE_LAYOUT_BUFFER_PX = 16;
const fmtNum = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const fmt = (value: number) => fmtNum.format(value || 0);

const safe = (value: string | number | null | undefined) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toUpperText = (value?: string | null) => String(value || '').trim().toUpperCase();

const fmtDotDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}.${month}.${year}`;
};

const flattenPrintableRows = (payload: BillPdfPayload): BillPrintableRow[] => [
    ...payload.detailRows.map((row) => ({ kind: 'detail' as const, row })),
    ...payload.vehicleCancelItems.map((item) => ({ kind: 'vehicle-cancel' as const, item })),
];

const billTableHeadHtml = () => `
    <thead>
        <tr>
            <th style="width:4%;">CNS<br/>No</th>
            <th style="width:6.5%;">Date</th>
            <th style="width:13%;">Invoice<br/>No</th>
            <th style="width:8%;">Vehicle no.</th>
            <th style="width:10%;">Loading<br/>Station</th>
            <th style="width:10%;">Destination</th>
            <th style="width:6.5%;">Charge Wt.</th>
            <th style="width:5.5%;">Rate</th>
            <th style="width:5%;">Freight</th>
            <th style="width:6%;">Detention</th>
            <th style="width:5.5%;">Loading</th>
            <th style="width:5.5%;">Unload</th>
            <th style="width:5.5%;">Extra KM</th>
            <th style="width:5%;">Other<br/>Charg</th>
            <th style="width:6.5%;">Total Billed<br/>Amount</th>
        </tr>
    </thead>
`;

const detailRowHtml = (row: BillPdfDetailRow) => `
    <tr class="item-row">
        <td class="center cn-cell${row.isFreightIncluded ? ' incl' : ''}">${safe(row.cnNo)}</td>
        <td class="center">${safe(row.date)}</td>
        <td class="center invoice-cell">${safe(row.invoiceNo)}</td>
        <td class="center name-cell">${safe(row.vehicleNo)}</td>
        <td class="center name-cell">${safe(row.loadingStation)}</td>
        <td class="center name-cell">${safe(row.deliveryStation)}</td>
        <td class="center">${safe(row.chargeWt)}</td>
        <td class="center">${safe(row.rate)}</td>
        <td class="amount">${safe(row.freight)}</td>
        <td class="amount">${safe(row.detention)}</td>
        <td class="amount">${safe(row.loading)}</td>
        <td class="amount">${safe(row.unloading)}</td>
        <td class="amount">${safe(row.extraKm)}</td>
        <td class="amount">${safe(row.otherCharges)}</td>
        <td class="amount">${safe(row.totalAmount)}</td>
    </tr>
`;

const vehicleCancelRowHtml = (item: BillingVehicleCancelItem) => `
    <tr class="item-row vehicle-cancel-row">
        <td class="center">&nbsp;</td>
        <td class="center">${fmtDotDate(item.cancellation_date)}</td>
        <td class="center">&nbsp;</td>
        <td class="center name-cell">${toUpperText(item.vehicle_no) || '—'}</td>
        <td class="center name-cell">${toUpperText(item.from_station) || '—'}</td>
        <td class="center name-cell">${toUpperText(item.to_station) || '—'}</td>
        <td colspan="8" class="center vehicle-cancel-label">VEHICLE CANCELLATION CHARGES</td>
        <td class="amount vehicle-cancel-amount">${fmt(item.charges)}</td>
    </tr>
`;

const printableRowHtml = (entry: BillPrintableRow) =>
    entry.kind === 'detail' ? detailRowHtml(entry.row) : vehicleCancelRowHtml(entry.item);

const blankRowsHtml = (count: number) => Array.from({ length: count }, () => `
    <tr class="item-row blank-row">
        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
    </tr>
`).join('');

const totalRowHtml = (displayTotal: number) => `
    <tr class="total-row">
        <td colspan="14" class="total-label">TOTAL</td>
        <td class="amount" style="color: #111; font-weight: 900;">${fmt(displayTotal)}</td>
    </tr>
`;

const billStyles = () => `
@page { size: A4 landscape; margin: 5mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
.page { width: 287mm; height: 200mm; max-height: 200mm; margin: 0 auto; padding: 6mm 10mm; background: #fff; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: auto; }
.sheet { border: 1.2px solid #1d2f7a; height: 100%; max-height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.header-band { border-bottom: 1.2px solid #1d2f7a; display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; column-gap: 8px; padding: 7px 12px 5px; flex-shrink: 0; }
.header-logo { display: flex; align-items: center; justify-content: flex-start; }
.header-logo img { ${PDF_HEADER_LOGO_IMG_CSS} }
.header-copy { text-align: center; }
.header-title { font-size: 16px; font-weight: 800; letter-spacing: 0.2px; color: ${PDF_HEADER_TITLE_COLOR}; }
.header-line { display: flex; justify-content: center; gap: 34px; font-size: 11px; font-weight: 700; margin-top: 3px; line-height: 1.3; }
.header-line.contact { display: inline-block; margin-top: 3px; margin-bottom: 5px; padding: 0 6px 5px; border-bottom: 1.2px solid #1d2f7a; }
.detail-grid { display: grid; grid-template-columns: 56% 44%; border-bottom: 1.2px solid #1d2f7a; align-items: stretch; flex-shrink: 0; }
.party-block { border-right: 1.2px solid #1d2f7a; display: flex; flex-direction: column; justify-content: center; gap: 8px; padding: 8px 10px; }
.party-line { font-size: 11px; font-weight: 800; text-transform: uppercase; line-height: 1.24; overflow-wrap: anywhere; word-break: break-word; }
.party-address-line2 { display: block; margin-top: 4px; }
.right-block { display: grid; grid-template-rows: 44px minmax(50px, 1fr); height: 100%; }
.branch-row { border-bottom: 1.2px solid #1d2f7a; display: grid; grid-template-columns: 24% 76%; align-items: stretch; }
.branch-label { border-right: 1.2px solid #1d2f7a; padding: 4px 6px; font-size: 10px; font-weight: 800; line-height: 1.15; display: flex; align-items: center; color: #1d2f7a; }
.branch-value { display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #111; padding: 4px 6px; }
.bill-row { display: grid; grid-template-columns: 42% 16% 42%; align-items: stretch; min-height: 50px; }
.bill-cell { border-right: 1.2px solid #1d2f7a; padding: 4px 6px; font-size: 10px; font-weight: 700; line-height: 1.12; display: flex; align-items: center; }
.bill-cell:last-child { border-right: none; }
.bill-cell.center { text-align: center; justify-content: center; }
.bill-cell.value { font-size: 13px; font-weight: 800; }
.table-wrap { min-height: 0; flex: 1 1 auto; overflow: visible; display: flex; flex-direction: column; }
.items-table { width: 100%; border-collapse: collapse; table-layout: fixed; border-top: 1.2px solid #1d2f7a; }
.page--first .items-table { margin-top: 5px; }
.page--continuation .items-table { margin-top: 0; border-top: none; }
.items-table th, .items-table td { border-right: 1.2px solid #1d2f7a; border-bottom: 1.2px solid #1d2f7a; padding: 5px 3px 6px; font-size: 10.8px; vertical-align: middle; }
.items-table th:last-child, .items-table td:last-child { border-right: none; }
.items-table thead th { text-align: center; font-size: 10px; font-weight: 800; line-height: 1.18; padding: 2px 3px 9px; vertical-align: middle; color: ${PDF_TABLE_HEADER_TEXT_COLOR}; background: ${PDF_TABLE_HEADER_BG}; }
.items-table tbody td { height: 24px; font-weight: 700; line-height: 1.15; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.invoice-cell, .name-cell, .cn-cell { height: auto !important; white-space: normal !important; word-break: break-word !important; overflow: hidden !important; vertical-align: middle !important; padding-top: 4px !important; padding-bottom: 4px !important; }
.invoice-cell { word-break: break-all !important; }
.cn-cell.incl { color: #1d4ed8; font-weight: 800; font-size: 9.6px; line-height: 1.2; }
.items-table .center { text-align: center; }
.items-table .amount { text-align: right; padding-right: 8px; }
.blank-row td { font-weight: 400; }
.vehicle-cancel-row td { font-size: 10.8px; }
.vehicle-cancel-label { font-size: 10.8px; font-weight: 800; color: #1d2f7a; letter-spacing: 0.1px; white-space: nowrap !important; overflow: visible !important; text-overflow: clip !important; }
.vehicle-cancel-amount { font-size: 10.8px; }
.total-row td { height: 24px; max-height: 24px; min-height: 24px; font-size: 10.8px; font-weight: 800; padding: 5px 3px 6px; line-height: 1.15; vertical-align: middle; overflow: visible !important; text-overflow: clip !important; }
.total-label { text-align: right; padding-right: 8px; color: #1d2f7a; font-size: 10.8px; white-space: nowrap !important; }
.total-row .amount { font-size: 10.8px; font-weight: 900; }
.bill-footer { flex-shrink: 0; }
.words-row { border-bottom: 1.2px solid #1d2f7a; padding: 7px 10px 8px; text-align: center; font-size: 10px; font-weight: 800; line-height: 1.25; }
.notes-block { min-height: 38px; border-bottom: 1.2px solid #1d2f7a; padding: 6px 8px; font-size: 10px; font-weight: 700; line-height: 1.5; color: #111; }
.remark-title { margin-bottom: 4px; font-weight: 800; color: #1d2f7a; }
.footer-grid { display: grid; grid-template-columns: 65% 35%; }
.bank-block { border-right: 1.2px solid #1d2f7a; padding: 0 10px; font-size: 9.2px; font-weight: 700; line-height: 1.45; color: #111; display: grid; grid-template-columns: 1fr 1.2px 1.05fr; gap: 10px; align-items: stretch; }
.bank-details-sub { display: flex; flex-direction: column; justify-content: center; padding: 3px 0; }
.bank-divider { background-color: #1d2f7a; width: 1.2px; height: 100%; }
.eway-sub { display: flex; flex-direction: column; justify-content: center; line-height: 1.45; padding: 3px 0; }
.bank-title { font-size: 9.4px; font-weight: 800; color: #1d2f7a; }
.signature-block { padding: 6px 8px 8px; display: flex; align-items: flex-start; justify-content: center; }
.signature-inner { width: 100%; text-align: center; font-size: 9.4px; font-weight: 700; line-height: 1.45; }
.signature-company { font-size: 10.5px; font-weight: 800; margin-bottom: 16px; color: #1d2f7a; }
.signature-name { margin-top: 10px; color: #111; }
.signature-role { font-size: 9.4px; font-weight: 800; color: #1d2f7a; }
#measure-root { position: absolute; left: -20000px; top: 0; width: 287mm; visibility: hidden; pointer-events: none; }
`;

const headerBandHtml = (logoUrl: string) => `
    <div class="header-band">
        <div class="header-logo">
            <img src="${safe(logoUrl)}" alt="VGT Logo" />
        </div>
        <div class="header-copy">
            <div class="header-title">VISAKHA GOLDEN TRANSPORT</div>
            <div class="header-line">
                <span>D. NO. 8-19-58/A, GOPAL NAGAR, NEAR BANK COLONY, VIZIANAGARAM, ANDHRA PRADESH - 535003</span>
            </div>
            <div class="header-line contact">Contact:9392223404,8756314575 Email:vsp@visakhagolden.com</div>
        </div>
        <div style="text-align: right; font-size: 11px; font-weight: 800; line-height: 1.35;">
            <span style="color: #1d2f7a;">PAN NO:</span><br/><span style="color: #111;">AAWFV7670H</span>
        </div>
    </div>
`;

const detailGridHtml = (payload: BillPdfPayload) => `
    <div class="detail-grid">
        <div class="party-block">
            <div class="party-line" style="color: #111;">${safe(payload.partyName)}</div>
            <div class="party-line" style="color: #111;">
                ${safe(payload.addressLine1)}
                ${payload.addressStateLine ? `<span class="party-address-line2">${safe(payload.addressStateLine)}</span>` : ''}
            </div>
            <div class="party-line" style="color: #111; display: flex; align-items: center;">
                ${payload.partyGstin ? `<span><span style="color: #1d2f7a; font-weight: 800;">GSTIN:</span> <span style="font-weight: 800;">${toUpperText(payload.partyGstin)}</span></span>` : '&nbsp;'}
            </div>
        </div>
        <div class="right-block">
            <div class="branch-row">
                <div class="branch-label">Issuing<br/>Branch :</div>
                <div class="branch-value">${safe(payload.branchDisplay)}</div>
            </div>
            <div class="bill-row">
                <div class="bill-cell value">
                    <span style="color: #1d2f7a; font-weight: 800; margin-right: 4px;">Bill No.</span>
                    <span style="color: #cc1a1a; font-weight: 800;">${safe(payload.billRefNo || payload.billRefFallback)}</span>
                </div>
                <div class="bill-cell center" style="color: #1d2f7a; font-weight: 800;">Date.</div>
                <div class="bill-cell value center" style="color: #111;">${safe(payload.billingDate)}</div>
            </div>
        </div>
    </div>
`;

const billFooterHtml = (payload: BillPdfPayload) => `
    <div class="bill-footer">
        <div class="words-row">
            <span style="color: #1d2f7a; font-weight: 800; margin-right: 4px;">Rupees In Words:-</span>
            <span style="color: #111;">${safe(payload.amountWords)}</span>
        </div>
        <div class="notes-block">
            ${payload.narrationHtml || '&nbsp;'}
        </div>
        <div class="footer-grid">
            <div class="bank-block">
                <div class="bank-details-sub">
                    <div class="bank-title">Bank Details: Visakha Golden Transport</div>
                    <div><span style="color: #1d2f7a; font-weight: 700;">A/C No:</span> 070205500602</div>
                    <div><span style="color: #1d2f7a; font-weight: 700;">IFSC Code:</span> ICIC0000702</div>
                    <div>ICICI Bank Vizianagaram</div>
                </div>
                <div class="bank-divider"></div>
                <div class="eway-sub">
                    <div style="color: #1d2f7a; font-weight: 800; font-size: 9.5px; text-transform: uppercase;">GST PAYABLE BY UNDER REVERSE CHARGE MECHANISM</div>
                    <div style="margin-top: 2px;"><span style="color: #1d2f7a; font-weight: 800; font-size: 9.5px;">Ewaybill id:</span> <span style="font-weight: 800; font-size: 9.5px; color: #111;">37AAWFV7670H1Z8</span></div>
                </div>
            </div>
            <div class="signature-block">
                <div class="signature-inner">
                    <div class="signature-company">For Visakha Golden Transport</div>
                    <div class="signature-name">${payload.status === 'CANCELLED' ? 'Cancelled Bill' : '&nbsp;'}</div>
                    <div class="signature-role">(Authorized Signatory)</div>
                </div>
            </div>
        </div>
    </div>
`;

type BillLayoutHeights = {
    sheetHeight: number;
    headerHeight: number;
    detailHeight: number;
    footerHeight: number;
    theadHeight: number;
    contSheetHeight: number;
};

const readLayoutHeights = (doc: Document): BillLayoutHeights => {
    const singlePage = doc.getElementById('measure-single-page');
    const contPage = doc.getElementById('measure-cont-page');
    const sheet = singlePage?.querySelector<HTMLElement>('.sheet');
    const header = singlePage?.querySelector<HTMLElement>('.header-band');
    const detail = singlePage?.querySelector<HTMLElement>('.detail-grid');
    const footer = singlePage?.querySelector<HTMLElement>('.bill-footer');
    const thead = singlePage?.querySelector<HTMLElement>('.items-table thead');
    const contSheet = contPage?.querySelector<HTMLElement>('.sheet');

    return {
        sheetHeight: sheet?.offsetHeight || 700,
        headerHeight: header?.offsetHeight || 88,
        detailHeight: detail?.offsetHeight || 98,
        footerHeight: footer?.offsetHeight || 118,
        theadHeight: thead?.offsetHeight || 30,
        contSheetHeight: contSheet?.offsetHeight || 700,
    };
};

const sumRowHeights = (rowHeights: number[], start = 0) =>
    rowHeights.slice(start).reduce((sum, height) => sum + height, 0);

const measureBillPages = (doc: Document, rows: BillPrintableRow[]): BillPageSlice[] => {
    if (rows.length === 0) {
        return [{ rows: [], isFirst: true, isLast: true, blankCount: 0 }];
    }

    const layout = readLayoutHeights(doc);
    const rowEls = Array.from(doc.querySelectorAll<HTMLTableRowElement>('#measure-all-rows .item-row'));
    const rowHeights = rowEls.map((el) => el.offsetHeight);
    const blankRowEl = doc.querySelector<HTMLTableRowElement>('#measure-blank-row');
    const totalRowEl = doc.querySelector<HTMLTableRowElement>('#measure-total-row');
    const blankRowHeight = Math.max(blankRowEl?.offsetHeight || 24, 1);
    const totalRowHeight = totalRowEl?.offsetHeight || 24;

    const singlePageTbodyBudget = Math.max(
        blankRowHeight,
        layout.sheetHeight
            - layout.headerHeight
            - layout.detailHeight
            - layout.theadHeight
            - layout.footerHeight
            - totalRowHeight
            - PAGE_LAYOUT_BUFFER_PX,
    );

    const firstPageTbodyBudget = Math.max(
        blankRowHeight,
        layout.sheetHeight
            - layout.headerHeight
            - layout.detailHeight
            - layout.theadHeight
            - PAGE_LAYOUT_BUFFER_PX,
    );

    const contPageTbodyBudget = Math.max(
        blankRowHeight,
        layout.contSheetHeight - layout.theadHeight - PAGE_LAYOUT_BUFFER_PX,
    );

    const contLastPageTbodyBudget = Math.max(
        blankRowHeight,
        layout.contSheetHeight
            - layout.theadHeight
            - layout.footerHeight
            - totalRowHeight
            - PAGE_LAYOUT_BUFFER_PX,
    );

    const dataHeight = sumRowHeights(rowHeights);
    const singlePageContentHeight = dataHeight + totalRowHeight;

    if (singlePageContentHeight <= singlePageTbodyBudget) {
        const maxBlankRowsByBudget = Math.max(
            0,
            Math.floor((singlePageTbodyBudget - singlePageContentHeight) / blankRowHeight),
        );
        return [{
            rows,
            isFirst: true,
            isLast: true,
            // Let short single-page bills consume the available table height so
            // the footer sits closer to the total row without creating overlap.
            blankCount: maxBlankRowsByBudget,
        }];
    }

    const pages: BillPageSlice[] = [];
    let rowIndex = 0;

    while (rowIndex < rows.length) {
        const isFirst = pages.length === 0;
        const remainingDataHeight = sumRowHeights(rowHeights, rowIndex);
        const lastPageBudget = isFirst ? singlePageTbodyBudget : contLastPageTbodyBudget;

        if (remainingDataHeight + totalRowHeight <= lastPageBudget) {
            const blankCount = Math.max(
                0,
                Math.floor((lastPageBudget - remainingDataHeight - totalRowHeight) / blankRowHeight),
            );
            pages.push({
                rows: rows.slice(rowIndex),
                isFirst,
                isLast: true,
                blankCount,
            });
            break;
        }

        const bodyBudget = isFirst ? firstPageTbodyBudget : contPageTbodyBudget;
        const pageRows: BillPrintableRow[] = [];
        let usedHeight = 0;

        while (rowIndex < rows.length) {
            const rowHeight = rowHeights[rowIndex] ?? blankRowHeight;
            if (pageRows.length > 0 && usedHeight + rowHeight > bodyBudget) {
                break;
            }

            pageRows.push(rows[rowIndex]);
            usedHeight += rowHeight;
            rowIndex += 1;
        }

        if (pageRows.length === 0 && rowIndex < rows.length) {
            pageRows.push(rows[rowIndex]);
            usedHeight += rowHeights[rowIndex] ?? blankRowHeight;
            rowIndex += 1;
        }

        const isLast = rowIndex >= rows.length;
        const blankCount = isLast
            ? Math.max(0, Math.floor((lastPageBudget - usedHeight - totalRowHeight) / blankRowHeight))
            : 0;

        pages.push({
            rows: pageRows,
            isFirst,
            isLast,
            blankCount,
        });
    }

    if (pages.length > 0 && !pages.some((page) => page.isLast)) {
        const lastPage = pages[pages.length - 1];
        lastPage.isLast = true;
    }

    return pages;
};

const billTableHtml = (slice: BillPageSlice, displayTotal: number) => `
    <table class="items-table">
        ${billTableHeadHtml()}
        <tbody>
            ${slice.rows.map(printableRowHtml).join('')}
            ${blankRowsHtml(slice.blankCount)}
            ${slice.isLast ? totalRowHtml(displayTotal) : ''}
        </tbody>
    </table>
`;

const billPageHtml = (payload: BillPdfPayload, slice: BillPageSlice) => `
    <div class="page${slice.isFirst ? ' page--first' : ' page--continuation'}">
        <div class="sheet">
            ${slice.isFirst ? `${headerBandHtml(payload.logoUrl)}${detailGridHtml(payload)}` : ''}
            <div class="table-wrap">
                ${billTableHtml(slice, payload.displayTotal)}
            </div>
            ${slice.isLast ? billFooterHtml(payload) : ''}
        </div>
    </div>
`;

const measurementHtml = (payload: BillPdfPayload, rows: BillPrintableRow[]) => `<!DOCTYPE html>
<html>
<head><style>${billStyles()}</style></head>
<body>
<div id="measure-root">
    <div class="page page--first" id="measure-single-page">
        <div class="sheet">
            ${headerBandHtml(payload.logoUrl)}
            ${detailGridHtml(payload)}
            <div class="table-wrap">
                <table class="items-table">${billTableHeadHtml()}<tbody></tbody></table>
            </div>
            ${billFooterHtml(payload)}
        </div>
    </div>
    <div class="page page--continuation" id="measure-cont-page">
        <div class="sheet">
            <div class="table-wrap">
                <table class="items-table">${billTableHeadHtml()}<tbody></tbody></table>
            </div>
        </div>
    </div>
    <div id="measure-bill-footer">${billFooterHtml(payload)}</div>
    <table class="items-table" style="width:287mm">
        ${billTableHeadHtml()}
        <tbody id="measure-all-rows">
            ${rows.map(printableRowHtml).join('')}
            <tr class="item-row blank-row" id="measure-blank-row">${Array.from({ length: BILL_TABLE_COLUMNS }, () => '<td>&nbsp;</td>').join('')}</tr>
            <tr class="total-row" id="measure-total-row">
                <td colspan="14" class="total-label">TOTAL</td>
                <td class="amount">${fmt(payload.displayTotal)}</td>
            </tr>
        </tbody>
    </table>
</div>
</body>
</html>`;

export const buildBillPdfDocument = (payload: BillPdfPayload, pages: BillPageSlice[]) => `<!DOCTYPE html>
<html>
<head>
<title>${safe(payload.billRefNo || payload.billRefFallback)}</title>
<style>${billStyles()}</style>
</head>
<body>
${pages.map((slice) => billPageHtml(payload, slice)).join('')}
</body>
</html>`;

export const renderBillPdfPages = async (
    doc: Document,
    payload: BillPdfPayload,
): Promise<BillPageSlice[]> => {
    const rows = flattenPrintableRows(payload);

    doc.open();
    doc.write(measurementHtml(payload, rows));
    doc.close();

    await Promise.all(Array.from(doc.images).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
            image.onload = () => resolve();
            image.onerror = () => resolve();
        });
    }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    const pages = measureBillPages(doc, rows);

    doc.open();
    doc.write(buildBillPdfDocument(payload, pages));
    doc.close();

    await Promise.all(Array.from(doc.images).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
            image.onload = () => resolve();
            image.onerror = () => resolve();
        });
    }));
    await new Promise((resolve) => setTimeout(resolve, 250));

    return pages;
};

export const downloadBillPdfFromDocument = async (
    doc: Document,
    fileName: string,
): Promise<void> => {
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
            width: page.offsetWidth,
            height: page.offsetHeight,
            windowWidth: page.offsetWidth,
            windowHeight: page.offsetHeight,
        });
        if (index > 0) pdf.addPage('a4', 'landscape');
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, 5, 287, 200, undefined, 'FAST');
    }

    pdf.save(fileName);
};
