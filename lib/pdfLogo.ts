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
