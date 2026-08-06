/**
 * Deployment switches.
 *
 * This file is intentionally the ONLY thing that differs between `master` and
 * `production` — every other file should merge clean between the two branches.
 * If you need a deployment-specific difference, add a flag here rather than
 * editing a component on one branch only.
 *
 *   master     — both true (everything on, current behaviour)
 *   production — both false (API docs and Investigate not open to users yet)
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
