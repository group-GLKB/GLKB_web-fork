import React from 'react';
import CheckIcon from '@mui/icons-material/Check';

import BetaBadge from '../Units/BetaBadge';

import { minutesLeft, STAGES, stageFill, stageIndex } from './reviewModel';

const count = (n, one, many) => `${Number(n).toLocaleString('en-US')} ${n === 1 ? one : many}`;
const pad2 = (n) => String(n).padStart(2, '0');
const SECTION_STATE = { queued: 'Queued', writing: 'Writing', done: 'Done' };

/** The outline's sections once the run has planned them, each with where it is (the design's "Sections"). */
function SectionList({ rows }) {
    if (!rows?.length) return null;
    return (
        <section className="lr-sections" aria-label="Sections">
            <div className="lr-sections-title">Sections</div>
            <ol className="lr-sections-list">
                {rows.map((row, i) => (
                    <li key={row.id} className={`lr-section-row is-${row.state}`}>
                        <span className="lr-mono lr-section-row-num">{pad2(i + 1)}</span>
                        <span className="lr-section-row-title">{row.title}</span>
                        <span className="lr-section-row-state">{SECTION_STATE[row.state] || row.state}</span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

/** What each stage's row says on its right, from the counts the service reports. */
const stageCount = (stage, detail, targetWords, sections) => {
    if (stage.id === 'acquisition') {
        const parts = [];
        if (detail.searches) parts.push(count(detail.searches, 'search', 'searches'));
        if (detail.papers_opened) parts.push(count(detail.papers_opened, 'paper', 'papers'));
        return parts.join(' · ');
    }
    // The planner is asked for one section per ~600 words, at least six (literature_review/style.py).
    // Once the outline is known, its own count.
    if (stage.id === 'planning' && sections?.length) return count(sections.length, 'section', 'sections');
    if (stage.id === 'planning') return targetWords ? `~${Math.max(6, Math.round(targetWords / 600))} sections` : '';
    if (stage.id === 'writing') return targetWords ? `~${Number(targetWords).toLocaleString('en-US')} words` : '';
    return '';
};

/**
 * Steps 2–3 while the review is written (design: "Verifying citations… · About 2 min left",
 * a four-part bar, one row per stage). The rows are the pipeline's real stages; the counts
 * are the ones its progress frames carry.
 */
export default function WritingStep({
    topic, progress, elapsed, targetWords, notify, pending, onStop, papers = 0, papersOnly = false, phone = false,
    sections = null,
}) {
    const phase = progress?.phase || 'acquisition';
    const at = stageIndex(phase);
    const fills = stageFill(progress?.percent, phase);
    const left = minutesLeft(progress?.percent, elapsed);
    const detail = progress?.detail || {};
    const writing = phase === 'writing';
    const papersLine = papers > 0 && (
        <p className="lr-writing-papers">
            {papersOnly ? `From your ${papers === 1 ? 'paper' : `${papers} papers`} only`
                : `With your ${papers === 1 ? 'paper' : `${papers} papers`}`}
        </p>
    );

    if (phone) {
        /* The phone design: the share done as one big number and one bar, the topic, the stages as a
           checklist (done, in hand, to come) and a status bar at the bottom. A review reopened while
           it is still being written has no percentage to show, so it says so instead. */
        const percent = Math.max(1, Math.min(99, Math.round(Number(progress?.percent) || 1)));
        return (
            <div className="lr-mwriting">
                <div className="lr-mpct" aria-live="polite">
                    {pending ? <span className="lr-mpct-pending">Still being written</span> : (
                        <>
                            <span className="lr-mpct-n">{percent}%</span>
                            <span className="lr-mpct-left">{left ? `About ${left} min left` : (progress?.label || 'Starting…')}</span>
                        </>
                    )}
                </div>
                <div className="lr-mprogress" aria-hidden="true"><span style={{ width: `${pending ? 0 : percent}%` }} /></div>
                <p className="lr-mwriting-topic">{topic}</p>
                {papersLine}
                <ol className="lr-mcard lr-mstages">
                    {STAGES.map((stage, i) => {
                        const state = pending ? 'todo' : i < at ? 'done' : i === at ? 'current' : 'todo';
                        const said = state === 'todo' ? '' : (stageCount(stage, detail, targetWords, sections) || stage.detail);
                        return (
                            <li key={stage.id} className={`lr-mstage is-${state}`}>
                                <span className="lr-mstage-mark">
                                    {state === 'done' && <CheckIcon style={{ width: 16, height: 16 }} />}
                                </span>
                                <span className="lr-mstage-text">
                                    <span className="lr-mstage-name">{stage.doing}</span>
                                    {said && <span className="lr-mstage-detail">{said}</span>}
                                </span>
                            </li>
                        );
                    })}
                </ol>
                <SectionList rows={sections} />
                <p className="lr-mleave">
                    You can close this tab — the review keeps running.
                    {notify && " We'll email you when it's ready."}
                </p>
                <div className="lr-mbar">
                    <button type="button" className="lr-mbar-status" disabled>
                        {writing ? 'Writing your review…' : 'Building the outline…'}
                    </button>
                    {onStop && <button type="button" className="lr-secondary lr-mbar-stop" onClick={onStop}>Stop</button>}
                </div>
            </div>
        );
    }

    return (
        <div className="lr-page lr-writing">
            <div className="lr-main is-narrow">
                <div className="lr-kicker">{writing ? 'Step 3 · Writing' : 'Step 2 · Building the outline'}<BetaBadge className="lr-kicker-beta" /></div>
                <h1 className="lr-title">{topic}</h1>
                {papersLine}
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
                            const right = stageCount(stage, detail, targetWords, sections);
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
                <SectionList rows={sections} />
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
