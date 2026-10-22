/* Build-time rendering only: no browser, API calls, credentials or user data. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
process.env.NODE_ENV = 'production';
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build');
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

async function main() {
    const template = fs.readFileSync(path.join(output, fs.existsSync(path.join(output, 'app.html')) ? 'app.html' : 'index.html'), 'utf8');
    const cleanTemplate = template
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
        .replace(/<meta\b[^>]*(?:name="(?:description|robots)"|property="og:[^"]*")[^>]*>/gi, '')
        .replace(/<link\b[^>]*rel="canonical"[^>]*>/gi, '')
        .replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<noscript>You need to enable JavaScript to run this app\.<\/noscript>/g, '');
    // Hosting must send unknown/application routes here, not to the prerendered home page.
    write(path.join(output, 'app.html'), cleanTemplate.replace('</head>', '<meta name="robots" content="noindex, nofollow" data-rh="true"><title data-rh="true">GLKB</title></head>'));
    const temp = fs.mkdtempSync(path.join(root, '.prerender-'));
    try {
        const cssFiles = new Set();
        const existingAssets = new Map();
        const mediaDir = path.join(output, 'static/media');
        if (fs.existsSync(mediaDir)) for (const file of fs.readdirSync(mediaDir)) {
            const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(mediaDir, file))).digest('hex');
            existingAssets.set(digest, `/static/media/${file}`);
        }
        await esbuild.build({
            entryPoints: [path.join(__dirname, 'render-public.jsx')], outfile: path.join(temp, 'render.cjs'),
            bundle: true, platform: 'node', format: 'cjs', logLevel: 'warning',
            loader: { '.js': 'jsx', '.md': 'text' },
            external: ['react', 'react-dom', 'react-dom/server'],
            define: { 'process.env.NODE_ENV': '"production"', 'process.env.PUBLIC_URL': '""' },
            plugins: [{ name: 'public-assets', setup(build) {
                build.onLoad({ filter: /\.css$/ }, args => {
                    cssFiles.add(args.path);
                    return { contents: '', loader: 'js' };
                });
                build.onLoad({ filter: /\.(svg|png|jpe?g|webp|gif)$/ }, args => {
                    const bytes = fs.readFileSync(args.path);
                    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
                    const url = existingAssets.get(hash) || `/static/public/${hash.slice(0, 16)}${path.extname(args.path)}`;
                    if (!existingAssets.has(hash)) write(path.join(output, url), bytes);
                    let component = '';
                    if (args.path.endsWith('.svg')) {
                        const svg = bytes.toString();
                        const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] || '0 0 24 24';
                        const inner = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
                        component = `import React from 'react'; export const ReactComponent = props => React.createElement('svg', {...props, viewBox:${JSON.stringify(viewBox)}, dangerouslySetInnerHTML:{__html:${JSON.stringify(inner)}}});`;
                    }
                    return { contents: `${component}\nexport default ${JSON.stringify(url)};`, loader: 'js' };
                });
            } }],
        });
        const { publicPages, renderPublic } = require(path.join(temp, 'render.cjs'));
        const css = [path.join(root, 'src/index.css'), ...cssFiles].map(file => `@import ${JSON.stringify(file.replace(/\\/g, '/'))};`).join('\n');
        await esbuild.build({ stdin: { contents: css, loader: 'css', resolveDir: root }, bundle: true,
            outfile: path.join(output, 'static/public/content.css'), minify: true, logLevel: 'warning',
            loader: { '.svg': 'file', '.png': 'file', '.jpg': 'file', '.woff2': 'file' } });
        for (const page of publicPages) {
            const rendered = renderPublic(page);
            if (rendered.body.length < 200 || !/<(?:h1|h2|article)\b/.test(rendered.body)) throw new Error(`Empty public page: ${page.path}`);
            const head = `${rendered.head}<meta data-rh="true" name="robots" content="index, follow"><link data-rh="true" rel="canonical" href="${rendered.canonical}"><link id="public-content-css" rel="stylesheet" href="/static/public/content.css"><style>#root[data-public-html]{overflow:auto}</style>`;
            const html = cleanTemplate.replace('</head>', `${head}</head>`)
                .replace(/(<div\b[^>]*id="root"[^>]*>)[\s\S]*?(<\/div>)/, (_, open, close) => open.replace('id="root"', 'id="root" data-public-html="true"') + rendered.body + close);
            const filename = page.path === '/' ? 'index.html' : `${page.path.slice(1)}/index.html`;
            write(path.join(output, filename), html);
            console.log(`Prerendered ${page.path}`);
        }
        write(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicPages.map(page => `<url><loc>https://glkb.org${page.path}</loc></url>`).join('')}</urlset>\n`);
        // Import these ahead of Amplify's current catch-all SPA rule. This file contains no secrets.
        const redirects = [
            { source: '/', target: '/index.html', status: '200' },
            { source: '/about', target: '/', status: '301' },
            { source: '/about/', target: '/', status: '301' },
            { source: '/blog', target: '/#from-the-lab', status: '301' },
            { source: '/blog/', target: '/#from-the-lab', status: '301' },
            { source: '/api-docs/overview', target: '/api-docs', status: '301' },
            { source: '/api-docs/overview/', target: '/api-docs', status: '301' },
            ...publicPages.filter(page => page.path !== '/').flatMap(page => [
                { source: `${page.path}/`, target: page.path, status: '301' },
                { source: page.path, target: `${page.path}/index.html`, status: '200' },
            ]),
            { source: '</^[^.]+$/>', target: '/app.html', status: '200' },
        ];
        write(path.join(output, 'amplify-redirects.json'), JSON.stringify(redirects, null, 2));
        for (const [from, to] of [['about', '/'], ['blog', '/#from-the-lab'], ['api-docs/overview', '/api-docs']]) {
            write(path.join(output, from, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow"><link rel="canonical" href="https://glkb.org${to.split('#')[0]}"><meta http-equiv="refresh" content="0;url=${to}"><title>GLKB — moved</title></head><body><a href="${to}">Continue to GLKB</a></body></html>`);
        }
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
