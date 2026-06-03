import { formatBranchLabel } from '@/lib/formatBranchLabel';

export type ChallanLedgerSummaryBrokerRow = {
    broker_code: string;
    broker_name: string;
    primary_branch_code: string | null;
    total_challan_count: number;
    total_challan_amount: number;
    total_billed: number;
    unbilled_amount: number;
    overbilled_amount: number;
    total_paid: number;
    outstanding: number;
};

export type ChallanLedgerSummaryPdfPayload = {
    rows: ChallanLedgerSummaryBrokerRow[];
    periodLabel: string;
    filters: {
        branch?: string;
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

const splitRows = (rows: ChallanLedgerSummaryBrokerRow[]) => {
    const pages: ChallanLedgerSummaryBrokerRow[][] = [];
    for (let index = 0; index < rows.length; index += PAGE_ROWS) {
        pages.push(rows.slice(index, index + PAGE_ROWS));
    }
    return pages.length > 0 ? pages : [[]];
};

const totalsFor = (rows: ChallanLedgerSummaryBrokerRow[]) => ({
    challanCount: rows.reduce((sum, row) => sum + Number(row.total_challan_count || 0), 0),
    challanAmount: rows.reduce((sum, row) => sum + Number(row.total_challan_amount || 0), 0),
    billed: rows.reduce((sum, row) => sum + Number(row.total_billed || 0), 0),
    unbilled: rows.reduce((sum, row) => sum + Number(row.unbilled_amount || 0), 0),
    paid: rows.reduce((sum, row) => sum + Number(row.total_paid || 0), 0),
    outstanding: rows.reduce((sum, row) => sum + Number(row.outstanding || 0), 0),
});

const buildRow = (row: ChallanLedgerSummaryBrokerRow) => `
    <tr>
        <td>${safe(row.broker_code)}</td>
        <td class="party-name">${safe(row.broker_name)}</td>
        <td class="center branch-cell">${safe(formatBranchLabel(row.primary_branch_code, null))}</td>
        <td class="amount">${fmt(row.total_challan_count)}</td>
        <td class="amount">${fmt(row.total_challan_amount)}</td>
        <td class="amount">${fmt(row.total_billed)}</td>
        <td class="amount unbilled">${fmt(row.unbilled_amount)}</td>
        <td class="amount">${fmt(row.total_paid)}</td>
        <td class="amount outstanding">${fmt(row.outstanding)}</td>
    </tr>
`;

const buildTable = (rows: ChallanLedgerSummaryBrokerRow[], allRows: ChallanLedgerSummaryBrokerRow[], isLastPage: boolean) => {
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
                    <th style="width:21%;">Broker Name</th>
                    <th style="width:11%;">Branch</th>
                    <th style="width:5%;">Ch.</th>
                    <th style="width:12%;">Challan<br/>Amount</th>
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
                        <td>${allRows.length} brokers</td>
                        <td></td>
                        <td class="amount">${fmt(totals.challanCount)}</td>
                        <td class="amount">${fmt(totals.challanAmount)}</td>
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
    payload: ChallanLedgerSummaryPdfPayload,
    rows: ChallanLedgerSummaryBrokerRow[],
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
                    <div class="header-line"><span>Broker Challan Ledger Summary</span></div>
                </div>
                <div class="header-pan"><span>PAN NO:</span><br/>AAWFV7670H</div>
            </div>
            <div class="detail-grid">
                <div class="report-block">
                    <div class="report-title">Broker Challan Ledger Summary</div>
                    <div class="report-line">${safe(payload.periodLabel)}</div>
                </div>
                <div class="right-block">
                    <div class="meta-row"><div class="meta-label">Generated :</div><div class="meta-value">${safe(payload.generatedAt)}</div></div>
                </div>
            </div>
            ${buildTable(rows, payload.rows, pageIndex === pageCount - 1)}
            <div class="footer-row">
                <span>${payload.rows.length} brokers</span>
                <span>Page ${pageIndex + 1} of ${pageCount}</span>
            </div>
        </div>
    </div>
`;

const buildHtml = (payload: ChallanLedgerSummaryPdfPayload, logoUrl: string) => {
    const pages = splitRows(payload.rows);
    return `<!DOCTYPE html><html><head><title>Broker Challan Ledger Summary</title>
<style>
@page { size: A4 landscape; margin: 5mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
.page { width: 287mm; min-height: 200mm; margin: 0 auto; padding: 6mm 10mm; background: #fff; page-break-after: always; }
.page:last-child { page-break-after: auto; }
.sheet { border: 1.2px solid #1d2f7a; min-height: 186mm; display: flex; flex-direction: column; overflow: hidden; }
.header-band { border-bottom: 1.2px solid #1d2f7a; display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; column-gap: 8px; padding: 7px 12px 5px; }
.header-logo img { width: 102px; max-width: 100%; filter: grayscale(1) contrast(1.6) brightness(0.2); object-fit: contain; }
.header-copy { text-align: center; }
.header-title { font-size: 17px; font-weight: 800; color: #17308b; }
.header-line { font-size: 12px; font-weight: 700; margin-top: 3px; }
.header-pan { text-align: right; font-size: 12px; font-weight: 800; line-height: 1.35; }
.detail-grid { display: grid; grid-template-columns: 56% 44%; border-bottom: 1.2px solid #1d2f7a; min-height: 58px; }
.report-block { border-right: 1.2px solid #1d2f7a; display: flex; flex-direction: column; justify-content: center; gap: 7px; padding: 8px 10px; }
.report-title { font-size: 14px; font-weight: 800; text-transform: uppercase; }
.report-line { font-size: 11px; font-weight: 700; text-transform: uppercase; }
.right-block { display: grid; grid-template-rows: 1fr; }
.meta-row { display: grid; grid-template-columns: 28% 72%; min-height: 29px; }
.meta-label { border-right: 1.2px solid #1d2f7a; display: flex; align-items: center; padding: 3px 6px 5px; color: #1d2f7a; font-size: 11px; font-weight: 800; }
.meta-value { display: flex; align-items: center; justify-content: center; padding: 3px 6px 5px; font-size: 12px; font-weight: 800; }
.items-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 20px; border-top: 1.2px solid #1d2f7a; }
.items-table th, .items-table td { border-right: 1.2px solid #1d2f7a; border-bottom: 1.2px solid #1d2f7a; padding: 5px 5px 6px; vertical-align: middle; overflow: hidden; }
.items-table th:last-child, .items-table td:last-child { border-right: none; }
.items-table thead th { text-align: center; font-size: 11.8px; font-weight: 800; color: #1d2f7a; background: rgba(29, 47, 122, 0.12); }
.items-table tbody td { height: 22px; font-size: 11.2px; font-weight: 700; white-space: nowrap; text-overflow: ellipsis; }
.items-table .party-name { text-align: left; }
.items-table .center { text-align: center; }
.items-table .amount { text-align: right; padding-right: 7px; font-variant-numeric: tabular-nums; }
.items-table .unbilled:not(:empty) { background: rgba(255, 221, 120, 0.28); }
.items-table .outstanding:not(:empty) { background: rgba(255, 162, 162, 0.22); }
.blank-row td { font-weight: 400; background: #fff; }
.total-row td { height: 40px; font-size: 17px; font-weight: 800; background: rgba(29, 47, 122, 0.12); }
.total-label { color: #1d2f7a !important; font-size: 17px; }
.footer-row { margin-top: auto; border-top: 1.2px solid #1d2f7a; display: flex; justify-content: space-between; padding: 6px 9px; color: #1d2f7a; font-size: 10px; font-weight: 800; text-transform: uppercase; }
</style></head><body>
${pages.map((rows, index) => buildPage(payload, rows, logoUrl, index, pages.length)).join('')}
</body></html>`;
};

export const downloadChallanLedgerSummaryPdf = async (payload: ChallanLedgerSummaryPdfPayload): Promise<void> => {
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
        if (!doc) throw new Error('Failed to create export document');

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
        pdf.save(`broker-challan-ledger-${safePeriod}.pdf`);
    } finally {
        iframe.remove();
    }
};
