/**
 * Each answer keeps the effort level it ran at (service/effortLevels.js): a conversation can mix
 * levels question by question, so the level is the MESSAGE's, never the composer's.
 *
 * Pinned here on the answer card: the small level chip in its actions (shown once more than
 * Medium and Extra are on offer, or when the answer ran at another level), and what the card asks
 * of its graph — the answer graph at High, Extra and Max in a saved conversation for a signed-in
 * reader, the basic graph otherwise. Old answers read their level off `investigateMode`.
 * The submit paths are glue inside a component of several thousand lines, asserted in the
 * source as the other wiring tests do.
 */
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

/* eslint-disable import/first */
const mockGraphProps = [];
jest.mock('../AnswerGraph/AnswerGraphForMessage', () => (props) => {
    mockGraphProps.push(props);
    return <div data-testid="answer-graph" />;
});
jest.mock('../../service/serviceTiers', () => ({
    ...jest.requireActual('../../service/serviceTiers'),
    fetchTierPricing: jest.fn(() => new Promise(() => {})),
}));

import { MessageCard } from './index';
/* eslint-enable import/first */

const ANSWER = 'Metformin activates AMPK in hepatocytes [111](https://pubmed.ncbi.nlm.nih.gov/111/).\n\n'
    + 'AMPK in turn lowers hepatic glucose output.';
const REFERENCES = [{
    title: 'Metformin and AMPK', url: 'https://pubmed.ncbi.nlm.nih.gov/111/', pmid: '111',
    year: 2001, journal: 'JCI', authors: 'G. Zhou', citation_count: 4000, evidence: [],
}];

const assistant = (patch = {}) => ({
    role: 'assistant',
    content: ANSWER,
    references: REFERENCES,
    timestamp: '10:00',
    thinkingSteps: [],
    thoughtDurationMs: 31000,
    trajectory: null,
    answerOptions: { graph: true },
    invocationId: 'inv-7',
    ...patch,
});

const card = (message, props = {}) => (
    <MessageCard
        index={1}
        message={message}
        referenceSortOption="Year"
        referenceSummaryMap={{}}
        totalMessages={2}
        isProcessing={false}
        streamingGroups={[]}
        preamble=""
        streamingStepName=""
        investigatePhase={null}
        investigateFunnel={null}
        investigateStartedAt={null}
        investigatePercent={null}
        investigateKeywords={[]}
        investigatePapers={[]}
        investigateDetail={{}}
        pendingClarification={null}
        clarificationDrafts={{}}
        clarificationError=""
        clarificationSubmitting={false}
        hasInvalidOtherSelection={false}
        refresh={() => {}}
        copy={() => {}}
        save={() => {}}
        downloadConversation={() => {}}
        onOpenFeedback={() => {}}
        showReloadPrompt={false}
        onReloadLatest={() => {}}
        onStop={() => {}}
        interactionLocked={false}
        conversationId="42"
        investigateTier="advanced"
        isGuest={false}
        {...props}
    />
);

const lastGraph = () => mockGraphProps[mockGraphProps.length - 1];

beforeEach(() => { mockGraphProps.length = 0; });

describe('the level chip', () => {
    it('names a High answer', () => {
        render(card(assistant({ effort: 'high' })));
        expect(screen.getByTitle('Answered at High effort')).toHaveTextContent('High');
    });

    it('says nothing on a Medium answer while only Medium and Extra are on offer', () => {
        render(card(assistant({ effort: 'medium' })));
        expect(screen.queryByTitle(/Answered at/)).toBeNull();
    });

    it('names every answer once the levels are on offer — an old one by its mode', () => {
        render(card(assistant({ effort: 'medium' }), { effortsLive: true }));
        expect(screen.getByTitle('Answered at Medium effort')).toBeInTheDocument();
    });

    it('reads an old Investigate answer as Extra', () => {
        render(card(assistant({ investigateMode: true, answerOptions: {} }), { effortsLive: true }));
        expect(screen.getByTitle('Answered at Extra effort')).toBeInTheDocument();
    });
});

describe('what the answer asks of its graph', () => {
    it('a High answer in a saved conversation: the answer graph, by its invocation id', () => {
        render(card(assistant({ effort: 'high' })));
        expect(screen.getByTestId('answer-graph')).toBeInTheDocument();
        expect(lastGraph()).toMatchObject({
            effort: 'high', historyId: '42', invocationId: 'inv-7', isGuest: false, basic: true,
        });
        expect(lastGraph().references).toBe(REFERENCES);
    });

    it('a Medium or Low answer: the basic graph, exactly as before', () => {
        render(card(assistant({ effort: 'medium' })));
        expect(lastGraph()).toMatchObject({ effort: '', basic: true });
        mockGraphProps.length = 0;
        render(card(assistant({ effort: 'low' })));
        expect(lastGraph()).toMatchObject({ effort: '' });
    });

    it('a guest\'s High answer: the basic graph', () => {
        render(card(assistant({ effort: 'high' }), { isGuest: true }));
        expect(lastGraph()).toMatchObject({ effort: '' });
    });

    it('an answer not yet saved: the basic graph', () => {
        render(card(assistant({ effort: 'high' }), { conversationId: null }));
        expect(lastGraph()).toMatchObject({ effort: '' });
    });

    it('an old Investigate answer asks as Extra, by its row', () => {
        // As a reloaded row comes back: `id`, and no invocation id on an Investigate answer.
        render(card(assistant({ investigateMode: true, answerOptions: {}, invocationId: null, id: 88 })));
        expect(lastGraph()).toMatchObject({ effort: 'extra', basic: true, messageId: 88, invocationId: null });
    });

    it('a live answer asks by the row its Saved frame named', () => {
        render(card(assistant({ effort: 'max', investigateMode: true, messageId: 91 })));
        expect(lastGraph()).toMatchObject({ effort: 'max', messageId: 91 });
    });

    it('a High answer whose turn turned the graph off draws none', () => {
        render(card(assistant({ effort: 'high', answerOptions: { graph: false } })));
        expect(screen.queryByTestId('answer-graph')).toBeNull();
    });

    it('a High answer with nothing for the basic graph asks for the answer graph only', () => {
        render(card(assistant({ effort: 'high', references: [], answerOptions: {} })));
        expect(lastGraph()).toMatchObject({ effort: 'high', basic: false });
    });
});

describe('the submit paths (index.jsx)', () => {
    const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');
    const between = (start, end) => {
        const from = source.indexOf(start);
        expect(from).toBeGreaterThan(-1);
        const to = source.indexOf(end, from);
        expect(to).toBeGreaterThan(from);
        return source.slice(from, to);
    };

    it('the composer puts the level on the turn\'s own options — so a queued question keeps it', () => {
        const submit = between('onSubmit={(event, submissionMeta) => {', 'onStop={handleStopStreaming}');
        expect(submit).toContain('investigateEnabled: deep,');
        expect(submit).toMatch(/isDefaultEffort\(effortForTurn\(composerEffort, deep\)\)\s*\?\s*\{\}\s*:\s*\{ effort: effortForTurn\(composerEffort, deep\) \}/);
    });

    it('a turn resolves its level once, records it on both messages, and sends it only off the default', () => {
        const turn = between('const handleSubmit = async', 'const updateClarificationDraft');
        expect(turn).toContain('const turnEffort = effortForTurn(requestSearchOptions?.effort ?? options.effort, investigateEnabled);');
        // Every message this turn writes carries it beside the pipeline flag.
        const flags = turn.match(/investigateMode: investigateEnabled,\n\s*effort: /g) || [];
        expect(flags.length).toBeGreaterThanOrEqual(8);
        expect(turn).toMatch(/investigateMode: investigateEnabled,\n\s*effort: effortOf\(update\.effort\) \|\| turnEffort,/);
        expect(turn).toContain('effort: effortForRequest(turnEffort, investigateEnabled),');
        // Priced at the level, too.
        expect(turn).toMatch(/effectiveTier\(requestSearchOptions\?\.serviceTier, \{ isGuest \}\),\s*turnEffort,/);
    });

    it('a guest\'s High question asks them to sign in before anything is drawn', () => {
        const turn = between('const handleSubmit = async', 'const optimisticRunHistory');
        expect(turn).toMatch(/if \(isGuest && !investigateEnabled && isGuestLockedEffort\(turnEffort\)\) \{\s*requireSignIn\(guestEffortReason\(turnEffort\)\);/);
    });

    it('a queued follow-up released in the background runs at its own level', () => {
        const turn = between('const runBackgroundTurn = async', 'messagesOverride: [...base, userMessage]');
        expect(turn).toContain('const turnEffort = effortForTurn(requestSearchOptions?.effort, investigateEnabled);');
        expect(turn).toContain('effort: effortForRequest(turnEffort, investigateEnabled),');
    });

    it('a regenerate or an edit re-asks at the level the question was asked at', () => {
        expect(between('const handleRegenerateResponse', 'const handleAskInInvestigate'))
            .toContain('effort: assistantMessage.effort || userMessage.effort,');
        expect(between('const handleSaveEdit', 'const handleCopyMessage'))
            .toContain('effort: chatHistory[index]?.effort,');
    });

    it('Saved stamps the exchange with its row, invocation id and level', () => {
        const turn = between('const handleSubmit = async', 'const updateClarificationDraft');
        const saved = turn.slice(turn.indexOf("case 'saved': {"));
        expect(saved).toContain('...(update.messageId ? { messageId: update.messageId } : {}),');
        expect(saved).toContain('...(savedEffort ? { effort: savedEffort } : {}),');
    });

    it('a guest refused for the level is not moved off their model', () => {
        const handler = between('const handleRefusal = useCallback', '}, [requireSignIn, refreshTierStatus]);');
        expect(handler).toContain("&& refusal.reason !== 'effort'");
    });
});
