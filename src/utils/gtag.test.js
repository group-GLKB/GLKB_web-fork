import { createQuerySubmitSuccessTracker } from './gtag';

describe('query_submit_success', () => {
    beforeEach(() => {
        window.dataLayer = [];
        delete window.gtag;
    });

    it.each(['example', 'button', 'enter'])('reports %s once after the completed response', (method) => {
        const report = createQuerySubmitSuccessTracker(method);

        expect(report({ type: 'started' })).toBe(false);
        expect(report({ type: 'step' })).toBe(false);
        expect(report({ type: 'final' })).toBe(true);
        expect(report({ type: 'saved' })).toBe(false);
        expect(window.dataLayer).toEqual([expect.objectContaining({
            event: 'query_submit_success',
            query_method: method,
        })]);
    });

    it('does not report an error or an unclassified programmatic request', () => {
        const failed = createQuerySubmitSuccessTracker('button');
        const internal = createQuerySubmitSuccessTracker(undefined);

        expect(failed({ type: 'error' })).toBe(false);
        expect(internal({ type: 'final' })).toBe(false);
        expect(window.dataLayer).toEqual([]);
    });

    it('does not report a request that starts and then fails', () => {
        const report = createQuerySubmitSuccessTracker('enter');
        expect(report({ type: 'started' })).toBe(false);
        expect(report({ type: 'error' })).toBe(false);
        expect(window.dataLayer).toEqual([]);
    });

    it('uses a saved frame as the success fallback when no final frame was delivered', () => {
        const report = createQuerySubmitSuccessTracker('button');
        expect(report({ type: 'saved' })).toBe(true);
        expect(window.dataLayer).toHaveLength(1);
    });
});
