/**
 * Literature Review, the other way to use GLKB: the four steps of the real flow
 * (components/LiteratureReview — Scope, Outline, Writing, Review), each a button, beside a
 * window that shows that step: the scope form, the planned outline, the writing progress and
 * the finished page. While the section passes, the window plays through them with the scroll;
 * once the reader picks a step, it shows that step and stops following the scroll.
 *
 * Below it, the benchmark: BioLitBench, the lab's test against 2,042 published reviews, with
 * the scores from the paper (arXiv 2609.32318) as the blog post reports them
 * (Blog/content/literature-review.md).
 *
 * The window is an illustration: its labels are the review page's own, and the only readable
 * content is real — the papers cited and the quoted sentence are the candidate-target
 * example's references (DYRK1A_EXAMPLE, useCases.js), checked against their abstracts.
 * Without motion it shows the finished page.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { segment, useScrollProgress } from './motion';
import { DYRK1A_EXAMPLE } from './useCases';

/* The steps as the review page's own stepper names them (LiteratureReview/Chrome.jsx). The
   figures are the product's: 3,000–12,000 words and five styles (ScopeStep, citationStyle.js),
   8–12 minutes (the estimate ScopeStep shows for a review from search), three export formats
   (ExportDialog.jsx). */
export const REVIEW_STEPS = [
    ['Scope', 'Your topic, the years and article types to cover, a target length from 3,000 to 12,000 words, one of five citation styles, and your own papers if you have them.'],
    ['Outline', 'GLKB plans the sections, how long each one runs, and the papers each draws on.'],
    ['Writing', 'It searches PubMed, the knowledge graph and citation chains, then writes section by section, in about 8–12 minutes. Close the tab if you like: it emails you when the review is ready.'],
    ['Review', 'Hover a citation to see the sentence that supports it. Ask about, rewrite, shorten or add evidence to any passage, then export to Word, LaTeX or PDF.'],
];

/* BioLitBench, every tool given the same papers (the controlled condition): overall scores on
   the human scale, 0 = a weak published review, 1 = the review being graded against. */
export const BENCHMARK = [
    { name: 'SCRIBE · GLKB', note: 'its own trained model', score: 0.606, ours: true },
    { name: 'SCRIBE · GPT-5.6 Luna', note: 'the same design on an OpenAI model', score: 0.564, ours: true },
    { name: 'Claude Science', note: 'claude-sonnet-5', score: 0.541 },
    { name: 'Elicit Systematic Review', note: 'reads full text, cites at most 80 papers', score: 0.535 },
    { name: 'Claude Code', note: 'claude-sonnet-5', score: 0.534 },
    { name: 'OpenAI tool loop', note: 'gpt-5.6-luna', score: 0.515 },
];
const SCALE_MAX = 0.7;
const STUDY_URL = 'https://arxiv.org/abs/2609.32318';

const REFERENCES = DYRK1A_EXAMPLE.references;
const TOPIC = 'DYRK1A inhibition for β-cell regeneration in type 2 diabetes';

/* The planned outline, with each section's share of a 6,000-word target. */
const OUTLINE = [
    ['Introduction', 500],
    ['β-cell loss in type 2 diabetes', 800],
    ['DYRK1A and NFAT signaling', 1000],
    ['Small-molecule DYRK1A inhibitors', 1100],
    ['Combination strategies', 1000],
    ['Translational challenges', 1000],
    ['Outlook', 600],
];

/* The scope form's rows, with the choice this review made. */
const SCOPE_ROWS = [
    ['Target length', ['3,000', '6,000', '10,000', '12,000'], 1],
    ['Publication years', ['Any year', 'Last 5 years', 'Last 10 years', 'Since 2000'], 2],
    ['Sources', ['Search only', 'Your papers + search', 'Your papers only'], 0],
    ['Citation style', ['Vancouver', 'AMA', 'Nature', 'APA 7', 'Harvard'], 0],
];

/* The writing stages as the progress panel names them (LiteratureReview/reviewModel.js). */
const WRITING_STAGES = ['Search & select', 'Synthesize', 'Outline', 'Write'];

/* The page's paragraphs, as line widths (%) with the reference each line cites, if any. */
const PARAGRAPHS = [
    [[100], [96, 1], [100], [58]],
    [[100], [92, 2], [100, 3], [74]],
];

/* Where the window is (0..1) over the section's pass through the viewport. */
const PLAY_FROM = 0.08;
const PLAY_TO = 0.5;
const STEP_SPAN = 1 / REVIEW_STEPS.length;

const stageAt = (played) => Math.min(REVIEW_STEPS.length - 1, Math.floor(played * REVIEW_STEPS.length));

const parseMeta = (meta) => {
    const [, year, journal] = meta.split(/\s*·\s*/);
    return { year, journal };
};

const ReviewScene = ({ motion, onStart }) => {
    const sectionRef = useRef(null);
    const manualRef = useRef(false);
    const frameRef = useRef(0);
    const [stage, setStage] = useState(REVIEW_STEPS.length - 1);

    const setPlayed = (value) => {
        sectionRef.current?.style.setProperty('--w', value.toFixed(4));
    };

    useScrollProgress(sectionRef, {
        mode: 'pass',
        property: '--v',
        onProgress: (progress) => {
            // Without motion the page stays finished; once the reader picks a step, it stays.
            if (!motion || manualRef.current) return;
            const played = segment(progress, PLAY_FROM, PLAY_TO);
            setPlayed(played);
            const next = stageAt(played);
            setStage((current) => (current === next ? current : next));
        },
    });

    useEffect(() => () => window.cancelAnimationFrame(frameRef.current), []);

    // A picked step plays its own part of the window, start to finish.
    const pick = (index) => {
        manualRef.current = true;
        setStage(index);
        window.cancelAnimationFrame(frameRef.current);
        const from = index * STEP_SPAN;
        // Writing stops part way, so it reads as a review being written, not one already done.
        const ends = [STEP_SPAN - 0.001, 2 * STEP_SPAN - 0.001, 2.62 * STEP_SPAN, 1];
        const to = ends[index];
        if (!motion) {
            setPlayed(to);
            return;
        }
        const started = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - started) / 1100);
            setPlayed(from + (to - from) * (1 - (1 - t) ** 3));
            if (t < 1) frameRef.current = window.requestAnimationFrame(tick);
        };
        frameRef.current = window.requestAnimationFrame(tick);
    };

    const lineCount = PARAGRAPHS.flat().length;
    let lineIndex = 0;
    const first = REFERENCES[0];
    const { year, journal } = parseMeta(first.meta);

    return (
        <section
            ref={sectionRef}
            className="about-section about-review"
            id="literature-review"
            aria-labelledby="about-review-heading"
            data-stage={stage}
        >
            <div className="about-inner about-review-inner">
                <div className="about-review-copy">
                    <p className="about-eyebrow" data-reveal>Literature Review</p>
                    <h2 className="about-heading" id="about-review-heading" data-reveal style={{ '--d': 1 }}>
                        From a question to a cited review.
                    </h2>
                    <p className="about-review-lede" data-reveal style={{ '--d': 2 }}>
                        When one answer is not enough, give GLKB a topic. It reads the literature, plans an
                        outline and writes the review, and every citation opens onto the paper and the sentence
                        that supports it.
                    </p>
                    {/* Revealed as a whole: useReveal marks elements with a class, which React
                        would wipe from an element whose className it re-renders, as each step's is. */}
                    <ol className="about-review-steps" data-reveal style={{ '--d': 3 }}>
                        {REVIEW_STEPS.map(([name, text], index) => (
                            <li key={name}>
                                <button
                                    type="button"
                                    className={`about-review-step${index === stage ? ' is-active' : ''}${index < stage ? ' is-done' : ''}`}
                                    aria-pressed={index === stage}
                                    onClick={() => pick(index)}
                                >
                                    <span className="about-review-step-index" aria-hidden="true">{index + 1}</span>
                                    <span className="about-review-step-name">{name}</span>
                                    <span className="about-review-step-text">{text}</span>
                                </button>
                            </li>
                        ))}
                    </ol>
                    <div className="about-review-actions" data-reveal style={{ '--d': 4 }}>
                        <button type="button" className="site-button" onClick={onStart}>
                            Set up a review
                        </button>
                        <span className="about-review-note">Needs a free account.</span>
                    </div>
                </div>

                <figure className="about-review-media" data-reveal style={{ '--d': 2 }}>
                    <div className="about-review-window" aria-hidden="true">
                        <div className="about-review-bar">
                            <span className="about-review-dots"><i /><i /><i /></span>
                            <span className="about-review-stepper">
                                {REVIEW_STEPS.map(([name], index) => (
                                    <span key={name} className={index <= stage ? 'is-on' : undefined}>{name}</span>
                                ))}
                            </span>
                        </div>
                        <div className="about-review-views">
                            {/* Scope */}
                            <div className="about-rv-view about-rv-scope" data-view="0">
                                <span className="about-review-label">Step 1 · Define the scope</span>
                                <span className="about-rv-heading">Set up your review</span>
                                <span className="about-rv-field">
                                    <span className="about-rv-field-label">Topic</span>
                                    <span className="about-rv-input"><span>{TOPIC}</span></span>
                                </span>
                                {SCOPE_ROWS.map(([label, options, chosen]) => (
                                    <span className="about-rv-row" key={label}>
                                        <span className="about-rv-field-label">{label}</span>
                                        <span className="about-rv-chips">
                                            {options.map((option, index) => (
                                                <span key={option} className={index === chosen ? 'is-on' : undefined}>{option}</span>
                                            ))}
                                        </span>
                                    </span>
                                ))}
                                <span className="about-rv-primary">Generate outline →</span>
                            </div>

                            {/* Outline */}
                            <div className="about-rv-view about-rv-outline" data-view="1">
                                <span className="about-review-label">Step 2 · Outline</span>
                                <span className="about-rv-heading">{TOPIC}</span>
                                <ol className="about-rv-sections">
                                    {OUTLINE.map(([title, words], index) => (
                                        <li key={title} style={{ '--i': index, '--n': OUTLINE.length, '--share': words / 1100 }}>
                                            <span className="about-rv-section-index">{index + 1}</span>
                                            <span className="about-rv-section-title">{title}</span>
                                            <span className="about-rv-section-bar"><i /></span>
                                            <span className="about-rv-section-words">~{words.toLocaleString('en-US')} words</span>
                                        </li>
                                    ))}
                                </ol>
                                <span className="about-rv-meter">Planned length 6,000 words · On target</span>
                            </div>

                            {/* Writing */}
                            <div className="about-rv-view about-rv-writing" data-view="2">
                                <span className="about-review-label">Step 3 · Writing</span>
                                <span className="about-rv-stages">
                                    {WRITING_STAGES.map((name, index) => (
                                        <span key={name} className="about-rv-stage" style={{ '--i': index }}>
                                            <i />
                                            {name}
                                        </span>
                                    ))}
                                </span>
                                <span className="about-rv-progress"><i /></span>
                                <span className="about-rv-field-label">Sections</span>
                                <ol className="about-rv-status">
                                    {OUTLINE.map(([title], index) => (
                                        <li key={title} style={{ '--i': index, '--n': OUTLINE.length }}>
                                            <span>{title}</span>
                                            <b className="is-queued">Queued</b>
                                            <b className="is-writing">Writing</b>
                                            <b className="is-done">Done</b>
                                        </li>
                                    ))}
                                </ol>
                                <span className="about-rv-hint">You can close this tab — the review keeps running.</span>
                            </div>

                            {/* Review */}
                            <div className="about-rv-view about-rv-review" data-view="3">
                                <div className="about-review-body">
                                    <aside className="about-review-contents">
                                        <span className="about-review-label">Contents</span>
                                        <ol>
                                            {OUTLINE.map(([title]) => (
                                                <li key={title}>
                                                    <i className="about-review-tick" />
                                                    <span>{title}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </aside>
                                    <div className="about-review-page">
                                        <span className="about-review-label">Literature review · Draft 1</span>
                                        <span className="about-review-title">{TOPIC}</span>
                                        {PARAGRAPHS.map((lines, paragraphIndex) => (
                                            // eslint-disable-next-line react/no-array-index-key
                                            <span className="about-review-paragraph" key={paragraphIndex}>
                                                {lines.map(([width, cite]) => {
                                                    const index = lineIndex;
                                                    lineIndex += 1;
                                                    return (
                                                        <span
                                                            key={index}
                                                            className="about-review-line"
                                                            style={{ '--i': index, '--n': lineCount, '--width': `${width}%` }}
                                                        >
                                                            <i />
                                                            {cite ? <b className={`about-review-cite${cite === 1 ? ' is-open' : ''}`}>{cite}</b> : null}
                                                        </span>
                                                    );
                                                })}
                                            </span>
                                        ))}
                                        <span className="about-review-popover">
                                            <span className="about-review-popover-meta">
                                                {journal} · {year} · PMID {first.pmid}
                                            </span>
                                            <span className="about-review-popover-quote">{first.quote}</span>
                                            <span className="about-review-popover-tag">Supporting sentence · from the abstract</span>
                                        </span>
                                        <span className="about-review-label about-review-refs-label">References</span>
                                        <ol className="about-review-refs">
                                            {REFERENCES.slice(0, 3).map((reference) => (
                                                <li key={reference.pmid}>{reference.title}</li>
                                            ))}
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <figcaption className="about-review-caption">
                        An illustration of the review page. The papers and the quoted sentence are real.
                    </figcaption>
                </figure>
            </div>

            <div className="about-inner about-bench" aria-labelledby="about-bench-heading">
                <div className="about-bench-copy">
                    <p className="about-eyebrow" data-reveal>Benchmark</p>
                    <h3 className="about-bench-title" id="about-bench-heading" data-reveal style={{ '--d': 1 }}>
                        Graded against 2,042 published reviews.
                    </h3>
                    <p className="about-bench-text" data-reveal style={{ '--d': 2 }}>
                        On BioLitBench, every tool wrote from the same papers and its review was scored against the
                        expert-written one. SCRIBE, the agent behind GLKB Literature Review, scored highest of 13
                        systems and was confirmed ahead of every other tool.
                    </p>
                    <dl className="about-bench-facts" data-reveal style={{ '--d': 3 }}>
                        <div>
                            <dt>0.606</dt>
                            <dd>Overall score, the highest of 13 systems</dd>
                        </div>
                        <div>
                            <dt>0.319</dt>
                            <dd>Planning score; the best commercial tool reached 0.185</dd>
                        </div>
                    </dl>
                    <Link className="about-bench-link" to="/blog/literature-review" data-reveal style={{ '--d': 4 }}>
                        How it was tested
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
                    </Link>
                </div>
                <figure className="about-bench-chart" data-reveal style={{ '--d': 2 }}>
                    <figcaption className="about-bench-caption">
                        Overall score, every tool given the same papers
                        <span>0 = a weak published review · 1 = the review being graded against</span>
                    </figcaption>
                    <ol className="about-bench-rows">
                        {BENCHMARK.map((row) => (
                            <li
                                key={row.name}
                                className={`about-bench-row${row.ours ? ' is-ours' : ''}`}
                                style={{ '--score': row.score / SCALE_MAX }}
                                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                                tabIndex={0}
                                aria-label={`${row.name}, ${row.note}: ${row.score.toFixed(3)}`}
                            >
                                <span className="about-bench-name">
                                    {row.name}
                                    <small>{row.note}</small>
                                </span>
                                <span className="about-bench-track">
                                    <i />
                                    <b>{row.score.toFixed(3)}</b>
                                </span>
                                <span className="about-bench-tip" role="tooltip">
                                    {row.name} · {row.score.toFixed(3)}
                                    <small>{row.note}</small>
                                </span>
                            </li>
                        ))}
                    </ol>
                    <span className="about-bench-axis" aria-hidden="true">
                        {[0, 0.2, 0.4, 0.6].map((tick) => (
                            <span key={tick} style={{ '--at': tick / SCALE_MAX }}>{tick.toFixed(1)}</span>
                        ))}
                    </span>
                    <p className="about-bench-source">
                        Scores from{' '}
                        <a href={STUDY_URL} target="_blank" rel="noopener noreferrer">the BioLitBench paper</a>
                        , 50 held-out topics. GLKB runs SCRIBE&rsquo;s design on OpenAI models today; its own trained
                        model, the 0.606, is coming.
                    </p>
                </figure>
            </div>
        </section>
    );
};

export default ReviewScene;
