import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { countWords, linkCitations, parseReview } from './reviewModel';

const REMARK_PLUGINS = [remarkGfm];
const pad2 = (n) => String(n).padStart(2, '0');

/** The plain text of a rendered markdown node (for the paragraph actions). */
const nodeText = (node) => {
    if (!node) return '';
    if (node.type === 'text') return node.value;
    return (node.children || []).map(nodeText).join('');
};

/** What each paragraph action asks the chat, with the passage quoted. */
export const PARAGRAPH_ACTIONS = [
    { id: 'ask', label: 'Ask', prompt: (t, title) => `About this passage from my literature review "${title}" — what does the evidence behind it show, and how strong is it?\n\n"${t}"` },
    { id: 'rewrite', label: 'Rewrite', prompt: (t) => `Rewrite this passage from my literature review for clarity. Keep every claim and its citation numbers.\n\n"${t}"` },
    { id: 'shorten', label: 'Shorten', prompt: (t) => `Shorten this passage from my literature review to about half its length. Keep the key claims and their citation numbers.\n\n"${t}"` },
    { id: 'evidence', label: 'Add evidence', prompt: (t) => `Find more published evidence, with PMIDs, for the claims in this passage from my literature review.\n\n"${t}"` },
];

function ReferenceCard({ reference, highlighted, refEl }) {
    return (
        <article ref={refEl} id={`ref-${reference.number}`} className={`lr-ref${highlighted ? ' is-highlighted' : ''}`}>
            <div className="lr-ref-head"><span className="lr-mono lr-ref-num">[{reference.number}]</span></div>
            <div className="lr-ref-title">{reference.title || 'Untitled'}</div>
            <div className="lr-ref-meta">
                {[reference.journal, reference.year].filter(Boolean).join(' · ')}
                {reference.pmid && (
                    <>
                        {(reference.journal || reference.year) ? ' · ' : ''}
                        <a href={reference.url || `https://pubmed.ncbi.nlm.nih.gov/${reference.pmid}/`} target="_blank" rel="noopener noreferrer">
                            PMID {reference.pmid}
                        </a>
                    </>
                )}
            </div>
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
export default function ReviewDocument({ markdown, references: given, meta, onAction }) {
    const review = useMemo(() => parseReview(markdown, given), [markdown, given]);
    const byNumber = useMemo(() => new Map(review.references.map((r) => [r.number, r])), [review.references]);
    const words = review.audit?.words ?? countWords(review);
    const target = review.audit?.target ?? meta?.targetWords ?? null;
    const cited = review.audit?.cited ?? review.references.length;
    const [activeId, setActiveId] = useState(review.sections[0]?.id || null);
    const [hover, setHover] = useState(null); // { nums, rect }
    const [highlight, setHighlight] = useState(null);
    const refEls = useRef(new Map());
    const hideTimer = useRef(null);

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
                return (
                    <button
                        type="button"
                        className="lr-cite"
                        aria-label={`References ${nums.join(', ')}`}
                        onMouseEnter={(e) => openCard(nums, e.currentTarget)}
                        onMouseLeave={closeCard}
                        onFocus={(e) => openCard(nums, e.currentTarget)}
                        onBlur={closeCard}
                        onClick={() => showRef(nums)}
                    >
                        {nums.join(',')}
                    </button>
                );
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
        },
        p: ({ node, children }) => {
            const text = nodeText(node).replace(/\s+/g, ' ').trim();
            return (
                <div className="lr-para">
                    {/* A zero-height sticky anchor: on a paragraph taller than the window the
                        toolbar stays at the top of what is visible of it. */}
                    {onAction && text.length > 40 && (
                        <div className="lr-para-anchor">
                            <div className="lr-para-tools" role="toolbar" aria-label="Paragraph actions">
                                {PARAGRAPH_ACTIONS.map((a) => (
                                    <button key={a.id} type="button" onClick={() => onAction(a, text)}>{a.label}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    <p>{children}</p>
                </div>
            );
        },
        table: ({ node, ...props }) => <div className="lr-table-scroll"><table {...props} /></div>,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [onAction, showRef]);

    const jump = (id) => {
        setActiveId(id);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const render = (md) => <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>{linkCitations(md)}</ReactMarkdown>;
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
                <div className="lr-kicker">Literature review · Draft 1</div>
                <h1 className="lr-title">{review.title || meta?.topic}</h1>
                <div className="lr-meta">
                    {meta?.cutoffYear && <span>Up to {meta.cutoffYear}</span>}
                    <span>Vancouver</span>
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
                <p className="lr-hint">Hover a citation to preview the paper. Hover a paragraph to ask about it or rewrite it.</p>
                {review.intro && <div className="lr-section">{render(review.intro)}</div>}
                {review.sections.map((s) => (
                    <section key={s.id} id={s.id} className="lr-section">
                        <h2><span className="lr-mono lr-section-num">{pad2(s.number)}</span>{s.title}</h2>
                        {render(s.body)}
                    </section>
                ))}
            </article>

            <aside className="lr-refs" id="lr-references" aria-label="References">
                <div className="lr-refs-head">
                    <span className="lr-refs-title">References</span>
                    <span className="lr-mono lr-refs-count">{review.references.length}</span>
                </div>
                <div className="lr-refs-list">
                    {review.references.map((r) => (
                        <ReferenceCard key={r.number} reference={r} highlighted={highlight === r.number}
                                       refEl={(el) => { if (el) refEls.current.set(r.number, el); }} />
                    ))}
                </div>
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
                            <div className="lr-cite-card-meta"><span className="lr-mono">[{r.number}]</span> {[r.journal, r.year].filter(Boolean).join(' · ')}{r.pmid ? ` · PMID ${r.pmid}` : ''}</div>
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

