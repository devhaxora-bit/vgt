import type { jsPDF } from 'jspdf';
import { GState } from 'jspdf';
import { loadPdfLogo } from '@/lib/pdfLogo';

/** Subtle light red for cancelled / reversed documents */
export const CANCEL_WATERMARK_RED = { r: 220, g: 140, b: 140 } as const;

/** Soft navy watermark — readable as blue, stays behind form text */
const LOGO_WATERMARK_OPACITY = 0.12;
const CANCEL_WATERMARK_OPACITY = 0.14;
const CANCEL_WATERMARK_ANGLE = 32;
/** Large centered logo — ~55% of the shorter page edge */
const LOGO_SIZE_RATIO = 0.55;
const CANCEL_FONT_SIZE = 72;

export type PdfWatermarkOptions = {
    /** Pre-loaded logo data URL. Falls back to client logo when omitted. */
    logoDataUrl?: string | null;
    /** @deprecated Opacity is always applied via GState; kept for callers */
    serverRawLogo?: boolean;
    /** Show faint large CANCEL text in the page center */
    showCancel?: boolean;
};

let cachedWatermarkLogo: string | null = null;

/** Original VGT logo for centered watermarks (browser). */
export const loadPdfWatermarkLogo = async (): Promise<string> => {
    if (cachedWatermarkLogo) return cachedWatermarkLogo;
    cachedWatermarkLogo = await loadPdfLogo();
    return cachedWatermarkLogo;
};

const resolveLogoDataUrl = async (logoDataUrl?: string | null): Promise<string | null> => {
    if (logoDataUrl) return logoDataUrl;
    if (typeof window !== 'undefined') {
        try {
            return await loadPdfWatermarkLogo();
        } catch {
            return null;
        }
    }
    return logoDataUrl ?? null;
};

const stampLogoWatermark = (
    pdf: jsPDF,
    logoDataUrl: string,
    pageWidth: number,
    pageHeight: number,
) => {
    const shortEdge = Math.min(pageWidth, pageHeight);
    const logoWidth = shortEdge * LOGO_SIZE_RATIO;
    const aspect = 0.42;
    const logoHeight = logoWidth * aspect;
    /** 10px left, 5px down from true center (px → mm @ 96dpi) */
    const x = (pageWidth - logoWidth) / 2 - 2.65;
    const y = (pageHeight - logoHeight) / 2 + 1.32;

    // Straight (no tilt) — original navy logo colors, opacity via GState
    pdf.addImage(logoDataUrl, 'PNG', x, y, logoWidth, logoHeight, undefined, 'FAST');
};

const stampCancelWatermark = (pdf: jsPDF, pageWidth: number, pageHeight: number) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(CANCEL_FONT_SIZE);
    pdf.setTextColor(CANCEL_WATERMARK_RED.r, CANCEL_WATERMARK_RED.g, CANCEL_WATERMARK_RED.b);

    pdf.text('CANCEL', pageWidth / 2, pageHeight / 2, {
        angle: CANCEL_WATERMARK_ANGLE,
        align: 'center',
        baseline: 'middle',
    });
};

const stampPageWatermarks = (
    pdf: jsPDF,
    logoDataUrl: string | null,
    showCancel: boolean,
) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.saveGraphicsState();

    if (logoDataUrl) {
        pdf.setGState(new GState({ opacity: LOGO_WATERMARK_OPACITY }));
        stampLogoWatermark(pdf, logoDataUrl, pageWidth, pageHeight);
    }

    if (showCancel) {
        pdf.setGState(new GState({ opacity: CANCEL_WATERMARK_OPACITY }));
        stampCancelWatermark(pdf, pageWidth, pageHeight);
    }

    pdf.restoreGraphicsState();
    pdf.setGState(new GState({ opacity: 1 }));
};

/** Apply VGT logo (+ optional CANCEL) watermarks to every page of a jsPDF document. */
export const applyPdfWatermarks = async (
    pdf: jsPDF,
    options: PdfWatermarkOptions = {},
): Promise<void> => {
    const logoDataUrl = await resolveLogoDataUrl(options.logoDataUrl);
    const showCancel = Boolean(options.showCancel);
    const totalPages = pdf.getNumberOfPages();

    for (let page = 1; page <= totalPages; page += 1) {
        pdf.setPage(page);
        stampPageWatermarks(pdf, logoDataUrl, showCancel);
    }
};

/** Stamp watermarks then trigger browser download. */
export const savePdfWithWatermarks = async (
    pdf: jsPDF,
    fileName: string,
    options: PdfWatermarkOptions = {},
): Promise<void> => {
    await applyPdfWatermarks(pdf, options);
    pdf.save(fileName);
};
