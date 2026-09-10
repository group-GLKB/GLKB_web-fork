const getPathname = () => {
    if (typeof window === 'undefined') return '';
    return window.location?.pathname || '';
};

export const trackGtagEvent = (eventName, params = {}) => {
    if (!eventName || typeof window === 'undefined') return;

    const payload = {
        page_path: getPathname(),
        ...params,
    };

    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, payload);
        return;
    }

    if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({
            event: eventName,
            ...payload,
        });
    }
};

const QUERY_METHODS = new Set(['example', 'button', 'enter']);
const SUCCESSFUL_QUERY_UPDATE_TYPES = new Set(['final', 'saved']);

/**
 * One success event for one real Agent request. Calling this from click handlers is too early:
 * a home submit has only navigated, and a busy-conversation submit may only have entered the
 * queue. The returned function is instead fed Agent updates and reports only after a definitive
 * completion/save frame. Starting or making progress is not success: that request can still end
 * in an error. The guard also de-duplicates the usual `final` then `saved` pair.
 */
export const createQuerySubmitSuccessTracker = (queryMethod) => {
    const normalizedMethod = QUERY_METHODS.has(queryMethod) ? queryMethod : null;
    let tracked = false;

    return (update) => {
        const updateType = typeof update === 'string' ? update : update?.type;
        if (!normalizedMethod || tracked || !SUCCESSFUL_QUERY_UPDATE_TYPES.has(updateType)) {
            return false;
        }
        tracked = true;
        trackGtagEvent('query_submit_success', { query_method: normalizedMethod });
        return true;
    };
};
