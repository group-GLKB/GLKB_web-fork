/**
 * No caller may refresh a narrower window than the widest view draws.
 *
 * The conversation store is shared — the sidebar draws it, the chat page rewrites it after
 * every answer — and a refresh is authoritative only over the rows it actually asked for.
 * When the sidebar drew 50 rows and the chat page's refresh asked for 20, ranks 21-50 were
 * frozen at whatever some earlier fetch had seen: a conversation deleted in another tab kept
 * its place in the list and opened nothing when clicked.
 *
 * So `fetchConversations` takes the window from `RECENT_CONVERSATION_LIMIT` by default, and
 * this is the guard against a call site quietly passing something smaller — which is a
 * one-word edit at any of four places, and invisible in every other test.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { RECENT_CONVERSATION_LIMIT } from './chatHistory';

const SRC = join(__dirname, '..');

const sourceFiles = (dir) => readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(js|jsx)$/.test(entry) || /\.test\.(js|jsx)$/.test(entry)) return [];
    return [full];
});

/* Every `fetchConversations(...)` call in the app, as [file, argument text]. The argument is
   a single object literal or nothing, so matching to the first `)` is enough. */
const callSites = () => sourceFiles(SRC).flatMap((file) => {
    if (file.endsWith(join('utils', 'chatHistory.js'))) return []; // the definition itself
    const text = readFileSync(file, 'utf-8');
    return [...text.matchAll(/fetchConversations\(([^)]*)\)/g)]
        .map((match) => [file.slice(SRC.length + 1), match[1].trim()]);
});

it('finds the call sites it is meant to be guarding', () => {
    // If this ever reads zero, the regex stopped matching and every assertion below is vacuous.
    expect(callSites().length).toBeGreaterThanOrEqual(4);
});

it('never asks for fewer conversations than the store is meant to hold', () => {
    const narrowing = callSites().filter(([, args]) => {
        if (args === '') return false; // the default IS the window
        const limit = args.match(/limit:\s*([^,}]+)/);
        if (!limit) return true; // an argument that does not set a limit at all is suspicious
        const value = limit[1].trim();
        // A name is fine — it can only resolve to the shared constant. A literal is not.
        return /^\d+$/.test(value) && Number(value) < RECENT_CONVERSATION_LIMIT;
    });

    expect(narrowing).toEqual([]);
});

it('keeps the window wide enough to be worth paging — more than one History page', () => {
    /* The reported bug was a sidebar stuck at twenty. Twenty is also History's page size, so a
       window of twenty would silently restore it while every other test stayed green. This is
       a product decision: change the number here deliberately, not by drift. */
    expect(RECENT_CONVERSATION_LIMIT).toBe(50);
});
