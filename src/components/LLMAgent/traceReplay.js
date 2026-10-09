/**
 * Rebuild a finished turn's process trace from what the backend stored with it.
 *
 * The thought list under an answer ("Thought for 41s"), the model's narration before each
 * tool call, and an investigation's summary (duration, funnel, phase, the steps behind it)
 * were built in the page from the live stream and kept nowhere else — so a reload, which
 * rebuilds every turn from the server's history, showed them all empty. The backend now
 * records the frames it relays and returns them as `trace` on the answer
 * (glkb-backend `app/services/trace_recorder.py`); this replays them.
 *
 * Replayed, not re-derived: each frame goes through `frameToUpdate`, the same mapping the
 * live stream uses, and the updates are folded with the same merge helpers the live view
 * uses (they live here now, and `index.jsx` imports them). What is folded, and how, mirrors
 * the `started` / `step` / `thinking` / `delta` / `final` cases of the live handler.
 */
import { frameToUpdate, inferInvestigatePhase as inferPhase } from '../../service/LLMAgent';
import { INVESTIGATE_PHASE_ORDER, PHASE_PERCENT_FLOOR } from '../../service/investigatePhases';
import { emptyFunnel, mergeFunnel } from './funnel';

export const mergeLiveKeywords = (prev, next) => {
    if (!Array.isArray(next) || !next.length) return prev || [];
    return Array.from(new Set([...(prev || []), ...next.map(String)]));
};

export const mergeLivePapers = (prev, next) => {
    if (!Array.isArray(next) || !next.length) return prev || [];
    const map = new Map();
    [...(prev || []), ...next].forEach((paper) => {
        if (!paper) return;
        const key = paper.pmid || paper.id || paper.title;
        if (!key) return;
        map.set(String(key), paper);
    });
    return Array.from(map.values());
};

/**
 * Fold one progress frame's structured fields into the accumulated detail. Kept additive: a
 * frame that omits `facets` must not blank the facets the analyzing step is displaying, and the
 * writing frames only carry section/step/total. Keys are renamed to the shapes the panel reads.
 */
export const mergeInvestigateDetail = (prev, next, label) => {
    const out = { ...(prev || {}) };
    if (Array.isArray(next.topic) && next.topic.length) out.topic = next.topic.map(String);
    if (Array.isArray(next.facets) && next.facets.length) out.facets = next.facets.map(String);
    // Retrieval channels reporting one by one. Accumulated (not replaced) and de-duplicated by
    // name, because each frame carries the running list and a later frame must not drop an
    // earlier probe's result.
    if (Array.isArray(next.channels) && next.channels.length) {
        const byName = new Map((out.channels || []).map((c) => [c.name, c]));
        next.channels.forEach((c) => {
            if (!c || !c.name) return;
            // `pending` = announced but still running. Carried through so the panel can say
            // "searching…" instead of showing an unfinished probe as a failure.
            byName.set(String(c.name), {
                name: String(c.name),
                hits: Number(c.hits) || 0,
                ok: c.ok !== false,
                pending: c.pending === true,
            });
        });
        out.channels = Array.from(byName.values());
    }
    // `facets` is capped for display; `n_facets` is the true count.
    if (Number.isFinite(Number(next.n_facets))) out.nFacets = Number(next.n_facets);
    if (Number.isFinite(Number(next.n_claims))) out.nClaims = Number(next.n_claims);
    if (Number.isFinite(Number(next.n_conflicted))) out.nConflicted = Number(next.n_conflicted);
    // `step`/`total` only mean "report section i of n" on the writing frames — the reading frame
    // also carries a `total` (the paper count), which must not be read as a section count.
    if (next.section) {
        out.section = String(next.section);
        if (Number.isFinite(Number(next.step))) out.step = Number(next.step);
        if (Number.isFinite(Number(next.total))) out.totalSections = Number(next.total);
    }
    if (label) out.label = String(label);
    return out;
};

/**
 * Phases only ever move forward. A frame that names an earlier phase — a late-arriving event, a
 * phase inferred from free text, or a stage that reports its own completion — must not rewind the
 * header from "Reading..." back to "Searching...". Unknown phases are ignored rather than
 * treated as a reset.
 */
export const mergePhaseMonotonic = (prev, next) => {
    if (!next) return prev;
    if (!prev) return next;
    const a = INVESTIGATE_PHASE_ORDER.indexOf(prev);
    const b = INVESTIGATE_PHASE_ORDER.indexOf(next);
    if (b < 0) return prev;
    if (a < 0) return next;
    return b >= a ? next : prev;
};

export const mergePercentMonotonic = (prev, next) => {
    if (!Number.isFinite(Number(next))) return prev;
    const n = Math.max(0, Math.min(100, Math.round(Number(next))));
    if (!Number.isFinite(Number(prev))) return n;
    return Math.max(Number(prev), n);
};

const normalizeTrace = (trace) => {
    if (!trace) return null;
    if (typeof trace === 'string') {
        try {
            return normalizeTrace(JSON.parse(trace));
        } catch (error) {
            return null;
        }
    }
    if (typeof trace !== 'object' || !Array.isArray(trace.frames)) return null;
    return trace;
};

/**
 * The message fields a stored trace stands for, or `{}` when there is none.
 *
 * `{}` rather than nulls, so spreading it over a message never erases fields the message
 * already had — an answer saved before traces were stored reloads exactly as it did before.
 */
export const replayTrace = (rawTrace) => {
    const trace = normalizeTrace(rawTrace);
    if (!trace) return {};
    const investigate = trace.mode === 'investigate';

    let thinkingSteps = [];
    let preamble = { text: '', index: -1 };
    let answerBuffer = { block: -1, text: '' };
    let phase = 'planning';
    let funnel = emptyFunnel();
    let percent = investigate ? PHASE_PERCENT_FLOOR.planning : null;
    let keywords = [];
    let papers = [];

    const foldProgress = (update, rawContent = '') => {
        phase = mergePhaseMonotonic(
            phase,
            update.phase || (update.type === 'step'
                ? inferPhase(update.step, rawContent)
                : null),
        );
        if (update.funnel) funnel = mergeFunnel(funnel, update.funnel);
        percent = mergePercentMonotonic(
            percent,
            update.type === 'step' ? (update.percent ?? PHASE_PERCENT_FLOOR[phase]) : update.percent,
        );
        if (update.keywords) keywords = mergeLiveKeywords(keywords, update.keywords);
        if (update.papers) papers = mergeLivePapers(papers, update.papers);
    };

    trace.frames.forEach((frame) => {
        const update = frameToUpdate(frame);
        if (!update) return;
        switch (update.type) {
            case 'started':
                if (update.phase) phase = update.phase;
                foldProgress({ ...update, phase: null });
                break;
            case 'step': {
                const rawContent = update.content ?? '';
                foldProgress(update, rawContent);
                if (update.isProgress && update.label && update.phase) {
                    thinkingSteps = [...thinkingSteps, {
                        step: update.step || update.phase,
                        content: update.label,
                        isProgress: true,
                        phase: update.phase,
                    }];
                }
                if (rawContent.trim() && !update.isProgress) {
                    thinkingSteps = [...thinkingSteps, { step: update.step, content: rawContent }];
                }
                break;
            }
            case 'thinking': {
                preamble = { ...preamble, text: preamble.text + update.delta };
                const entry = { step: 'Thinking', content: preamble.text, isThought: true };
                if (preamble.index < 0) {
                    preamble = { ...preamble, index: thinkingSteps.length };
                    thinkingSteps = [...thinkingSteps, entry];
                } else {
                    thinkingSteps = thinkingSteps.map((s, i) => (i === preamble.index ? entry : s));
                }
                break;
            }
            case 'delta':
                if (update.block > answerBuffer.block) {
                    const narration = answerBuffer.text.trim();
                    if (narration) {
                        thinkingSteps = [...thinkingSteps, {
                            step: 'Thinking', content: narration, isThought: true,
                        }];
                    }
                    answerBuffer = { block: update.block, text: update.delta };
                } else if (update.block === answerBuffer.block) {
                    answerBuffer = { block: answerBuffer.block, text: answerBuffer.text + update.delta };
                }
                break;
            case 'final':
                if (update.funnel) funnel = mergeFunnel(funnel, update.funnel);
                break;
            default:
                break;
        }
    });

    // The recorder drops the answer's own block, so whatever is still buffered here is the
    // last narration before it — which the live view had already moved into the thoughts
    // by the time the answer's first token arrived.
    const narration = answerBuffer.text.trim();
    if (narration) {
        thinkingSteps = [...thinkingSteps, { step: 'Thinking', content: narration, isThought: true }];
    }

    const durationMs = Number(trace.duration_ms);
    const out = {
        thinkingSteps,
        thoughtDurationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null,
    };
    if (Array.isArray(trace.trajectory) && trace.trajectory.length) {
        out.trajectory = trace.trajectory;
    }
    if (investigate) {
        const complete = trace.complete !== false;
        Object.assign(out, {
            investigateMode: true,
            investigateFunnel: funnel,
            // What the live `final` handler settles on.
            investigatePhase: phase || 'verifying',
            investigatePercent: complete ? (mergePercentMonotonic(percent, 100) ?? 100) : percent,
            investigateKeywords: keywords,
            investigatePapers: papers,
        });
    }
    return out;
};
