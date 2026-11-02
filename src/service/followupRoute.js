/**
 * How the agent chose to answer an Investigate follow-up (glkb-agent
 * docs/investigate-followup-routing.md).
 *
 * A follow-up in an Investigate conversation no longer always runs a whole deep-research pass.
 * Before any retrieval the agent judges how much research the question needs and says so with a
 * frame of its own, then stamps the same choice on the answer's `Complete` frame (`route`):
 *
 *   answer_from_prior  answerable from the earlier reports and their evidence: the CHAT agent
 *                      answers, in about thirty seconds, at the tier's chat price
 *   incremental        needs new evidence but overlaps the earlier scope: deep research that
 *                      reuses what was already read (Phase 2), at half the Investigate price
 *   full               a new topic, or anything the router was unsure of: deep research as before
 *
 * First turns are never routed (`route` null), and neither is a turn the reader forced with
 * "Run a full investigation" (`force_full_research: true`; its `route` is "full").
 *
 * Dependency-free so the stream parser, the trace replay and the panels can all share it.
 */

export const FOLLOWUP_ROUTES = ['answer_from_prior', 'incremental', 'full'];

/** A route this client knows, or null — for a first turn, a chat turn, or a value it does not. */
export const followupRouteOf = (value) => (FOLLOWUP_ROUTES.includes(value) ? value : null);

const ROUTE_LABELS = {
    answer_from_prior: 'Answering from the earlier investigation',
    incremental: 'Building on the earlier investigation',
    full: 'Running a full investigation',
};

/** What the run is doing, in the reader's words; '' for an unknown route. */
export const followupRouteLabel = (route) => ROUTE_LABELS[followupRouteOf(route)] || '';

/**
 * The line the thoughts carry for the agent's choice: its label, then the router's one-sentence
 * reason when it gave one ("Answering from the earlier investigation — the second point is in
 * the report"). '' for an unknown route.
 */
export const followupRouteText = (route, reason = '') => {
    const label = followupRouteLabel(route);
    if (!label) return '';
    const why = typeof reason === 'string' ? reason.trim() : '';
    return why ? `${label} — ${why}` : label;
};

/**
 * Whether the progress panel keeps the choice as a standing line under its header. Only for a
 * route that changes what the reader is about to get: a full investigation is what the panel
 * already shows, so it says nothing extra there (the thoughts still record it).
 */
export const routeShowsOnPanel = (route) => (
    followupRouteOf(route) === 'answer_from_prior' || followupRouteOf(route) === 'incremental'
);

/**
 * The route an answer was given: the `Complete` frame's (authoritative), else the one the
 * `followup_route` frame announced earlier in the same run — all a run has to go on when its
 * Complete did not carry the field (a stream that dropped and was recovered from the run
 * record, or an agent from before the field). null when neither says.
 */
export const settledRoute = (completeRoute, announcedRoute) => (
    followupRouteOf(completeRoute) || followupRouteOf(announcedRoute) || null
);

/**
 * The fields a finished answer carries for its route: `{ followupRoute }`, or `{}` when it has
 * none — a chat answer and a first Investigate turn stay exactly the shape they were.
 */
export const followupRouteFields = (completeRoute, announcedRoute) => {
    const route = settledRoute(completeRoute, announcedRoute);
    return route ? { followupRoute: route } : {};
};

/**
 * How a message is drawn, given its route. `answeredFromPrior` is an Investigate turn the chat
 * agent answered from the earlier investigation: it is drawn as a chat answer — no "Investigated
 * for …" row, no funnel, the chat's live panel — and offers a full investigation under it.
 * `investigateReport` is everything else Investigate, drawn as before. While a run is live the
 * route comes from the `followup_route` frame (`liveRoute`); once it settles, from the message.
 */
export const routedPresentation = ({ investigateMode, followupRoute, liveRoute, isLoading }) => {
    const route = followupRouteOf(isLoading ? liveRoute : followupRoute);
    const answeredFromPrior = Boolean(investigateMode) && route === 'answer_from_prior';
    return {
        route: investigateMode ? route : null,
        answeredFromPrior,
        investigateReport: Boolean(investigateMode) && !answeredFromPrior,
        builtOnEarlier: Boolean(investigateMode) && route === 'incremental',
    };
};
