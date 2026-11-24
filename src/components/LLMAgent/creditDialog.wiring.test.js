/**
 * Out of credits on the chat page (2026-11-02): an Investigate question handed over from the
 * home page with 10 credits left was refused (429) after its conversation row had been made, and
 * the page then reloaded that empty row — a blank page, no word of why. Glue inside a component
 * of several thousand lines, asserted in the source as the other wiring tests do; the notice and
 * the pop-up themselves are covered in Units/CreditNotice.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');
const between = (start, end) => {
    const from = source.indexOf(start);
    expect(from).toBeGreaterThan(-1);
    const to = source.indexOf(end, from);
    expect(to).toBeGreaterThan(from);
    return source.slice(from, to);
};

describe('a turn the credits cannot pay for', () => {
    it('is stopped in handleSubmit before any conversation row or bubble, with the pop-up', () => {
        const head = between('const handleSubmit = async', 'let historyId = targetConversationId;');
        const check = head.indexOf("if (shortfall?.level === 'short')");
        expect(check).toBeGreaterThan(-1);
        // Priced on the turn's own mode and tier, the ones the request would carry.
        expect(head).toContain("investigateEnabled ? 'deep_research' : 'chat'");
        expect(head).toContain('effectiveTier(requestSearchOptions?.serviceTier, { isGuest })');
        const branch = head.slice(check, head.indexOf('return false;', check));
        expect(branch).toContain('setCreditDialog(shortfall);');
        expect(branch).toContain('setUserInput(inputText)');
        // Before the optimistic history and the row.
        expect(check).toBeLessThan(head.indexOf('const optimisticRunHistory'));
    });

    it("opens the pop-up on the backend's refusal too", () => {
        const handler = between('const handleRefusal = useCallback', '}, [requireSignIn, refreshTierStatus]);');
        expect(handler).toContain("setCreditDialog({ level: 'short', text: refusalText(refusal) });");
        expect(source).toContain('<CreditDialog notice={creditDialog}');
    });

    it('takes away the empty row a refused first turn made, and starts over with the question', () => {
        const recovery = between("if (refusal?.code === 'INSUFFICIENT_CREDITS' && shouldStartNewConversation", 'if (!refusal && pollSessionId');
        expect(recovery).toContain('removeConversation(emptyId)');
        expect(recovery).toContain('startNewConversation();');
        expect(recovery).toContain('navigate(CHAT_HOME_PATH, { replace: true });');
        expect(recovery).toContain('setUserInput(inputText);');
    });
});
