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
 * Gates BOTH the entry point (the "API Docs" button on the API dashboard) and
 * the `/api-docs` routes themselves. They have to move together: with the
 * routes redirected to `/` but the button showing, the button just bounces the
 * user to the home page.
 */
export const SHOW_API_DOCS = true;

/**
 * Whether Investigate (deep research) is offered.
 *
 * When false the Investigate toggle is not rendered on the home search box, so
 * no request can carry `investigateEnabled` and every question goes through
 * ordinary chat.
 */
export const INVESTIGATE_ENABLED = true;

/**
 * Whether Literature Review is offered. In internal testing — keep it FALSE on `production`.
 *
 * On: the home search box's Investigate chip becomes a two-tool dropdown (Investigate /
 * Literature Review), the `/literature-review` page exists, and History opens Literature Review
 * conversations there. Off: the chip is plain Investigate as before, the route redirects home,
 * and no request to `/api/v1/literature-review` can be made from the UI. The feature is a
 * separate pipeline end to end (backend `/literature-review`, glkb-agent `literature_review/`),
 * so turning it off here touches nothing chat or Investigate depend on.
 *
 * OFF on the production site whatever this branch says. `production` has no line for this flag, so
 * an ordinary master -> production merge brings this file's line in WITHOUT a conflict (checked with
 * `git merge-tree` on 2026-09-30: the merged file read `LITERATURE_REVIEW_ENABLED = true`) — a plain
 * `true` here would open the feature on glkb.org with the next unrelated release.
 *
 * THE SWITCH is the last line of this file — one value, nothing else to change:
 *   false                 off everywhere (10-03 to 10-06, and 10-07 for a few hours)
 *   !isProductionSite()   on for dev.glkb.org and localhost, off on glkb.org (current, since 2026-10-07)
 *   true                  on everywhere (launch)
 * Off hides the entry points only; the page, the client and the pipeline stay in the codebase.
 */
/**
 * Where a signed-in reader BUYS CREDITS: the e-Lucid store page for GLKB credits.
 *
 * The backend already credits a purchase there (`POST /api/v1/payment/elucid/webhook`,
 * glkb-backend `app/services/elucid_service.py`): $10 = 100 purchased credits that never
 * expire, spent after the free monthly allowance. The buyer is matched to a GLKB account by
 * the EMAIL used at checkout, so every entry tells the reader to use the address they sign in
 * with.
 *
 * Empty hides every "Buy credits" entry (the Account page row, the out-of-credits notice in
 * the chat): an entry with nowhere to go is worse than none. Set it to the store's URL to open
 * purchasing — nothing else needs to change.
 */
export const CREDITS_PURCHASE_URL = '';

export const PRODUCTION_HOSTS = ['glkb.org', 'www.glkb.org'];

export const isProductionSite = (hostname = (typeof window !== 'undefined' ? window.location.hostname : '')) => (
    PRODUCTION_HOSTS.includes(String(hostname || '').toLowerCase())
);

export const LITERATURE_REVIEW_ENABLED = !isProductionSite();
