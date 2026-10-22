const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../build');
const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert.equal(new Set(urls).size, urls.length);
assert.ok(urls.length >= 5);
const titles = new Set();
const redirects = JSON.parse(fs.readFileSync(path.join(root, 'amplify-redirects.json')));
const blogUrls = urls.filter(url => new URL(url).pathname.startsWith('/blog/'));
assert.ok(blogUrls.length > 0, 'sitemap must include blog articles');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
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
    const schema = JSON.parse(schemas[0][1]);
    assert.equal(schema.url, url);
    if (blogUrls.includes(url)) {
        assert.match(html, /<article class="blog-article">[\s\S]+<\/article>/);
        assert.equal(schema['@type'], 'BlogPosting');
        assert.ok(schema.headline, `article headline ${pathname}`);
        assert.ok(home.includes(`href="${pathname}"`), `home must link to article ${pathname}`);
        const siblings = blogUrls.filter(other => other !== url);
        if (siblings.length) assert.ok(siblings.some(sibling => html.includes(`href="${new URL(sibling).pathname}"`)), `article must link to another article ${pathname}`);
        assert.ok(!html.includes('<meta http-equiv="refresh"'), `article must not redirect ${pathname}`);
        assert.equal(redirects.find(rule => rule.source === pathname)?.target, `${pathname}/index.html`);
    }
    for (const [, src] of html.matchAll(/(?:src|href)="(\/static\/[^"?#]+)[^"]*"/g)) {
        assert.ok(fs.existsSync(path.join(root, decodeURIComponent(src))), `missing asset ${src}`);
    }
}
assert.ok(home.includes('Do you search full texts, or just abstracts?'));
assert.ok(home.includes('results should be reviewed and validated'));
assert.ok(home.includes('/blog/glkb-knowledge-graph'));
assert.match(fs.readFileSync(path.join(root, 'app.html'), 'utf8'), /noindex, nofollow/);
assert.equal(redirects.at(-1).target, '/app.html');
assert.equal(redirects.find(rule => rule.source === '/about').status, '301');
console.log(`Validated ${urls.length} public pages: content, links, unique metadata, canonical, JSON-LD, assets, sitemap and routing.`);
