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
 * The header title for each phase.
 *
 * Titles follow the design recording for the five phases it shows; `planning` / `screening` /
 * `finalizing` are not in the recording and take their wording from the content-mapping doc.
 *
 * There used to be an `etaMin` here — a per-phase "~6 min" estimate lifted off the recording. It
 * was dropped: it stepped only on a phase change, so it sat frozen for minutes at a stretch, and
 * its ladder was never reconciled with a measured run. The header now shows elapsed time instead.
 */
export const INVESTIGATE_PHASE_META = {
    planning: { title: 'Investigating...' },
    searching: { title: 'Searching...' },
    screening: { title: 'Screening...' },
    reading: { title: 'Reading...' },
    analyzing: { title: 'Analyzing...' },
    writing: { title: 'Writing...' },
    verifying: { title: 'Verifying...' },
    finalizing: { title: 'Polishing...' },
    summary: { title: 'Report ready' },
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
