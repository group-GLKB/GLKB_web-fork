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
 * `true` here would open the feature on glkb.org with the next unrelated release. So the value is
 * "not the production site": on for dev.glkb.org and localhost, off on glkb.org. To launch it,
 * replace the expression with `true`; to hide it everywhere, with `false`.
 */
export const PRODUCTION_HOSTS = ['glkb.org', 'www.glkb.org'];

export const isProductionSite = (hostname = (typeof window !== 'undefined' ? window.location.hostname : '')) => (
    PRODUCTION_HOSTS.includes(String(hostname || '').toLowerCase())
);

export const LITERATURE_REVIEW_ENABLED = !isProductionSite();
