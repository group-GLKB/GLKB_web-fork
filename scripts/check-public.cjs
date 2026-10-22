const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../build');
const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert.equal(new Set(urls).size, urls.length);
assert.ok(urls.length >= 5);
const titles = new Set();
for (const url of urls) {
    const pathname = new URL(url).pathname;
    assert.ok(!/^\/(chat|search|account|library|history|api-page|literature-review)(\/|$)/.test(pathname));
    const html = fs.readFileSync(path.join(root, pathname === '/' ? 'index.html' : `${pathname.slice(1)}/index.html`), 'utf8');
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1, pathname);
    assert.ok(html.includes(`href="${url}"`), `canonical ${pathname}`);
    assert.match(html, /name="robots" content="index, follow"/);
    assert.equal((html.match(/name="description"/g) || []).length, 1);
    const title = html.match(/<title[^>]*>(.*?)<\/title>/)?.[1];
    assert.ok(title && !titles.has(title), `unique title ${pathname}`);
    titles.add(title);
    assert.match(html, /<h1\b|<h2\b/);
    assert.match(html, /<a\b[^>]*href=/);
    assert.ok(!html.includes('You need to enable JavaScript to run this app.'));
    const schemas = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)];
    assert.equal(schemas.length, 1);
    assert.equal(JSON.parse(schemas[0][1]).url, url);
    for (const [, src] of html.matchAll(/(?:src|href)="(\/static\/[^"?#]+)[^"]*"/g)) {
        assert.ok(fs.existsSync(path.join(root, decodeURIComponent(src))), `missing asset ${src}`);
    }
}
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(home.includes('Do you search full texts, or just abstracts?'));
assert.ok(home.includes('results should be reviewed and validated'));
assert.ok(home.includes('/blog/glkb-knowledge-graph'));
assert.match(fs.readFileSync(path.join(root, 'app.html'), 'utf8'), /noindex, nofollow/);
const redirects = JSON.parse(fs.readFileSync(path.join(root, 'amplify-redirects.json')));
assert.equal(redirects.at(-1).target, '/app.html');
assert.equal(redirects.find(rule => rule.source === '/about').status, '301');
console.log(`Validated ${urls.length} public pages: content, links, unique metadata, canonical, JSON-LD, assets, sitemap and routing.`);
