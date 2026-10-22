# Public HTML deployment

`npm ci` and `npm run build` now generate public HTML after CRA builds the application.
The postbuild step uses Node/esbuild and React server rendering, not a browser or production API.
Keep devDependencies installed in the build stage. Publish `build` as before. If the current
Amplify build command invokes `craco build` directly, change it to `npm run build` so postbuild runs.

Run `node scripts/check-public.cjs` after the build. This checks the actual shipped HTML,
metadata, schema, links, assets, sitemap and the private application fallback.

## Amplify action required

Repository files cannot change Amplify's saved **Rewrites and redirects** settings.
After building, import `build/amplify-redirects.json` into the dev app's redirect editor.
Replace the old catch-all rewrite to `/index.html` with the generated rules. Keep any existing
domain-level/HTTPS redirects before these rules, and preserve unrelated intentional redirects.
Do not overwrite the production app's rules until dev is reviewed.

The order matters: legacy addresses get 301 redirects, each public route gets its own HTML,
and extensionless application routes fall back to `/app.html` (noindex). Requests for missing
static assets must remain errors, not receive home-page HTML. The root `/` serves `index.html`.
There are meta-refresh/link fallback files for legacy URLs, but these are not HTTP 301s;
the Amplify rules are required for proper HTTP redirects.

Verify actual hosting, not only the browser UI:

- `/` has product text, FAQs and article links without JS.
- `/blog/glkb-knowledge-graph` and `/api-docs/quickstart` return distinct bodies and metadata.
- `/about` returns HTTP 301 to `/`; `/blog` to `/#from-the-lab`.
- `/chat/<id>` still boots the application, with no public conversation HTML or index permission.
- `/sitemap.xml` contains canonical content URLs, not app dashboards or redirect aliases.

Canonical URLs deliberately remain `https://glkb.org`, including on dev. Do not submit the
dev hostname to Search Console. Consider hosting-level noindex/access protection for the dev
domain; do not publish that restriction on glkb.org. No analytics or research queries are sent
by prerendering. Text claims and pricing policy were not changed in this technical SEO update.

## Search Console (after production deployment, not after dev push)

1. Submit/resubmit `https://glkb.org/sitemap.xml` in Sitemaps.
2. URL Inspection → Test live URL for `/`, both blog URLs, `/api-docs` and a document.
   Check fetched HTML, index permission, declared canonical and rendered content.
3. Request indexing for those representative pages after the live checks pass.
4. If a noindex exclusion issue is listed, use Validate fix after deployment.
5. Review indexing/crawl reports later. Submission is not a guarantee of indexing/ranking.

No new Search Console property, robots permission, GPTBot permission or special AI schema is
required for this change. CDN crawler restrictions still need separate log/access checks.
