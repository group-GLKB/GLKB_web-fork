/**
 * Where the chat page wires the agent's choice for an Investigate follow-up, and what "Run a
 * full investigation" sends.
 *
 * The frame, the panels, the card and the replay are covered behaviourally in
 * followupRoute.test.jsx, and the request body in service/LLMAgent.payload.test.js. What is left
 * is glue inside a component of several thousand lines with a live stream behind it, so it is
 * asserted in the source, as searchLimit.wiring.test.js does — plus a real reload through the
 * history store.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('../../service/ChatHistory', () => ({
    createChatHistory: jest.fn(),
    deleteChatHistory: jest.fn(),
    getChatHistoryDetail: jest.fn(),
    getChatHistoryDetailByPublicId: jest.fn(),
    listChatHistories: jest.fn(),
    updateChatHistoryTitle: jest.fn(),
}));

/* eslint-disable import/first */
import { getChatHistoryDetail } from '../../service/ChatHistory';
import { fetchConversationDetail } from '../../utils/chatHistory';
/* eslint-enable import/first */

const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');
const between = (start, end) => {
    const from = source.indexOf(start);
    expect(from).toBeGreaterThan(-1);
    return source.slice(from, source.indexOf(end, from));
};

describe('"Run a full investigation"', () => {
    const handler = () => between('const handleRunFullInvestigation = (index) => {', 'const handleReloadLatest');

    it('asks the same question again, in the same conversation, forced past the router', () => {
        const body = handler();
        // The reader's own words for that turn.
        expect(body).toContain('investigateQuestionFor(chatHistory, index)');
        expect(body).toMatch(/stableSubmit\(null, question, null, \{\s*searchOptions: \{\s*investigateEnabled: true,[\s\S]*?forceFullResearch: true,\s*\},/);
        // As the conversation's next turn: no new conversation, no hand-over.
        expect(body).not.toMatch(/forceNewConversation|navigate\(/);
        // Priced, and run, at the picker's tier — the price the button shows.
        expect(body).toMatch(/serviceTier: typeof serviceTier === 'string' \? serviceTier : '',/);
    });

    it('never races a turn still being written in that conversation', () => {
        expect(handler()).toMatch(/if \(\(isLoading && isViewingRunningConversation\)\s*\|\| isConversationRunning\(activeConversationIdRef\.current\)\) \{\s*message\.info\(/);
        // And the card holds the button for the view's own run.
        expect(source).toMatch(/<FullInvestigationOffer[\s\S]*?disabled=\{interactionLocked\}/);
    });

    it('reaches the request: the turn reads the flag, and hands it to the service', () => {
        expect(source).toContain(
            "const forceFullResearch = investigateEnabled && requestSearchOptions?.forceFullResearch === true;",
        );
        const call = between('await llmService.chat(inputText, abortController,', '} catch (error) {');
        expect(call).toContain('forceFullResearch: forceFullResearch || undefined,');
        // A queued follow-up released in the background carries it the same way.
        expect(source).toMatch(/forceFullResearch: \(investigateEnabled\s*&& requestSearchOptions\?\.forceFullResearch === true\) \|\| undefined,/);
    });

    it('stays forced through a clarify retry, which must not be routed to a quick answer', () => {
        expect(source).toContain('forceFullResearch: forceFullResearch || undefined,\n        };');
        expect(source).toContain('forceFullResearch: prior.forceFullResearch,');
    });

    it('is handed to every card as a stable callback', () => {
        expect(source).toContain('const stableRunFullInvestigation = useStableCallback(handleRunFullInvestigation);');
        expect(source).toContain('onRunFullInvestigation={stableRunFullInvestigation}');
    });
});

describe('the card on the chat page', () => {
    it('puts the offer under the answer, outside its markdown, so Copy and Download never carry it', () => {
        const body = between('<div className="markdown-body">', '{isAssistant && (');
        const offer = body.indexOf('<FullInvestigationOffer');
        expect(offer).toBeGreaterThan(-1);
        expect(body.lastIndexOf('</div>', offer)).toBeGreaterThan(body.indexOf('<ReactMarkdown'));
    });

    it('offers it only on a settled answer the chat agent gave from the earlier investigation', () => {
        expect(source).toMatch(/const showFullInvestigationOffer = isAssistant && !isLoading && !showReloadInMessage\s*&& answeredFromPrior && Boolean\(onRunFullInvestigation\);/);
    });

    it("gives the chat's panel the follow-up's standing lines only for such a turn", () => {
        expect(source).toContain('followupDetail={answeredFromPrior ? investigateDetail : null}');
    });
});

describe('the live run', () => {
    it("restarts the chat panel's stages when the chat agent takes over", () => {
        const reset = between("if (update.detail.followup_route === 'answer_from_prior') {", '}');
        expect(reset).toContain("investigatePhaseRef.current = 'planning';");
        expect(reset).toContain('investigatePercentRef.current = null;');
    });

    it('stamps the route on every finished answer: live, detached, recovered and in the background', () => {
        // Live: the Complete frame's route, else what this run's frame announced.
        expect(source).toMatch(/\.\.\.followupRouteFields\(\s*update\.route,\s*investigateDetailRef\.current\?\.followupRoute,\s*\),\s*timestamp: timestamp,/);
        // Detached (a frame update or a run record) and a background follow-up.
        expect(source.match(/\.\.\.followupRouteFields\(update\.route\),/g)).toHaveLength(2);
        // Every answer rebuilt from a run record: the record's route, else the frame's.
        expect(source.match(/followupRouteFields\(\s*run\.route,\s*investigateDetailRef\.current\?\.followupRoute,\s*\)/g))
            .toHaveLength(4);
        expect(source).toContain('...(investigateEnabled ? followupRouteFields(run.route) : {}),');
    });

    it('notices a stored copy that differs only by its route', () => {
        expect(source).toContain('followupRoute: leftMsg?.followupRoute,');
        expect(source).toContain('followupRoute: rightMsg?.followupRoute,');
    });
});

describe('a reloaded conversation', () => {
    const detail = (assistant) => ({
        hid: 11,
        public_id: 'p-11',
        leading_title: 'NR4A1',
        created_at: '2026-11-02T10:00:00',
        last_accessed_time: '2026-11-02T10:05:00',
        is_investigate: true,
        messages: [
            { id: 1, pair_index: 0, role: 'user', content: 'How does NR4A1 drive exhaustion?' },
            { id: 2, pair_index: 0, role: 'assistant', content: 'A report…', trace: { v: 1, mode: 'investigate', complete: true, frames: [{ step: 'Started', phase: 'searching' }] } },
            { id: 3, pair_index: 1, role: 'user', content: 'Which of these used human samples?' },
            { id: 4, pair_index: 1, role: 'assistant', content: 'Two of them…', ...assistant },
        ],
    });

    it('brings each turn back with its route, from the stored trace', async () => {
        getChatHistoryDetail.mockResolvedValue(detail({
            trace: {
                v: 1,
                mode: 'investigate',
                complete: true,
                duration_ms: 31000,
                frames: [
                    { step: 'Started', phase: 'searching' },
                    { step: 'Choosing how to answer', type: 'followup_route', route: 'answer_from_prior', reason: 'covered by the report' },
                    { step: 'Complete', route: 'answer_from_prior' },
                ],
            },
        }));
        const conversation = await fetchConversationDetail(11);
        expect(conversation.messages[3].followupRoute).toBe('answer_from_prior');
        expect(conversation.messages[3].investigateMode).toBe(true);
        // The first turn, and the questions, carry none.
        expect(conversation.messages[1]).not.toHaveProperty('followupRoute');
        expect(conversation.messages[2]).not.toHaveProperty('followupRoute');
    });

    it("takes a route the backend returns on the message itself", async () => {
        getChatHistoryDetail.mockResolvedValue(detail({
            route: 'incremental',
            trace: { v: 1, mode: 'investigate', complete: true, frames: [{ step: 'Started', phase: 'searching' }] },
        }));
        const conversation = await fetchConversationDetail(11);
        expect(conversation.messages[3].followupRoute).toBe('incremental');
    });
});
