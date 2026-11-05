/**
 * The knowledge base in three numbers. The stage is pinned while the section
 * scrolls past it: the page darkens, and each figure takes its turn while the
 * picture beside it turns papers into terms and terms into a graph.
 */
import React, { useEffect, useRef, useState } from 'react';

import { FIELD_TYPES, createKnowledgeField } from './knowledgeField';
import { clamp01, easeOut, segment, useScrollProgress } from './motion';

export const SCALE_STAGES = [
    {
        value: '41.2M+',
        label: 'Papers',
        body: 'Biomedical papers read and indexed, every one of them a source an answer can cite.',
    },
    {
        value: '3.71M+',
        label: 'Biomedical terms',
        body: 'Genes, diseases, chemicals, variants and pathways, recognized in the text and reconciled against biomedical ontologies.',
    },
    {
        value: '14.6M+',
        label: 'Relationships',
        body: 'Gene–disease associations, pathway memberships and literature-derived links between terms, each traceable to its source.',
    },
];

/* Where each figure takes over, as a fraction of the scene's progress. */
const STAGE_STARTS = [0, 0.33, 0.64];
const stageAt = (progress) => (progress < STAGE_STARTS[1] ? 0 : progress < STAGE_STARTS[2] ? 1 : 2);

const COUNT_MS = 1400;

const countTo = (value, t) => {
    const [, digits, suffix] = /^([\d.]+)(.*)$/.exec(value);
    const decimals = (digits.split('.')[1] || '').length;
    return `${(Number(digits) * t).toFixed(decimals)}${suffix}`;
};

const ScaleScene = ({ motion }) => {
    const sectionRef = useRef(null);
    const visualRef = useRef(null);
    const canvasRef = useRef(null);
    const valueRefs = useRef([]);
    const progressRef = useRef(0);
    // The step whose figure last counted up while the scene was on screen; null off screen.
    const countedRef = useRef(null);
    const countFrameRef = useRef(0);
    const [stage, setStage] = useState(0);

    useScrollProgress(sectionRef, {
        mode: 'pin',
        onProgress: (progress, rect, viewport) => {
            progressRef.current = progress;
            // The dark arrives as the section scrolls in and lifts at the very end,
            // so the bands either side of it stay white.
            const arriving = clamp01((viewport - rect.top) / (viewport * 0.75));
            const leaving = 1 - segment(progress, 0.93, 1);
            sectionRef.current.style.setProperty('--tone', Math.min(arriving, leaving).toFixed(3));
            const next = stageAt(progress);
            setStage((current) => (current === next ? current : next));
            if (!motion) return;
            // Each figure counts up from zero on its own clock when its step comes up on
            // screen, rather than with the scroll; away from the scene they wait at zero,
            // so coming back counts them again.
            const onScreen = rect.top < viewport * 0.6 && rect.bottom > viewport * 0.4;
            if (!onScreen) {
                if (countedRef.current !== null) {
                    countedRef.current = null;
                    window.cancelAnimationFrame(countFrameRef.current);
                    SCALE_STAGES.forEach((item, index) => {
                        if (valueRefs.current[index]) valueRefs.current[index].textContent = countTo(item.value, 0);
                    });
                }
                return;
            }
            if (countedRef.current !== next) {
                countedRef.current = next;
                countUp(next);
            }
        },
    });

    // Zero to the figure in COUNT_MS, easing out, like a counter settling.
    const countUp = (index) => {
        const node = valueRefs.current[index];
        if (!node) return;
        window.cancelAnimationFrame(countFrameRef.current);
        const started = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - started) / COUNT_MS);
            node.textContent = countTo(SCALE_STAGES[index].value, easeOut(t));
            if (t < 1) countFrameRef.current = window.requestAnimationFrame(tick);
        };
        countFrameRef.current = window.requestAnimationFrame(tick);
    };

    useEffect(() => () => window.cancelAnimationFrame(countFrameRef.current), []);

    // With motion the figures wait at zero until their step comes up (the prerender and the
    // no-motion page show them whole); without it, or if motion is switched off mid-visit,
    // they are the plain figures.
    useEffect(() => {
        SCALE_STAGES.forEach((item, index) => {
            const node = valueRefs.current[index];
            if (!node) return;
            if (!motion) node.textContent = item.value;
            else if (countedRef.current === null) node.textContent = countTo(item.value, 0);
        });
    }, [motion]);

    // The canvas is only built once the scene is near, and only drawn while it is on screen.
    useEffect(() => {
        const canvas = canvasRef.current;
        const visual = visualRef.current;
        if (!canvas || !visual || typeof window.IntersectionObserver !== 'function') return undefined;
        let field = null;
        let frame = 0;
        let visible = false;
        const loop = (now) => {
            frame = 0;
            if (!visible || !field) return;
            field.draw(progressRef.current, motion ? now : 0);
            frame = window.requestAnimationFrame(loop);
        };
        const fit = () => {
            if (!field) return;
            const box = visual.getBoundingClientRect();
            field.resize(box.width, box.height);
        };
        const observer = new window.IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible && !field) {
                field = createKnowledgeField(canvas, { dense: window.innerWidth > 700 });
                fit();
            }
            if (visible && !frame) frame = window.requestAnimationFrame(loop);
        }, { rootMargin: '200px 0px' });
        observer.observe(visual);
        window.addEventListener('resize', fit);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', fit);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, [motion]);

    return (
        <section className="about-scale" id="knowledge-base" ref={sectionRef}>
            <div className="about-scale-stage">
                <div className="about-scale-dark" aria-hidden="true" />
                {/* One wash per figure, cross-faded: gradients themselves do not animate. */}
                <div className="about-scale-glow" data-stage={stage} aria-hidden="true"><i /><i /><i /></div>
                <div className="about-scale-inner">
                    <div className="about-scale-copy">
                        <p className="about-eyebrow about-scale-eyebrow">The knowledge base</p>
                        <h2 className="about-heading about-scale-heading">
                            The biomedical literature,
                            <br />
                            read into one graph.
                        </h2>
                        <div className="about-scale-stats">
                            {SCALE_STAGES.map((item, index) => (
                                <div
                                    className="about-scale-stat"
                                    data-state={index === stage ? 'active' : index < stage ? 'before' : 'after'}
                                    key={item.label}
                                >
                                    <div className="about-scale-value">
                                        <span ref={(node) => { valueRefs.current[index] = node; }}>{item.value}</span>
                                    </div>
                                    <div className="about-scale-label">{item.label}</div>
                                    <p className="about-scale-body">{item.body}</p>
                                </div>
                            ))}
                        </div>
                        <ol className="about-scale-progress" aria-hidden="true">
                            {SCALE_STAGES.map((item, index) => (
                                <li key={item.label} className={index <= stage ? 'is-reached' : ''}>
                                    <span style={{ '--from': STAGE_STARTS[index], '--to': STAGE_STARTS[index + 1] || 0.93 }} />
                                </li>
                            ))}
                        </ol>
                    </div>
                    <div className="about-scale-visual" ref={visualRef}>
                        <canvas className="about-scale-canvas" ref={canvasRef} aria-hidden="true" />
                        <ul className={`about-scale-legend${stage > 0 ? ' is-shown' : ''}`} aria-label="Entity types in the graph">
                            {FIELD_TYPES.map((type) => (
                                <li key={type.key}>
                                    <i style={{ backgroundColor: `rgb(${type.color.join(',')})` }} />
                                    {type.label}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ScaleScene;
