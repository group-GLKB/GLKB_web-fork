/**
 * "Built for your research": five real questions, each answered by GLKB. A segmented control
 * picks one; the card shows the question as a message, an excerpt of GLKB's stored answer with
 * its citations, and the papers those citations point to, each with the sentence it was cited
 * for. "Open the full answer" asks the question in the chat, where the whole stored answer is
 * replayed, free (useCases.js, exampleQuestions.js).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import siteMark from '../../img/GLKB_logo_icon.png';
import { exampleChatLink } from './exampleQuestions';
import { USE_CASES } from './useCases';

/* Short names for the segmented control; the card heading keeps the full one. */
const SHORT_LABELS = {
    'candidate-target': 'Candidate Target',
    'variant-interpretation': 'Variant',
    'drug-repurposing': 'Drug Repurposing',
    'mechanism-mapping': 'Mechanism',
    biomarkers: 'Biomarkers',
};

/** `**bold**` and `[n]` citations, the only markup the stored answers use. */
export const renderAnswerText = (text) => text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, index) => {
    if (!part) return null;
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    // eslint-disable-next-line react/no-array-index-key
    if (bold) return <strong key={index}>{bold[1]}</strong>;
    const cite = /^\[(\d+)\]$/.exec(part);
    // eslint-disable-next-line react/no-array-index-key
    if (cite) return <span className="about-uc-cite" key={index} aria-label={`reference ${cite[1]}`}>{cite[1]}</span>;
    return part;
});

const parseMeta = (meta) => {
    const [authors, year, journal] = meta.split(/\s*·\s*/);
    return { authors, year, journal };
};

const UseCasesSection = () => {
    const [activeId, setActiveId] = useState(USE_CASES[0].id);
    const active = USE_CASES.find((item) => item.id === activeId) || USE_CASES[0];
    const trackRef = useRef(null);
    const [pill, setPill] = useState(null);

    // The white pill slides under the chosen segment: measured, so it fits any label. Until it
    // is measured (the prerender, the first frame) the chosen button wears the white itself.
    useEffect(() => {
        const track = trackRef.current;
        const button = track?.querySelector('[aria-selected="true"]');
        if (!track || !button) return undefined;
        const measure = () => setPill({ left: button.offsetLeft, width: button.offsetWidth });
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [activeId]);

    const onKeyDown = (event) => {
        const index = USE_CASES.findIndex((item) => item.id === activeId);
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = USE_CASES[(index + step + USE_CASES.length) % USE_CASES.length];
        setActiveId(next.id);
        trackRef.current?.querySelector(`[data-id="${next.id}"]`)?.focus();
    };

    return (
        <section className="about-section about-use" id="use-cases" aria-labelledby="about-use-heading">
            <div className="about-inner">
                <div className="about-use-head">
                    <p className="about-eyebrow" data-reveal>Use cases</p>
                    <h2 className="about-display" id="about-use-heading" data-reveal style={{ '--d': 1 }}>
                        Built for your research.
                    </h2>
                    <p className="about-use-sub" data-reveal style={{ '--d': 2 }}>
                        Five real questions, answered by GLKB. Every claim points to the paper behind it.
                    </p>
                </div>

                <div className="about-seg-wrap" data-reveal style={{ '--d': 3 }}>
                    {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
                    <div className="about-seg" role="tablist" aria-label="Use cases" ref={trackRef} onKeyDown={onKeyDown}>
                        {pill ? (
                            <span className="about-seg-pill" aria-hidden="true" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />
                        ) : null}
                        {USE_CASES.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                data-id={item.id}
                                id={`about-use-tab-${item.id}`}
                                aria-selected={item.id === active.id}
                                aria-controls="about-use-panel"
                                tabIndex={item.id === active.id ? 0 : -1}
                                className={`about-seg-button${item.id === active.id ? ' is-active' : ''}${pill ? '' : ' is-static'}`}
                                onClick={() => setActiveId(item.id)}
                            >
                                {SHORT_LABELS[item.id] || item.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div
                    className="about-uc-card"
                    id="about-use-panel"
                    role="tabpanel"
                    aria-labelledby={`about-use-tab-${active.id}`}
                    key={active.id}
                >
                    <div className="about-uc-chat">
                        <h3 className="about-uc-title">{active.label}</h3>
                        <p className="about-uc-lede">{active.lede}</p>
                        <div className="about-uc-thread">
                            <p className="about-uc-ask">
                                <span className="about-uc-sr">Question: </span>
                                {active.question}
                            </p>
                            <div className="about-uc-reply">
                                <img className="about-uc-avatar" src={siteMark} alt="" />
                                <div className="about-uc-answer">
                                    {active.answer.map((block, index) => {
                                        // eslint-disable-next-line react/no-array-index-key
                                        const key = `${block.type}-${index}`;
                                        if (block.type === 'list') {
                                            return (
                                                <ul key={key}>
                                                    {block.items.map((item) => <li key={item.slice(0, 60)}>{renderAnswerText(item)}</li>)}
                                                </ul>
                                            );
                                        }
                                        if (block.type === 'heading') return <p className="about-uc-answer-heading" key={key}>{block.text}</p>;
                                        return <p key={key}>{renderAnswerText(block.text)}</p>;
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="about-uc-actions">
                            <Link className="about-uc-open" {...exampleChatLink(active.question)}>
                                Open the full answer
                                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
                            </Link>
                            <span className="about-uc-free">Free, no sign-in · {active.sourceCount} sources</span>
                        </div>
                    </div>

                    <aside className="about-uc-sources" aria-label="Sources">
                        <p className="about-uc-sources-head">
                            <span>Sources</span>
                            <span className="about-uc-sources-count">
                                {active.references.length} of {active.sourceCount}
                            </span>
                        </p>
                        <ol className="about-uc-source-list">
                            {active.references.map((reference, index) => {
                                const { authors, year, journal } = parseMeta(reference.meta);
                                return (
                                    <li className="about-uc-source" key={reference.pmid}>
                                        <p className="about-uc-source-top">
                                            <span className="about-uc-cite">{index + 1}</span>
                                            <span className="about-uc-source-journal">{journal}</span>
                                            <span className="about-uc-source-year">{year}</span>
                                        </p>
                                        <p className="about-uc-source-title">{reference.title}</p>
                                        <p className="about-uc-source-quote">{reference.quote}</p>
                                        <p className="about-uc-source-foot">
                                            <span>{authors}</span>
                                            <a
                                                href={`https://pubmed.ncbi.nlm.nih.gov/${reference.pmid}/`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                PMID {reference.pmid}
                                            </a>
                                        </p>
                                    </li>
                                );
                            })}
                        </ol>
                    </aside>
                </div>
                <p className="about-sample-note">
                    An excerpt of GLKB&rsquo;s answer, with the papers it cites there. Each quote is the sentence
                    the answer drew on. Open the full answer to read the rest and every source.
                </p>
            </div>
        </section>
    );
};

export default UseCasesSection;
