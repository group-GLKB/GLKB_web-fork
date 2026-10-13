import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';

import BetaBadge from '../Units/BetaBadge';

const pad2 = (n) => String(n).padStart(2, '0');
const MAX_TITLE = 200;

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

/**
 * Step 2: the outline, approved before anything is written (the phone design: "You'll approve an
 * outline before any writing starts"). The run has stopped at it and nothing runs while the reader
 * decides (glkb-agent literature_review/service.py, POST /run/{run_id}/resume). The reader may rename
 * the review and its sections, move the body's sections and leave some out; the introduction stays
 * first and the outlook last. `onApprove({title, sections: [{id, title}]})` writes it.
 */
export default function OutlineStep({ outline, onApprove, onDiscard, busy = false, error = '', phone = false }) {
    const original = useMemo(() => new Map((outline?.sections || []).map((s) => [s.id, s.title])), [outline]);
    const [title, setTitle] = useState(outline?.title || '');
    const [rows, setRows] = useState(() => (outline?.sections || []).map((s) => ({ ...s, removed: false })));
    const kept = rows.filter((r) => !r.removed);
    const body = rows.filter((r) => r.kind === 'body');
    const canWrite = body.some((r) => !r.removed) && !busy;
    const words = outline?.words || kept.reduce((n, r) => n + (r.words || 0), 0);

    const rename = (id, value) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, title: value } : r)));
    const toggle = (id) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, removed: !r.removed } : r)));
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
        sections: kept.map((r) => ({ id: r.id, title: r.title.trim() || original.get(r.id) })),
    });

    const list = (
        <ol className="lr-outline-list" aria-label="Sections">
            {rows.map((r) => {
                const n = kept.indexOf(r) + 1;
                const at = body.indexOf(r);
                const name = r.title.trim() || original.get(r.id);
                return (
                    <li key={r.id} className={`lr-outline-row is-${r.kind}${r.removed ? ' is-removed' : ''}`}>
                        <span className="lr-mono lr-outline-num" aria-hidden="true">{r.removed ? '—' : pad2(n)}</span>
                        <div className="lr-outline-main">
                            <TitleField
                                className="lr-outline-title"
                                value={r.title}
                                disabled={r.removed || busy}
                                aria-label={`Section title: ${original.get(r.id)}`}
                                onChange={(value) => rename(r.id, value)}
                            />
                            {!r.removed && r.message && <p className="lr-outline-message">{r.message}</p>}
                            {!r.removed && r.subsections?.length > 0 && (
                                <p className="lr-outline-subs">{r.subsections.map((x) => x.title).join(' · ')}</p>
                            )}
                            <div className="lr-outline-foot">
                                <span className="lr-outline-meta">
                                    {r.removed ? 'Left out: not written'
                                        : `${r.kind === 'introduction' ? 'Introduction · ' : r.kind === 'outlook' ? 'Outlook · ' : ''}~${(r.words || 0).toLocaleString('en-US')} words`}
                                </span>
                                {r.kind === 'body' && (
                                    <div className="lr-outline-tools">
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
                                                onClick={() => toggle(r.id)}>
                                            {r.removed ? 'Undo' : <CloseIcon style={{ width: 18, height: 18 }} />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </li>
                );
            })}
        </ol>
    );

    const titleField = (
        <>
            <label className="lr-mfield-label" htmlFor="lr-outline-review-title">Title</label>
            <input id="lr-outline-review-title" className="lr-outline-review-title" value={title}
                   maxLength={MAX_TITLE} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
            {outline?.thesis && (
                <>
                    <div className="lr-mfield-label lr-outline-thesis-label">Argument</div>
                    <p className="lr-outline-thesis">{outline.thesis}</p>
                </>
            )}
        </>
    );
    const sectionsHint = `${kept.length} section${kept.length === 1 ? '' : 's'}. The introduction stays first and the outlook last.`;
    const lede = 'Rename, reorder or leave out sections. Nothing is written until you approve it.';
    const discard = (
        <button type="button" className="lr-link lr-outline-discard" disabled={busy} onClick={onDiscard}>
            Discard and start over
        </button>
    );

    if (phone) {
        return (
            <div className="lr-mscope lr-moutline">
                <h1 className="lr-mscope-title">Review the outline</h1>
                <p className="lr-mscope-sub">{lede}</p>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <section className="lr-mcard" aria-label="Outline">
                    <div className="lr-mfield">{titleField}</div>
                    <div className="lr-mfield">
                        <div className="lr-mfield-label">Sections</div>
                        <p className="lr-mfield-hint">{sectionsHint}</p>
                        {list}
                    </div>
                </section>
                <p className="lr-note">{discard}</p>
                <div className="lr-mbar">
                    <div className="lr-mbar-text">
                        <div className="lr-mbar-big"><strong>~{words.toLocaleString('en-US')}</strong> words</div>
                        <div className="lr-mbar-sub">{kept.length} sections · the draft takes a few minutes</div>
                    </div>
                    <button type="button" className="lr-primary lr-mbar-go" disabled={!canWrite} onClick={approve}>
                        Write the review →
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="lr-page lr-outline-page">
            <div className="lr-main is-narrow">
                <div className="lr-kicker">Step 2 · Approve the outline<BetaBadge className="lr-kicker-beta" /></div>
                <h1 className="lr-title">Review the outline</h1>
                <p className="lr-lede">{lede}</p>
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                <section className="lr-card lr-outline-card" aria-label="Outline">
                    <div className="lr-mfield">{titleField}</div>
                    <div className="lr-mfield">
                        <div className="lr-mfield-label">Sections</div>
                        <p className="lr-mfield-hint">{sectionsHint}</p>
                        {list}
                    </div>
                </section>
                <div className="lr-outline-actions">
                    {discard}
                    <span className="lr-mono lr-outline-total">~{words.toLocaleString('en-US')} words · {kept.length} sections</span>
                    <button type="button" className="lr-primary is-small" disabled={!canWrite} onClick={approve}>
                        Write the review →
                    </button>
                </div>
            </div>
        </div>
    );
}
