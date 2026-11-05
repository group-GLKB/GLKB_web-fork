/**
 * Literature Review, the other way to use GLKB: the four steps of the real flow
 * (components/LiteratureReview — Scope, Outline, Writing, Review) beside a review
 * page that writes itself as the section passes. Its outline fills in, its lines
 * run out, citations land, and the first one opens onto the sentence that
 * supports it.
 *
 * The page is an illustration: its text is drawn as lines, and the only words in it
 * are real — the papers cited and the quoted sentence are the candidate-target
 * example's references (useCases.js), checked against their abstracts. Without
 * motion it is simply the finished page.
 */
import React, { useRef, useState } from 'react';

import { segment, useScrollProgress } from './motion';
import { USE_CASES } from './useCases';

/* The steps as the review page's own stepper names them (LiteratureReview/Chrome.jsx). */
export const REVIEW_STEPS = [
    ['Scope', 'Your topic, the years and article types to cover, a target length from 3,000 to 12,000 words, and your own papers if you have them.'],
    ['Outline', 'GLKB plans the sections and how many papers each one draws on.'],
    ['Writing', 'It searches PubMed, the knowledge graph and citation chains, then writes section by section. Close the tab if you like: it emails you when the review is ready.'],
    ['Review', 'Hover a citation to see the sentence that supports it. Ask about, rewrite, shorten or add evidence to any passage, then export to Word, LaTeX or PDF.'],
];

/* Measured or stated in the product, not estimated here: the review page promises 8–12
   minutes for a review from search (ScopeStep); 6,000-word reviews on dev cited 83, 101
   and 132 papers (glkb-agent docs/literature-review.md); five citation styles
   (citationStyle.js); three export formats (ExportDialog.jsx). */
const REVIEW_FACTS = [
    ['8–12 min', 'From topic to a first draft'],
    ['~100', 'Papers cited in a 6,000-word review'],
    ['5', 'Citation styles, from Vancouver to APA 7'],
    ['3', 'Export formats: Word, LaTeX and PDF'],
];

const REFERENCES = USE_CASES[0].references;

const OUTLINE = [
    'Introduction',
    'β-cell loss in type 2 diabetes',
    'DYRK1A and NFAT signaling',
    'Small-molecule DYRK1A inhibitors',
    'Combination strategies',
    'Translational challenges',
    'Outlook',
];

/* The page's paragraphs, as line widths (%) with the reference each line cites, if any. */
const PARAGRAPHS = [
    [[100], [96, 1], [100], [58]],
    [[100], [92, 2], [100, 3], [74]],
];

/* Where the page is in its writing (0..1) over the section's pass through the window. */
const WRITE_FROM = 0.1;
const WRITE_TO = 0.5;

const stageAt = (written) => Math.min(REVIEW_STEPS.length - 1, Math.floor(written * REVIEW_STEPS.length));

const parseMeta = (meta) => {
    const [, year, journal] = meta.split(/\s*·\s*/);
    return { year, journal };
};

const ReviewScene = ({ motion, onStart }) => {
    const sectionRef = useRef(null);
    const [stage, setStage] = useState(REVIEW_STEPS.length - 1);

    useScrollProgress(sectionRef, {
        mode: 'pass',
        property: '--v',
        onProgress: (progress) => {
            // Without motion the page stays written and the last step stays lit.
            if (!motion) return;
            const written = segment(progress, WRITE_FROM, WRITE_TO);
            sectionRef.current.style.setProperty('--w', written.toFixed(4));
            const next = stageAt(written);
            setStage((current) => (current === next ? current : next));
        },
    });

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
                            <li
                                key={name}
                                className={`about-review-step${index === stage ? ' is-active' : ''}${index < stage ? ' is-done' : ''}`}
                            >
                                <span className="about-review-step-index" aria-hidden="true">{index + 1}</span>
                                <span className="about-review-step-name">{name}</span>
                                <span className="about-review-step-text">{text}</span>
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
                        <div className="about-review-body">
                            <aside className="about-review-contents">
                                <span className="about-review-label">Contents</span>
                                <ol>
                                    {OUTLINE.map((title, index) => (
                                        <li key={title} style={{ '--i': index, '--n': OUTLINE.length }}>
                                            <i className="about-review-tick" />
                                            <span>{title}</span>
                                        </li>
                                    ))}
                                </ol>
                            </aside>
                            <div className="about-review-page">
                                <span className="about-review-label">Literature review · Draft 1</span>
                                <span className="about-review-title">
                                    DYRK1A inhibition for β-cell regeneration in type 2 diabetes
                                </span>
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
                    <figcaption className="about-review-caption">
                        An illustration of the review page. The papers and the quoted sentence are real.
                    </figcaption>
                </figure>
            </div>

            <ul className="about-inner about-review-facts">
                {REVIEW_FACTS.map(([figure, label], index) => (
                    <li key={label} data-reveal style={{ '--d': index }}>
                        <strong>{figure}</strong>
                        <span>{label}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default ReviewScene;
