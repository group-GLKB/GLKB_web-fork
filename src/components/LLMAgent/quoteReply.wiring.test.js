/**
 * How the chat page joins Reply, the composer's quote and the send.
 *
 * What the button, the quote and the chip do is covered behaviourally in
 * SelectionReply.test.jsx. The glue is inside a component of several thousand lines with a live
 * stream behind it, so it is asserted in the source, as composerMode.wiring.test.js does.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');
const between = (start, end) => {
    const from = source.indexOf(start);
    expect(from).toBeGreaterThan(-1);
    return source.slice(from, source.indexOf(end, from));
};

describe('Reply on the chat page', () => {
    it('watches the whole transcript, chat and Investigate answers alike, from outside it', () => {
        const mount = between('<SelectionReply', '/>');
        expect(mount).toContain('containerRef={messagesContainerRef}');
        expect(mount).toContain('onReply={handleSelectionReply}');
        // Mounted after the transcript closes, not inside any message.
        const transcriptEnd = source.indexOf('<div ref={messagesEndRef} />');
        expect(source.indexOf('<SelectionReply')).toBeGreaterThan(transcriptEnd);
    });

    it('puts the passage on the composer and the cursor in its field', () => {
        const handler = between('const handleSelectionReply = useCallback(', '}, []);');
        expect(handler).toContain('setReplyQuote(quote);');
        expect(handler).toContain('composerInputRef.current');
        expect(handler).toContain('field.focus();');
        const composer = between('<ChatSearchBar', 'onStop={handleStopStreaming}');
        expect(composer).toContain('quote={replyQuote}');
        expect(composer).toContain('onRemoveQuote={removeReplyQuote}');
        expect(composer).toContain('inputRef={composerInputRef}');
    });

    it('sends the quote in front of the question, sent now or queued, files or not', () => {
        const send = between('const submitOrQueue = useCallback(', 'const handleSelectionReply');
        expect(send).toContain('const text = withQuote(asked, replyQuote);');
        // Sent now: the words are no longer only the box's own, so they go as `input`...
        expect(send).toContain('stableSubmit(event, text === typed ? null : text, null, {');
        // ...queued: the entry keeps the quoted text.
        expect(send).toMatch(/setQueuedPrompts\(\(prev\) => \[\.\.\.prev, \{[\s\S]*?\btext,/);
        // Either way the chip goes with the question.
        expect(send.match(/setReplyQuote\(''\);/g)).toHaveLength(2);
        expect(send).toContain('replyQuote, isLoading');
    });

    it("still clears the reader's box when the composer's question arrives as `input`", () => {
        expect(source).toContain("if (!input || options.fromComposer) setUserInput('');");
    });

    it('drops a quote when the reader leaves its conversation', () => {
        const reset = between('const startNewConversation = useCallback(', '}, [cancelStreaming, llmService]);');
        expect(reset).toContain("setReplyQuote('');");
        expect(source).toMatch(/if \(previous != null && String\(previous\) !== String\(activeConversationId \?\? ''\)\) \{\s*setReplyQuote\(''\);/);
    });
});
