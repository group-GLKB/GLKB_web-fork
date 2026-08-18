/**
 * Full-page render of About at the design's 1440px, for comparing against the
 * Figma frame band by band.
 *
 *   node e2e/scripts/shoot-about.mjs <out.png> [url]
 */
import { chromium } from 'playwright';

const out = process.argv[2] || 'about.png';
const url = process.argv[3] || 'http://localhost:3000/about';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });

// AppLayout scrolls an inner wrapper rather than the window, so fullPage would
// capture one viewport. Find that wrapper, walk it down to load the lazy
// images, then grow the viewport to its full height and shoot that.
const scroller = () => page.evaluate(() => {
    let el = document.querySelector('.about-page')?.parentElement;
    while (el && el !== document.body) {
        const { overflowY } = getComputedStyle(el);
        if (overflowY === 'auto' || overflowY === 'scroll') return el.scrollHeight;
        el = el.parentElement;
    }
    return document.body.scrollHeight;
});

await page.evaluate(async () => {
    let el = document.querySelector('.about-page')?.parentElement;
    while (el && el !== document.body) {
        const { overflowY } = getComputedStyle(el);
        if (overflowY === 'auto' || overflowY === 'scroll') break;
        el = el.parentElement;
    }
    const target = el && el !== document.body ? el : window;
    const total = target === window ? document.body.scrollHeight : target.scrollHeight;
    for (let y = 0; y < total; y += 700) {
        if (target === window) window.scrollTo(0, y); else target.scrollTop = y;
        await new Promise((r) => setTimeout(r, 120));
    }
    if (target === window) window.scrollTo(0, 0); else target.scrollTop = 0;
});
await page.waitForTimeout(800);

const height = await scroller();
await page.setViewportSize({ width: 1440, height: Math.min(height, 20000) });
await page.waitForTimeout(500);
await page.screenshot({ path: out });
console.log(`${out} — 1440x${height}`);
await browser.close();
