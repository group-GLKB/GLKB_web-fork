/**
 * Per-citation evidence — the `direct_citations` field.
 *
 * An answer cites a paper at a particular spot because of a particular sentence in it. The
 * `references` list cannot express that: it holds one entry per PMID, so a paper cited twice
 * for two different passages had one blob of evidence covering both, and both citation chips
 * showed the same quote. `direct_citations` binds each spot in the text to the exact passage
 * that supports it, keyed by a marker the answer carries inline.
 *
 * `references` is untouched and still owns the bibliography — title, journal, authors, counts.
 * These two coexist: a binding carries no bibliographic metadata, and it can legitimately be
 * absent while `references` is populated.
 *
 * How a marker survives into the rendered answer: the body arrives as
 * `[8028670](https://pubmed.ncbi.nlm.nih.gov/8028670)[[c1]]`, and `bindMarkersToLinks` folds
 * the marker into the link as a fragment — `.../8028670#c1`. The marker then rides along to
 * the anchor renderer, which is the only place that knows which chip is being drawn. The
 * alternative, matching on position in the source string, desynchronises the moment anything
 * upstream rewrites the text.
 */

/** A marker as it appears inline. The agent also emits `[[c1, c2]]` groups, which never bind. */
export const CITATION_MARKER = /\[\[\s*(c\d+)\s*\]\]/i;

/** Any marker at all, bound or not — what is left over after binding gets stripped. */
export const ANY_CITATION_MARKER = /\[\[\s*c\d+(?:\s*,\s*c\d+)*\s*\]\]/gi;

/** `[8028670](https://pubmed.ncbi.nlm.nih.gov/8028670)[[c1]]` — a marker on a PubMed link. */
const LINKED_MARKER = /(\]\(\s*https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/?)\s*\)\s*\[\[\s*(c\d+)\s*\]\]/gi;

/** The trailing definition block: `## Citations` followed by `[[cN]]: "quote"` lines. */
const CITATIONS_BLOCK = /\n*^#{1,6}[ \t]*Citations[ \t]*$[\s\S]*$/im;

const MARKER_FRAGMENT = /#(c\d+)$/i;

/**
 * Normalise the field. The backend already normalises the name for us on every endpoint, so
 * this only has to cope with the shapes absence takes: `null` for user messages, for answers
 * saved before the feature shipped, and for answers with no bindings.
 */
export const parseDirectCitations = (raw) => {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((entry) => {
            const marker = String(entry?.marker || '').trim();
            if (!marker) return null;
            return {
                marker,
                pmid: entry?.pmid ? String(entry.pmid) : '',
                quote: typeof entry?.quote === 'string' ? entry.quote : '',
                // Two different things arrive as false: checked-and-not-found, and nothing to
                // check against. `contextType` is what tells them apart — see isSuspect.
                verified: entry?.verified === true,
                contextType: String(entry?.context_type ?? entry?.contextType ?? '').trim(),
                offsets: Array.isArray(entry?.offsets) ? entry.offsets : [],
            };
        })
        .filter(Boolean);
};

/**
 * The same bindings, read out of the answer text instead of the structured field.
 *
 * Not every deployment ships `direct_citations` yet — the backend this app talks to emits the
 * `[[cN]]` markers and the trailing definition block, and no field. But the block *is* the
 * bindings: `[[cN]]: "quote"`, one per passage, which is everything a chip needs, since the
 * PMID comes from the link the marker is attached to.
 *
 * So the block is parsed as a fallback rather than merely discarded. Everything read this way
 * is reported unverified with `no_source` — nothing checked these quotes against the papers,
 * and claiming otherwise would put a verification badge on an unverified passage. The moment
 * the field ships, it wins: see citationsFor.
 */
/* One definition line. The quote is taken greedily to the last `"` on the line, which is what
   makes an embedded quote fall out for free — `[[c3]]: "We discover \"subTMEs,\" and more."` */
const BLOCK_LINE = /^[ \t]*\[\[(c\d+)\]\]\s*:\s*"(.*)"[ \t]*$/gim;

export const parseCitationsBlock = (content) => {
    if (typeof content !== 'string') return [];
    const block = content.match(CITATIONS_BLOCK)?.[0];
    if (!block) return [];

    const out = [];
    const seen = new Set();
    let match = BLOCK_LINE.exec(block);
    while (match) {
        const [, marker, quote] = match;
        if (!seen.has(marker)) {
            seen.add(marker);
            out.push({
                marker,
                pmid: '',
                // ...and unescaping puts it back the way the paper wrote it.
                quote: quote.replace(/\\(["\\])/g, '$1'),
                verified: false,
                contextType: 'no_source',
                offsets: [],
            });
        }
        match = BLOCK_LINE.exec(block);
    }
    BLOCK_LINE.lastIndex = 0;
    return out;
};

/**
 * The bindings for a message: the structured field when the backend sends one, the answer's own
 * definition block when it does not. Both give a chip the passage it rests on; only the first
 * carries a verification result worth showing.
 */
export const citationsFor = (directCitations, content) => {
    const parsed = parseDirectCitations(directCitations);
    return parsed.length > 0 ? parsed : parseCitationsBlock(content);
};

/** Marker → binding. Duplicate markers cannot happen: same marker means same passage. */
export const indexByMarker = (citations) => {
    const map = new Map();
    (citations || []).forEach((citation) => {
        if (citation?.marker) map.set(citation.marker, citation);
    });
    return map;
};

/**
 * `unverified` means the quote was checked against the source and not found — the passage may
 * be attached to the wrong paper, and it is worth saying so. `no_source` means there was
 * nothing to check it against, which is merely unknown and not worth flagging.
 */
export const isSuspect = (citation) => (
    Boolean(citation) && !citation.verified && citation.contextType === 'unverified'
);

/**
 * Fold each bound marker into the link before it, so the anchor renderer can tell which of a
 * paper's several citations it is drawing.
 */
export const bindMarkersToLinks = (content, byMarker) => {
    if (typeof content !== 'string' || !content.includes('[[')) return content;
    return content.replace(LINKED_MARKER, (whole, link, marker) => (
        byMarker?.has?.(marker) ? `${link}#${marker})` : whole
    ));
};

/**
 * Drop the human-readable definition block. Always.
 *
 * The integration guide asks for this to be conditional on there being bindings, so that an
 * answer saved before the feature shipped degrades to "quotes visible as prose" rather than
 * losing its evidence. That fallback does not survive contact with this app: the answer body
 * goes through stripUnresolvedCitations, which removes every `[[cN]]` it finds — including the
 * labels that give the block its structure. What is left is not prose. It is the quotes run
 * together on one line, joined by the colons their labels used to introduce:
 *
 *     "...promote resistance to immunotherapy." : "We show that GVAX-induced..." : "Bulk and...
 *
 * So there is nothing to preserve by keeping it, and the block goes unconditionally. Old
 * answers lose evidence that was already unreadable; new ones show it on the citation itself,
 * which is where it belongs.
 */
export const stripCitationsBlock = (content) => {
    if (typeof content !== 'string') return content;
    return content.replace(CITATIONS_BLOCK, '').trimEnd();
};

/** The marker folded into a href by `bindMarkersToLinks`, if there is one. */
export const markerFromHref = (href) => String(href || '').match(MARKER_FRAGMENT)?.[1] || null;

/** The href as it should actually be followed — without our marker riding on it. */
export const hrefWithoutMarker = (href) => String(href || '').replace(MARKER_FRAGMENT, '');

/** The PMID a citation link points at, marker or no marker. */
export const pmidFromHref = (href) => (
    hrefWithoutMarker(href).split('/').filter(Boolean).pop() || ''
);
