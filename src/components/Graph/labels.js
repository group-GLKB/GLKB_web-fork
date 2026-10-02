export const GRAPH_FONT = 'Geist, Arial, sans-serif';
export const graphLabel = (data = {}) => {
    const value = [data.display, data.name, data.symbol, data.id]
        .find((item) => item != null && String(item).trim());
    return value == null ? '' : String(value);
};
export const loadGraphFont = async (fonts = document.fonts) => {
    if (!fonts?.load) return;
    try { await fonts.load('400 12px Geist'); } catch { /* Canvas uses the declared fallback. */ }
};
