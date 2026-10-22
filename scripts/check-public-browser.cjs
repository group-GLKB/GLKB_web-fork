// Local, anonymous smoke test. Never calls the live backend or runs research queries.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
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
            for (const pathname of ['/', '/blog/glkb-knowledge-graph', '/api-docs/quickstart']) {
                await page.goto(origin + pathname, { waitUntil: 'networkidle' });
                await page.locator('h1').first().waitFor();
                assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'index, follow');
                assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://glkb.org${pathname}`);
                assert.ok((await page.locator('body').innerText()).length > 300);
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
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
