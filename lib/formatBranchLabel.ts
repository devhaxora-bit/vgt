/** Human-readable branch label for PDFs and reports. */
export const formatBranchLabel = (
    branchCode?: string | null,
    branchName?: string | null,
): string => {
    const code = String(branchCode ?? '').trim();
    const name = String(branchName ?? '').trim();

    if (code && name) {
        return `${code} — ${name}`;
    }
    if (name) {
        return name;
    }
    if (code === 'VZM') {
        return 'VZM — Vizianagaram';
    }
    if (code) {
        return code;
    }
    return '—';
};
