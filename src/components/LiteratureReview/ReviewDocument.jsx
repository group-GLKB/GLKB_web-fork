import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import CheckIcon from '@mui/icons-material/Check';
import { CircularProgress } from '@mui/material';
import remarkGfm from 'remark-gfm';

import BetaBadge from '../Units/BetaBadge';
import { OptionSelect } from '../Units/OptionMenu';

import { buildStyle, REVIEW_STYLES } from './citationStyle';
import { countWords, isProseBlock, linkCitations, markdownBlocks, parseReview } from './reviewModel';

const REMARK_PLUGINS = [remarkGfm];
const pad2 = (n) => String(n).padStart(2, '0');

/** The paragraph actions of a saved review (backend POST /literature-review/history/{id}/paragraph). */
export const PARAGRAPH_ACTIONS_ENABLED = true;

/** Each action: its label, what the panel says while it works, and what its result is called. */
export const PARAGRAPH_ACTIONS = [
    { id: 'ask', label: 'Ask', working: 'Answering…', result: 'Answer' },
    { id: 'rewrite', label: 'Rewrite', working: 'Rewriting…', result: 'Suggested rewrite' },
    { id: 'shorten', label: 'Shorten', working: 'Shortening…', result: 'Suggested shorter version' },
    { id: 'evidence', label: 'Add evidence', working: 'Looking for more evidence…', result: 'With new evidence' },
];
const ACTION_BY_ID = Object.fromEntries(PARAGRAPH_ACTIONS.map((a) => [a.id, a]));

/** What a paragraph needs from the document: which one is being worked on, and the handlers. */
const ParaContext = createContext(null);

const errorText = (err) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return detail.message;
    return 'Something went wrong. Try again.';
};

/** The suggestion, answer or question under the paragraph being worked on. */
function ParagraphPanel({ id, source }) {
    const ctx = useContext(ParaContext);
    const { para, setPara } = ctx;
    const action = ACTION_BY_ID[para.action];
    const close = () => setPara(null);
    const run = (question = '') => {
        setPara({ id, action: para.action, status: 'loading', question });
        ctx.onParagraph(para.action, source, question)
            .then((result) => setPara((p) => (p?.id === id ? { ...p, status: 'ready', result } : p)))
            .catch((err) => setPara((p) => (p?.id === id ? { ...p, status: 'error', error: errorText(err) } : p)));
    };
    const accept = () => {
        setPara((p) => ({ ...p, status: 'saving' }));
        ctx.onAccept(source, para.result)
            .then(() => setPara(null))
            .catch((err) => setPara((p) => (p?.id === id ? { ...p, status: 'error', error: errorText(err), saveFailed: true } : p)));
    };
    const result = para.result || {};
    const changed = result.paragraph && result.paragraph.trim() !== source.trim();
    return (
        <div className="lr-para-panel" role="region" aria-label={action.label}>
            {para.status === 'asking' && (
                <form className="lr-para-ask" onSubmit={(e) => { e.preventDefault(); if (para.question?.trim()) run(para.question.trim()); }}>
                    <input
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        type="text"
                        placeholder="Ask about this paragraph…"
                        value={para.question || ''}
                        maxLength={2000}
                        onChange={(e) => { const question = e.target.value; setPara((p) => ({ ...p, question })); }}
                    />
                    <button type="submit" className="is-primary" disabled={!para.question?.trim()}>Ask</button>
                    <button type="button" onClick={close}>Cancel</button>
                </form>
            )}
            {(para.status === 'loading' || para.status === 'saving') && (
                <div className="lr-para-working">
                    <CircularProgress size={14} thickness={5} />
                    <span>{para.status === 'saving' ? 'Saving…' : action.working}</span>
                </div>
            )}
            {para.status === 'error' && (
                <div className="lr-para-error">
                    <span>{para.error}</span>
                    <div className="lr-para-buttons">
                        <button type="button" className="is-primary"
                                onClick={() => (para.saveFailed ? accept() : run(para.question || ''))}>Try again</button>
                        <button type="button" onClick={close}>Close</button>
                    </div>
                </div>
            )}
            {para.status === 'ready' && para.action === 'ask' && (
                <>
                    <div className="lr-para-panel-label">{para.question}</div>
                    <div className="lr-para-suggestion">{ctx.renderPlain(result.answer || '')}</div>
                    <div className="lr-para-buttons">
                        <button type="button" onClick={() => setPara({ id, action: 'ask', status: 'asking', question: '' })}>Ask another</button>
                        <button type="button" onClick={close}>Close</button>
                    </div>
                </>
            )}
            {para.status === 'ready' && para.action !== 'ask' && (
                changed ? (
                    <>
                        <div className="lr-para-panel-label">{action.result}</div>
                        <div className="lr-para-suggestion">{ctx.renderPlain(result.paragraph)}</div>
                        {result.new_references?.length > 0 && (
                            <ul className="lr-para-newrefs" aria-label="New references">
                                {result.new_references.map((r) => (
                                    <li key={r.pmid}>
                                        <span className="lr-mono">[{r.number}]</span> {r.title}{r.year ? ` (${r.year})` : ''}
                                        {r.pmid && <> · <a href={r.url || `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noopener noreferrer">PMID {r.pmid}</a></>}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="lr-para-buttons">
                            <button type="button" className="is-primary" onClick={accept}>Replace paragraph</button>
                            <button type="button" onClick={close}>Discard</button>
                        </div>
                    </>
                ) : (
                    <div className="lr-para-error">
                        <span>{result.message || 'No change to suggest for this paragraph.'}</span>
                        <div className="lr-para-buttons"><button type="button" onClick={close}>Close</button></div>
                    </div>
                )
            )}
        </div>
    );
}

/** One paragraph of prose: the actions over it, and the panel under it while it is worked on. */
function Paragraph({ id, source, children }) {
    const ctx = useContext(ParaContext);
    const actionable = Boolean(ctx?.onParagraph && source && source.length > 40);
    const busy = ctx?.para && ['loading', 'saving'].includes(ctx.para.status);
    const open = ctx?.para?.id === id;
    const start = (action) => {
        if (busy) return;
        if (action.id === 'ask') {
            ctx.setPara({ id, action: 'ask', status: 'asking', question: '' });
            return;
        }
        ctx.setPara({ id, action: action.id, status: 'loading' });
        ctx.onParagraph(action.id, source, '')
            .then((result) => ctx.setPara((p) => (p?.id === id ? { ...p, status: 'ready', result } : p)))
            .catch((err) => ctx.setPara((p) => (p?.id === id ? { ...p, status: 'error', error: errorText(err) } : p)));
    };
    const tools = actionable && (
        <div className="lr-para-tools" role="toolbar" aria-label="Paragraph actions">
            {PARAGRAPH_ACTIONS.map((a) => (
                <button key={a.id} type="button" disabled={busy} onClick={() => start(a)}>{a.label}</button>
            ))}
        </div>
    );
    // A phone has no hover: a tap on the paragraph shows its actions under it.
    const selected = ctx?.phone && ctx.selected === id;
    return (
        <div className={`lr-para${open ? ' is-open' : ''}${selected ? ' is-selected' : ''}`}>
            {/* A zero-height sticky anchor: on a paragraph taller than the window the
                toolbar stays at the top of what is visible of it. */}
            {tools && !ctx.phone && <div className="lr-para-anchor">{tools}</div>}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
            <p onClick={actionable && ctx.phone ? () => ctx.setSelected(selected ? null : id) : undefined}>{children}</p>
            {tools && selected && !open && <div className="lr-para-inline">{tools}</div>}
            {open && <ParagraphPanel id={id} source={source} />}
        </div>
    );
}

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
    markdown, references: given, records, citationStyle, onCitationStyle, meta, onParagraph, onAccept,
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
    // The paragraph being worked on: {id, action, status, question?, result?, error?}.
    const [para, setPara] = useState(null);
    const [selected, setSelected] = useState(null);

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
    const paraContext = useMemo(() => ({
        para, setPara, selected, setSelected, phone, renderPlain,
        onParagraph: onParagraph && onAccept ? onParagraph : null, onAccept,
    }), [para, selected, phone, renderPlain, onParagraph, onAccept]);

    const jump = (id) => {
        setActiveId(id);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const styleSelect = onCitationStyle ? (
        <OptionSelect label={`Citation style: ${styled.style.label}`} panelLabel="Citation style"
                      className="lr-style-select" placement="bottom-start"
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

            <article className="lr-document">
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
                    Hover a citation to preview the paper.{PARAGRAPH_ACTIONS_ENABLED && onParagraph && ' Hover a paragraph to ask about it, rewrite or shorten it, or add evidence to it.'}
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

