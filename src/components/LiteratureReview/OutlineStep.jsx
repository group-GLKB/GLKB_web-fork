import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';

import { articleTypeLabel, sourceById, yearsLabel } from '../HomePage/ReviewScope';
import BetaBadge from '../Units/BetaBadge';
import { styleById } from './citationStyle';

const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const MAX_TITLE = 200;

/** How long a section may be, in words of the finished review (glkb-agent narrative.SECTION_WORDS). */
export const SECTION_WORDS = { min: 200, max: 1500, step: 100 };
/** How far over its target a review may be planned (narrative.MAX_OVER_TARGET): its price is fixed. */
export const MAX_OVER_TARGET = 1.5;
/** Within this share of the target, the planned length is on target. */
const ON_TARGET = 0.05;

const clampWords = (n) => Math.min(SECTION_WORDS.max, Math.max(SECTION_WORDS.min, n));

/**
 * How many PLANNED words of a section carry one cited paper, from three 6,000-word reviews by the
 * narrative writer (dev 2026-10-14, local 2026-10-27): a written body section cites one paper per ~45
 * words (36-57), the introduction and outlook one per ~85 (55-91), and the continuity edit leaves about
 * 88% of the planned length. The sections share some papers: the distinct references were 93-96% of the
 * sections' sum. Those three reviews had 101, 132 and 83 references; this estimates ~100.
 */
const WORDS_PER_CITATION = { body: 50, introduction: 95, outlook: 95 };
const SHARED_REFERENCES = 0.95;

/** About how many papers a section will cite at its length, never more than its writer is shown. */
export const citesFor = (r) => (typeof r.papers === 'number'
    ? Math.min(r.papers, Math.max(1, Math.round((r.words || 0) / (WORDS_PER_CITATION[r.kind] || WORDS_PER_CITATION.body))))
    : null);

/** 'gpt-6.1-terra' -> 'GPT-6.1 Terra'. */
export const modelLabel = (id) => (id ? String(id).replace(/^gpt-/i, 'GPT-').replace(/-([a-z])/g, (_, c) => ` ${c.toUpperCase()}`) : '');

/**
 * The kept sections' lengths scaled to `target`, to the nearest 50 and within the section bounds; what
 * rounding leaves over goes to the longest body section.
 */
export function fitToTarget(rows, target) {
    const kept = rows.filter((r) => !r.removed);
    const total = kept.reduce((n, r) => n + (r.words || 0), 0);
    if (!target || !total) return rows;
    const scaled = new Map(kept.map((r) => [r.id, clampWords(Math.round(((r.words || 0) * target) / total / 50) * 50)]));
    const left = target - [...scaled.values()].reduce((n, w) => n + w, 0);
    const longest = kept.filter((r) => r.kind === 'body').sort((a, b) => scaled.get(b.id) - scaled.get(a.id))[0];
    if (longest && left) scaled.set(longest.id, clampWords(scaled.get(longest.id) + left));
    return rows.map((r) => (scaled.has(r.id) ? { ...r, words: scaled.get(r.id) } : r));
}

/** A one-line title that wraps instead of scrolling sideways: a phone's row is narrower than most titles. */
function TitleField({ value, onChange, ...rest }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);
    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            maxLength={MAX_TITLE}
            onChange={(e) => onChange(e.target.value.replace(/\s*\n\s*/g, ' '))}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            {...rest}
        />
    );
}

/** − ~1,100 words +: a section's length, in steps of 100. */
function WordStepper({ name, words, onChange, canGrow, disabled }) {
    return (
        <span className="lr-osec-words" role="group" aria-label={`Length: ${name}`}>
            <button type="button" aria-label={`Shorter: ${name}`} disabled={disabled || words <= SECTION_WORDS.min}
                    onClick={() => onChange(clampWords(words - SECTION_WORDS.step))}>
                <RemoveIcon style={{ width: 16, height: 16 }} />
            </button>
            <span className="lr-mono" aria-live="polite">~{fmt(words)} words</span>
            <button type="button" aria-label={`Longer: ${name}`}
                    disabled={disabled || !canGrow || words >= SECTION_WORDS.max}
                    onClick={() => onChange(clampWords(words + SECTION_WORDS.step))}>
                <AddIcon style={{ width: 16, height: 16 }} />
            </button>
        </span>
    );
}

/**
 * Step 2: the outline, approved before anything is written (the outline design: "Rename, reorder or
 * remove sections, and adjust how long each should be"). The run has stopped at it and nothing runs
 * while the reader decides (glkb-agent literature_review/service.py, POST /run/{run_id}/resume).
 *
 * Each section shows what it covers (its subsections, or its message), its length in words of the
 * finished review and about how many papers it will cite at that length (citesFor). The reader renames the review and its
 * sections, moves the body's sections, leaves some out and makes each longer or shorter; the
 * introduction stays first and the outlook last. Beside it, the scope the review was planned with and
 * the planned length against the target. `onApprove({title, sections: [{id, title, words}]})` writes
 * it, every kept section with the length shown; a section the reader moved or resized by more than a
 * quarter has its paragraphs planned again before it is written (narrative.apply_edits).
 *
 * "Change scope" discards the outline and goes back to Step 1 with the same settings
 * (`onChangeScope`): the outline was the review's charge, so starting again is charged again, which
 * the reader is told before it happens.
 */
export default function OutlineStep({
    outline, topic = '', scope: pageScope = {}, citationStyle, yourPapers = 0, onApprove, onChangeScope,
    busy = false, error = '', phone = false,
}) {
    const original = useMemo(() => new Map((outline?.sections || []).map((s) => [s.id, s.title])), [outline]);
    const [title, setTitle] = useState(outline?.title || '');
    const [rows, setRows] = useState(() => (outline?.sections || []).map((s) => ({ ...s, removed: false })));
    const [confirming, setConfirming] = useState(false);

    // The scope the review was planned with: the run's own record (a reload has nothing else), else the page's.
    const runScope = outline?.scope || {};
    const target = Number(outline?.target_words || runScope.target_words || pageScope.targetWords || 0)
        || (outline?.sections || []).reduce((n, s) => n + (s.words || 0), 0);
    const kept = rows.filter((r) => !r.removed);
    const body = rows.filter((r) => r.kind === 'body');
    const planned = kept.reduce((n, r) => n + (r.words || 0), 0);
    const cap = Math.floor(target * MAX_OVER_TARGET);
    const canWrite = body.some((r) => !r.removed) && !busy;
    // About how many references the review will have: what each kept section will cite, less what they share.
    const knowsPapers = kept.some((r) => typeof r.papers === 'number');
    const references = knowsPapers
        ? Math.round((kept.reduce((n, r) => n + (citesFor(r) || 0), 0) * SHARED_REFERENCES) / 5) * 5 : null;
    const off = target ? (planned - target) / target : 0;
    const onTarget = Math.abs(off) <= ON_TARGET;

    const patch = (id, change) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));
    // The body's sections sit between the introduction and the outlook: a move swaps two of them.
    const move = (id, by) => setRows((rs) => {
        const i = rs.findIndex((r) => r.id === id);
        const j = i + by;
        if (i < 0 || j < 0 || j >= rs.length || rs[j].kind !== 'body') return rs;
        const next = [...rs];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
    });
    const approve = () => onApprove({
        title: title.trim(),
        sections: kept.map((r) => ({ id: r.id, title: r.title.trim() || original.get(r.id), words: r.words })),
    });

    const status = !target ? '' : onTarget ? 'On target'
        : off < 0 ? `${fmt(target - planned)} words under the target`
            : `${fmt(planned - target)} words over the target`;
    // The phone's bar has room for less.
    const shortStatus = !target || onTarget ? status : `${fmt(Math.abs(planned - target))} ${off < 0 ? 'under' : 'over'} target`;
    const fit = !onTarget && target > 0 && (
        <button type="button" className="lr-link lr-outline-fit" disabled={busy}
                onClick={() => setRows((rs) => fitToTarget(rs, target))}>
            Fit to {fmt(target)}
        </button>
    );

    const list = (
        <ol className="lr-osecs" aria-label="Sections">
            {rows.map((r) => {
                const n = kept.indexOf(r) + 1;
                const at = body.indexOf(r);
                const name = r.title.trim() || original.get(r.id);
                const covers = r.subsections?.length ? r.subsections.map((x) => x.title).join(' · ') : r.message;
                const fixed = r.kind === 'introduction' ? 'Always first' : r.kind === 'outlook' ? 'Always last' : '';
                return (
                    <li key={r.id} className={`lr-osec is-${r.kind}${r.removed ? ' is-removed' : ''}`}>
                        <span className="lr-mono lr-osec-num" aria-hidden="true">{r.removed ? '—' : pad2(n)}</span>
                        <div className="lr-osec-main">
                            <TitleField
                                className="lr-outline-title"
                                value={r.title}
                                disabled={r.removed || busy}
                                aria-label={`Section title: ${original.get(r.id)}`}
                                onChange={(value) => patch(r.id, { title: value })}
                            />
                            {!r.removed && covers && <p className="lr-osec-covers">{covers}</p>}
                            <div className="lr-osec-foot">
                                {r.removed ? (
                                    <span className="lr-osec-meta">Left out: not written</span>
                                ) : (
                                    <>
                                        <WordStepper name={name} words={r.words || 0} disabled={busy}
                                                     canGrow={!cap || planned + SECTION_WORDS.step <= cap}
                                                     onChange={(words) => patch(r.id, { words })} />
                                        {citesFor(r) !== null && (
                                            <span className="lr-mono lr-osec-meta"
                                                  title={`About ${citesFor(r)} cited, of the ${r.papers} papers its writer is shown`}>
                                                ~{citesFor(r)} paper{citesFor(r) === 1 ? '' : 's'}
                                            </span>
                                        )}
                                        {fixed && <span className="lr-osec-meta">{fixed}</span>}
                                    </>
                                )}
                            </div>
                        </div>
                        {r.kind === 'body' && (
                            <div className="lr-outline-tools lr-osec-tools">
                                {!r.removed && (
                                    <>
                                        <button type="button" aria-label={`Move up: ${name}`} disabled={busy || at === 0}
                                                onClick={() => move(r.id, -1)}>
                                            <ArrowUpwardIcon style={{ width: 18, height: 18 }} />
                                        </button>
                                        <button type="button" aria-label={`Move down: ${name}`}
                                                disabled={busy || at === body.length - 1} onClick={() => move(r.id, 1)}>
                                            <ArrowDownwardIcon style={{ width: 18, height: 18 }} />
                                        </button>
                                    </>
                                )}
                                <button type="button" className={r.removed ? 'is-undo' : ''} disabled={busy}
                                        aria-label={r.removed ? `Keep: ${name}` : `Leave out: ${name}`}
                                        onClick={() => patch(r.id, { removed: !r.removed })}>
                                    {r.removed ? 'Undo' : <CloseIcon style={{ width: 18, height: 18 }} />}
                                </button>
                            </div>
                        )}
                    </li>
                );
            })}
        </ol>
    );

    const head = (
        <section className="lr-ohead" aria-label="Title and argument">
            <label className="lr-ohead-label" htmlFor="lr-outline-review-title">Working title</label>
            <TitleField id="lr-outline-review-title" className="lr-outline-review-title" value={title}
                        disabled={busy} onChange={setTitle} />
            {outline?.thesis && (
                <>
                    <div className="lr-ohead-label">Argument</div>
                    <p className="lr-outline-thesis">{outline.thesis}</p>
                </>
            )}
        </section>
    );

    const years = yearsLabel({ startYear: runScope.start_year ?? pageScope.startYear,
                               cutoffYear: runScope.cutoff_year ?? pageScope.cutoffYear }, undefined, { long: true });
    const sources = runScope.sources || (yourPapers ? 'papers_and_search' : 'search');
    const scopeRows = [
        ['Target length', `${fmt(target)} words`],
        ...(references !== null ? [['References', `~${fmt(references)}`]] : []),
        ...(sources === 'papers' ? [] : [['Years', years],
                                         ['Article types', articleTypeLabel(runScope.article_types || pageScope.articleTypes)]]),
        ['Sources', sourceById(sources).label],
        ['Your papers', yourPapers ? fmt(yourPapers) : 'None'],
        ['Citation style', styleById(citationStyle).label],
        ...(runScope.model ? [['Model', modelLabel(runScope.model)]] : []),
    ];
    const meter = (
        <div className={`lr-ometer${onTarget ? ' is-on' : ' is-off'}`}>
            <div className="lr-ometer-head">
                <span>Planned length</span>
                <span className="lr-mono">{fmt(planned)} / {fmt(target)}</span>
            </div>
            <div className="lr-ometer-bar" role="meter" aria-label="Planned length" aria-valuemin={0}
                 aria-valuemax={target} aria-valuenow={planned}>
                <span style={{ width: `${Math.min(100, target ? (planned / target) * 100 : 0)}%` }} />
            </div>
            <div className="lr-ometer-status">
                <span>{status}</span>
                {fit}
            </div>
        </div>
    );
    const changeScope = confirming ? (
        <div className="lr-oconfirm" role="group" aria-label="Change scope">
            <p>Discard this outline and change the scope? Starting again is charged as a new review.</p>
            <div>
                <button type="button" className="lr-secondary" onClick={() => setConfirming(false)}>Keep the outline</button>
                <button type="button" className="lr-secondary is-danger" onClick={onChangeScope}>Discard it</button>
            </div>
        </div>
    ) : (
        <button type="button" className="lr-link lr-ochange" disabled={busy} onClick={() => setConfirming(true)}>
            ← Change scope
        </button>
    );
    const lede = 'Rename, reorder or remove sections, and adjust how long each should be. Writing starts only after you approve.';
    // Measured: 55 s for six sections on GPT-6.1 Terra (2026-10-27); a few minutes leaves room for Sol.
    const leave = 'Writing takes a few minutes. You can leave — the draft appears in Recent.';

    if (phone) {
        return (
            <div className="lr-mscope lr-moutline">
                <h1 className="lr-mscope-title">Review the outline</h1>
                <p className="lr-mscope-sub">{lede}</p>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {topic && <p className="lr-moutline-topic">{topic}</p>}
                <div className="lr-mcard lr-moutline-head">{head}</div>
                {list}
                <section className="lr-mcard lr-moutline-scope" aria-label="Scope">
                    <dl className="lr-scope-rows">
                        {scopeRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                    </dl>
                    {meter}
                </section>
                <div className="lr-note lr-moutline-change">{changeScope}</div>
                <div className="lr-mbar">
                    <div className="lr-mbar-text">
                        <div className="lr-mbar-big"><strong>~{fmt(planned)}</strong> words</div>
                        <div className="lr-mbar-sub">{kept.length} sections{shortStatus ? ` · ${shortStatus}` : ''}</div>
                    </div>
                    <button type="button" className="lr-primary lr-mbar-go" disabled={!canWrite} onClick={approve}>
                        Approve →
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="lr-page lr-scope lr-outline-page">
            <div className="lr-main">
                <div className="lr-kicker">Step 2 · Approve the outline<BetaBadge className="lr-kicker-beta" /></div>
                <h1 className="lr-title lr-outline-heading">{topic || outline?.title || 'Review the outline'}</h1>
                <p className="lr-lede">{lede}</p>
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                {head}
                {list}
            </div>
            <aside className="lr-card lr-scope-card lr-outline-side" aria-label="Scope">
                <div className="lr-card-title">Scope</div>
                <dl className="lr-scope-rows">
                    {scopeRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
                {meter}
                <button type="button" className="lr-primary" disabled={!canWrite} onClick={approve}>
                    Approve &amp; start writing →
                </button>
                <div className="lr-ochange-row">{changeScope}</div>
                <p className="lr-note">{leave}</p>
            </aside>
        </div>
    );
}
