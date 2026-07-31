/**
 * Deep Research phase table — the shared vocabulary between the agent's progress frames and the
 * investigate progress panel.
 *
 * Deliberately dependency-free: the panel and its tests import these constants, and pulling them
 * from `service/LLMAgent.jsx` would drag axios (and the app's auth interceptors) along with them.
 * `service/LLMAgent.jsx` re-exports everything here, so existing imports keep working.
 */

/**
 * Fallback percent by phase when the agent omits percent — and the floor the progress bar eases
 * toward. These MIRROR the agent's ladder in `my_agent/harness/orchestrator.py`; keep them in
 * sync, because `phasePercentCap` derives the bar's creep ceiling from the *next* phase's floor.
 */
export const PHASE_PERCENT_FLOOR = {
    planning: 2,
    searching: 6,
    screening: 14,
    reading: 22,
    analyzing: 35,
    writing: 40,
    verifying: 80,
    finalizing: 90,
    summary: 100,
};

/** Run order. Drives "has a later phase started?" (row tense) and the bar's creep cap. */
export const INVESTIGATE_PHASE_ORDER = [
    'planning', 'searching', 'screening', 'reading', 'analyzing',
    'writing', 'verifying', 'finalizing', 'summary',
];

/**
 * Header title + the ETA shown for each phase.
 *
 * `etaMin` steps ONCE per phase and is not interpolated (measured from the design recording:
 * 6 / 5 / 4 / 2 / 1 — `3` is deliberately skipped). The previous values for writing (3) and
 * verifying (2) were each off by one step.
 *
 * Titles follow the recording for the five phases it shows; `planning` / `screening` /
 * `finalizing` are not in the recording and take their wording from the content-mapping doc.
 */
export const INVESTIGATE_PHASE_META = {
    planning: { title: 'Investigating...', etaMin: 6 },
    searching: { title: 'Searching...', etaMin: 6 },
    screening: { title: 'Screening...', etaMin: 6 },
    reading: { title: 'Reading...', etaMin: 5 },
    analyzing: { title: 'Analyzing...', etaMin: 4 },
    writing: { title: 'Writing...', etaMin: 2 },
    verifying: { title: 'Verifying...', etaMin: 1 },
    finalizing: { title: 'Polishing...', etaMin: 1 },
    summary: { title: 'Report ready', etaMin: 0 },
};

/**
 * The ceiling the bar may creep to while a phase is in flight: just under the next phase's floor,
 * so the creep can never overshoot into territory the run has not reached.
 */
export const phasePercentCap = (phase) => {
    const idx = INVESTIGATE_PHASE_ORDER.indexOf(phase);
    if (idx < 0) return 99;
    const next = INVESTIGATE_PHASE_ORDER[idx + 1];
    if (!next) return 100;
    return Math.max(PHASE_PERCENT_FLOOR[phase] ?? 0, (PHASE_PERCENT_FLOOR[next] ?? 100) - 1);
};

/** Index of a phase in run order; unknown phases sort first so they can never look "later". */
export const phaseIndex = (phase) => {
    const i = INVESTIGATE_PHASE_ORDER.indexOf(phase);
    return i < 0 ? 0 : i;
};
