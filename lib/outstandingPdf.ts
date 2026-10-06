import { formatBranchLabel } from '@/lib/formatBranchLabel';
import { loadPdfLogo, PDF_HEADER_LOGO_IMG_CSS, PDF_TABLE_HEADER_BG, PDF_TABLE_HEADER_TEXT_COLOR, PDF_TABLE_STRIPE_BG } from '@/lib/pdfLogo';
import { savePdfWithWatermarks } from '@/lib/pdfWatermark';
import type { OutstandingPartyRow, OutstandingBill } from '@/app/api/outstanding/route';

export type OutstandingPdfFilters = {
    branch?: string;
    branchName?: string;
    search?: string;
    status?: string;
};

export type OutstandingPdfPayload = {
    rows: OutstandingPartyRow[];
    periodLabel: string;
    filters: OutstandingPdfFilters;
    generatedAt: string;
    /** Single-party statement: left header shows party name + address. */
    statementMode?: boolean;
};

const fmtNum = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const fmt = (value: number) => fmtNum.format(value || 0);

const safe = (value: string | number | null | undefined) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const fmtDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

const describeFilters = (filters: OutstandingPdfFilters, options?: { omitSearch?: boolean }) => {
    const parts: string[] = [];
    if (filters.branch) {
        parts.push(`Branch: ${formatBranchLabel(filters.branch, filters.branchName)}`);
    }
    if (filters.status) parts.push(`Status: ${filters.status}`);
    if (filters.search && !options?.omitSearch) parts.push(`Party: ${filters.search}`);
    return parts.length > 0 ? parts.join(' | ') : 'All Branches';
};

const billDateValue = (dateStr: string | null) => {
    if (!dateStr) return Number.POSITIVE_INFINITY;
    const parsed = Date.parse(dateStr);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
};

/** PDF shows oldest bills first (dashboard keeps newest-first). */
const sortBillsOldestFirst = (bills: OutstandingBill[]) =>
    [...bills].sort((a, b) => billDateValue(a.billing_date) - billDateValue(b.billing_date));

const buildBillRows = (bills: OutstandingBill[]) =>
    sortBillsOldestFirst(bills)
        .map(
            (bill) => `
    <tr class="bill-row">
        <td class="bill-no-cell">${safe(bill.bill_ref_no || '—')}</td>
        <td class="center">${safe(fmtDate(bill.billing_date))}</td>
        <td class="center">${safe(
            bill.pay_status === 'paid' ? 'Paid' : bill.pay_status === 'partial' ? 'Partial' : 'To be paid'
        )}</td>
        <td class="amount">${fmt(bill.amount)}</td>
        <td class="amount">${fmt(bill.paid_amount)}</td>
        <td class="amount outstanding-cell">${fmt(bill.outstanding)}</td>
    </tr>
`
        )
        .join('');

const buildPartyBlock = (party: OutstandingPartyRow) => {
    const address = String(party.party_address || '').trim();
    return `
    <tr class="party-header-row">
        <td colspan="6">
            <div class="party-header-line">
                <div class="party-header-main">
                    <span class="party-name">${safe(party.party_name)}</span>
                    ${address ? `<span class="party-address-inline">${safe(address)}</span>` : ''}
                </div>
                <span class="party-meta">
                    <span class="party-code">${safe(party.party_code)}</span>
                    ${party.branch_code ? `<span class="party-branch">${safe(party.branch_name || party.branch_code)}</span>` : ''}
                    <span class="party-bill-count">${party.bills.length} bill${party.bills.length !== 1 ? 's' : ''}</span>
                </span>
            </div>
        </td>
    </tr>
    ${buildBillRows(party.bills)}
    <tr class="subtotal-row">
        <td colspan="3" class="subtotal-label">Subtotal</td>
        <td class="amount">${fmt(party.total_billed)}</td>
        <td class="amount">${fmt(party.total_paid)}</td>
        <td class="amount outstanding-cell">${fmt(party.total_outstanding)}</td>
    </tr>
`;
};

const buildGrandTotals = (rows: OutstandingPartyRow[]) => {
    const totalBilled = rows.reduce((s, p) => s + p.total_billed, 0);
    const totalPaid = rows.reduce((s, p) => s + p.total_paid, 0);
    const totalOutstanding = rows.reduce((s, p) => s + p.total_outstanding, 0);
    const totalBills = rows.reduce((s, p) => s + p.bills.length, 0);
    return { totalBilled, totalPaid, totalOutstanding, totalBills };
};

const PARTY_ROWS_PER_PAGE = 6;

const buildPages = (rows: OutstandingPartyRow[]) => {
    const pages: OutstandingPartyRow[][] = [];
    let current: OutstandingPartyRow[] = [];
    let rowCount = 0;

    for (const party of rows) {
        const partyRowCount = party.bills.length + 2; // header + bills + subtotal
        if (rowCount > 0 && rowCount + partyRowCount > PARTY_ROWS_PER_PAGE * 3) {
            pages.push(current);
            current = [];
            rowCount = 0;
        }
        current.push(party);
        rowCount += partyRowCount;
    }
    if (current.length > 0) pages.push(current);
    if (pages.length === 0) pages.push([]);
    return pages;
};

const buildTableSection = (
    pageRows: OutstandingPartyRow[],
    allRows: OutstandingPartyRow[],
    isLastPage: boolean
) => {
    const totals = buildGrandTotals(allRows);
    return `
    <table class="items-table">
        <thead>
            <tr>
                <th style="width:20%;">Bill No.</th>
                <th style="width:12%;">Bill Date</th>
                <th style="width:12%;">Status</th>
                <th style="width:18%;">Bill Amount</th>
                <th style="width:18%;">Paid</th>
                <th style="width:20%;">Outstanding</th>
            </tr>
        </thead>
        <tbody>
            ${pageRows.map(buildPartyBlock).join('')}
            ${isLastPage ? `
            <tr class="grand-total-row">
                <td colspan="3" class="grand-total-label">
                    GRAND TOTAL
                </td>
                <td class="amount">${fmt(totals.totalBilled)}</td>
                <td class="amount">${fmt(totals.totalPaid)}</td>
                <td class="amount outstanding-cell">${fmt(totals.totalOutstanding)}</td>
            </tr>
            ` : ''}
        </tbody>
    </table>
    `;
};

const buildPartyStatementBlock = (party: OutstandingPartyRow, filters: OutstandingPdfFilters): string => {
    const secondary = describeFilters(filters, { omitSearch: true });
    const parts = [
        `<div class="party-title">${safe(party.party_name)}</div>`,
        `<div class="party-address">${safe(String(party.party_address || '').trim() || 'Address not available')}</div>`,
    ];

    const gstin = String(party.party_gstin || '').trim();
    if (gstin) {
        parts.push(
            `<div class="party-gstin"><span class="gstin-label">GSTIN:</span> ${safe(gstin.toUpperCase())}</div>`,
        );
    }
    if (secondary && secondary !== 'All Branches') {
        parts.push(`<div class="report-line muted">${safe(secondary)}</div>`);
    }

    return parts.join('');
};

const buildDetailLeftBlock = (
    payload: OutstandingPdfPayload,
    pageRows: OutstandingPartyRow[],
): string => {
    // Prefer the party on this page when the page is a single-party statement slice
    // (common when one party has many bills), or when the whole export is one party.
    const focusParty =
        payload.statementMode || payload.rows.length === 1
            ? payload.rows[0] ?? null
            : pageRows.length === 1
              ? pageRows[0]
              : null;

    if (!focusParty) {
        return [
            '<div class="report-title">Party Outstanding Report</div>',
            `<div class="report-line">${safe(describeFilters(payload.filters))}</div>`,
        ].join('');
    }

    return buildPartyStatementBlock(focusParty, payload.filters);
};

const buildPageHtml = (
    payload: OutstandingPdfPayload,
    pageRows: OutstandingPartyRow[],
    logoUrl: string,
    pageIndex: number,
    pageCount: number
) => `
<div class="page">
    <div class="sheet">
        <div class="header-band">
            <div class="header-logo"><img src="${safe(logoUrl)}" alt="VGT Logo" /></div>
            <div class="header-copy">
                <div class="header-title">VISAKHA GOLDEN TRANSPORT</div>
                <div class="header-line">
                    <span>D. NO. 8-19-58/A, GOPAL NAGAR, NEAR BANK COLONY, VIZIANAGARAM, ANDHRA PRADESH - 535003</span>
                </div>
                <div class="header-line contact">Contact:9392223404,8756314575 Email:vsp@visakhagolden.com</div>
            </div>
            <div class="header-pan">
                <span>PAN NO:</span><br/>AAWFV7670H
            </div>
        </div>
        <div class="detail-grid">
            <div class="report-block">
                ${buildDetailLeftBlock(payload, pageRows)}
            </div>
            <div class="right-block">
                <div class="meta-row">
                    <div class="meta-label">Period :</div>
                    <div class="meta-value">${safe(payload.periodLabel)}</div>
                </div>
                <div class="meta-row">
                    <div class="meta-label">Generated :</div>
                    <div class="meta-value">${safe(payload.generatedAt)}</div>
                </div>
            </div>
        </div>
        ${buildTableSection(pageRows, payload.rows, pageIndex === pageCount - 1)}
        <div class="footer-row">
            <span>${payload.rows.length} ${payload.rows.length === 1 ? 'party' : 'parties'}</span>
            <span>Page ${pageIndex + 1} of ${pageCount}</span>
        </div>
    </div>
</div>
`;

export const buildOutstandingHtml = (payload: OutstandingPdfPayload, logoUrl: string): string => {
    const pages = buildPages(payload.rows);
    return `<!DOCTYPE html>
<html>
<head>
<title>Party Outstanding Report</title>
<style>
@page { size: A4 landscape; margin: 5mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
.page { width: 287mm; min-height: 200mm; margin: 0 auto; padding: 6mm 10mm; background: #fff; page-break-after: always; }
.page:last-child { page-break-after: auto; }
.sheet { border: 1.2px solid #1d2f7a; min-height: 186mm; display: flex; flex-direction: column; overflow: hidden; }
.header-band { border-bottom: 1.2px solid #1d2f7a; display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; column-gap: 8px; padding: 7px 12px 5px; }
.header-logo { display: flex; align-items: center; justify-content: flex-start; }
.header-logo img { ${PDF_HEADER_LOGO_IMG_CSS} }
.header-copy { text-align: center; }
.header-title { font-size: 17px; font-weight: 800; letter-spacing: 0.2px; color: #17308b; }
.header-line { display: flex; justify-content: center; gap: 34px; font-size: 12px; font-weight: 700; margin-top: 3px; line-height: 1.3; }
.header-line.contact { display: inline-block; margin-top: 3px; margin-bottom: 5px; padding: 0 6px 5px; border-bottom: 1.2px solid #1d2f7a; }
.header-pan { text-align: right; font-size: 12px; font-weight: 800; line-height: 1.35; }
.header-pan span { color: #1d2f7a; }
.detail-grid { display: grid; grid-template-columns: 56% 44%; border-bottom: 1.2px solid #1d2f7a; align-items: stretch; min-height: 58px; }
.report-block { border-right: 1.2px solid #1d2f7a; display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 8px 10px; }
.report-title { color: #111; font-size: 14px; font-weight: 800; text-transform: uppercase; }
.report-line { font-size: 11px; font-weight: 700; color: #111; text-transform: uppercase; overflow-wrap: anywhere; }
.report-line.muted { font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase; }
.party-title { color: #111; font-size: 13px; font-weight: 800; line-height: 1.25; text-transform: uppercase; }
.party-address { color: #111; font-size: 11px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; white-space: normal; }
.party-gstin { font-size: 11px; font-weight: 800; color: #111; }
.party-gstin .gstin-label { color: #1d2f7a; margin-right: 4px; }
.right-block { display: grid; grid-template-rows: 1fr 1fr; }
.meta-row { display: grid; grid-template-columns: 28% 72%; min-height: 29px; border-bottom: 1.2px solid #1d2f7a; }
.meta-row:last-child { border-bottom: none; }
.meta-label { border-right: 1.2px solid #1d2f7a; display: flex; align-items: center; padding: 3px 6px 5px; color: #1d2f7a; font-size: 11px; font-weight: 800; }
.meta-value { display: flex; align-items: center; justify-content: center; min-width: 0; padding: 3px 6px 5px; font-size: 12px; font-weight: 800; text-align: center; overflow-wrap: anywhere; }
.items-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 12px; border-top: 1.2px solid #1d2f7a; }
.items-table th, .items-table td { border-right: 1.2px solid #1d2f7a; border-bottom: 1.2px solid #1d2f7a; padding: 5px 5px 6px; vertical-align: middle; overflow: hidden; }
.items-table th:last-child, .items-table td:last-child { border-right: none; }
.items-table thead th { text-align: center; font-size: 11.8px; font-weight: 800; line-height: 1.25; padding: 8px 4px 9px; color: ${PDF_TABLE_HEADER_TEXT_COLOR}; background: ${PDF_TABLE_HEADER_BG}; }
.items-table tbody td { height: 22px; font-size: 11.2px; font-weight: 700; line-height: 1.15; white-space: nowrap; text-overflow: ellipsis; }
.items-table .center { text-align: center; }
.items-table .amount { text-align: right; padding-right: 7px; font-variant-numeric: tabular-nums; }
.items-table .bill-no-cell { font-family: monospace; font-size: 10.5px; padding-left: 18px; }
.items-table .outstanding-cell:not(:empty) { background: rgba(255, 162, 162, 0.22); }
/* Party header — must override tbody td height/overflow or the name gets clipped */
.items-table tbody tr.party-header-row td {
    height: auto;
    min-height: 26px;
    padding: 7px 8px;
    overflow: visible;
    white-space: normal;
    line-height: 1.35;
    vertical-align: middle;
    background: rgba(144, 202, 249, 0.35);
    font-size: 12px;
    font-weight: 800;
    border-bottom: 1px solid #1d2f7a;
}
.party-header-line { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-width: 0; }
.party-header-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.party-name { display: block; color: #17308b; line-height: 1.35; white-space: normal; overflow: visible; text-overflow: unset; }
.party-address-inline { display: block; font-size: 10px; font-weight: 700; color: #333; line-height: 1.3; white-space: normal; overflow-wrap: anywhere; }
.party-meta { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; white-space: nowrap; }
.party-code { font-size: 10.5px; color: #555; font-family: monospace; background: rgba(0,0,0,0.06); padding: 0 5px; border-radius: 3px; }
.party-branch { font-size: 10.5px; color: #444; background: rgba(0,0,0,0.05); padding: 0 5px; border-radius: 3px; }
.party-bill-count { font-size: 10.5px; color: #555; font-family: monospace; }
/* Bill rows */
.bill-row:nth-child(odd) td { background: #fff; }
.bill-row:nth-child(even) td { background: ${PDF_TABLE_STRIPE_BG}; }
/* Subtotal */
.subtotal-row td { background: rgba(29, 47, 122, 0.07); font-size: 11.5px; font-weight: 800; border-top: 1px solid #1d2f7a; }
.subtotal-label { font-size: 11px; color: #555; }
/* Grand total */
.grand-total-row td { height: 40px; font-size: 14px; font-weight: 800; background: rgba(29, 47, 122, 0.12); color: #111; border-top: 2px solid #1d2f7a; }
.grand-total-label { font-size: 12px; color: #17308b; }
.footer-row { margin-top: auto; border-top: 1.2px solid #1d2f7a; display: flex; justify-content: space-between; padding: 6px 9px; color: #1d2f7a; font-size: 10px; font-weight: 800; text-transform: uppercase; }
</style>
</head>
<body>
${pages.map((pageRows, index) => buildPageHtml(payload, pageRows, logoUrl, index, pages.length)).join('')}
</body>
</html>`;
};

export const loadPdfLogoForOutstanding = loadPdfLogo;

export const downloadOutstandingPdf = async (payload: OutstandingPdfPayload): Promise<void> => {
    const logoUrl = await loadPdfLogo();
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
        if (!doc) throw new Error('Failed to create outstanding export document');

        doc.open();
        doc.write(buildOutstandingHtml(payload, logoUrl));
        doc.close();

        await Promise.all(
            Array.from(doc.images).map((img) => {
                if (img.complete) return Promise.resolve();
                return new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                });
            })
        );
        await new Promise((resolve) => setTimeout(resolve, 250));

        const pages = Array.from(doc.querySelectorAll<HTMLElement>('.page'));
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
        ]);

        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
            compress: true,
        });

        for (let index = 0; index < pages.length; index++) {
            const page = pages[index];
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
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, 5, 287, 200, undefined, 'FAST');
        }

        const safePeriod =
            payload.periodLabel
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'report';
        await savePdfWithWatermarks(pdf, `party-outstanding-${safePeriod}.pdf`);
    } finally {
        iframe.remove();
    }
};
