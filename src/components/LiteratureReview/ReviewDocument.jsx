import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import CheckIcon from '@mui/icons-material/Check';
import remarkGfm from 'remark-gfm';

import BetaBadge from '../Units/BetaBadge';
import { OptionSelect } from '../Units/OptionMenu';

import { buildStyle, REVIEW_STYLES } from './citationStyle';
import {
    countWords, isProseBlock, linkCitations, locateSelection, markdownBlocks, parseReview, proseWords,
} from './reviewModel';

const REMARK_PLUGINS = [remarkGfm];
const pad2 = (n) => String(n).padStart(2, '0');

/** The paragraph actions of a saved review (backend POST /literature-review/history/{id}/paragraph). */
export const PARAGRAPH_ACTIONS_ENABLED = true;

/**
 * The four actions the toolbar over a selection offers (the design's Ask · Rewrite · Shorten · Add
 * evidence). Each works on the text the reader selected (`selection`), or on the whole paragraph when
 * the selection is all of it. `tab` is the panel tab it belongs to; `run` its button; `working` what
 * the panel says while it runs. Ask and Rewrite open the panel for the reader's own words first;
 * Shorten and Add evidence run at once, and "Try again" opens the box for a direction.
 */
export const PARAGRAPH_ACTIONS = [
    { id: 'ask', label: 'Ask', tab: 'ask', run: 'Ask', working: 'Reading the cited sources…',
      placeholder: 'Ask about this paragraph…', placeholderSelected: 'Ask about the selected text…' },
    { id: 'rewrite', label: 'Rewrite', tab: 'rewrite', run: 'Rewrite', working: 'Rewriting with the same sources…',
      placeholder: 'How should it change? e.g. tighten the second half' },
    { id: 'shorten', label: 'Shorten', tab: 'rewrite', run: 'Shorten', working: 'Shortening with the same sources…',
      placeholder: 'What should stay, and how short? e.g. keep the AML result' },
    { id: 'evidence', label: 'Add evidence', tab: 'rewrite', run: 'Find evidence', working: 'Looking for more evidence…',
      placeholder: 'What evidence? e.g. clinical trials, human studies only' },
];
const ACTION_BY_ID = Object.fromEntries(PARAGRAPH_ACTIONS.map((a) => [a.id, a]));
/** Actions that run as soon as they are picked: they have a standard job to do without the reader's words. */
const RUNS_AT_ONCE = new Set(['shorten', 'evidence']);
/** The design's suggestions under the box, each run as the action that does it. */
const ASK_DEFAULT = 'What is the strongest evidence here?';
const QUICK = {
    ask: [
        { label: ASK_DEFAULT, action: 'ask', question: ASK_DEFAULT },
        { label: 'Which claims rely on one study?', action: 'ask', question: 'Which claims rely on one study?' },
        { label: 'Any contradicting papers?', action: 'ask', question: 'Any contradicting papers?' },
    ],
    rewrite: [
        { label: 'More concise', action: 'shorten', question: '' },
        { label: 'Emphasize limitations', action: 'rewrite', question: 'Emphasize limitations' },
        { label: 'More formal', action: 'rewrite', question: 'More formal' },
        { label: 'Add supporting evidence', action: 'evidence', question: '' },
    ],
};

/** What a paragraph needs from the document: which one is being worked on, and the handlers. */
const ParaContext = createContext(null);

const errorText = (err) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return detail.message;
    return 'Something went wrong. Try again.';
};

/** A turn's result as the service's `history` takes it: the answer, or the suggestion it made. */
const turnAnswer = (turn, source) => {
    const r = turn.result || {};
    if (r.answer) return r.answer;
    const proposed = r.replacement ?? r.paragraph;
    return proposed && r.paragraph && r.paragraph.trim() !== source.trim() ? proposed : '';
};

/** "12 fewer words", "3 more words" or "same length". */
const wordDelta = (before, after) => {
    const a = proseWords(before);
    const b = proseWords(after);
    if (b < a) return `${a - b} fewer word${a - b === 1 ? '' : 's'}`;
    if (b > a) return `${b - a} more word${b - a === 1 ? '' : 's'}`;
    return 'same length';
};

/* The selected text stays marked while its panel is open (the CSS Custom Highlight API, where the
   browser has it): typing in the panel's box takes the browser's own selection away. */
const HIGHLIGHT = 'lr-selection';
const markRange = (range) => {
    try {
        if (range && window.CSS?.highlights && typeof window.Highlight === 'function') {
            window.CSS.highlights.set(HIGHLIGHT, new window.Highlight(range));
        }
    } catch (err) { /* nothing marked: the panel still says what it works on */ }
};
const unmarkRange = () => {
    try { window.CSS?.highlights?.delete(HIGHLIGHT); } catch (err) { /* nothing was marked */ }
};

/** The panel under the paragraph being worked on: the design's idle, loading and done states. */
function ParagraphPanel({ id, source }) {
    const ctx = useContext(ParaContext);
    const { para, setPara } = ctx;
    const action = ACTION_BY_ID[para.action];
    const turns = para.turns || [];
    const last = turns[turns.length - 1];
    const result = last?.result || {};
    const selected = Boolean(para.selection);
    const working = para.status === 'loading' || para.status === 'saving';
    const isAsk = para.action === 'ask';
    const close = () => setPara(null);
    const accept = () => {
        setPara((p) => ({ ...p, status: 'saving' }));
        ctx.onAccept(source, result)
            .then(() => { setPara(null); ctx.markEdited(id); })
            .catch((err) => setPara((p) => (p?.id === id ? { ...p, status: 'error', error: errorText(err), saveFailed: true } : p)));
    };
    // Back to the box: what came before stays as history, so "now shorter still" revises the suggestion.
    const again = () => setPara((p) => ({ ...p, status: 'idle', text: '', error: null, saveFailed: false }));
    const switchTab = (tab) => setPara((p) => (ACTION_BY_ID[p.action].tab === tab ? p
        : { ...p, action: tab, status: 'idle', text: '', turns: [], error: null }));
    const submit = () => ctx.runPara(para.action, para.text || '');

    const proposed = result.replacement ?? result.paragraph;
    const changed = Boolean(result.paragraph && result.paragraph.trim() !== source.trim());
    const before = result.replacement != null ? (result.selection || para.selection) : source;

    let body;
    if (working) {
        body = (
            <div className="lr-pa-loading" role="status">
                <span className="lr-pa-dot" aria-hidden="true" />
                {para.status === 'saving' ? 'Saving…' : action.working}
            </div>
        );
    } else if (para.status === 'error' && para.saveFailed) {
        body = (
            <div className="lr-pa-done">
                <div className="lr-pa-error" role="alert">{para.error}</div>
                <div className="lr-pa-buttons">
                    <button type="button" className="lr-pa-btn is-primary" onClick={accept}>Try again</button>
                    <button type="button" className="lr-pa-btn is-ghost" onClick={close}>Close</button>
                </div>
            </div>
        );
    } else if (para.status === 'ready' && isAsk) {
        body = (
            <div className="lr-pa-done">
                <div className="lr-pa-q">“{last.question}”</div>
                <div className="lr-pa-answer">{ctx.renderPlain(result.answer || '')}</div>
                <div className="lr-pa-buttons">
                    <button type="button" className="lr-pa-btn" onClick={again}>Ask a follow-up</button>
                    <button type="button" className="lr-pa-btn is-ghost" onClick={close}>Close</button>
                </div>
            </div>
        );
    } else if (para.status === 'ready') {
        body = changed ? (
            <div className="lr-pa-done">
                <div className="lr-pa-label">Proposed · {wordDelta(before, proposed)}</div>
                <div className="lr-pa-proposed">{ctx.renderPlain(proposed)}</div>
                {result.new_references?.length > 0 && (
                    <ul className="lr-pa-newrefs" aria-label="New references">
                        {result.new_references.map((r) => (
                            <li key={r.pmid}>
                                <span className="lr-mono">[{r.number}]</span> {r.title}{r.year ? ` (${r.year})` : ''}
                                {r.pmid && <> · <a href={r.url || `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noopener noreferrer">PMID {r.pmid}</a></>}
                            </li>
                        ))}
                    </ul>
                )}
                <div className="lr-pa-buttons">
                    <button type="button" className="lr-pa-btn is-primary" onClick={accept}>
                        {result.replacement != null ? 'Replace selection' : 'Replace paragraph'}
                    </button>
                    <button type="button" className="lr-pa-btn" onClick={again}>Try again</button>
                    <button type="button" className="lr-pa-btn is-ghost" onClick={close}>Discard</button>
                </div>
            </div>
        ) : (
            <div className="lr-pa-done">
                <p className="lr-pa-note">{result.message || `No change to suggest for this ${selected ? 'text' : 'paragraph'}.`}</p>
                <div className="lr-pa-buttons">
                    <button type="button" className="lr-pa-btn" onClick={again}>Try again</button>
                    <button type="button" className="lr-pa-btn is-ghost" onClick={close}>Discard</button>
                </div>
            </div>
        );
    } else {
        const placeholder = isAsk && selected ? action.placeholderSelected : action.placeholder;
        body = (
            <form className="lr-pa-idle" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                {para.status === 'error' && <div className="lr-pa-error" role="alert">{para.error}</div>}
                <div className="lr-pa-row">
                    <input
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        value={para.text || ''}
                        maxLength={2000}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        onChange={(e) => { const value = e.target.value; setPara((p) => ({ ...p, text: value })); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault(); }}
                    />
                    <button type="submit" className="lr-pa-run">{action.run}</button>
                </div>
                <div className="lr-pa-quick">
                    {QUICK[action.tab].map((q) => (
                        <button key={q.label} type="button" onClick={() => ctx.runPara(q.action, q.question)}>{q.label}</button>
                    ))}
                </div>
            </form>
        );
    }

    return (
        <div className="lr-pa" role="region" aria-label={action.label}>
            <div className="lr-pa-head">
                {[['ask', 'Ask'], ['rewrite', 'Rewrite']].map(([tab, label]) => (
                    <button key={tab} type="button" className={`lr-pa-tab${action.tab === tab ? ' is-on' : ''}`}
                            aria-pressed={action.tab === tab} disabled={working} onClick={() => switchTab(tab)}>
                        {label}
                    </button>
                ))}
                <span className="lr-pa-spacer" />
                <span className="lr-pa-scope" title={selected ? para.selection : undefined}>
                    {selected ? 'Selected text only' : 'This paragraph only'}
                </span>
                <button type="button" className="lr-pa-x" aria-label="Close" disabled={para.status === 'saving'} onClick={close}>×</button>
            </div>
            {body}
        </div>
    );
}

/** One paragraph of prose, and the panel under it while the reader's selection in it is worked on. */
function Paragraph({ id, source, children }) {
    const ctx = useContext(ParaContext);
    const actionable = Boolean(ctx?.onParagraph && source && source.length > 40);
    if (actionable) ctx.sources.set(id, source);
    const open = ctx?.para?.id === id;
    const edited = ctx?.edited?.id === id;
    return (
        <div className={`lr-para${open ? ' is-open' : ''}`} data-para-id={actionable ? id : undefined}>
            <p>{children}</p>
            {edited && !open && (
                <div className="lr-pa-edited">
                    Edited
                    {ctx.onUndo && (
                        <> · <button type="button" disabled={ctx.edited.busy} onClick={ctx.undo}>Undo</button></>
                    )}
                    {ctx.edited.error && <span className="lr-pa-error" role="alert"> {ctx.edited.error}</span>}
                </div>
            )}
            {open && <ParagraphPanel id={id} source={source} />}
        </div>
    );
}

/** The text of a range as the reader saw it, without the citations' own text (pills or author–year). */
const rangeText = (range) => {
    const fragment = range.cloneContents();
    fragment.querySelectorAll('.lr-cite').forEach((n) => n.remove());
    return fragment.textContent || '';
};

/** Where a selection is: the actionable paragraph it lies in (both ends), and what of its markdown it is. */
const readSelection = (root, sources) => {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const paraOf = (node) => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('[data-para-id]') || null;
    const para = paraOf(range.startContainer);
    if (!para || para !== paraOf(range.endContainer) || !root?.contains(para)) return null;
    const p = Array.from(para.children).find((n) => n.tagName === 'P');
    if (!p || !p.contains(range.startContainer) || !p.contains(range.endContainer)) return null;
    const id = para.getAttribute('data-para-id');
    const source = sources.get(id);
    if (!source) return null;
    const pre = document.createRange();
    pre.setStart(p, 0);
    pre.setEnd(range.startContainer, range.startOffset);
    const found = locateSelection(source, rangeText(pre), rangeText(range));
    if (!found) return null;
    return { id, source, ...found, range: range.cloneRange() };
};

/** Where the toolbar goes: above the selection, or under it near the top of the window (and on a phone,
 *  whose own copy menu sits above a selection). */
const TOOLBAR_WIDTH = 300;
const toolbarAt = (range, phone) => {
    const r = typeof range?.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
    if (!r) return { top: 0, left: 0 };
    const below = phone || r.top < 120;
    const half = TOOLBAR_WIDTH / 2;
    const width = window.innerWidth || 1024;
    const center = Math.min(Math.max(r.left + r.width / 2, half + 8), Math.max(half + 8, width - half - 8));
    return { top: below ? r.bottom + 8 : r.top - 42, left: center };
};

function ReferenceCard({ entry, authorDate, highlighted, refEl, position }) {
    const reference = entry.reference;
    return (
        <article ref={refEl} id={`ref-${entry.number}`} className={`lr-ref${highlighted ? ' is-highlighted' : ''}`}>
            <div className="lr-ref-head">
                <span className="lr-mono lr-ref-num">{authorDate ? entry.label : `[${entry.number}]`}</span>
            </div>
            {/* The phone design numbers the list down its left edge instead. */}
            <span className="lr-ref-pos" aria-hidden="true">{position}</span>
            <div className="lr-ref-text">{entry.text}</div>
            {(reference.pmid || reference.source === 'upload') && (
                <div className="lr-ref-meta">
                    {reference.source === 'upload' && (
                        <span className="lr-ref-upload" title={reference.file_name}>
                            Your paper{reference.file_name ? ` · ${reference.file_name}` : ''}
                        </span>
                    )}
                    {reference.pmid && (
                        <a href={reference.url || `https://pubmed.ncbi.nlm.nih.gov/${reference.pmid}/`} target="_blank" rel="noopener noreferrer">
                            PMID {reference.pmid}
                        </a>
                    )}
                </div>
            )}
            {reference.quote && (
                <blockquote className="lr-ref-quote">
                    <div className="lr-ref-quote-label">Supporting sentence · {reference.quote_source === 'abstract' ? 'from the abstract' : 'verbatim'}</div>
                    “{reference.quote}”
                </blockquote>
            )}
        </article>
    );
}

/**
 * Step 4, the finished review (design: contents on the left, the draft with its numbers in the
 * middle, the references on the right). Every number shown is the pipeline's own audit when the
 * review carries it (reviewModel.reviewAudit); the two that need it — claims verified and needing
 * review — are left out otherwise rather than estimated.
 */
export default function ReviewDocument({
    markdown, references: given, records, citationStyle, onCitationStyle, meta, onParagraph, onAccept, onUndo,
    phone = false,
}) {
    const review = useMemo(() => parseReview(markdown, given), [markdown, given]);
    const byNumber = useMemo(() => new Map(review.references.map((r) => [r.number, r])), [review.references]);
    // The citation style (citationStyle.js): what the pills say and how the list reads and is ordered.
    const styled = useMemo(() => buildStyle(review.references, records || {}, citationStyle),
        [review.references, records, citationStyle]);
    const { authorDate } = styled.style;
    const words = review.audit?.words ?? countWords(review);
    const target = review.audit?.target ?? meta?.targetWords ?? null;
    const cited = review.audit?.cited ?? review.references.length;
    const [activeId, setActiveId] = useState(review.sections[0]?.id || null);
    const [hover, setHover] = useState(null); // { nums, rect }
    const [highlight, setHighlight] = useState(null);
    const refEls = useRef(new Map());
    const hideTimer = useRef(null);
    // The paragraph being worked on: {id, source, selection (its markdown the reader selected, '' for
    // all of it), start, action, status (idle | loading | ready | error | saving), text (being typed),
    // pending (being run), turns: [{question, result}], error?}.
    const [para, setPara] = useState(null);
    const paraRef = useRef(null);
    paraRef.current = para;
    // The reader's selection, while the toolbar over it shows: {id, source, text, start, whole, range, top, left}.
    const [selTool, setSelTool] = useState(null);
    // The paragraph last edited here, which can be put back: {id, busy?, error?}.
    const [edited, setEdited] = useState(null);
    const sources = useRef(new Map());
    const articleRef = useRef(null);
    const draggingRef = useRef(false);
    const actionable = Boolean(onParagraph && onAccept);

    // Three columns need the width: the app's sidebar folds to its rail while the review is open.
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('glkb-sidebar-rail', { detail: true }));
        return () => window.dispatchEvent(new CustomEvent('glkb-sidebar-rail', { detail: false }));
    }, []);

    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return undefined;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (visible[0]) setActiveId(visible[0].target.id);
        }, { rootMargin: '-80px 0px -60% 0px' });
        review.sections.forEach((s) => { const el = document.getElementById(s.id); if (el) observer.observe(el); });
        return () => observer.disconnect();
    }, [review.sections]);

    const showRef = useCallback((nums) => {
        const first = nums[0];
        setHighlight(first);
        refEls.current.get(first)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, []);
    const openCard = (nums, el) => { clearTimeout(hideTimer.current); setHover({ nums, rect: el.getBoundingClientRect() }); };
    const closeCard = () => { hideTimer.current = setTimeout(() => setHover(null), 150); };

    const components = useMemo(() => ({
        a: ({ href, children, node, ...props }) => {
            if (href && href.startsWith('#cite=')) {
                const nums = href.slice(6).split(',').map(Number).filter(Number.isFinite);
                const handlers = {
                    'aria-label': `References ${nums.join(', ')}`,
                    onMouseEnter: (e) => openCard(nums, e.currentTarget),
                    onMouseLeave: closeCard,
                    onFocus: (e) => openCard(nums, e.currentTarget),
                    onBlur: closeCard,
                    onClick: () => showRef(nums),
                };
                // An author–year citation is a phrase of the sentence and has to wrap with it, which a
                // <button> (an inline-block) cannot: it is a focusable span acting as a button.
                if (authorDate) {
                    return (
                        <span
                            role="button"
                            tabIndex={0}
                            className="lr-cite is-author-date"
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showRef(nums); } }}
                            {...handlers}
                        >
                            ({styled.cite(nums)})
                        </span>
                    );
                }
                return <button type="button" className="lr-cite" {...handlers}>{nums.join(',')}</button>;
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
        },
        table: ({ node, ...props }) => <div className="lr-table-scroll"><table {...props} /></div>,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [showRef, styled]);

    /* Per part of the review (the introduction, each section): the same components, with a `p` that
       finds the paragraph's own markdown — citations as stored, [3, 7] — from where it was rendered,
       which is what an action works on. Stable while a paragraph is worked on, so its panel (and the
       question being typed into it) is not remounted. */
    const partComponents = useMemo(() => {
        const parts = [['intro', review.intro], ...review.sections.map((s) => [s.id, s.body])];
        return new Map(parts.map(([part, md]) => {
            const blocks = markdownBlocks(md);
            const p = ({ node, children }) => {
                const offset = node?.position?.start?.offset;
                const index = blocks.findIndex((b) => offset >= b.tStart && offset < b.tEnd);
                const block = blocks[index];
                const source = block && isProseBlock(block.text) && offset - block.tStart < 4 ? block.text.trim() : null;
                return <Paragraph id={`${part}:${index}`} source={source}>{children}</Paragraph>;
            };
            return [part, { ...components, p }];
        }));
    }, [components, review]);
    const renderPlain = useCallback(
        (md) => <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>{linkCitations(md)}</ReactMarkdown>,
        [components],
    );
    /* Runs an action on the open panel's paragraph (or `base`, a panel just opened) with the reader's
       words, sending the panel's earlier turns of the same action, and adds the result as its newest
       turn. An Ask with nothing typed asks the design's first suggestion. */
    const runPara = useCallback((actionId, question, base) => {
        const p0 = base || paraRef.current;
        if (!p0 || !onParagraph) return;
        const action = actionId || p0.action;
        const typed = String(question ?? '').trim();
        const q = typed || (action === 'ask' ? ASK_DEFAULT : '');
        const turns = action === p0.action ? (p0.turns || []) : [];
        const history = turns.map((t) => ({ question: t.question, answer: turnAnswer(t, p0.source) }));
        setPara({ ...p0, action, status: 'loading', pending: q, error: null, saveFailed: false, turns });
        const mine = (p) => p && p.id === p0.id && p.action === action && p.status === 'loading';
        onParagraph(action, p0.source, q, history, p0.selection ? { text: p0.selection, start: p0.start } : null)
            .then((result) => setPara((p) => (mine(p) ? {
                ...p, status: 'ready', text: '', pending: null, turns: [...turns, { question: q, result }],
            } : p)))
            .catch((err) => setPara((p) => (mine(p) ? {
                ...p, status: 'error', text: typed, pending: null, error: errorText(err),
            } : p)));
    }, [onParagraph]);

    // The toolbar's actions: open the panel on the selection (Shorten and Add evidence run at once).
    const startAction = (actionId) => {
        const t = selTool;
        if (!t) return;
        const base = { id: t.id, source: t.source, selection: t.whole ? '' : t.text, start: t.whole ? null : t.start,
                       action: actionId, status: 'idle', text: '', turns: [] };
        setPara(base);
        setSelTool(null);
        markRange(t.range);
        window.getSelection?.()?.removeAllRanges?.();
        if (RUNS_AT_ONCE.has(actionId)) runPara(actionId, '', base);
    };
    useEffect(() => { if (!para) unmarkRange(); }, [para]);
    useEffect(() => () => unmarkRange(), []);

    /* The selection, read when the reader lets go of the mouse, after a keyboard selection, and (a
       phone's handles have no mouse) whenever it changes while no mouse button is down. */
    const busy = para && ['loading', 'saving'].includes(para.status);
    useEffect(() => {
        if (!actionable) return undefined;
        let timer = null;
        const read = (delay = 0) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const found = readSelection(articleRef.current, sources.current);
                setSelTool(found ? { ...found, ...toolbarAt(found.range, phone) } : null);
            }, delay);
        };
        const onDown = (e) => { if (!e.target.closest?.('.lr-seltools')) draggingRef.current = true; };
        const onUp = () => { draggingRef.current = false; read(0); };
        const onKey = (e) => {
            if (e.key === 'Escape') { setSelTool(null); return; }
            if (e.shiftKey || e.key.startsWith('Arrow') || ((e.metaKey || e.ctrlKey) && e.key === 'a')) read(0);
        };
        const onChange = () => { if (!draggingRef.current) read(150); };
        const onScroll = () => setSelTool((t) => (t ? { ...t, ...toolbarAt(t.range, phone) } : t));
        document.addEventListener('mousedown', onDown);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('keyup', onKey);
        document.addEventListener('selectionchange', onChange);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('keyup', onKey);
            document.removeEventListener('selectionchange', onChange);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [actionable, phone]);

    // The last accepted edit can be put back (the backend keeps every version it replaced).
    const markEdited = useCallback((id) => setEdited({ id }), []);
    const undo = useCallback(() => {
        if (!onUndo || !edited) return;
        setEdited((e) => ({ ...e, busy: true, error: null }));
        onUndo()
            .then(() => setEdited(null))
            .catch((err) => setEdited((e) => (e ? { ...e, busy: false, error: errorText(err) } : e)));
    }, [onUndo, edited]);

    const paraContext = useMemo(() => ({
        para, setPara, renderPlain, runPara, sources: sources.current, markEdited, edited, undo,
        onUndo: onUndo || null, onParagraph: actionable ? onParagraph : null, onAccept,
    }), [para, renderPlain, runPara, markEdited, edited, undo, onUndo, actionable, onParagraph, onAccept]);

    const jump = (id) => {
        setActiveId(id);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const styleSelect = onCitationStyle ? (
        <OptionSelect label={`Citation style: ${styled.style.label}`} panelLabel="Citation style"
                      className="lr-style-select" panelClassName="lr-pop" placement="bottom-start"
                      value={styled.style.id} onChange={onCitationStyle}
                      options={REVIEW_STYLES.map((st) => ({
                          id: st.id, label: st.label,
                          hint: st.authorDate ? 'Author–year in the text' : 'Numbered in the text',
                      }))} />
    ) : <span>{styled.style.label}</span>;
    const render = (md, part) => (
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={partComponents.get(part) || components}>
            {linkCitations(md)}
        </ReactMarkdown>
    );
    const hoverRefs = hover ? hover.nums.map((n) => byNumber.get(n)).filter(Boolean) : [];

    return (
        <div className="lr-review">
            <nav className="lr-contents" aria-label="Contents">
                <div className="lr-contents-title">Contents</div>
                <ol>
                    {review.sections.map((s) => (
                        <li key={s.id}>
                            <button type="button" className={activeId === s.id ? 'is-active' : ''} onClick={() => jump(s.id)}>
                                <span className="lr-mono">{pad2(s.number)}</span>
                                <span>{s.title}</span>
                            </button>
                        </li>
                    ))}
                    {review.references.length > 0 && (
                        <li><button type="button" className="is-plain" onClick={() => jump('lr-references')}>
                            <span className="lr-mono" /> <span>References</span>
                        </button></li>
                    )}
                </ol>
            </nav>

            <article className="lr-document" ref={articleRef}>
                {/* The phone design: what the audit found as one badge, then a one-line meta. The badge
                    needs the pipeline's audit; without it nothing is claimed. */}
                {phone ? review.audit && (
                    review.audit.fabricated ? (
                        <div className="lr-mverified is-warn">
                            {review.audit.fabricated === 1 ? '1 citation needs' : `${review.audit.fabricated} citations need`} review
                        </div>
                    ) : (
                        <div className="lr-mverified">
                            <span className="lr-mverified-mark"><CheckIcon style={{ width: 13, height: 13 }} /></span>
                            Citations verified
                        </div>
                    )
                ) : <div className="lr-kicker">Literature review · Draft 1<BetaBadge className="lr-kicker-beta" /></div>}
                <h1 className="lr-title">{review.title || meta?.topic}</h1>
                {phone && (
                    <div className="lr-mmeta">
                        <span>≈{words.toLocaleString('en-US')} words</span>
                        <span>{review.references.length} reference{review.references.length === 1 ? '' : 's'}</span>
                        {meta?.startYear && <span>{meta.startYear}–{meta.cutoffYear || new Date().getFullYear()}</span>}
                        {styleSelect}
                    </div>
                )}
                {!phone && (<>
                <div className="lr-meta">
                    {meta?.startYear
                        ? <span>{meta.startYear}–{meta.cutoffYear || new Date().getFullYear()}</span>
                        : meta?.cutoffYear && <span>Up to {meta.cutoffYear}</span>}
                    {meta?.papers > 0 && <span>{meta.papers === 1 ? 'One' : meta.papers} of your papers</span>}
                    {styleSelect}
                    {meta?.generated && <span>Generated {meta.generated}{meta.minutes ? ` · ${meta.minutes} min` : ''}</span>}
                </div>
                <div className="lr-stats">
                    <div className="lr-stat">
                        <div className="lr-stat-label">Words{target ? ' / target' : ''}</div>
                        <div className="lr-stat-value">{words.toLocaleString('en-US')}{target ? <span className="lr-stat-of"> / {target.toLocaleString('en-US')}</span> : null}</div>
                        {target ? <div className="lr-stat-bar"><span style={{ width: `${Math.min(100, Math.round((words / target) * 100))}%` }} /></div> : null}
                    </div>
                    <div className="lr-stat">
                        <div className="lr-stat-label">Papers cited</div>
                        <div className="lr-stat-value">{cited.toLocaleString('en-US')}</div>
                    </div>
                    {review.audit && (
                        <div className="lr-stat">
                            <div className="lr-stat-label">Citations verified</div>
                            <div className="lr-stat-value is-good">{review.audit.verified.toLocaleString('en-US')}</div>
                        </div>
                    )}
                    {review.audit && (
                        <div className={`lr-stat${review.audit.fabricated ? ' is-warn' : ''}`}
                             title="Citations the pipeline's final audit could not match to a paper it read">
                            <div className="lr-stat-label">Needs review</div>
                            <div className="lr-stat-value">{review.audit.fabricated}</div>
                        </div>
                    )}
                </div>
                <p className="lr-hint">
                    Hover a citation to preview the paper.{PARAGRAPH_ACTIONS_ENABLED && actionable && ' Select text to ask about it, or to rewrite, shorten or add evidence to it.'}
                </p>
                </>)}
                <ParaContext.Provider value={paraContext}>
                    {review.intro && <div className="lr-section">{render(review.intro, 'intro')}</div>}
                    {review.sections.map((s) => (
                        <section key={s.id} id={s.id} className="lr-section">
                            <h2><span className="lr-mono lr-section-num">{phone ? s.number : pad2(s.number)}</span>{s.title}</h2>
                            {render(s.body, s.id)}
                        </section>
                    ))}
                </ParaContext.Provider>
            </article>

            <aside className="lr-refs" id="lr-references" aria-label="References">
                <div className="lr-refs-head">
                    <span className="lr-refs-title">References</span>
                    <span className="lr-mono lr-refs-count">{review.references.length}</span>
                </div>
                <div className="lr-refs-list">
                    {styled.entries.map((e, i) => (
                        <ReferenceCard key={e.number} entry={e} authorDate={authorDate} highlighted={highlight === e.number}
                                       position={i + 1} refEl={(el) => { if (el) refEls.current.set(e.number, el); }} />
                    ))}
                </div>
                {phone && (
                    <p className="lr-disclaimer">AI-generated draft. Verify all citations against primary sources before submission.</p>
                )}
            </aside>

            {selTool && !busy && (
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                <div className="lr-seltools" role="toolbar" aria-label="Selection actions"
                     style={{ top: selTool.top, left: selTool.left }}
                     // Keeps the selection while a button is pressed.
                     onMouseDown={(e) => e.preventDefault()}>
                    {PARAGRAPH_ACTIONS.map((a) => (
                        <button key={a.id} type="button" onClick={() => startAction(a.id)}>{a.label}</button>
                    ))}
                </div>
            )}

            {hover && hoverRefs.length > 0 && (
                <div
                    className="lr-cite-card"
                    role="tooltip"
                    style={{ top: Math.min(hover.rect.bottom + 8, window.innerHeight - 220), left: Math.max(12, Math.min(hover.rect.left - 40, window.innerWidth - 440)) }}
                    onMouseEnter={() => clearTimeout(hideTimer.current)}
                    onMouseLeave={closeCard}
                >
                    {hoverRefs.slice(0, 3).map((r) => (
                        <div key={r.number} className="lr-cite-card-item">
                            <div className="lr-cite-card-meta">
                                <span className="lr-mono">{authorDate ? styled.byNumber.get(r.number)?.label : `[${r.number}]`}</span>
                                {' '}{[records?.[r.pmid]?.['container-title-short'] || r.journal, r.year].filter(Boolean).join(' · ')}{r.pmid ? ` · PMID ${r.pmid}` : ''}{r.source === 'upload' ? ' · Your paper' : ''}
                            </div>
                            <div className="lr-cite-card-title">{r.title}</div>
                            {r.quote && <div className="lr-cite-card-quote">“{r.quote}”</div>}
                        </div>
                    ))}
                    {hoverRefs.length > 3 && <div className="lr-cite-card-more">+{hoverRefs.length - 3} more</div>}
                </div>
            )}
        </div>
    );
}

