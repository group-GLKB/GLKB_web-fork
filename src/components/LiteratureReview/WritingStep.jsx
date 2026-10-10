import React from 'react';
import CheckIcon from '@mui/icons-material/Check';

import { minutesLeft, STAGES, stageFill, stageIndex } from './reviewModel';

const count = (n, one, many) => `${Number(n).toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** What each stage's row says on its right, from the counts the service reports. */
const stageCount = (stage, detail, targetWords) => {
    if (stage.id === 'acquisition') {
        const parts = [];
        if (detail.searches) parts.push(count(detail.searches, 'search', 'searches'));
        if (detail.papers_opened) parts.push(count(detail.papers_opened, 'paper', 'papers'));
        return parts.join(' · ');
    }
    // The planner is asked for one section per ~600 words, at least six (literature_review/style.py).
    if (stage.id === 'planning') return targetWords ? `~${Math.max(6, Math.round(targetWords / 600))} sections` : '';
    if (stage.id === 'writing') return targetWords ? `~${Number(targetWords).toLocaleString('en-US')} words` : '';
    return '';
};

/**
 * Steps 2–3 while the review is written (design: "Verifying citations… · About 2 min left",
 * a four-part bar, one row per stage). The rows are the pipeline's real stages; the counts
 * are the ones its progress frames carry.
 */
export default function WritingStep({ topic, progress, elapsed, targetWords, notify, pending, onStop }) {
    const phase = progress?.phase || 'acquisition';
    const at = stageIndex(phase);
    const fills = stageFill(progress?.percent, phase);
    const left = minutesLeft(progress?.percent, elapsed);
    const detail = progress?.detail || {};
    const writing = phase === 'writing';
    return (
        <div className="lr-page lr-writing">
            <div className="lr-main is-narrow">
                <div className="lr-kicker">{writing ? 'Step 3 · Writing' : 'Step 2 · Building the outline'}</div>
                <h1 className="lr-title">{topic}</h1>
                <section className="lr-card lr-progress" aria-live="polite">
                    <div className="lr-progress-head">
                        <span className="lr-progress-label">{pending ? 'Writing — this page updates when the review is saved' : (progress?.label || 'Starting…')}</span>
                        {left && <span className="lr-mono lr-progress-left">About {left} min left</span>}
                    </div>
                    <div className="lr-segments" aria-hidden="true">
                        {fills.map((f, i) => (
                            <span key={STAGES[i].id} className="lr-segment"><span style={{ width: `${Math.round(f * 100)}%` }} /></span>
                        ))}
                    </div>
                    <ol className="lr-stages">
                        {STAGES.map((stage, i) => {
                            const state = pending ? 'todo' : i < at ? 'done' : i === at ? 'current' : 'todo';
                            const right = stageCount(stage, detail, targetWords);
                            return (
                                <li key={stage.id} className={`lr-stage is-${state}`}>
                                    <span className="lr-stage-mark">
                                        {state === 'done' ? <CheckIcon style={{ width: 14, height: 14 }} /> : i + 1}
                                    </span>
                                    <span className="lr-stage-text">
                                        <span className="lr-stage-name">{stage.label}</span>
                                        <span className="lr-stage-detail">{stage.detail}</span>
                                    </span>
                                    {right && <span className="lr-mono lr-stage-count">{right}</span>}
                                </li>
                            );
                        })}
                    </ol>
                </section>
                <div className="lr-leave">
                    <span>You can close this tab — the review keeps running.</span>
                    <span className="lr-leave-side">
                        {notify && <span className="lr-notify"><CheckIcon style={{ width: 16, height: 16 }} /> We'll email you when it's ready</span>}
                        {onStop && <button type="button" className="lr-link" onClick={onStop}>Stop</button>}
                    </span>
                </div>
            </div>
        </div>
    );
}
