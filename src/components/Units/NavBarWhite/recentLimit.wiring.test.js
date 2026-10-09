/**
 * The Recent section asks for as many conversations as it draws.
 *
 * It drew up to MAX_RECENT_COUNT (50) but fetched with no argument, taking `fetchConversations`'
 * default page of 20 — so the slice was decoration and the sidebar stopped at 20 for every
 * reader, however many conversations they had. The two numbers have to be the same number.
 *
 * NavBarWhite is a few thousand lines behind a router, a theme and four contexts; the coupling
 * that broke is one call argument, so it is asserted in the source. What the fetch does with
 * the store once it is asked for 50 is covered behaviourally in
 * `utils/chatHistory.recentWindow.test.js`.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');

describe('the Recent conversation list', () => {
    it('fetches its own render cap, symbolically — not a literal that can drift', () => {
        expect(source).toContain('fetchConversations({ limit: MAX_RECENT_COUNT })');
        expect(source).not.toMatch(/fetchConversations\(\s*\)/);
    });

    it('slices to the same constant it fetched', () => {
        expect(source).toMatch(/const \[maxRecentCount\] = useState\(MAX_RECENT_COUNT\);/);
        expect(source).toMatch(/\.slice\(0, maxRecentCount\),/);
    });

    it('takes that cap from the store, rather than choosing a number of its own', () => {
        /* Drawing more rows than a refresh of the store validates leaves the ones past that
           point stale — a conversation deleted in another tab keeps its place in the sidebar
           and opens nothing. The cap and the refresh window are one constant, and it lives
           with the store. */
        expect(source).toMatch(/const MAX_RECENT_COUNT = RECENT_CONVERSATION_LIMIT;/);
        expect(source).toMatch(/RECENT_CONVERSATION_LIMIT,[\s\S]{0,200}from '\.\.\/\.\.\/\.\.\/utils\/chatHistory';/);
    });

    it('has exactly one fetch behind the section, so there is one number to keep in step', () => {
        expect(source.match(/fetchConversations\(/g)).toHaveLength(1);
    });
});
