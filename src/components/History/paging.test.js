import { appendConversationPage, historyCountLabel, isLastPage } from './paging';

const conv = (id, extra = {}) => ({ id, title: `conv ${id}`, ...extra });

describe('appending a page of conversations', () => {
    it('adds the older rows under the ones already on screen', () => {
        const list = appendConversationPage([conv(1), conv(2)], [conv(3), conv(4)]);
        expect(list.map((item) => item.id)).toEqual([1, 2, 3, 4]);
    });

    it('updates a conversation that moved between the two requests, never draws it twice', () => {
        // The order key is last-accessed time, so a finishing run can lift a row into a page
        // the reader already holds. Appending blindly would show it twice.
        const list = appendConversationPage(
            [conv(1), conv(2)],
            [conv(2, { title: 'renamed' }), conv(3)],
        );
        expect(list.map((item) => item.id)).toEqual([1, 2, 3]);
        expect(list.find((item) => item.id === 2).title).toBe('renamed');
    });

    it('ignores a row with no id rather than keying the list on undefined', () => {
        expect(appendConversationPage([conv(1)], [{ title: 'nameless' }, conv(2)]))
            .toHaveLength(2);
    });

    it('survives a missing page or a missing list', () => {
        expect(appendConversationPage(undefined, [conv(1)])).toHaveLength(1);
        expect(appendConversationPage([conv(1)], undefined)).toHaveLength(1);
    });
});

describe('knowing when the list is exhausted', () => {
    it('keeps going while a full page came back with a cursor', () => {
        expect(isLastPage({ received: 20, pageSize: 20, nextCursor: 'ts|7' })).toBe(false);
    });

    it('stops on a short page', () => {
        expect(isLastPage({ received: 6, pageSize: 20, nextCursor: 'ts|7' })).toBe(true);
    });

    it('stops when the server sends no cursor, whatever the page size', () => {
        // An older server cannot be paged safely: asking again re-reads the same rows.
        expect(isLastPage({ received: 20, pageSize: 20, nextCursor: null })).toBe(true);
    });
});

describe('the line under the toolbar', () => {
    it('says how far through the list the reader is', () => {
        // The reported bug: this said "20 search history records with GLKB" — a page size
        // dressed as a total — while 43 conversations existed.
        expect(historyCountLabel({ loaded: 20, total: 43, filtered: 20 }))
            .toBe('20 of 43 search history records with GLKB');
    });

    it('drops the "of" once everything is loaded', () => {
        expect(historyCountLabel({ loaded: 43, total: 43, filtered: 43 }))
            .toBe('43 search history records with GLKB');
    });

    it('counts matches while a search is typed, and says they are matches', () => {
        expect(historyCountLabel({ loaded: 40, total: 43, filtered: 3, searching: true }))
            .toBe('3 matching records');
    });

    it('is not plural about one record', () => {
        expect(historyCountLabel({ loaded: 1, total: 1, filtered: 1 }))
            .toBe('1 search history record with GLKB');
        expect(historyCountLabel({ filtered: 1, searching: true })).toBe('1 matching record');
    });

    it('falls back to what is on screen when the server sent no total', () => {
        expect(historyCountLabel({ loaded: 20, total: null, filtered: 20 }))
            .toBe('20 search history records with GLKB');
    });
});


/* The cached first paint, asserted in the source: History's mount seeds from the shared
   conversation store before its own first page arrives, and that store now holds as many rows
   as the sidebar refreshes. Painting all of them showed a long list under a bare count, both
   of which then shrank to a page. The component is not rendered by any test — this pins the
   one line that keeps the seed and the page the same size. */
describe('what History paints before its first page arrives', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, 'index.jsx'), 'utf-8');

    it('seeds from the store a page at a time', () => {
        expect(source).toContain('const cached = getConversations().slice(0, PAGE_SIZE);');
    });
});
