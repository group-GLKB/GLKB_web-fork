/**
 * How the agent chose to answer an Investigate follow-up, as the reader sees it
 * (glkb-agent docs/investigate-followup-routing.md, "Contract" and "Web").
 *
 * The agent judges each follow-up before any retrieval and says so with a frame —
 *   { step: 'Choosing how to answer', type: 'followup_route', route, reason }
 * — then stamps the choice on the answer's Complete frame (`route`). Pinned here:
 *   * the frame becomes a line in the thoughts and, for `answer_from_prior` / `incremental`, a
 *     standing line on the progress panel ("Answering from the earlier investigation — …");
 *     nothing extra on the panel for `full`;
 *   * an `answer_from_prior` answer — a chat Complete inside an Investigate conversation — is
 *     drawn as a chat answer: its citations and references, its graph when it came with one,
 *     no "Investigated for …" row and no funnel; while it is written, the chat's panel, not the
 *     investigation's counters; and under it "Answered from the earlier investigation" with
 *     "Run a full investigation" at the Investigate price;
 *   * an `incremental` answer is an Investigate report with a "Built on the earlier
 *     investigation" note;
 *   * all of it comes back on reload, from the stored trace;
 *   * chat answers and first Investigate turns draw exactly as before.
 */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

/* eslint-disable import/first */
jest.mock('../AnswerGraph/AnswerGraphForMessage', () => () => <div data-testid="answer-graph" />);
jest.mock('../../service/serviceTiers', () => ({
    ...jest.requireActual('../../service/serviceTiers'),
    fetchTierPricing: jest.fn(),
}));

import { MessageCard } from './index';
import ChatProgress from './ChatProgress';
import InvestigateProgress from './InvestigateProgress';
import { BuiltOnEarlierNote, FullInvestigationOffer } from './FollowupRouteNotice';
import { mergeInvestigateDetail, replayTrace } from './traceReplay';
import stepLabels from './step.json';
import { frameToUpdate } from '../../service/LLMAgent';
import {
    followupRouteFields,
    followupRouteOf,
    followupRouteText,
    routedPresentation,
    routeShowsOnPanel,
    settledRoute,
} from '../../service/followupRoute';
import { PHASE_PERCENT_FLOOR } from '../../service/investigatePhases';
import { fetchTierPricing, parsePricing } from '../../service/serviceTiers';
/* eslint-enable import/first */

const PRICING = parsePricing({
    default_service_tier: 'advanced',
    prices: [
        { pipeline: 'chat', service_tier: 'standard', credits: 1, enabled: true },
        { pipeline: 'chat', service_tier: 'advanced', credits: 5, enabled: true },
        { pipeline: 'deep_research', service_tier: 'standard', credits: 20, enabled: true },
        { pipeline: 'deep_research', service_tier: 'advanced', credits: 30, enabled: true },
        { pipeline: 'deep_research', service_tier: 'premium', credits: 45, enabled: true },
    ],
});

const REASON = 'the earlier report already compares these two studies';
const ROUTE_FRAME = (route, reason = REASON) => ({
    step: 'Choosing how to answer', type: 'followup_route', route, reason,
});

beforeAll(() => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
});

beforeEach(() => {
    fetchTierPricing.mockReset();
    fetchTierPricing.mockResolvedValue(PRICING);
});

describe('the followup_route frame', () => {
    it('becomes a line in the thoughts and a standing detail for the panel', () => {
        const update = frameToUpdate(ROUTE_FRAME('answer_from_prior'));
        expect(update).toEqual(expect.objectContaining({
            type: 'step',
            step: 'Choosing how to answer',
            content: `Answering from the earlier investigation — ${REASON}`,
            isProgress: false,
        }));
        expect(update.detail).toEqual({ followup_route: 'answer_from_prior', followup_reason: REASON });
    });

    it('says what each route does', () => {
        expect(frameToUpdate(ROUTE_FRAME('incremental')).content)
            .toBe(`Building on the earlier investigation — ${REASON}`);
        expect(frameToUpdate(ROUTE_FRAME('full', '')).content).toBe('Running a full investigation');
        expect(followupRouteText('answer_from_prior', '  ')).toBe('Answering from the earlier investigation');
    });

    it("pins the phase to planning — the router's reason is prose, not a phase", () => {
        // "reading", "papers", "write" in the reason must not move the run on.
        const update = frameToUpdate(ROUTE_FRAME('full', 'needs papers on reading frames to write about'));
        expect(update.phase).toBe('planning');
    });

    it('says nothing for a route this client does not know', () => {
        const update = frameToUpdate(ROUTE_FRAME('telepathy'));
        expect(update.content).toBe('');
        expect(update.detail).toEqual({});
    });

    it('groups under its own heading in the thoughts', () => {
        expect(stepLabels['Choosing how to answer']).toBe('Choosing how to answer');
    });

    it('is kept by the panel detail across the frames that follow it', () => {
        let detail = mergeInvestigateDetail({}, frameToUpdate(ROUTE_FRAME('incremental')).detail, '');
        detail = mergeInvestigateDetail(detail, { topic: ['NR4A1'] }, 'Searching 3 facets');
        detail = mergeInvestigateDetail(detail, { followup_route: 'nonsense' }, 'Reading 40 papers');
        expect(detail.followupRoute).toBe('incremental');
        expect(detail.followupReason).toBe(REASON);
        expect(detail.label).toBe('Reading 40 papers');
    });
});

describe("the Complete frame's route", () => {
    it('is read off the frame: the three routes, nothing else', () => {
        ['answer_from_prior', 'incremental', 'full'].forEach((route) => {
            expect(frameToUpdate({ step: 'Complete', response: 'a', route }).route).toBe(route);
        });
        // A first turn, a chat turn, and anything this client does not know.
        expect(frameToUpdate({ step: 'Complete', response: 'a' }).route).toBeNull();
        expect(frameToUpdate({ step: 'Complete', response: 'a', route: null }).route).toBeNull();
        expect(frameToUpdate({ step: 'Complete', response: 'a', route: 'quick' }).route).toBeNull();
    });

    it("wins over the frame's announcement, which stands in only when it is missing", () => {
        expect(settledRoute('full', 'answer_from_prior')).toBe('full');
        expect(settledRoute(null, 'answer_from_prior')).toBe('answer_from_prior');
        expect(settledRoute(undefined, undefined)).toBeNull();
        // A message without a route keeps its old shape: no key at all.
        expect(followupRouteFields(null, null)).toEqual({});
        expect(followupRouteFields('incremental')).toEqual({ followupRoute: 'incremental' });
        expect(followupRouteOf('answer_from_prior')).toBe('answer_from_prior');
    });
});

describe('how a message is drawn', () => {
    it('draws an answer_from_prior turn as a chat answer, in an Investigate conversation', () => {
        expect(routedPresentation({ investigateMode: true, followupRoute: 'answer_from_prior', isLoading: false }))
            .toEqual({ route: 'answer_from_prior', answeredFromPrior: true, investigateReport: false, builtOnEarlier: false });
    });

    it('follows the live frame while the run is written, and the message once it settles', () => {
        expect(routedPresentation({
            investigateMode: true, followupRoute: undefined, liveRoute: 'answer_from_prior', isLoading: true,
        }).answeredFromPrior).toBe(true);
        expect(routedPresentation({
            investigateMode: true, followupRoute: undefined, liveRoute: 'answer_from_prior', isLoading: false,
        }).answeredFromPrior).toBe(false);
    });

    it('leaves every other turn as it was', () => {
        // A first Investigate turn, a full and an incremental one: reports.
        [undefined, 'full', 'incremental'].forEach((followupRoute) => {
            expect(routedPresentation({ investigateMode: true, followupRoute, isLoading: false }).investigateReport)
                .toBe(true);
        });
        expect(routedPresentation({ investigateMode: true, followupRoute: 'incremental' }).builtOnEarlier).toBe(true);
        // A chat answer is never routed, whatever it carries.
        expect(routedPresentation({ investigateMode: false, followupRoute: 'answer_from_prior', isLoading: false }))
            .toEqual({ route: null, answeredFromPrior: false, investigateReport: false, builtOnEarlier: false });
    });

    it('keeps a full investigation off the panel', () => {
        expect(routeShowsOnPanel('answer_from_prior')).toBe(true);
        expect(routeShowsOnPanel('incremental')).toBe(true);
        expect(routeShowsOnPanel('full')).toBe(false);
        expect(routeShowsOnPanel(null)).toBe(false);
    });
});

describe('the progress panels', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => {
        act(() => { jest.runOnlyPendingTimers(); });
        jest.useRealTimers();
    });

    const investigatePanel = (detail) => (
        <InvestigateProgress
            phase="searching"
            funnel={{ retrieved: null, screened: null, extracted: null, cited: null }}
            percent={PHASE_PERCENT_FLOOR.searching}
            keywords={[]}
            papers={[]}
            detail={detail}
            label=""
            expanded
        />
    );

    it('shows the choice under "Interpreted as", for the rest of the run', () => {
        render(investigatePanel({
            interpretedAs: 'What about NR4A1 in mouse models?',
            followupRoute: 'incremental',
            followupReason: 'the earlier report covered human cells only',
        }));
        expect(screen.getByText('Interpreted as:')).toBeInTheDocument();
        const line = screen.getByText('Building on the earlier investigation').closest('p');
        expect(line).toHaveTextContent('Building on the earlier investigation — the earlier report covered human cells only');
    });

    it('shows nothing extra for a full investigation, or for a first question', () => {
        const { rerender } = render(investigatePanel({ followupRoute: 'full', followupReason: 'a new topic' }));
        expect(screen.queryByText(/Running a full investigation/)).toBeNull();
        rerender(investigatePanel({}));
        expect(document.querySelector('.ip-route')).toBeNull();
    });

    it("the chat's panel carries the same lines when the chat agent answers a follow-up", () => {
        const { rerender } = render(
            <ChatProgress
                phase="searching"
                startedAt={Date.now()}
                followupDetail={{
                    interpretedAs: 'Explain the second point of the report',
                    followupRoute: 'answer_from_prior',
                    followupReason: REASON,
                }}
            />,
        );
        expect(screen.getByText('Interpreted as:')).toBeInTheDocument();
        expect(screen.getByText('Answering from the earlier investigation').closest('p'))
            .toHaveTextContent(`Answering from the earlier investigation — ${REASON}`);
        // A chat run passes nothing, and shows nothing new.
        rerender(<ChatProgress phase="searching" startedAt={Date.now()} />);
        expect(screen.queryByText('Interpreted as:')).toBeNull();
        expect(document.querySelector('.ip-route')).toBeNull();
    });
});

describe('the notices under a routed answer', () => {
    it('offers a full investigation at its price', async () => {
        const onRun = jest.fn();
        render(<FullInvestigationOffer serviceTier="premium" onRun={onRun} />);
        expect(screen.getByText('Answered from the earlier investigation')).toBeInTheDocument();
        const button = await screen.findByRole('button', { name: 'Run a full investigation, 45 credits' });
        fireEvent.click(button);
        expect(onRun).toHaveBeenCalledTimes(1);
    });

    it("prices at the pipeline's default tier when none is picked, and waits for the pricing", async () => {
        let resolvePricing;
        fetchTierPricing.mockReturnValue(new Promise((resolve) => { resolvePricing = resolve; }));
        render(<FullInvestigationOffer onRun={() => {}} />);
        expect(screen.getByRole('button', { name: 'Run a full investigation' })).toBeInTheDocument();
        await act(async () => { resolvePricing(PRICING); });
        expect(screen.getByRole('button', { name: 'Run a full investigation, 30 credits' })).toBeInTheDocument();
    });

    it('cannot be pressed while the conversation is still answering', () => {
        const onRun = jest.fn();
        render(<FullInvestigationOffer showPrice={false} disabled onRun={onRun} />);
        const button = screen.getByRole('button', { name: 'Run a full investigation' });
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(onRun).not.toHaveBeenCalled();
        expect(fetchTierPricing).not.toHaveBeenCalled();
    });

    it('notes a report that built on the earlier investigation', () => {
        render(<BuiltOnEarlierNote />);
        expect(screen.getByText('Built on the earlier investigation')).toBeInTheDocument();
    });
});

/* ── The card itself ─────────────────────────────────────────────────────────────────────── */

const ANSWER = 'NR4A1 drives exhaustion [111](https://pubmed.ncbi.nlm.nih.gov/111/) in both studies.';
const REFERENCES = [{
    title: 'NR4A1 and T-cell exhaustion',
    url: 'https://pubmed.ncbi.nlm.nih.gov/111/',
    pmid: '111',
    year: 2021,
    journal: 'Nature',
    authors: 'A. Author',
    citation_count: 40,
    evidence: [],
}];
const FUNNEL = { retrieved: 3000, screened: 120, extracted: 40, cited: 12 };

const assistant = (patch = {}) => ({
    role: 'assistant',
    content: ANSWER,
    references: REFERENCES,
    timestamp: '10:00',
    thinkingSteps: [{ step: 'Choosing how to answer', content: `Answering from the earlier investigation — ${REASON}` }],
    thoughtDurationMs: 28000,
    trajectory: null,
    investigateMode: true,
    investigateFunnel: FUNNEL,
    investigatePhase: 'summary',
    investigatePercent: 100,
    ...patch,
});

const card = (message, props = {}) => (
    <MessageCard
        index={3}
        message={message}
        referenceSortOption="Year"
        referenceSummaryMap={{}}
        totalMessages={4}
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
        onAskInInvestigate={() => {}}
        investigateTier="advanced"
        isGuest={false}
        onRunFullInvestigation={() => {}}
        {...props}
    />
);

describe('an answer given from the earlier investigation', () => {
    it('is drawn as a chat answer: citations and references, no investigation chrome', async () => {
        render(card(assistant({ followupRoute: 'answer_from_prior' })));
        // The answer, with its citation numbered from the references.
        const body = document.querySelector('.markdown-body');
        expect(body).toHaveTextContent('NR4A1 drives exhaustion 1 in both studies.');
        expect(within(body).getByRole('link')).toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/111/');
        // The chat's "Thought for …" row, not "Investigated for …" and its funnel.
        expect(screen.getByText(/^Thought for/)).toBeInTheDocument();
        expect(screen.queryByText(/Investigated for/)).toBeNull();
        expect(screen.queryByLabelText('Investigation funnel')).toBeNull();
        // No graph: none came with it, and it does not ask for one to be built.
        expect(screen.queryByTestId('answer-graph')).toBeNull();
        // Under it, outside the answer's own text: what happened, and the way to the full run.
        const notice = screen.getByRole('note');
        expect(notice).toHaveTextContent('Answered from the earlier investigation');
        expect(body).not.toContainElement(notice);
        expect(await within(notice).findByRole('button', { name: 'Run a full investigation, 30 credits' }))
            .toBeEnabled();
    });

    it('re-sends its own turn when the reader asks for the full investigation', async () => {
        const onRunFullInvestigation = jest.fn();
        render(card(assistant({ followupRoute: 'answer_from_prior' }), { onRunFullInvestigation }));
        fireEvent.click(await screen.findByRole('button', { name: /Run a full investigation, 30 credits/ }));
        expect(onRunFullInvestigation).toHaveBeenCalledWith(3);
    });

    it('holds the offer while the conversation is answering', async () => {
        render(card(assistant({ followupRoute: 'answer_from_prior' }), { interactionLocked: true }));
        expect(await screen.findByRole('button', { name: /Run a full investigation, 30 credits/ })).toBeDisabled();
    });

    it('draws its graph when the agent sent one with it', async () => {
        render(card(assistant({ followupRoute: 'answer_from_prior', kgQueryList: ['MATCH (n) RETURN n'] })));
        expect(screen.getByTestId('answer-graph')).toBeInTheDocument();
        await screen.findByRole('button', { name: /30 credits/ });
    });

    it("is drawn with the chat's panel while it is written, under the choice that was made", () => {
        jest.useFakeTimers();
        try {
            render(card(assistant({ content: '', references: [], followupRoute: undefined }), {
                isProcessing: true,
                investigateStartedAt: Date.now(),
                investigatePhase: 'planning',
                investigateDetail: {
                    interpretedAs: 'Which of these studies used human samples?',
                    followupRoute: 'answer_from_prior',
                    followupReason: REASON,
                },
            }));
            // The chat's stages, not the investigation's counters and notify control.
            expect(document.querySelector('.chat-progress .ip-head-title'))
                .toHaveTextContent('Understanding the question');
            expect(screen.queryByText('Retrieved')).toBeNull();
            expect(screen.queryByText(/Notify/)).toBeNull();
            expect(screen.getByText('Answering from the earlier investigation').closest('p'))
                .toHaveTextContent(`— ${REASON}`);
            expect(screen.getByText('Interpreted as:')).toBeInTheDocument();
            // No offer before the answer is in.
            expect(screen.queryByRole('button', { name: /Run a full investigation/ })).toBeNull();
        } finally {
            act(() => { jest.runOnlyPendingTimers(); });
            jest.useRealTimers();
        }
    });
});

describe('a report that built on the earlier investigation', () => {
    it('is an Investigate report, with a note', () => {
        render(card(assistant({ followupRoute: 'incremental', thinkingSteps: [] })));
        expect(screen.getByText(/Investigated for/)).toBeInTheDocument();
        expect(screen.getByLabelText('Investigation funnel')).toBeInTheDocument();
        expect(screen.getByText('Built on the earlier investigation')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Run a full investigation/ })).toBeNull();
        // An Investigate report always gets its graph.
        expect(screen.getByTestId('answer-graph')).toBeInTheDocument();
    });

    it("keeps the investigation's panel while it is written, with the choice under its header", () => {
        jest.useFakeTimers();
        try {
            render(card(assistant({ content: '', references: [], followupRoute: undefined }), {
                isProcessing: true,
                investigateStartedAt: Date.now(),
                investigatePhase: 'searching',
                investigatePercent: PHASE_PERCENT_FLOOR.searching,
                investigateFunnel: { retrieved: null, screened: null, extracted: null, cited: null },
                investigateDetail: { followupRoute: 'incremental', followupReason: 'mouse models are new' },
            }));
            expect(screen.getByText(/Notify/)).toBeInTheDocument();
            expect(screen.getByText('Building on the earlier investigation').closest('p'))
                .toHaveTextContent('— mouse models are new');
        } finally {
            act(() => { jest.runOnlyPendingTimers(); });
            jest.useRealTimers();
        }
    });
});

describe('every other answer', () => {
    it('a full or first Investigate turn is the report it was', () => {
        [undefined, 'full'].forEach((followupRoute) => {
            const { unmount } = render(card(assistant({ followupRoute, thinkingSteps: [] })));
            expect(screen.getByText(/Investigated for/)).toBeInTheDocument();
            expect(screen.queryByText('Built on the earlier investigation')).toBeNull();
            expect(screen.queryByText('Answered from the earlier investigation')).toBeNull();
            unmount();
        });
    });

    it('a chat answer is the chat answer it was', () => {
        render(card(assistant({
            investigateMode: false,
            investigateFunnel: undefined,
            // Even if a chat Complete carried one, a chat turn is never routed.
            followupRoute: 'answer_from_prior',
            thinkingSteps: [{ step: 'Searching', content: 'article_search' }],
        })));
        expect(screen.getByText(/^Thought for/)).toBeInTheDocument();
        expect(screen.queryByText('Answered from the earlier investigation')).toBeNull();
        expect(screen.queryByTestId('answer-graph')).toBeNull();
    });
});

describe('a reloaded routed turn', () => {
    const trace = (frames, mode = 'investigate') => ({
        v: 1, mode, complete: true, duration_ms: 31000, frames,
    });
    const STARTED = { step: 'Started', run_id: 'dr-2', session_id: 'web_dr_2', phase: 'searching' };
    const REWRITE = {
        step: 'Interpreting the question',
        type: 'question_rewritten',
        original: 'which of these used human samples?',
        question: 'Which of the studies in the NR4A1 report used human samples?',
    };

    it('comes back as the chat answer it was, with its offer', async () => {
        const replayed = replayTrace(trace([
            STARTED,
            REWRITE,
            ROUTE_FRAME('answer_from_prior'),
            { step: 'Processing', type: 'progress', phase: 'searching', label: 'Reading the saved evidence', percent: 25 },
            { step: 'Delta', block: 1, delta: 'Let me check the saved notes.' },
            { step: 'Complete', route: 'answer_from_prior', kg_query_list: ['MATCH (g) RETURN g'] },
        ]));
        expect(replayed.followupRoute).toBe('answer_from_prior');
        expect(replayed.investigateMode).toBe(true);
        expect(replayed.kgQueryList).toEqual(['MATCH (g) RETURN g']);
        expect(replayed.thinkingSteps).toEqual(expect.arrayContaining([
            { step: 'Interpreting the question', content: `Interpreted as: ${REWRITE.question}` },
            { step: 'Choosing how to answer', content: `Answering from the earlier investigation — ${REASON}` },
            { step: 'Thinking', content: 'Let me check the saved notes.', isThought: true },
        ]));

        render(card(assistant({ ...replayed, content: ANSWER, references: REFERENCES })));
        expect(screen.queryByText(/Investigated for/)).toBeNull();
        expect(screen.getByText('Answered from the earlier investigation')).toBeInTheDocument();
        expect(screen.getByTestId('answer-graph')).toBeInTheDocument();
        await screen.findByRole('button', { name: 'Run a full investigation, 30 credits' });
    });

    it("takes the Complete stub's route over the frame's, and the frame's when the stub has none", () => {
        expect(replayTrace(trace([STARTED, ROUTE_FRAME('answer_from_prior'), { step: 'Complete', route: 'full' }]))
            .followupRoute).toBe('full');
        expect(replayTrace(trace([STARTED, ROUTE_FRAME('answer_from_prior'), { step: 'Complete', cited: 3 }]))
            .followupRoute).toBe('answer_from_prior');
        expect(replayTrace(trace([STARTED, ROUTE_FRAME('incremental')])).followupRoute).toBe('incremental');
    });

    it('leaves a first turn and a chat answer without one', () => {
        expect(replayTrace(trace([STARTED, { step: 'Complete', cited: 3 }]))).not.toHaveProperty('followupRoute');
        expect(replayTrace(trace([{ step: 'Processing', content: 'Searching' }], 'chat')))
            .not.toHaveProperty('followupRoute');
    });
});
