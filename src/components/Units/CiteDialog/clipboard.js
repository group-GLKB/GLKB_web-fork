/** Plain text is included in the same clipboard item for text-only destinations. */
export const copyCitation = async (text, html) => {
    if (html && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        try {
            await navigator.clipboard.write([new ClipboardItem({
                'text/plain': new Blob([text], { type: 'text/plain' }),
                'text/html': new Blob([html], { type: 'text/html' }),
            })]);
            return true;
        } catch { /* Browsers may deny HTML while allowing a plain-text copy. */ }
    }
    await navigator.clipboard.writeText(text);
    return false;
};
