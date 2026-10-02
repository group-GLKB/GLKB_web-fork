/**
 * Reference formatting for the "Cite this paper" dialog and the BibTeX/RIS/EndNote exports.
 *
 * Everything renders from a CSL-JSON record — the structured citation NCBI publishes for
 * every PubMed article (its Literature Citation Exporter, proxied by the backend at
 * `GET /api/v1/citation/{pmid}`; see `src/service/Citation.js`). That record carries what
 * a correct reference needs and a reference card does not: authors split into family and
 * given names, volume, issue, page range, DOI, PMCID and the full issue date.
 *
 * When the record cannot be fetched, `cslFromCard` builds a thin CSL item from the six
 * fields a reference card holds, so the dialog still shows something honest — a citation
 * without volume/pages/DOI — rather than nothing.
 *
 * The five styles follow their current editions for a journal article:
 *   MLA 9, APA 7, Chicago 17 (notes-bibliography), Harvard (Cite Them Right), Vancouver.
 * Titles are kept exactly as PubMed records them (sentence case); a style that asks for
 * Title Case is not applied, because capitalising gene and protein names mechanically
 * corrupts them (BRCA1 → Brca1, p53 → P53).
 */

export const FORMATS = ['MLA', 'APA', 'Chicago', 'Harvard', 'Vancouver'];
export const EXPORTS = ['BibTeX', 'RIS', 'EndNote'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_DASH = '–';

// ---------------------------------------------------------------------------------------
// Reading the record
// ---------------------------------------------------------------------------------------

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Strip one trailing full stop; each style decides its own terminal punctuation. */
const untrailed = (value) => clean(value).replace(/\.$/, '');

const pmidFromUrl = (url) => clean(url).match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i)?.[1] || '';

/**
 * "Samuel F Bunting" → {family: "Bunting", given: "Samuel F"}. Used only for the
 * fallback record, where authors are flat display strings. Particles ("van", "de la")
 * are kept with the family name; a one-word name is a family name.
 */
const PARTICLES = new Set(['van', 'von', 'de', 'del', 'della', 'der', 'den', 'di', 'da', 'la', 'le', 'du', 'dos', 'das']);
export const splitDisplayName = (name) => {
    const text = clean(name);
    if (!text) return null;
    if (text.includes(',')) {
        const [family, given] = text.split(',').map(clean);
        return { family, given };
    }
    const parts = text.split(' ');
    if (parts.length === 1) return { family: parts[0], given: '' };
    let cut = parts.length - 1;
    while (cut > 1 && PARTICLES.has(parts[cut - 1].toLowerCase())) cut -= 1;
    return { family: parts.slice(cut).join(' '), given: parts.slice(0, cut).join(' ') };
};

/**
 * A CSL item from a reference card's `[title, url, citation_count, year, journal, authors]`
 * array — the fallback when the NCBI record is unavailable.
 */
export const cslFromCard = (card) => {
    const data = Array.isArray(card) ? card : [];
    const authors = Array.isArray(data[5]) ? data[5] : clean(data[5]).split(/,\s*/);
    const year = clean(data[3]).match(/\b\d{4}\b/)?.[0];
    const pmid = pmidFromUrl(data[1]);
    const item = {
        type: 'article-journal',
        title: clean(data[0]),
        'container-title': clean(data[4]),
        author: authors.map(splitDisplayName).filter(Boolean),
        partial: true,
    };
    if (year) item.issued = { 'date-parts': [[Number(year)]] };
    if (pmid) item.PMID = pmid;
    return item;
};

export const normalizeCsl = (csl) => {
    const item = csl && typeof csl === 'object' ? csl : {};
    const authors = (Array.isArray(item.author) ? item.author : [])
        .map((a) => (a && (a.family || a.given || a.literal)
            ? { family: clean(a.family), given: clean(a.given), literal: clean(a.literal) }
            : null))
        .filter(Boolean);
    const dateParts = item.issued?.['date-parts']?.[0] || [];
    const [year, month, day] = dateParts.map((n) => Number(n) || 0);
    const pmid = clean(item.PMID) || (clean(item.id).match(/^pmid:(\d+)$/i)?.[1] ?? '');
    return {
        title: untrailed(item.title),
        authors,
        journal: clean(item['container-title']),
        journalAbbrev: clean(item['container-title-short']) || clean(item['container-title']),
        year: year || 0,
        month: month || 0,
        day: day || 0,
        season: clean(item.issued?.season),
        volume: clean(item.volume),
        issue: clean(item.issue),
        page: clean(item.page).replace(/\s*[-–—]+\s*/g, '-'),
        doi: clean(item.DOI),
        pmid,
        pmcid: clean(item.PMCID),
        issn: clean(item.ISSN),
        url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : clean(item.URL),
        partial: Boolean(item.partial),
    };
};

// ---------------------------------------------------------------------------------------
// Pieces the styles share
// ---------------------------------------------------------------------------------------

/** "Samuel F" → ["Samuel", "F"]; "Hua-Tang" → ["Hua-Tang"]. */
const givenTokens = (given) => clean(given).split(' ').filter(Boolean);

/** "Samuel F" → "S. F."; "Hua-Tang" → "H.-T." (APA, Harvard). NLM drops both dots and hyphens: "SF", "HT". */
const initials = (given, { dot = '.', sep = ' ', hyphen = '-' } = {}) => givenTokens(given)
    .map((token) => token.split('-').map((part) => (part ? `${part[0]}${dot}` : '')).filter(Boolean).join(hyphen))
    .join(sep);

/** Given names as written, with a bare initial given its full stop: "Samuel F" → "Samuel F.". */
const givenWritten = (given) => givenTokens(given)
    .map((token) => (/^[A-Za-zÀ-ɏ]$/.test(token) ? `${token}.` : token))
    .join(' ');

/** Style-specific author list. `render(author, isFirst)` → string; `joinWith(list)` → string. */
const authorList = (authors, { render, joinWith, max, keep, etAl }) => {
    if (!authors.length) return '';
    const names = authors.map((a, i) => (a.literal ? a.literal : render(a, i === 0)));
    if (max && names.length > max) {
        return `${names.slice(0, keep).join(', ')}${etAl}`;
    }
    return joinWith(names);
};

const yearOf = (r) => (r.year ? String(r.year) : 'n.d.');

/** "243-54" → ["243", "254"]; "e1234" → ["e1234", ""]; "S12-S15" → ["S12", "S15"]. */
export const expandPageRange = (page) => {
    const text = clean(page);
    if (!text) return ['', ''];
    const m = text.match(/^([A-Za-z]*)(\d+)\s*-\s*([A-Za-z]*)(\d+)$/);
    if (!m) return [text, ''];
    const [, prefixA, a, prefixB, b] = m;
    let end = b;
    if (prefixB === prefixA && b.length < a.length) end = a.slice(0, a.length - b.length) + b;
    return [`${prefixA}${a}`, `${prefixB || prefixA}${end}`];
};

const pageRange = (page, { expand, dash = EN_DASH }) => {
    const [start, end] = expandPageRange(page);
    if (!start) return '';
    if (!end) return start;
    if (expand) return `${start}${dash}${end}`;
    // MLA's "minimal-two" rule, which Chicago shares for the common cases: drop the leading
    // digits the end page has in common with the start, keeping at least two ("243–54", "1100–05").
    let short = end;
    if (start.length === end.length && start.length > 2) {
        let common = 0;
        while (common < start.length - 2 && start[common] === end[common]) common += 1;
        short = end.slice(common);
    }
    return `${start}${dash}${short}`;
};

const doiUrl = (doi) => (doi ? `https://doi.org/${doi}` : '');

/** "2010 Apr 16" / "2010 Apr" / "2010" / "2010 Spring" — the NLM date. */
const nlmDate = (r) => {
    if (!r.year) return '';
    const parts = [String(r.year)];
    if (r.season) parts.push(r.season);
    else if (r.month) {
        parts.push(MONTHS[r.month - 1]);
        if (r.day) parts.push(String(r.day));
    }
    return parts.join(' ');
};

const endWithStop = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
const joinParts = (parts, sep = ' ') => parts.filter(Boolean).join(sep);

// ---------------------------------------------------------------------------------------
// The styles (journal article)
// ---------------------------------------------------------------------------------------

/**
 * MLA 9:  Bunting, Samuel F., et al. "Title." Cell, vol. 141, no. 2, 2010, pp. 243–54.
 *         https://doi.org/10.1016/j.cell.2010.03.012.
 * Three or more authors → first author and "et al."; two → "Family, Given, and Given Family".
 */
const mla = (r) => {
    const authors = authorList(r.authors, {
        render: (a, first) => (first
            ? joinParts([a.family, givenWritten(a.given)], ', ')
            : joinParts([givenWritten(a.given), a.family])),
        joinWith: (names) => (names.length === 2 ? `${names[0]}, and ${names[1]}` : names[0]),
        max: 2, keep: 1, etAl: ', et al.',
    });
    const pages = pageRange(r.page, { expand: false });
    const source = joinParts([
        r.journal,
        r.volume && `vol. ${r.volume}`,
        r.issue && `no. ${r.issue}`,
        r.year && yearOf(r),
        pages && (pages.includes(EN_DASH) ? `pp. ${pages}` : `p. ${pages}`),
    ], ', ');
    return joinParts([
        authors && endWithStop(authors),
        r.title && `"${endWithStop(r.title)}"`,
        source && endWithStop(source),
        r.doi && `${doiUrl(r.doi)}.`,
    ]);
};

/**
 * APA 7:  Bunting, S. F., Callén, E., … Stark, J. M., & Nussenzweig, A. (2010). Title. Cell,
 *         141(2), 243–254. https://doi.org/10.1016/j.cell.2010.03.012
 * Up to 20 authors are listed; 21 or more → the first 19, an ellipsis, and the last.
 */
const apa = (r) => {
    const render = (a) => joinParts([a.family, initials(a.given)], ', ');
    let authors;
    const names = r.authors.map((a) => (a.literal ? a.literal : render(a)));
    if (names.length > 20) {
        authors = `${names.slice(0, 19).join(', ')}, . . . ${names[names.length - 1]}`;
    } else if (names.length >= 2) {
        authors = `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
    } else {
        authors = names[0] || '';
    }
    const volumeIssue = r.volume ? `${r.volume}${r.issue ? `(${r.issue})` : ''}` : '';
    const pages = pageRange(r.page, { expand: true });
    const source = joinParts([r.journal, volumeIssue, pages], ', ');
    const head = authors ? `${authors} (${yearOf(r)}).` : (r.title ? `${endWithStop(r.title)} (${yearOf(r)}).` : '');
    return joinParts([
        head,
        authors && r.title && endWithStop(r.title),
        source && endWithStop(source),
        doiUrl(r.doi),
    ]);
};

/**
 * Chicago 17, notes-bibliography:  Bunting, Samuel F., Elsa Callén, …, et al. "Title." Cell
 *         141, no. 2 (2010): 243–54. https://doi.org/….
 * Up to ten authors listed in full; more than ten → the first seven and "et al."
 */
const chicago = (r) => {
    const authors = authorList(r.authors, {
        render: (a, first) => (first
            ? joinParts([a.family, givenWritten(a.given)], ', ')
            : joinParts([givenWritten(a.given), a.family])),
        // The first name is inverted, so the comma before "and" stays even with two authors.
        joinWith: (names) => (names.length >= 2
            ? `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
            : names[0]),
        max: 10, keep: 7, etAl: ', et al.',
    });
    const pages = pageRange(r.page, { expand: false });
    const source = joinParts([
        joinParts([r.journal, r.volume]),
        r.issue && `no. ${r.issue}`,
    ], ', ');
    const dated = `${source ? `${source} ` : ''}(${yearOf(r)})${pages ? `: ${pages}` : ''}`;
    return joinParts([
        authors && endWithStop(authors),
        r.title && `"${endWithStop(r.title)}"`,
        endWithStop(dated),
        r.doi && `${doiUrl(r.doi)}.`,
    ]);
};

/**
 * Harvard (Cite Them Right):  Bunting, S.F. et al. (2010) 'Title', Cell, 141(2), pp. 243–254.
 *         Available at: https://doi.org/….
 * Up to three authors listed ("A, B and C"); four or more → the first and "et al."
 */
const harvard = (r) => {
    const authors = authorList(r.authors, {
        render: (a) => joinParts([a.family, initials(a.given, { sep: '' })], ', '),
        joinWith: (names) => (names.length >= 2
            ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
            : names[0]),
        max: 3, keep: 1, etAl: ' et al.',
    });
    const volumeIssue = r.volume ? `${r.volume}${r.issue ? `(${r.issue})` : ''}` : '';
    const pages = pageRange(r.page, { expand: true });
    const source = joinParts([
        r.journal,
        volumeIssue,
        pages && (pages.includes(EN_DASH) ? `pp. ${pages}` : `p. ${pages}`),
    ], ', ');
    const titled = r.title ? `'${r.title}'` : '';
    return joinParts([
        authors ? `${authors} (${yearOf(r)})` : (titled ? `${titled} (${yearOf(r)})` : ''),
        endWithStop(joinParts([authors && titled, source], ', ')),
        r.doi && `Available at: ${doiUrl(r.doi)}.`,
    ]);
};

/**
 * Vancouver:  Bunting SF, Callén E, Wong N, Chen HT, Polato F, Gunn A, et al. Title. Cell.
 *         2010 Apr 16;141(2):243-54. doi: 10.1016/…. PMID: 20362325; PMCID: PMC2857570.
 * The first six authors, then "et al."; the journal by its NLM abbreviation.
 */
const vancouver = (r) => {
    const authors = authorList(r.authors, {
        render: (a) => joinParts([a.family, initials(a.given, { dot: '', sep: '', hyphen: '' })]),
        joinWith: (names) => names.join(', '),
        max: 6, keep: 6, etAl: ', et al',
    });
    // NLM keeps the page range exactly as PubMed records it ("243-54").
    const pages = r.page;
    const locator = `${nlmDate(r)}${r.volume ? `;${r.volume}` : ''}${r.issue ? `(${r.issue})` : ''}${pages ? `:${pages}` : ''}`;
    const ids = joinParts([r.pmid && `PMID: ${r.pmid}`, r.pmcid && `PMCID: ${r.pmcid}`], '; ');
    return joinParts([
        authors && endWithStop(authors),
        r.title && endWithStop(r.title),
        r.journalAbbrev && endWithStop(r.journalAbbrev),
        locator && endWithStop(locator),
        r.doi && `doi: ${r.doi}.`,
        ids && `${ids}.`,
    ]);
};

const STYLES = { MLA: mla, APA: apa, Chicago: chicago, Harvard: harvard, Vancouver: vancouver };

/** The reference in one of `FORMATS`, from a CSL-JSON record (or a `cslFromCard` item). */
export const formatCitation = (format, csl) => {
    const render = STYLES[format];
    if (!render) return '';
    const r = normalizeCsl(csl);
    if (!r.title && !r.authors.length) return '';
    return render(r);
};

// ---------------------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------------------

const escapeBibTeX = (value) => clean(value).replace(/[\\{}%&#_$]/g, (char) =>
    (char === '\\' ? '\\textbackslash{}' : `\\${char}`));

/** Stable, tool-safe key: `pubmed20362325`. The same key the reference panel has always exported. */
export const bibtexKey = (csl) => {
    const r = normalizeCsl(csl);
    if (r.pmid) return `pubmed${r.pmid}`;
    const family = (r.authors[0]?.family || r.authors[0]?.literal || 'reference').replace(/[^A-Za-z0-9]/g, '');
    return `${family || 'reference'}${r.year || ''}`;
};

export const toBibTeX = (csl) => {
    const r = normalizeCsl(csl);
    const [start, end] = expandPageRange(r.page);
    const fields = [
        ['author', r.authors.map((a) => (a.literal ? `{${a.literal}}` : joinParts([a.family, a.given], ', '))).join(' and ')],
        ['title', r.title],
        ['journal', r.journal],
        ['year', r.year ? String(r.year) : ''],
        ['month', r.month ? MONTHS[r.month - 1].toLowerCase() : ''],
        ['volume', r.volume],
        ['number', r.issue],
        ['pages', start ? (end ? `${start}--${end}` : start) : ''],
        ['doi', r.doi],
        ['pmid', r.pmid],
        ['pmcid', r.pmcid],
        ['issn', r.issn],
        ['url', r.url],
    ].filter(([, value]) => value);
    const body = fields.map(([key, value]) => {
        // `month` is a BibTeX macro (apr), not a string; DOIs/URLs/ids carry no TeX specials worth escaping.
        const raw = key === 'month' ? value : `{${['doi', 'url', 'pmid', 'pmcid', 'issn'].includes(key) ? clean(value) : escapeBibTeX(value)}}`;
        return `  ${key.padEnd(7)} = ${raw}`;
    }).join(',\n');
    return `@article{${bibtexKey(csl)},\n${body}\n}`;
};

/**
 * EndNote's tagged ("refer") import format. RIS is what EndNote users usually want and the
 * exporter provides that verbatim; this is kept for anyone whose EndNote import filter is
 * set to the tagged format.
 */
export const toEndNote = (csl) => {
    const r = normalizeCsl(csl);
    const [start, end] = expandPageRange(r.page);
    const lines = [
        '%0 Journal Article',
        ...r.authors.map((a) => `%A ${a.literal || joinParts([a.family, a.given], ', ')}`),
        ...[
            ['T', r.title], ['J', r.journal], ['V', r.volume], ['N', r.issue],
            ['P', start ? (end ? `${start}-${end}` : start) : ''],
            ['D', r.year ? String(r.year) : ''], ['8', nlmDate(r)],
            ['R', r.doi], ['M', r.pmid], ['@', r.issn], ['U', r.url],
        ].filter(([, value]) => value).map(([tag, value]) => `%${tag} ${value}`),
    ];
    return lines.join('\n');
};
