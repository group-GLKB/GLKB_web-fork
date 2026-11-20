/**
 * Deployment switches.
 *
 * This file is intentionally the ONLY thing that differs between `master` and
 * `production` — every other file should merge clean between the two branches.
 * If you need a deployment-specific difference, add a flag here rather than
 * editing a component on one branch only.
 *
 *   master     — all true (everything on, current behaviour)
 *   production — all false (API docs, Investigate and Literature Review not open to users yet)
 *
 * A NEW flag has no line on `production` yet, so a merge brings master's value in silently. A flag
 * that must stay off in production until launch has to be off there by construction (see
 * LITERATURE_REVIEW_ENABLED), not by trusting whoever merges to remember it.
 */

/**
 * Whether the API documentation is reachable.
 *
 * Gates BOTH the entry points (the "API Docs" button on the API dashboard, the
 * footer link, the line on Contact) and the `/api-docs` routes themselves, which
 * are then neither routed nor prerendered. They have to move together: with the
 * routes redirected to `/` but a link showing, the link just bounces the user to
 * the home page.
 *
 * Off everywhere since 2026-11-04 (owner: take the API Docs button down for now).
 * Turning it back on restores all of it.
 */
export const SHOW_API_DOCS = false;

/**
 * Whether Investigate (deep research) is offered.
 *
 * When false the Investigate toggle is not rendered on the home search box, so
 * no request can carry `investigateEnabled` and every question goes through
 * ordinary chat.
 */
export const INVESTIGATE_ENABLED = true;

/**
 * Whether Literature Review is offered. On everywhere, glkb.org included, since 2026-10-14.
 *
 * On: the home search box's Investigate chip becomes a two-tool dropdown (Investigate /
 * Literature Review), the `/literature-review` page exists, and History opens Literature Review
 * conversations there. Off: the chip is plain Investigate as before, the route redirects home,
 * and no request to `/api/v1/literature-review` can be made from the UI. The feature is a
 * separate pipeline end to end (backend `/literature-review`, glkb-agent `literature_review/`),
 * so turning it off here touches nothing chat or Investigate depend on.
 *
 * `production` has no line for this flag, so an ordinary master -> production merge brings this
 * file's line in WITHOUT a conflict (checked with `git merge-tree` on 2026-09-30): whatever master
 * says here is what glkb.org gets with the next release.
 *
 * THE SWITCH is the `LITERATURE_REVIEW_ENABLED` line near the end of this file — one value, nothing
 * else to change:
 *   false                 off everywhere (2026-10-09; also 10-03 to 10-06)
 *   !isProductionSite()   on for dev.glkb.org and localhost, off on glkb.org (internal testing,
 *                         2026-10-10 to 10-14, for the redesigned review pages)
 *   true                  on everywhere (launch; current since 2026-10-14)
 * Off hides the entry points only; the page, the client and the pipeline stay in the codebase.
 */

export const PRODUCTION_HOSTS = ['glkb.org', 'www.glkb.org'];

export const isProductionSite = (hostname = (typeof window !== 'undefined' ? window.location.hostname : '')) => (
    PRODUCTION_HOSTS.includes(String(hostname || '').toLowerCase())
);

/**
 * Where a signed-in reader ADDS FUNDS: the U-M Innovation Partnerships store page for GLKB web
 * access (a separate U-M site, with its own account).
 *
 * A payment there adds DOLLARS to the account's balance (`POST /api/v1/payment/elucid/webhook`,
 * glkb-backend `app/services/elucid_service.py`), matched to a GLKB account by the EMAIL used at
 * checkout. Dollars become web credits only on the Account page's "Buy more" (POST
 * /balance/exchange, $0.10 a credit). The Account page asks before sending the reader there
 * ("Leaving GLKB", Figma 244:4476).
 *
 * Empty hides Add funds and every "Buy credits" entry. On for dev.glkb.org and localhost, off on
 * glkb.org until the production backend has the exchange (POST /balance/exchange, 2026-11-10)
 * and the owner opens purchasing there: then drop the isProductionSite() test.
 */
export const STORE_URL = 'https://available-inventions.umich.edu/product/genomic-literature-knowledge-base---web-access';
export const ADD_FUNDS_URL = isProductionSite() ? '' : STORE_URL;

/**
 * Where the chat's "Buy credits" entries (the out-of-credits notice and dialog) go: the Account
 * page, opened on its Buy more dialog — credits are bought there, with the balance. A new tab, so
 * the conversation stays where it was. Empty (no store configured) hides those entries.
 */
export const ACCOUNT_BUY_CREDITS_PATH = '/account?buy=credits';
export const CREDITS_PURCHASE_URL = ADD_FUNDS_URL ? ACCOUNT_BUY_CREDITS_PATH : '';

export const LITERATURE_REVIEW_ENABLED = true;

/**
 * Whether a literature review stops at its outline for the reader to approve before anything is
 * written (OutlineStep: rename, reorder, resize or leave out sections, then "Approve & start writing").
 *
 *   false                 off everywhere (2026-10-13 to 10-27: "确认大纲留在之后做"); the review runs
 *                         straight through, Scope says "Start writing", nothing looks for an outline
 *   !isProductionSite()   on for dev.glkb.org and localhost, off on glkb.org (current since
 *                         2026-10-27, the outline page's first version)
 *   true                  on everywhere
 *
 * On needs glkb-agent and glkb-backend with section lengths in the approval (2026-10-27) deployed
 * first. Defined after isProductionSite, which it calls when the module loads.
 */
export const LR_OUTLINE_APPROVAL_ENABLED = !isProductionSite();

/**
 * Whether an answer at High, Extra or Max draws the ANSWER graph — what the answer says, built
 * after it by the backend (`POST /api/v1/new-llm-agent/answer-graph`; components/AnswerGraph/
 * AnswerGraphV2.jsx) — instead of the basic co-occurrence graph.
 *
 *   !isProductionSite()   on for dev.glkb.org and localhost, off on glkb.org (current since
 *                         2026-11-05: the effort levels are dev-only until the owner says otherwise)
 *   true                  on everywhere
 *
 * Safe on a backend that does not have the endpoint yet: its 404 is remembered for the page load
 * and every answer draws the basic graph, as before. Off, nothing asks for it at all.
 */
export const ANSWER_GRAPH_V2_ENABLED = !isProductionSite();

/**
 * Whether the chat offers the SIDE CHAT (2026-11-20): a quick question about the conversation on
 * screen, answered in a panel beside it and never saved (components/LLMAgent/SideChatPanel.jsx,
 * service/sideChat.js; backend `POST /api/v1/new-llm-agent/side-chat`). Entry points: the "Side
 * chat" button at the top right of a chat, ⌘; / Ctrl+;, and "Ask in side chat" over a selection
 * in an answer.
 *
 *   !isProductionSite()   on for dev.glkb.org and localhost, off on glkb.org (current since
 *                         2026-11-20, like the other new features)
 *   true                  on everywhere
 *
 * On also needs the backend to offer it: `GET /credits/pricing` `side_chat.enabled` (the policy's
 * switch); a backend without the block offers nothing, so nothing is shown.
 */
export const SIDE_CHAT_ENABLED = !isProductionSite();
