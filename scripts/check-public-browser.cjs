// Local, anonymous smoke test. Never calls the live backend or runs research queries.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const BLOG_PATHS = ['/blog/glkb-knowledge-graph', '/blog/investigate-auditable-research'];
const root = path.resolve(__dirname, '../build');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.md': 'text/plain', '.json': 'application/json' };
async function main() {
    const server = http.createServer((req, res) => {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        let file = path.resolve(root, `.${pathname}`);
        if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        if (!fs.existsSync(file)) {
            if (path.extname(pathname)) { res.writeHead(404).end(); return; }
            file = path.join(root, 'app.html');
        }
        res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true, ...(process.env.SEO_BROWSER_CHANNEL ? { channel: process.env.SEO_BROWSER_CHANNEL } : {}) });
        const origin = `http://127.0.0.1:${server.address().port}`;
        for (const javaScriptEnabled of [false, true]) {
            const context = await browser.newContext({ javaScriptEnabled });
            await context.route('**/*', route => {
                const url = route.request().url();
                if (!url.startsWith(origin) || url.startsWith(`${origin}/api/`)) return route.fulfill({ status: 403, body: '{}' });
                return route.continue();
            });
            const page = await context.newPage();
            for (const pathname of ['/', ...BLOG_PATHS, '/api-docs/quickstart']) {
                await page.goto(origin + pathname, { waitUntil: 'networkidle' });
                await page.locator('h1').first().waitFor();
                assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), pathname.startsWith('/api-docs') ? 'noindex, nofollow' : 'index, follow');
                assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://glkb.org${pathname}`);
                assert.ok((await page.locator('body').innerText()).length > 300);
                if (BLOG_PATHS.includes(pathname)) {
                    assert.ok((await page.locator('article.blog-article').innerText()).length > 1000);
                    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
                    assert.equal(schema['@type'], 'BlogPosting');
                    assert.equal(await page.title(), `${schema.headline} | GLKB`);
                    const nextPost = BLOG_PATHS.find(other => other !== pathname);
                    assert.ok(await page.locator(`a[href="${nextPost}"]`).count());
                }
                if (!javaScriptEnabled && pathname === '/') {
                    assert.ok(await page.locator('#root').evaluate(el => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto'));
                    const question = page.locator('summary').filter({ hasText: 'Do you search full texts, or just abstracts?' });
                    await question.click();
                    assert.ok(await question.locator('..').getAttribute('open') !== null);
                }
            }
            if (javaScriptEnabled) {
                await page.goto(origin + '/chat', { waitUntil: 'networkidle' });
                assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
            }
            await context.close();
            console.log(`Public routes verified with JavaScript ${javaScriptEnabled ? 'enabled' : 'disabled'}.`);
        }
        // `/` (config/entryRoutes.js): every visitor sees About first; after that a signed-in reader
        // ENTERING the site there goes on to the chat. A guest always stays; so does About reached
        // from inside the app (the GLKB logo) or a #section of it.
        const reader = async ({ signedIn, seenAbout }) => {
            const context = await browser.newContext();
            await context.addInitScript(({ signedIn, seenAbout }) => {
                if (signedIn) {
                    localStorage.setItem('access_token', 'local-smoke-test');
                    localStorage.setItem('user', JSON.stringify({ id: 999999, email: 'local-smoke@example.invalid' }));
                }
                if (seenAbout) localStorage.setItem('glkb-about-seen-v1', '1');
            }, { signedIn, seenAbout });
            await context.route('**/*', route => {
                const url = route.request().url();
                if (!url.startsWith(origin) || url.startsWith(`${origin}/api/`)) return route.fulfill({ status: 403, body: '{}' });
                return route.continue();
            });
            return { context, page: await context.newPage() };
        };
        const landsOn = async (page, path, reload = false) => {
            if (reload) await page.reload({ waitUntil: 'networkidle' });
            else await page.goto(origin + path, { waitUntil: 'networkidle' });
            await page.waitForTimeout(300);
            return new URL(page.url()).pathname;
        };
        {
            const { context, page } = await reader({ signedIn: true, seenAbout: false });
            assert.equal(await landsOn(page, '/'), '/', 'a signed-in reader sees About once');
            await page.locator('h1').first().waitFor();
            assert.equal(await landsOn(page, '/'), '/chat', 'then entering at / goes on to the chat');
            await context.close();
        }
        {
            const { context, page } = await reader({ signedIn: true, seenAbout: true });
            assert.equal(await landsOn(page, '/'), '/chat');
            // The old /about is a hosting redirect (amplify-redirects.json), so it arrives as a
            // fresh load of / -- an entry like any other.
            assert.equal(await landsOn(page, '/about'), '/chat');
            await page.locator('a[href="/"]:visible').first().click();
            await page.waitForURL(url => new URL(url).pathname === '/');
            await page.locator('h1').first().waitFor();
            assert.equal(new URL(page.url()).pathname, '/', 'the GLKB logo inside the app opens About, and it stays');
            assert.equal(await landsOn(page, '/?source=test#faq'), '/', 'a section of About stays');
            assert.equal(await landsOn(page, null, true), '/', 'and stays on refresh');
            await page.getByRole('button', { name: 'Get Started', exact: true }).click();
            await page.waitForURL('**/chat');
            await context.close();
        }
        {
            const { context, page } = await reader({ signedIn: false, seenAbout: true });
            assert.equal(await landsOn(page, '/'), '/', 'a guest always stays on About');
            assert.equal(await landsOn(page, null, true), '/');
            await context.close();
        }
        console.log('Entry: About first for everyone, then a signed-in reader entering at / goes to the chat; guests, the in-app logo link and #sections stay on About.');

        // Before the app has run (its bundle held back), what is painted: a signed-in reader the app
        // will send to the chat sees nothing of About; a guest sees About.
        const paintedBeforeTheApp = async ({ signedIn, path = '/' }) => {
            const { context, page } = await reader({ signedIn, seenAbout: true });
            await context.route(/\/static\/js\//, route => route.abort());
            await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
            const visibility = await page.locator('#root').evaluate(el => getComputedStyle(el).visibility);
            const hasAbout = await page.locator('#root h1').count() > 0;
            await context.close();
            return { visibility, hasAbout };
        };
        assert.deepEqual(await paintedBeforeTheApp({ signedIn: true }), { visibility: 'hidden', hasAbout: true },
            'About must not flash for a signed-in reader entering at /');
        assert.deepEqual(await paintedBeforeTheApp({ signedIn: false }), { visibility: 'visible', hasAbout: true });
        assert.equal((await paintedBeforeTheApp({ signedIn: true, path: '/#faq' })).visibility, 'visible');
        console.log('Nothing of About is painted for a visit the app sends to the chat; guests see it at once.');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
