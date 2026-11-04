/**
 * Documents on an Investigate question (since 2026-11-02): where the chat page carries a turn's
 * files onto the deep-research request, and onto every re-send of that turn.
 *
 * The composers are covered behaviourally (ChatSearchBar.test.jsx, the home bar's
 * attachments test) and the request body in service/LLMAgent.payload.test.js. What is left is
 * glue inside a component of several thousand lines with a live stream behind it, so it is
 * asserted in the source, as searchLimit.wiring.test.js does.
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

describe('a turn sent to Investigate', () => {
    it('carries its files on both pipelines — no longer dropped on Investigate', () => {
        const submit = between('const turnAttachments = normalizeAttachmentList(', 'const turnAnswerOptions');
        expect(submit).toContain('options.attachments ?? requestSearchOptions?.attachments');
        expect(source).not.toMatch(/const turnAttachments = investigateEnabled\s*\?\s*\[\]/);
        // The optimistic question shows its chips at once, as in chat.
        expect(source).toContain('...(turnAttachments.length ? { attachments: turnAttachments } : {}),');
        // And the ids reach the service, which sends them to /deep-research/stream as well.
        const call = between('await llmService.chat(inputText, abortController,', '} catch (error) {');
        expect(call).toContain('attachments: turnAttachments.length ? attachmentIdsOf(turnAttachments) : undefined,');
    });

    it('so does a queued follow-up answered in the background', () => {
        expect(source).toContain(
            'const turnAttachments = normalizeAttachmentList(requestSearchOptions?.attachments);',
        );
    });

    it('gives the composer the documents-only limits at Extra effort', () => {
        expect(source).toMatch(
            /useAttachments\(\{\s*onRequireSignIn: requestAttachSignIn,\s*limits: INVESTIGATE_ENABLED && isDeepEffort\(composerEffort\) \? INVESTIGATE_ATTACH_LIMITS : undefined,\s*\}\)/,
        );
    });

    it('holds a send back only for an image on Investigate, not for its documents', () => {
        const queue = between('const submitOrQueue = useCallback(', 'const typed = userInput.trim();');
        expect(queue).toMatch(/attachmentBlockedNote\(composerAttachments, \{\s*investigate: Boolean\(composerOptions\?\.investigateEnabled\),\s*\}\)/);
        expect(queue).not.toMatch(/\|\|\s*composerOptions\?\.investigateEnabled\)\)/);
    });
});

describe('re-sending the same Investigate turn', () => {
    it('a clarify retry asks again with the same documents', () => {
        expect(source).toContain(
            'if (turnAttachments.length) lastSearchOptionsRef.current.attachments = turnAttachments;',
        );
        const retry = between("message.info('Clarification session expired.", "message.info('Clarification session not found.");
        expect(retry).toContain('attachments: prior.attachments,');
    });

    it('"Run a full investigation" asks again with that turn\'s documents', () => {
        const handler = between('const handleRunFullInvestigation = (index) => {', 'const handleReloadLatest');
        expect(handler).toContain('attachments: investigateAttachmentsFor(chatHistory, index),');
    });

    it('regenerate and edit already re-send the original question\'s files, whichever the mode', () => {
        expect(source).toContain('attachments: chatHistory[index]?.attachments,');
        expect(source).toContain('attachments: userMessage.attachments,');
    });
});
