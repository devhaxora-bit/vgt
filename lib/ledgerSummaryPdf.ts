import { formatBranchLabel } from '@/lib/formatBranchLabel';

export type LedgerSummaryPartyRow = {
    party_code: string;
    party_name: string;
    branch_code: string | null;
    branch_name?: string | null;
    total_cns_count: number;
    total_cns_amount: number;
    total_billed: number;
    unbilled_amount: number;
    overbilled_amount: number;
    total_paid: number;
    outstanding: number;
};

export type LedgerSummaryPdfPayload = {
    rows: LedgerSummaryPartyRow[];
    periodLabel: string;
    filters: {
        branch?: string;
        branchName?: string;
        billingStatus?: string;
        paymentStatus?: string;
        outstandingOnly?: boolean;
    };
    generatedAt: string;
};

const PAGE_ROWS = 18;
const fmtNum = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const fmt = (value: number) => fmtNum.format(value || 0);
const safe = (value: string | number | null | undefined) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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

const splitRows = (rows: LedgerSummaryPartyRow[]) => {
    const pages: LedgerSummaryPartyRow[][] = [];
    for (let index = 0; index < rows.length; index += PAGE_ROWS) {
        pages.push(rows.slice(index, index + PAGE_ROWS));
    }
    return pages.length > 0 ? pages : [[]];
};

const describeFilters = (filters: LedgerSummaryPdfPayload['filters']) => {
    const values: string[] = [];
    if (filters.branch) {
        values.push(`Branch: ${formatBranchLabel(filters.branch, filters.branchName)}`);
    }
    if (filters.billingStatus) values.push(`Billing: ${filters.billingStatus.replace(/_/g, ' ')}`);
    if (filters.paymentStatus) values.push(`Payment: ${filters.paymentStatus.replace(/_/g, ' ')}`);
    if (filters.outstandingOnly) values.push('Outstanding Only');
    return values.length > 0 ? values.join(' | ') : 'All ledger parties';
};

const totalsFor = (rows: LedgerSummaryPartyRow[]) => ({
    cnsCount: rows.reduce((sum, row) => sum + Number(row.total_cns_count || 0), 0),
    cnsAmount: rows.reduce((sum, row) => sum + Number(row.total_cns_amount || 0), 0),
    billed: rows.reduce((sum, row) => sum + Number(row.total_billed || 0), 0),
    unbilled: rows.reduce((sum, row) => sum + Number(row.unbilled_amount || 0), 0),
    paid: rows.reduce((sum, row) => sum + Number(row.total_paid || 0), 0),
    outstanding: rows.reduce((sum, row) => sum + Number(row.outstanding || 0), 0),
});

const buildRow = (row: LedgerSummaryPartyRow) => `
    <tr>
        <td>${safe(row.party_code)}</td>
        <td class="party-name">${safe(row.party_name)}</td>
        <td class="center branch-cell">${safe(formatBranchLabel(row.branch_code, row.branch_name))}</td>
        <td class="amount">${fmt(row.total_cns_count)}</td>
        <td class="amount">${fmt(row.total_cns_amount)}</td>
        <td class="amount">${fmt(row.total_billed)}</td>
        <td class="amount unbilled">${fmt(row.unbilled_amount)}</td>
        <td class="amount">${fmt(row.total_paid)}</td>
        <td class="amount outstanding">${fmt(row.outstanding)}</td>
    </tr>
`;

const buildTable = (rows: LedgerSummaryPartyRow[], allRows: LedgerSummaryPartyRow[], isLastPage: boolean) => {
    const totals = totalsFor(allRows);
    const blankRows = Array.from({ length: Math.max(0, PAGE_ROWS - rows.length) }, () => `
        <tr class="blank-row">
            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
        </tr>
    `).join('');

    return `
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width:7%;">Code</th>
                    <th style="width:21%;">Party Name</th>
                    <th style="width:11%;">Branch</th>
                    <th style="width:5%;">CNS</th>
                    <th style="width:12%;">CNS<br/>Amount</th>
                    <th style="width:11%;">Billed</th>
                    <th style="width:11%;">Unbilled</th>
                    <th style="width:10%;">Paid</th>
                    <th style="width:12%;">Outstanding</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(buildRow).join('')}
                ${blankRows}
                ${isLastPage ? `
                    <tr class="total-row">
                        <td class="total-label">TOTAL</td>
                        <td>${allRows.length} parties</td>
                        <td></td>
                        <td class="amount">${fmt(totals.cnsCount)}</td>
                        <td class="amount">${fmt(totals.cnsAmount)}</td>
                        <td class="amount">${fmt(totals.billed)}</td>
                        <td class="amount">${fmt(totals.unbilled)}</td>
                        <td class="amount">${fmt(totals.paid)}</td>
                        <td class="amount">${fmt(totals.outstanding)}</td>
                    </tr>
                ` : ''}
            </tbody>
        </table>
    `;
};

const buildPage = (
    payload: LedgerSummaryPdfPayload,
    rows: LedgerSummaryPartyRow[],
    logoUrl: string,
    pageIndex: number,
    pageCount: number,
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
                    <div class="report-title">Party Ledger Summary Report</div>
                    <div class="report-line">${safe(describeFilters(payload.filters))}</div>
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
            ${buildTable(rows, payload.rows, pageIndex === pageCount - 1)}
            <div class="footer-row">
                <span>${payload.rows.length} parties</span>
                <span>Page ${pageIndex + 1} of ${pageCount}</span>
            </div>
        </div>
    </div>
`;

const buildHtml = (payload: LedgerSummaryPdfPayload, logoUrl: string) => {
    const pages = splitRows(payload.rows);
    return `<!DOCTYPE html>
<html>
<head>
<title>Ledger Summary</title>
<style>
@page { size: A4 landscape; margin: 5mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
.page { width: 287mm; min-height: 200mm; margin: 0 auto; padding: 6mm 10mm; background: #fff; page-break-after: always; }
.page:last-child { page-break-after: auto; }
.sheet { border: 1.2px solid #1d2f7a; min-height: 186mm; display: flex; flex-direction: column; overflow: hidden; }
.header-band { border-bottom: 1.2px solid #1d2f7a; display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; column-gap: 8px; padding: 7px 12px 5px; }
.header-logo { display: flex; align-items: center; justify-content: flex-start; }
.header-logo img { width: 102px; max-width: 100%; filter: grayscale(1) contrast(1.6) brightness(0.2); object-fit: contain; }
.header-copy { text-align: center; }
.header-title { font-size: 17px; font-weight: 800; letter-spacing: 0.2px; color: #17308b; }
.header-line { display: flex; justify-content: center; gap: 34px; font-size: 12px; font-weight: 700; margin-top: 3px; line-height: 1.3; }
.header-line.contact { display: inline-block; margin-top: 3px; margin-bottom: 5px; padding: 0 6px 5px; border-bottom: 1.2px solid #1d2f7a; }
.header-pan { text-align: right; font-size: 12px; font-weight: 800; line-height: 1.35; }
.header-pan span { color: #1d2f7a; }
.detail-grid { display: grid; grid-template-columns: 56% 44%; border-bottom: 1.2px solid #1d2f7a; align-items: stretch; min-height: 58px; }
.report-block { border-right: 1.2px solid #1d2f7a; display: flex; flex-direction: column; justify-content: center; gap: 7px; padding: 8px 10px; }
.report-title { color: #111; font-size: 14px; font-weight: 800; text-transform: uppercase; }
.report-line { font-size: 11px; font-weight: 700; color: #111; text-transform: uppercase; overflow-wrap: anywhere; }
.right-block { display: grid; grid-template-rows: 1fr 1fr; }
.meta-row { display: grid; grid-template-columns: 28% 72%; min-height: 29px; border-bottom: 1.2px solid #1d2f7a; }
.meta-row:last-child { border-bottom: none; }
.meta-label { border-right: 1.2px solid #1d2f7a; display: flex; align-items: center; padding: 4px 6px; color: #1d2f7a; font-size: 11px; font-weight: 800; }
.meta-value { display: flex; align-items: center; justify-content: center; min-width: 0; padding: 4px 6px; font-size: 12px; font-weight: 800; text-align: center; overflow-wrap: anywhere; }
.items-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 20px; border-top: 1.2px solid #1d2f7a; }
.items-table th, .items-table td { border-right: 1.2px solid #1d2f7a; border-bottom: 1.2px solid #1d2f7a; padding: 5px 5px 6px; vertical-align: middle; overflow: hidden; }
.items-table th:last-child, .items-table td:last-child { border-right: none; }
.items-table thead th { text-align: center; font-size: 11.8px; font-weight: 800; line-height: 1.25; padding: 8px 4px 9px; color: #1d2f7a; background: rgba(29, 47, 122, 0.12); }
.items-table tbody td { height: 22px; font-size: 11.2px; font-weight: 700; line-height: 1.15; white-space: nowrap; text-overflow: ellipsis; }
.items-table tbody td.branch-cell { white-space: normal; overflow-wrap: anywhere; line-height: 1.2; vertical-align: middle; }
.items-table .party-name { text-align: left; }
.items-table .center { text-align: center; }
.items-table .amount { text-align: right; padding-right: 7px; font-variant-numeric: tabular-nums; }
.items-table .unbilled:not(:empty) { background: rgba(255, 221, 120, 0.28); }
.items-table .outstanding:not(:empty) { background: rgba(255, 162, 162, 0.22); }
.blank-row td { font-weight: 400; background: #fff; }
.total-row td { height: 25px; font-size: 12px; font-weight: 800; background: rgba(29, 47, 122, 0.12); color: #111; }
.total-label { color: #1d2f7a !important; }
.footer-row { margin-top: auto; border-top: 1.2px solid #1d2f7a; display: flex; justify-content: space-between; padding: 6px 9px; color: #1d2f7a; font-size: 10px; font-weight: 800; text-transform: uppercase; }
</style>
</head>
<body>
${pages.map((rows, index) => buildPage(payload, rows, logoUrl, index, pages.length)).join('')}
</body>
</html>`;
};

export const downloadLedgerSummaryPdf = async (payload: LedgerSummaryPdfPayload): Promise<void> => {
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
        doc.write(buildHtml(payload, logoUrl));
        doc.close();

        await Promise.all(Array.from(doc.images).map((image) => {
            if (image.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
                image.onload = () => resolve();
                image.onerror = () => resolve();
            });
        }));
        await new Promise((resolve) => setTimeout(resolve, 250));

        const pages = Array.from(doc.querySelectorAll<HTMLElement>('.page'));
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
        ]);
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });

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

        const safePeriod = payload.periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
        pdf.save(`ledger-summary-${safePeriod}.pdf`);
    } finally {
        iframe.remove();
    }
};
