import { jsPDF } from 'jspdf';

type LedgerReportParty = {
    name: string;
    code: string;
    type: string;
    gstin?: string | null;
    address?: string | null;
    branch_code?: string | null;
};

type LedgerReportSummary = {
    totalCnsAmount: number;
    totalCnsCount: number;
    totalBilled: number;
    totalPaid: number;
    unbilledAmount: number;
    overbilledAmount: number;
    outstanding: number;
};

type LedgerReportRow = Record<string, string | number>;

type LedgerReportColumn<Row extends LedgerReportRow> = {
    key: keyof Row;
    label: string;
    width: number;
    align?: 'left' | 'center' | 'right';
};

type LedgerReportSection<Row extends LedgerReportRow> = {
    title: string;
    columns: Array<LedgerReportColumn<Row>>;
    rows: Row[];
    emptyMessage: string;
};

export type PartyLedgerReportPayload = {
    party: LedgerReportParty;
    periodLabel: string;
    generatedAt: string;
    summary: LedgerReportSummary;
    sections: [
        LedgerReportSection<LedgerReportRow>,
        LedgerReportSection<LedgerReportRow>,
        LedgerReportSection<LedgerReportRow>,
    ];
};

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const PAGE_MARGIN = 8;
const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2);
const FOOTER_HEIGHT = 8;
const BLUE: [number, number, number] = [29, 47, 122];
const LIGHT_BLUE: [number, number, number] = [236, 241, 255];
const LIGHT_AMBER: [number, number, number] = [255, 247, 219];
const LIGHT_RED: [number, number, number] = [255, 234, 234];

const currencyFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

const fmt = (value: number) => currencyFormatter.format(value || 0);

const toText = (value: string | number | null | undefined) => String(value ?? '').trim() || '—';

const loadLogoDataUrl = async () => {
    const response = await fetch('/vgt_logo.png');
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
                return;
            }

            reject(new Error('Failed to read logo'));
        };
        reader.onerror = () => reject(new Error('Failed to read logo'));
        reader.readAsDataURL(blob);
    });
};

const fitText = (pdf: jsPDF, value: string, width: number, maxLines = 2) => {
    const lines = pdf.splitTextToSize(value, width) as string[];
    if (lines.length <= maxLines) return lines;

    const limited = lines.slice(0, maxLines);
    const lastLine = limited[maxLines - 1] || '';
    limited[maxLines - 1] = lastLine.length > 3 ? `${lastLine.slice(0, Math.max(lastLine.length - 3, 0))}...` : '...';
    return limited;
};

const drawHeader = (
    pdf: jsPDF,
    logoDataUrl: string | null,
    payload: PartyLedgerReportPayload,
    pageNumber: number
) => {
    pdf.setDrawColor(...BLUE);
    pdf.setLineWidth(0.4);
    pdf.rect(PAGE_MARGIN, PAGE_MARGIN, CONTENT_WIDTH, PAGE_HEIGHT - (PAGE_MARGIN * 2));
    pdf.rect(PAGE_MARGIN + 2, PAGE_MARGIN + 2, CONTENT_WIDTH - 4, 26);

    if (logoDataUrl) {
        pdf.addImage(logoDataUrl, 'PNG', PAGE_MARGIN + 5, PAGE_MARGIN + 5, 16, 16);
    }

    pdf.setTextColor(...BLUE);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('VISAKHA GOLDEN TRANSPORT', PAGE_WIDTH / 2, PAGE_MARGIN + 9, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('D.No. 8-19-58/A, Gopal Nagar, Near Bank Colony, Vizianagaram-535003 (A.P.)', PAGE_WIDTH / 2, PAGE_MARGIN + 15, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.text('Cell : 9701523640, Website : https://visakhagolden.com, Email : support@visakhagolden.com', PAGE_WIDTH / 2, PAGE_MARGIN + 20, { align: 'center' });

    pdf.setDrawColor(...BLUE);
    pdf.line(PAGE_MARGIN + 2, PAGE_MARGIN + 30, PAGE_WIDTH - PAGE_MARGIN - 2, PAGE_MARGIN + 30);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('PARTY LEDGER REPORT', PAGE_MARGIN + 6, PAGE_MARGIN + 37);
    pdf.setFontSize(9.5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Period: ${payload.periodLabel}`, PAGE_MARGIN + 6, PAGE_MARGIN + 42);
    pdf.text(`Generated: ${payload.generatedAt}`, PAGE_MARGIN + 6, PAGE_MARGIN + 47);

    pdf.setFont('helvetica', 'bold');
    pdf.text(`Page ${pageNumber}`, PAGE_WIDTH - PAGE_MARGIN - 6, PAGE_MARGIN + 42, { align: 'right' });

    return PAGE_MARGIN + 52;
};

const drawPartyInfo = (pdf: jsPDF, startY: number, payload: PartyLedgerReportPayload) => {
    const boxY = startY;
    const leftWidth = 120;
    const rightX = PAGE_MARGIN + 126;
    const rightWidth = CONTENT_WIDTH - 126;

    pdf.setDrawColor(...BLUE);
    pdf.setFillColor(...LIGHT_BLUE);
    pdf.roundedRect(PAGE_MARGIN + 2, boxY, leftWidth, 22, 2, 2, 'FD');
    pdf.roundedRect(rightX, boxY, rightWidth, 22, 2, 2, 'S');

    pdf.setTextColor(20, 24, 40);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(payload.party.name, PAGE_MARGIN + 6, boxY + 7);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`Code: ${toText(payload.party.code)}   Type: ${toText(payload.party.type)}`, PAGE_MARGIN + 6, boxY + 12);
    pdf.text(`Branch: ${toText(payload.party.branch_code)}   GSTIN: ${toText(payload.party.gstin)}`, PAGE_MARGIN + 6, boxY + 17);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('Address', rightX + 4, boxY + 6);
    pdf.setFont('helvetica', 'normal');
    const addressLines = fitText(pdf, toText(payload.party.address), rightWidth - 8, 3);
    pdf.text(addressLines, rightX + 4, boxY + 11);

    return boxY + 28;
};

const drawSummary = (pdf: jsPDF, startY: number, summary: LedgerReportSummary) => {
    const cards = [
        { label: 'Total CNS', value: `₹${fmt(summary.totalCnsAmount)}`, sub: `${summary.totalCnsCount} entries`, fill: LIGHT_BLUE },
        { label: 'Total Billed', value: `₹${fmt(summary.totalBilled)}`, sub: '', fill: LIGHT_BLUE },
        { label: 'Unbilled', value: `₹${fmt(summary.unbilledAmount)}`, sub: summary.overbilledAmount > 0 ? `Overbilled ₹${fmt(summary.overbilledAmount)}` : '', fill: LIGHT_AMBER },
        { label: 'Total Paid', value: `₹${fmt(summary.totalPaid)}`, sub: '', fill: LIGHT_BLUE },
        { label: 'Outstanding', value: `₹${fmt(summary.outstanding)}`, sub: '', fill: LIGHT_RED },
    ] as const;

    const gap = 4;
    const cardWidth = (CONTENT_WIDTH - (gap * (cards.length - 1)) - 4) / cards.length;
    const cardY = startY;

    cards.forEach((card, index) => {
        const x = PAGE_MARGIN + 2 + (index * (cardWidth + gap));
        pdf.setFillColor(...card.fill);
        pdf.setDrawColor(...BLUE);
        pdf.roundedRect(x, cardY, cardWidth, 18, 2, 2, 'FD');
        pdf.setTextColor(90, 98, 118);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.text(card.label.toUpperCase(), x + 3, cardY + 5);
        pdf.setTextColor(20, 24, 40);
        pdf.setFontSize(12);
        pdf.text(card.value, x + 3, cardY + 11);
        if (card.sub) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7.5);
            pdf.setTextColor(176, 61, 0);
            pdf.text(card.sub, x + 3, cardY + 15.5);
        }
    });

    return cardY + 24;
};

const drawTableHeader = <Row extends LedgerReportRow>(
    pdf: jsPDF,
    startY: number,
    columns: Array<LedgerReportColumn<Row>>
) => {
    let x = PAGE_MARGIN + 2;
    pdf.setDrawColor(...BLUE);
    pdf.setFillColor(...LIGHT_BLUE);
    pdf.setTextColor(20, 24, 40);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);

    columns.forEach((column) => {
        pdf.rect(x, startY, column.width, 7, 'FD');
        pdf.text(column.label, x + (column.align === 'right' ? column.width - 2 : column.align === 'center' ? column.width / 2 : 2), startY + 4.5, {
            align: column.align === 'right' ? 'right' : column.align === 'center' ? 'center' : 'left',
        });
        x += column.width;
    });

    return startY + 7;
};

const drawTable = <Row extends LedgerReportRow>(
    pdf: jsPDF,
    logoDataUrl: string | null,
    payload: PartyLedgerReportPayload,
    startY: number,
    pageNumberRef: { current: number },
    section: LedgerReportSection<Row>
) => {
    let y = startY;
    let pageJustAdded = false;

    const ensureSpace = (requiredHeight: number) => {
        pageJustAdded = false;
        if (y + requiredHeight <= PAGE_HEIGHT - PAGE_MARGIN - FOOTER_HEIGHT) return;
        pdf.addPage('a4', 'landscape');
        pageNumberRef.current += 1;
        y = drawHeader(pdf, logoDataUrl, payload, pageNumberRef.current);
        pageJustAdded = true;
    };

    ensureSpace(14);
    pdf.setTextColor(...BLUE);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(section.title, PAGE_MARGIN + 2, y);
    y += 3;
    y = drawTableHeader(pdf, y + 2, section.columns);

    if (section.rows.length === 0) {
        ensureSpace(8);
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(120, 124, 140);
        pdf.text(section.emptyMessage, PAGE_MARGIN + 4, y + 5);
        return y + 10;
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.2);
    pdf.setTextColor(20, 24, 40);

    for (const row of section.rows) {
        const cellLines = section.columns.map((column) => (
            fitText(pdf, toText(row[column.key]), column.width - 4, 3)
        ));
        const rowHeight = Math.max(...cellLines.map((lines) => lines.length)) * 4 + 2;

        ensureSpace(rowHeight + 2);
        if (pageJustAdded) {
            pdf.setTextColor(...BLUE);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.text(section.title, PAGE_MARGIN + 2, y);
            y += 3;
            y = drawTableHeader(pdf, y + 2, section.columns);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.2);
            pdf.setTextColor(20, 24, 40);
        }

        let x = PAGE_MARGIN + 2;
        section.columns.forEach((column, index) => {
            pdf.setDrawColor(180, 187, 208);
            pdf.rect(x, y, column.width, rowHeight);
            const textX = column.align === 'right' ? x + column.width - 2 : column.align === 'center' ? x + (column.width / 2) : x + 2;
            pdf.text(cellLines[index], textX, y + 4, {
                align: column.align === 'right' ? 'right' : column.align === 'center' ? 'center' : 'left',
            });
            x += column.width;
        });

        y += rowHeight;
    }

    return y + 4;
};

export const downloadPartyLedgerReportPdf = async (payload: PartyLedgerReportPayload) => {
    const logoDataUrl = await loadLogoDataUrl().catch(() => null);
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
    });

    const pageNumberRef = { current: 1 };
    let y = drawHeader(pdf, logoDataUrl, payload, pageNumberRef.current);
    y = drawPartyInfo(pdf, y, payload);
    y = drawSummary(pdf, y, payload.summary);

    for (const section of payload.sections) {
        y = drawTable(pdf, logoDataUrl, payload, y, pageNumberRef, section);
    }

    const safePartyCode = String(payload.party.code || 'ledger').replace(/[^a-zA-Z0-9-_]/g, '') || 'ledger';
    const safePeriod = payload.periodLabel.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
    pdf.save(`${safePartyCode}-ledger-${safePeriod}.pdf`);
};
