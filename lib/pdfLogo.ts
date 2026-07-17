/** Public logo asset for all PDF exports (maps to public/vgt_logo.png). */
export const VGT_LOGO_PATH = '/vgt_logo.png';

/** Company title / label blue — matches Bill No., GSTIN, Date labels */
export const PDF_HEADER_TITLE_COLOR = '#1d2f7a';
/** Table header — light sky blue background, black text */
export const PDF_TABLE_HEADER_BG = '#90caf9';
export const PDF_TABLE_HEADER_TEXT_COLOR = '#000000';

/** Header logo styles — natural image colors only; never add CSS filters here. */
export const PDF_HEADER_LOGO_IMG_CSS = 'width: 102px; max-width: 100%; object-fit: contain;';

/** Logo box styles for CN/challan print layouts. */
export const PDF_LOGO_BOX_IMG_CSS = 'width: 100%; height: 100%; object-fit: contain; display: block;';

export const loadPdfLogo = async (): Promise<string> => {
    try {
        const res = await fetch(VGT_LOGO_PATH);
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject());
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return `${window.location.origin}${VGT_LOGO_PATH}`;
    }
};

const parseHexColor = (hex: string): { r: number; g: number; b: number } | null => {
    const normalized = hex.trim().replace('#', '');
    if (normalized.length !== 3 && normalized.length !== 6) return null;
    const full = normalized.length === 3
        ? normalized.split('').map((ch) => `${ch}${ch}`).join('')
        : normalized;
    const value = Number.parseInt(full, 16);
    if (Number.isNaN(value)) return null;
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
};

/**
 * Replace solid white logo canvas with the given paper tint so pink/yellow/blue
 * CN copies do not show a white rectangle behind the VGT mark.
 */
export const tintPdfLogoBackground = async (
    src: string,
    backgroundHex: string,
): Promise<string> => {
    if (typeof document === 'undefined') return src;
    const tint = parseHexColor(backgroundHex);
    if (!tint) return src;
    if (tint.r > 250 && tint.g > 250 && tint.b > 250) return src;

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx || canvas.width === 0 || canvas.height === 0) {
                resolve(src);
                return;
            }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;

            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                const isNearWhite = r > 235 && g > 235 && b > 235;
                if (!isNearWhite) continue;
                pixels[i] = tint.r;
                pixels[i + 1] = tint.g;
                pixels[i + 2] = tint.b;
                pixels[i + 3] = 255;
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(src);
        img.src = src;
    });
};
