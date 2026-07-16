import type { jsPDF } from 'jspdf';
import { GState } from 'jspdf';
import { loadPdfLogo } from '@/lib/pdfLogo';

/** Pale tan from VGT letterhead watermark */
export const VGT_WATERMARK_TAN = { r: 197, g: 139, b: 62 } as const;
/** Subtle light red for cancelled / reversed documents */
export const CANCEL_WATERMARK_RED = { r: 220, g: 140, b: 140 } as const;

const LOGO_WATERMARK_OPACITY = 0.11;
const CANCEL_WATERMARK_OPACITY = 0.14;
const WATERMARK_ANGLE = 32;
const LOGO_WIDTH_MM = 36;
const CANCEL_FONT_SIZE = 24;

export type PdfWatermarkOptions = {
    /** Pre-loaded logo data URL. Falls back to client tan-tinted logo when omitted. */
    logoDataUrl?: string | null;
    /** Raw header logo (e.g. server-side) — apply opacity via GState instead of baked-in tint */
    serverRawLogo?: boolean;
    /** Show faint diagonal CANCEL text at both corners */
    showCancel?: boolean;
};

let cachedWatermarkLogo: string | null = null;

const tintLogoForWatermark = (src: string): Promise<string> => {
    if (typeof document === 'undefined') return Promise.resolve(src);

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(src);
                return;
            }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;

            for (let i = 0; i < pixels.length; i += 4) {
                const alpha = pixels[i + 3];
                if (alpha < 12) continue;

                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                const isWhiteish = r > 235 && g > 235 && b > 235;

                if (isWhiteish) {
                    pixels[i + 3] = 0;
                    continue;
                }

                pixels[i] = VGT_WATERMARK_TAN.r;
                pixels[i + 1] = VGT_WATERMARK_TAN.g;
                pixels[i + 2] = VGT_WATERMARK_TAN.b;
                pixels[i + 3] = Math.round(alpha * LOGO_WATERMARK_OPACITY);
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(src);
        img.src = src;
    });
};

/** Tan-tinted low-opacity VGT logo for corner watermarks (browser). */
export const loadPdfWatermarkLogo = async (): Promise<string> => {
    if (cachedWatermarkLogo) return cachedWatermarkLogo;
    const src = await loadPdfLogo();
    cachedWatermarkLogo = await tintLogoForWatermark(src);
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
    const aspect = 0.42;
    const logoHeight = LOGO_WIDTH_MM * aspect;

    pdf.addImage(
        logoDataUrl,
        'PNG',
        10,
        pageHeight - logoHeight - 10,
        LOGO_WIDTH_MM,
        logoHeight,
        undefined,
        'FAST',
        WATERMARK_ANGLE,
    );

    pdf.addImage(
        logoDataUrl,
        'PNG',
        pageWidth - LOGO_WIDTH_MM - 10,
        10,
        LOGO_WIDTH_MM,
        logoHeight,
        undefined,
        'FAST',
        WATERMARK_ANGLE,
    );
};

const stampCancelWatermark = (pdf: jsPDF, pageWidth: number, pageHeight: number) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(CANCEL_FONT_SIZE);
    pdf.setTextColor(CANCEL_WATERMARK_RED.r, CANCEL_WATERMARK_RED.g, CANCEL_WATERMARK_RED.b);

    pdf.text('CANCEL', 14, pageHeight - 14, { angle: WATERMARK_ANGLE });
    pdf.text('CANCEL', pageWidth - 14, 18, { angle: WATERMARK_ANGLE, align: 'right' });
};

const stampPageWatermarks = (
    pdf: jsPDF,
    logoDataUrl: string | null,
    showCancel: boolean,
    serverRawLogo: boolean,
) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.saveGraphicsState();

    if (logoDataUrl) {
        pdf.setGState(new GState({ opacity: serverRawLogo ? LOGO_WATERMARK_OPACITY : 1 }));
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
    const serverRawLogo = Boolean(options.serverRawLogo);
    const totalPages = pdf.getNumberOfPages();

    for (let page = 1; page <= totalPages; page += 1) {
        pdf.setPage(page);
        stampPageWatermarks(pdf, logoDataUrl, showCancel, serverRawLogo);
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
