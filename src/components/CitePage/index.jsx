/**
 * GLKB Cite, the Mac menu-bar app: what it is, whether it is for you, and the download.
 *
 * The short page. It answers "what is this, can I use it, where do I get it" and hands the
 * rest to the article (Blog/content/glkb-cite.md), which walks through every step. The two
 * are separate because they are read differently: this one is opened from the chat page by
 * someone who wants the file, the article is read beside the app while setting it up.
 *
 * Written for biologists, not for people who install software for a living: no jargon, no
 * Terminal, and the words on the screen ("Create key", "Request Access") quoted as they are.
 * The pictures are drawings (img/blog/cite-*.svg), made from the app's own guide — they say so.
 *
 * The build offered is named in config/citeApp.js and nowhere else.
 */
import './scoped.css';

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { CITE_APP, CITE_DOWNLOAD_URL, CITE_GUIDE_PATH } from '../../config/citeApp';
import { CHAT_HOME_PATH } from '../../config/entryRoutes';
import overviewFigure from '../../img/blog/cite-01-overview.svg';
import resultsFigure from '../../img/blog/cite-06-results.svg';
import appIcon from '../../img/cite/app-icon.png';
import { trackGtagEvent } from '../../utils/gtag';
import { SiteFooter, SiteNav } from '../SiteChrome';
import PublicPageSeo from '../Units/PublicPageSeo';

const guide = (section) => `${CITE_GUIDE_PATH}${section ? `#${section}` : ''}`;

/** 'mac', 'other' or null (not known: the prerender, or a browser that does not say). */
export const detectPlatform = (nav = (typeof navigator !== 'undefined' ? navigator : null)) => {
    if (!nav) return null;
    const text = `${nav.userAgentData?.platform || ''} ${nav.platform || ''} ${nav.userAgent || ''}`;
    if (!text.trim()) return null;
    // An iPad can call itself a Mac; it has a touch screen, a Mac does not.
    if (/iPhone|iPad|iPod|Android/i.test(text) || (/Mac/i.test(text) && nav.maxTouchPoints > 1)) return 'other';
    return /Mac/i.test(text) ? 'mac' : 'other';
};

const STEPS = [
    {
        title: 'Download the app',
        body: <>Click <b>Download for Mac</b> on this page. The file lands in your Downloads folder.</>,
    },
    {
        title: 'Drag it to Applications',
        body: <>Double-click the file, then drag <b>GLKB Cite</b> onto the <b>Applications</b> folder.</>,
        more: ['See it step by step', 'install'],
    },
    {
        title: 'Get your GLKB key',
        body: <>On this website, open <b>API</b> in the left menu and click <b>Create key</b>. Copy the key.</>,
        more: ['How to get a key', 'get-your-key'],
    },
    {
        title: 'Finish the short setup',
        body: <>Open GLKB Cite. Let it read the text you select, paste your key, and you are done.</>,
        more: ['The setup, explained', 'setup'],
    },
];

const RESULTS = [
    ['Papers in two groups', 'Direct evidence supports your sentence. Indirect context is related background.'],
    ['The passage that matched', 'Each paper comes with the excerpt that backs the match, so you can judge it quickly.'],
    ['A link to PubMed', 'Click a paper’s PMID to open it on PubMed and read it properly.'],
    ['A reference in your style', 'MLA, APA, Chicago, Harvard or Vancouver, copied with one click. BibTeX and EndNote too.'],
];

const QUESTIONS = [
    {
        id: 'windows',
        q: 'Is there a version for Windows, iPhone or iPad?',
        a: <>Not yet. GLKB Cite runs on a Mac only. On any other device you can ask for the papers behind a claim in the <Link to={CHAT_HOME_PATH}>GLKB chat</Link>.</>,
    },
    {
        id: 'cost',
        q: 'Does it cost anything?',
        a: <>The app is free to download. Each search is paid from the dollar balance on your GLKB account, at what it costs us to run: usually a few cents, and rarely more than thirty. Searches made by the app do not use your free monthly credits. <Link to={guide('cost')}>More about cost</Link>.</>,
    },
    {
        id: 'where',
        q: 'I opened the app and nothing happened. Where is it?',
        a: <>GLKB Cite has no window and no icon in the Dock. Look for a small GLKB icon at the top right of your screen, near the clock, and click it. <Link to={guide('menu-bar')}>See a picture</Link>.</>,
    },
    {
        id: 'badge',
        q: 'I select text, but no blue badge appears.',
        a: <>The app is usually missing one permission. Click the GLKB icon at the top of your screen. If you see <b>Accessibility Access Needed…</b>, choose it and turn on the switch next to GLKB Cite. <Link to={guide('no-badge')}>The full checklist</Link>.</>,
    },
    {
        id: 'key',
        q: 'It says “GLKB rejected this API key”.',
        a: <>The key in the app is switched off, deleted or mistyped. Create a new key on the <b>API</b> page of this website and paste it in the app under <b>Settings</b>, then <b>Literature</b>. <Link to={guide('key-rejected')}>Step by step</Link>.</>,
    },
    {
        id: 'pdf',
        q: 'Does it work in PDFs?',
        a: <>Yes, in most PDF readers, as long as the PDF has real text you can select. A scanned page is a picture and has no text to read. <Link to={guide('pdfs')}>How PDFs work</Link>.</>,
    },
    {
        id: 'privacy',
        q: 'What does the app send, and when?',
        a: <>Nothing leaves your Mac until you ask for citations. Then the app sends the one sentence you selected to GLKB. Your key stays in your Mac’s Keychain. There is no tracking and no history of your searches. <Link to={guide('privacy')}>The details</Link>.</>,
    },
];

const DownloadButton = ({ source }) => (
    <a
        className="site-button cite-download"
        href={CITE_DOWNLOAD_URL}
        download={CITE_APP.file}
        onClick={() => trackGtagEvent('cite_app_download_click', { source, version: CITE_APP.version })}
    >
        <svg className="cite-download-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 2v8m0 0L4.8 6.8M8 10l3.2-3.2M3 13h10" />
        </svg>
        Download for Mac
    </a>
);

export default function CitePage() {
    // Known only in the browser, after mount, so the prerendered page and the first paint agree.
    const [platform, setPlatform] = useState(null);
    useEffect(() => { setPlatform(detectPlatform()); }, []);

    useEffect(() => {
        // Arriving from a long page (About, an article), start at the top of this one.
        let scroller = document.querySelector('.cite-page')?.parentElement;
        while (scroller && scroller !== document.body) {
            const { overflowY } = window.getComputedStyle(scroller);
            if (overflowY === 'auto' || overflowY === 'scroll') { scroller.scrollTop = 0; return; }
            scroller = scroller.parentElement;
        }
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="cite-page">
            <PublicPageSeo
                title="GLKB Cite for Mac: the papers behind any sentence | GLKB"
                description="GLKB Cite is a small Mac app. Select a sentence in your manuscript, click once, and get the PubMed papers that support it, ready to cite. Download it here."
            />
            <SiteNav active="cite" />

            <main className="cite-main">
                <section className="cite-hero" aria-labelledby="cite-title">
                    <div className="cite-hero-copy">
                        <p className="cite-eyebrow">
                            <img className="cite-app-icon" src={appIcon} alt="" width="44" height="44" />
                            <span>New · App for Mac</span>
                        </p>
                        <h1 id="cite-title">GLKB Cite: the papers behind any sentence you select</h1>
                        <p className="cite-lede">
                            Select a sentence in your manuscript and click once. GLKB Cite shows you the
                            PubMed papers that support it, ready to cite. It works in the apps you
                            already write in.
                        </p>
                        <div className="cite-actions">
                            <DownloadButton source="hero" />
                            <Link className="site-button site-button--ghost" to={CITE_GUIDE_PATH}>
                                Read the step-by-step guide
                            </Link>
                        </div>
                        <p className="cite-meta">
                            Version {CITE_APP.version} · {CITE_APP.sizeLabel} · {CITE_APP.minMacOS} or newer · Apple-chip and Intel Macs
                        </p>
                        {platform === 'other' && (
                            <p className="cite-note" role="note">
                                <b>You do not seem to be on a Mac.</b> GLKB Cite runs on a Mac only. Open this
                                page on your Mac to download it.
                            </p>
                        )}
                    </div>
                    <figure className="cite-figure cite-hero-figure">
                        <img
                            src={overviewFigure}
                            alt="A drawing of how GLKB Cite works. A sentence is selected in a document and a small blue badge sits next to it. An arrow leads to a results panel that lists papers under Direct evidence and Indirect context."
                        />
                    </figure>
                </section>

                <section className="cite-section" aria-labelledby="cite-fit-title">
                    <h2 id="cite-fit-title">Is it for you?</h2>
                    <ul className="cite-fit">
                        <li>
                            <h3>You have a Mac</h3>
                            <p>
                                It needs {CITE_APP.minMacOS} or newer. To check, click the Apple logo at the top left
                                of your screen and choose <b>About This Mac</b>.
                            </p>
                        </li>
                        <li>
                            <h3>You have a GLKB account</h3>
                            <p>
                                The app runs its searches through your account. If you do not have one yet,{' '}
                                <Link to={CHAT_HOME_PATH}>open GLKB</Link> and log in to create it.
                            </p>
                        </li>
                        <li>
                            <h3>You write or review science</h3>
                            <p>
                                Manuscripts, grants, theses, reviews. Any time a sentence needs a reference, or you
                                want to see what backs a claim.
                            </p>
                        </li>
                    </ul>
                    <p className="cite-aside">
                        There is no version for Windows, Linux, iPhone, iPad or Android yet.
                    </p>
                </section>

                <section className="cite-section" aria-labelledby="cite-steps-title">
                    <h2 id="cite-steps-title">Ready in about five minutes</h2>
                    <ol className="cite-steps">
                        {STEPS.map((step, index) => (
                            <li key={step.title}>
                                <span className="cite-step-number" aria-hidden="true">{index + 1}</span>
                                <h3>{step.title}</h3>
                                <p>{step.body}</p>
                                {step.more && <Link className="cite-more" to={guide(step.more[1])}>{step.more[0]}</Link>}
                            </li>
                        ))}
                    </ol>
                    <p className="cite-aside">
                        After that, select a sentence anywhere and click the blue badge that appears. You can also
                        press <kbd>Option</kbd> + <kbd>Command</kbd> + <kbd>G</kbd>.
                    </p>
                </section>

                <section className="cite-section" aria-labelledby="cite-results-title">
                    <h2 id="cite-results-title">What you get back</h2>
                    <p className="cite-section-lede">
                        A search usually takes 10 to 30 seconds. Then a small panel opens with:
                    </p>
                    <dl className="cite-results-list">
                        {RESULTS.map(([term, text]) => (
                            <div key={term}>
                                <dt>{term}</dt>
                                <dd>{text}</dd>
                            </div>
                        ))}
                    </dl>
                    <figure className="cite-figure cite-results-figure">
                        {/* On a phone the drawing keeps a readable size and scrolls sideways. */}
                        <div className="cite-figure-scroll" tabIndex={0} role="group" aria-label="Drawing of the results panel">
                            <img
                                src={resultsFigure}
                                loading="lazy"
                                alt="A drawing of the results panel. Papers are numbered and grouped under Direct evidence and Indirect context. Each has its authors, year and journal, an excerpt, a PMID link and a Cite button. Two buttons at the bottom copy the whole list."
                            />
                        </div>
                        <figcaption>A drawing of the results panel, not a screenshot. Grey bars stand in for real papers.</figcaption>
                    </figure>
                    <p className="cite-caution">
                        <b>Always read a paper before you cite it.</b> GLKB Cite finds candidates quickly, and it
                        can be wrong. It is a research aid, not a tool for clinical decisions.
                    </p>
                </section>

                <section className="cite-section" aria-labelledby="cite-questions-title">
                    <h2 id="cite-questions-title">Common questions</h2>
                    <div className="cite-questions">
                        {QUESTIONS.map((item) => (
                            <details key={item.id} id={`cite-q-${item.id}`}>
                                <summary>{item.q}</summary>
                                <p>{item.a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <section className="cite-closing" aria-labelledby="cite-closing-title">
                    <h2 id="cite-closing-title">Get GLKB Cite</h2>
                    <p>
                        Signed by the University of Michigan and checked by Apple, so it opens with a normal
                        double-click.
                    </p>
                    <div className="cite-actions">
                        <DownloadButton source="closing" />
                        <Link className="site-button site-button--ghost" to={CITE_GUIDE_PATH}>
                            Read the step-by-step guide
                        </Link>
                    </div>
                    <p className="cite-meta">
                        Stuck? <Link to="/contact">Write to us</Link> and we will help. Please do not send us your key.
                    </p>
                </section>
            </main>

            <SiteFooter withCta={false} />
        </div>
    );
}
