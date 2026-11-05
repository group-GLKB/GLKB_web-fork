/**
 * How GLKB Works, as one pinned screen: the four steps stay put on the left
 * while the window on the right plays the candidate-target example through
 * them — the question types itself, the evidence arrives, the answer writes
 * itself line by line, and a citation opens onto its source sentence.
 */
import React, { useRef, useState } from 'react';

import { easeOut, segment, useScrollProgress } from './motion';
import { DYRK1A_EXAMPLE } from './useCases';

export const WORKFLOW_STEPS = [
    ['Ask', 'Type any biomedical query: a gene, variant, drug target, or disease.'],
    ['Retrieve', 'GLKB searches 41.2M+ papers, 3.71M+ biomedical terms and 14.6M+ relationships, surfacing the most relevant PubMed papers.'],
    ['Reason', 'The AI synthesizes retrieved evidence into a structured, concise, cited answer.'],
    ['Verify', 'Review the cited sources to check the supporting evidence and identify where further investigation is needed.'],
];

const EXAMPLE = DYRK1A_EXAMPLE;
const QUESTION = EXAMPLE.question;
const REFERENCES = EXAMPLE.references;

/* The example answer, condensed: each line keeps the reference it cites there. */
const ANSWER_TITLE = 'DYRK1A in type 2 diabetes: what’s known';
const ANSWER_LINES = [
    ['Harmine analogs act as human β-cell mitogens, most likely through DYRK1A with NFAT as mediator, improving glycemic control in vivo.', 1],
    ['Aminopyrazine compounds inhibiting DYRK1A and GSK3B drive robust proliferation in adult human islets.', 2],
    ['Adding TGFβ/SMAD inhibition to DYRK1A inhibition yields substantially higher proliferation, including in β-cells from people with T2D.', 3],
    ['Open challenge: β-cell specificity, since DYRK1A is broadly expressed.', null],
];

/* The retrieval view's graph: the pair the question names, and what links them. */
const GRAPH_NODES = [
    { id: 'harmine', label: 'Harmine', type: 'chemical', x: 62, y: 96 },
    { id: 'dyrk1a', label: 'DYRK1A', type: 'gene', x: 220, y: 40, labelAbove: true },
    { id: 'nfat', label: 'NFAT', type: 'gene', x: 220, y: 124 },
    { id: 't2d', label: 'Type 2 diabetes', type: 'disease', x: 410, y: 96 },
];
const GRAPH_EDGES = [
    ['harmine', 'dyrk1a', 'inhibits'],
    ['dyrk1a', 'nfat', 'regulates'],
    ['dyrk1a', 't2d', 'co-mentioned in 14 papers'],
];
const nodeById = Object.fromEntries(GRAPH_NODES.map((node) => [node.id, node]));

const stepAt = (progress) => Math.min(WORKFLOW_STEPS.length - 1, Math.floor(progress * WORKFLOW_STEPS.length));

const WorkflowScene = () => {
    const sectionRef = useRef(null);
    const typedRef = useRef(null);
    const [step, setStep] = useState(0);

    useScrollProgress(sectionRef, {
        mode: 'pin',
        onProgress: (progress) => {
            const element = sectionRef.current;
            const count = WORKFLOW_STEPS.length;
            for (let index = 0; index < count; index += 1) {
                element.style.setProperty(`--s${index}`, segment(progress, index / count, (index + 1) / count).toFixed(4));
            }
            const next = stepAt(progress);
            setStep((current) => (current === next ? current : next));
            const typed = easeOut(segment(progress, 0.02, 0.18));
            if (typedRef.current) typedRef.current.textContent = QUESTION.slice(0, Math.round(QUESTION.length * typed));
        },
    });

    const stateOf = (index) => (index === step ? 'active' : index < step ? 'done' : 'next');

    return (
        <section className="about-flow" id="how-it-works" ref={sectionRef}>
            <div className="about-flow-stage">
                <div className="about-flow-inner">
                    <div className="about-flow-copy">
                        <p className="about-eyebrow">From query to answer</p>
                        <h2 className="about-heading">How GLKB Works</h2>
                        <ol className="about-flow-steps">
                            {WORKFLOW_STEPS.map(([name, body], index) => (
                                <li className="about-flow-step" data-state={stateOf(index)} key={name}>
                                    <span className="about-flow-step-number">{index + 1}</span>
                                    <div className="about-flow-step-text">
                                        <h3 className="about-flow-step-name">{name}</h3>
                                        <p className="about-flow-step-body">{body}</p>
                                    </div>
                                    <span className="about-flow-step-meter" aria-hidden="true">
                                        <i style={{ '--fill': `var(--s${index}, 0)` }} />
                                    </span>
                                </li>
                            ))}
                        </ol>
                        {/* Phones show the steps as a row of numbers; the active one's text goes here. */}
                        <p className="about-flow-caption" aria-hidden="true">{WORKFLOW_STEPS[step][1]}</p>
                    </div>

                    <div className="about-flow-window" aria-hidden="true">
                        <div className="about-flow-chrome">
                            <span className="about-flow-lights"><i /><i /><i /></span>
                            <span className="about-flow-address">glkb.org/chat</span>
                        </div>
                        <div className="about-flow-screen" data-step={step}>
                            <div className="about-flow-panel about-flow-panel--ask" data-state={step === 0 ? 'active' : 'done'}>
                                <p className="about-flow-greeting">What would you like to know?</p>
                                <div className="about-flow-composer">
                                    <span className="about-flow-typed">
                                        <span ref={typedRef}>{QUESTION}</span>
                                        <span className="about-flow-caret" />
                                    </span>
                                    <span className="about-flow-send">↑</span>
                                </div>
                                <div className="about-flow-chips">
                                    {['Gene', 'Variant', 'Drug target', 'Disease'].map((chip) => <span key={chip}>{chip}</span>)}
                                </div>
                            </div>

                            <div className="about-flow-panel about-flow-panel--retrieve" data-state={stateOf(1)}>
                                <div className="about-flow-question">{QUESTION}</div>
                                <p className="about-flow-status">
                                    <span className="about-flow-spinner" />
                                    Searching 41.2M+ papers and the knowledge graph
                                </p>
                                <svg className="about-flow-graph" viewBox="0 0 480 160">
                                    {GRAPH_EDGES.map(([from, to, label], index) => {
                                        const a = nodeById[from];
                                        const b = nodeById[to];
                                        const mx = (a.x + b.x) / 2;
                                        const my = (a.y + b.y) / 2;
                                        // A vertical edge is labelled beside it; the others along their line.
                                        const vertical = a.x === b.x;
                                        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
                                        return (
                                            <g key={`${from}-${to}`} style={{ '--k': index }} className="about-flow-edge">
                                                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} pathLength="100" />
                                                {vertical ? (
                                                    <text x={mx + 10} y={my + 4} textAnchor="start">{label}</text>
                                                ) : (
                                                    <text x={mx} y={my - 7} textAnchor="middle" transform={`rotate(${angle.toFixed(1)} ${mx} ${my})`}>{label}</text>
                                                )}
                                            </g>
                                        );
                                    })}
                                    {GRAPH_NODES.map((node, index) => (
                                        <g key={node.id} className={`about-flow-node is-${node.type}`} style={{ '--k': index }}>
                                            <circle cx={node.x} cy={node.y} r="9" />
                                            <text x={node.x} y={node.labelAbove ? node.y - 16 : node.y + 26} textAnchor="middle">{node.label}</text>
                                        </g>
                                    ))}
                                </svg>
                                <ul className="about-flow-papers">
                                    {REFERENCES.map((reference, index) => (
                                        <li key={reference.title} style={{ '--k': index }}>
                                            <span className="about-flow-paper-title">{reference.title}</span>
                                            <span className="about-flow-paper-meta">{reference.meta}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="about-flow-panel about-flow-panel--answer" data-state={step >= 2 ? 'active' : 'next'}>
                                <div className="about-flow-question">{QUESTION}</div>
                                <div className="about-flow-answer">
                                    <p className="about-flow-answer-title">{ANSWER_TITLE}</p>
                                    {ANSWER_LINES.map(([text, cite], index) => (
                                        <p className="about-flow-line" style={{ '--k': index }} key={text}>
                                            {text}
                                            {cite ? <span className={`about-flow-cite${cite === 1 ? ' is-picked' : ''}`}>{cite}</span> : null}
                                        </p>
                                    ))}
                                </div>
                                <div className="about-flow-source">
                                    <span className="about-flow-source-index">1</span>
                                    <div>
                                        <p className="about-flow-source-title">{REFERENCES[0].title}</p>
                                        <p className="about-flow-source-meta">{REFERENCES[0].meta}</p>
                                        <p className="about-flow-source-quote"><mark>{REFERENCES[0].quote}</mark></p>
                                        <p className="about-flow-source-pmid">{`PubMed ID: ${REFERENCES[0].pmid}`}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WorkflowScene;
