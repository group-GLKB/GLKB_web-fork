import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import formatQuoteIcon from '../../img/llm/format_quote.svg';

export const CARD_WIDTH = 240;   // Figma 299:22085
const GAP = 8;                   // between the citation and the card
const MARGIN = 8;                // keep-inside-viewport margin

/** Scrolling here moves the reference entry, not the citation, so the card stays open. */
const IGNORE_SCROLL_WITHIN = '.references-list, .ref-hover-card';

/**
 * "Coomans de Brachène A et al." — first author, then et al. for any co-authors, matching the
 * design's own line. Authors arrive either as an array or as one pre-joined string.
 */
export const formatAuthors = (authors) => {
    const list = Array.isArray(authors)
        ? authors.map((a) => String(a || '').trim()).filter(Boolean)
        : String(authors || '').split(/[;,]\s*/).map((a) => a.trim()).filter(Boolean);
    if (!list.length) return '';
    return list.length === 1 ? list[0] : `${list[0]} et al.`;
};

/** "2024 · Diabetologia", dropping either half when it is missing rather than leaving a stray dot. */
export const formatSource = (date, journal) => {
    const year = String(date || '').match(/\d{4}/)?.[0] || '';
    return [year, String(journal || '').trim()].filter(Boolean).join(' · ');
};

export const formatCitations = (n) => {
    // A genuine zero is shown ("PMID: 37162905 · 0 Citations"), so absent has to be told apart
    // from zero — `Number(null)` is 0, which would print a count the reference never carried.
    if (n === null || n === undefined || n === '') return '';
    const count = Number(n);
    if (!Number.isFinite(count) || count < 0) return '';
    return `${count} Citation${count === 1 ? '' : 's'}`;
};

/**
 * Place the card next to the citation without letting it leave the viewport.
 *
 * Above the citation by default, as the design shows it; flipped below only when there is no room
 * above, which is the common case for a citation in the first line of an answer.
 */
const place = (anchorRect, cardHeight) => {
    const left = Math.min(
        Math.max(MARGIN, anchorRect.left + anchorRect.width / 2 - CARD_WIDTH / 2),
        window.innerWidth - CARD_WIDTH - MARGIN,
    );
    const above = anchorRect.top - GAP - cardHeight;
    const below = anchorRect.bottom + GAP;
    const fitsAbove = above >= MARGIN;
    return { left, top: fitsAbove ? above : Math.min(below, window.innerHeight - cardHeight - MARGIN) };
};

/**
 * Reference hover card — Figma "Reference - Hover Preview" (node 299:22085).
 *
 * Replaces the browser's native `title` tooltip on a citation. That tooltip could only ever show
 * one unstyled string, appeared after the OS delay, and could not carry the paper's identity — the
 * user saw a quote with no way to tell which paper it came from without going to the panel.
 *
 * Everything shown comes from the reference the answer already carries; the card fetches nothing.
 */
const ReferenceHoverCard = ({
    reference,
    citation,
    number,
    anchorRect,
    isBookmarked,
    onBookmark,
    onCite,
    onFullText,
    onMouseEnter,
    onMouseLeave,
}) => {
    const ref = useRef(null);
    const [pos, setPos] = useState(null);

    // Measure first, then place: the height depends on how far the title and quote wrap, so a
    // fixed guess would sit visibly wrong on a long title.
    useLayoutEffect(() => {
        if (!ref.current || !anchorRect) return;
        setPos(place(anchorRect, ref.current.offsetHeight));
    }, [anchorRect, reference]);

    // The card is fixed-positioned against the citation's rect, so it cannot ride along when
    // something scrolls — it closes instead. That was right, except it closed on *any* scroll
    // anywhere in the document, and the references panel scrolling to the hovered entry is
    // something this very hover sets off. The card blinked away exactly as the panel arrived.
    //
    // A scroll inside the panel is therefore ignored: it moves the entry, never the citation.
    //
    // Following the citation instead of closing is not on offer. Opening the card re-renders the
    // answer, which replaces the citation's DOM node — by the time the card is up, the element it
    // was opened from is already detached and measures 0x0. Placing against that rect is what put
    // the card in the top-left corner.
    useEffect(() => {
        const close = () => onMouseLeave?.();
        const onScroll = (event) => {
            const target = event.target;
            if (target?.closest?.(IGNORE_SCROLL_WITHIN)) return;
            close();
        };
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', close);
        };
    }, [onMouseLeave]);

    if (!reference) return null;

    const pmid = reference.pmid ? String(reference.pmid) : '';
    // The passage this citation actually rests on, when the answer bound one to this spot.
    // `reference.evidence` is per-paper, so a paper cited twice for two different sentences
    // showed the same quote at both — which is the whole reason direct_citations exists.
    const referenceEvidence = (Array.isArray(reference.evidence) ? reference.evidence : [])
        .map((e) => (typeof e === 'string' ? e : e?.quote))
        .find((q) => q && String(q).trim());
    const quote = (citation?.quote || '').trim() || referenceEvidence;
    const authors = formatAuthors(reference.authors);
    // The app normalises references through `parseReferences`, which renames the agent's `date`
    // and `n_citation` to `year` and `citation_count`. Read both: the normalised names are what
    // actually arrives here, the raw ones keep this component usable with an unparsed reference.
    const source = formatSource(reference.year ?? reference.date, reference.journal);
    const citations = formatCitations(reference.citation_count ?? reference.n_citation);
    const meta = [pmid ? `PMID: ${pmid}` : '', citations].filter(Boolean).join(' · ');

    const card = (
        <div
            ref={ref}
            className="ref-hover-card"
            role="tooltip"
            /* Which binding this card is showing. Two chips on one paper look identical from
               the outside, so without this there is no way to tell a card that re-opened on
               the second citation from one that never closed after the first. */
            data-citation={citation?.marker || undefined}
            style={{
                left: pos ? `${pos.left}px` : 0,
                top: pos ? `${pos.top}px` : 0,
                // measured off-screen on the first pass so the jump into place is never seen
                visibility: pos ? 'visible' : 'hidden',
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="ref-hover-head">
                {reference.title ? <p className="ref-hover-title">{reference.title}</p> : null}
                {(authors || source) ? (
                    <p className="ref-hover-source">
                        {authors ? <span className="ref-hover-authors">{authors}</span> : null}
                        {source ? <span className="ref-hover-year">{source}</span> : null}
                    </p>
                ) : null}
            </div>

            {quote ? (
                <div className="ref-hover-quote">
                    <p className="ref-hover-quote-text">{`“${String(quote).replace(/^[“"]|[”"]$/g, '')}”`}</p>
                </div>
            ) : null}

            {meta ? <p className="ref-hover-meta">{meta}</p> : null}

            <div className="ref-hover-divider" />

            <div className="ref-hover-actions">
                {Number.isFinite(Number(number)) && Number(number) > 0 ? (
                    <span className="ref-hover-badge">{number}</span>
                ) : <span />}
                <span className="ref-hover-buttons">
                    <button
                        type="button"
                        className="ref-hover-icon"
                        title="Cite paper"
                        aria-label="Cite paper"
                        onClick={onCite}
                    >
                        <img src={formatQuoteIcon} alt="" className="ref-hover-quote-icon" />
                    </button>
                    <button
                        type="button"
                        className="ref-hover-icon"
                        title={isBookmarked ? 'Remove bookmark' : 'Bookmark this reference'}
                        aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this reference'}
                        onClick={onBookmark}
                    >
                        {isBookmarked
                            ? <BookmarkIcon className="ref-hover-bookmark active" />
                            : <BookmarkBorderIcon className="ref-hover-bookmark" />}
                    </button>
                    {/* The real full text where the paper has one (PMC), which is what the
                        label promises. `url` is the PubMed record — a fallback, not full text. */}
                    <a
                        className="ref-hover-fulltext"
                        href={reference.fulltext_url || reference.url
                            || (pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={onFullText}
                    >
                        Full Text
                        <OpenInNewIcon className="ref-hover-external" />
                    </a>
                </span>
            </div>
        </div>
    );

    // Portalled to <body>, not left where it is written. Rendered inline it is the last child of
    // the answer's own `.markdown-body`, and inserting a node there while the transcript sits at
    // the bottom lets the browser's scroll anchoring re-pick its anchor — which is the jump the
    // user sees on hovering a citation near the end of an answer. `position: fixed` does not save
    // it either: any ancestor with a transform/filter/contain becomes its containing block, so the
    // card would be positioned — and clipped — inside the answer rather than the viewport.
    return typeof document === 'undefined' ? card : createPortal(card, document.body);
};

export default ReferenceHoverCard;
