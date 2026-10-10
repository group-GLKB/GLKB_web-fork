/**
 * What to tell the reader when the backend turned a question away before running it.
 *
 * The refusal is the parsed HTTP error (`refusalOf` in service/LLMAgent.jsx): credits and guest
 * limits are checked before the agent is called, so nothing ran and nothing was charged.
 */
import { tierLabel } from '../service/serviceTiers';

export const INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS';
export const GUEST_LIMIT_REACHED = 'GUEST_LIMIT_REACHED';
export const GUEST_LOGIN_REQUIRED = 'GUEST_LOGIN_REQUIRED';

/* Since 2026-10-09 a guest gets plain AI Chat (10 questions in all) and nothing else: these are
   what the sign-in overlay says when they reach for Investigate or the Graph Viewer. The backend
   refuses a guest's Investigate with the same code (`reason: "investigate"`). */
export const GUEST_INVESTIGATE_REASON = "Investigate is available to signed-in users. Sign in to use it — it's free.";
export const GUEST_GRAPH_VIEWER_REASON = "The Graph Viewer is available to signed-in users. Sign in to use it — it's free.";
export const GUEST_REVIEW_REASON = "Literature Review is available to signed-in users. Sign in to use it — it's free.";

/** Whether answering this refusal means signing in — a guest's limit, or a tier only members get. */
export const refusalNeedsSignIn = (refusal) => (
    refusal?.code === GUEST_LIMIT_REACHED || refusal?.code === GUEST_LOGIN_REQUIRED
);

/**
 * The sentence for the answer bubble. The backend's own `message` first — it names the numbers —
 * then, for credits, the cheaper choice it found ("Switch to GPT-6 Luna Investigate to continue
 * with 20 credits."), as the credits guide suggests.
 */
export const refusalText = (refusal) => {
    if (!refusal) return '';
    let text = refusal.message || '';
    if (!text) {
        if (refusal.code === INSUFFICIENT_CREDITS) text = 'Not enough credits for this query.';
        else if (refusalNeedsSignIn(refusal)) text = 'Please sign in to continue.';
        else text = 'This request could not be started.';
    }
    const cheaper = refusal.code === INSUFFICIENT_CREDITS ? refusal.cheaper_option : null;
    if (cheaper?.service_tier && Number.isFinite(Number(cheaper.credits))) {
        const mode = cheaper.pipeline === 'deep_research' ? ' Investigate' : ' AI Chat';
        text += ` Switch to ${tierLabel(cheaper.service_tier)}${mode} to continue with ${cheaper.credits} credits.`;
    }
    return text;
};
