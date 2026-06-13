/** Public logo asset for all PDF exports (maps to public/vgt_logo.png). */
export const VGT_LOGO_PATH = '/vgt_logo.png';

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
