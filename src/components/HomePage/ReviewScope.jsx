import './ReviewScope.css';

import React, { useEffect, useRef, useState } from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { DEFAULT_STYLE, getStylePref, REVIEW_STYLES, styleById } from '../LiteratureReview/citationStyle';
import { PAPER_ACCEPT, PAPER_FORMATS_TEXT } from '../../service/attachments';
import { OptionItem, OptionNote, OptionPanel } from '../Units/OptionMenu';

/**
 * A literature review's scope, set in the home composer (design: Length · Years · Types ·
 * Style · Sources), and the pieces the review page's Scope card shares with it.
 *
 *   Length  the review service's `target_words` — a preset or any length in MIN_WORDS..MAX_WORDS
 *   Years   its `start_year` and `cutoff_year`: nothing published before the first or after the
 *           second. The start is open by default; the end is this year
 *   Types   its `article_types` (PubMed publication types; glkb-agent literature_review/sources.py)
 *   Style   the citation style the finished review is shown and exported in. Applied by the page
 *           (LiteratureReview/citationStyle.js), never sent: it can be changed after writing too
 *   Sources where the literature comes from (`sources`): GLKB's search, the reader's own papers
 *           (added with the composer's "+", uploaded as attachments and sent by id), or both.
 *           Always offered; the two that read papers say so, and offer the upload, until there is one
 *
 * Years and Types filter what GLKB searches, so a review of the reader's papers alone has no use
 * for them: they are shown, but fixed.
 */
export const LENGTH_OPTIONS = [3000, 4500, 6000, 8000, 10000];
// The review service's own bounds (glkb-agent literature_review/service.py ReviewRequest).
export const MIN_WORDS = 500;
export const MAX_WORDS = 12000;
export const MIN_YEAR = 1900;

export const ARTICLE_TYPES = [
    { id: 'all', label: 'All types', hint: 'Every kind of article' },
    { id: 'research', label: 'Research & reviews', hint: 'No editorials, comments, letters or news' },
    { id: 'primary', label: 'Primary research', hint: 'No reviews or meta-analyses either' },
];
export const articleTypeLabel = (id) => (ARTICLE_TYPES.find((t) => t.id === id) || ARTICLE_TYPES[0]).label;

/* Where a review's literature comes from (glkb-agent literature_review/papers.py). */
export const SOURCES = [
    { id: 'search', label: 'Search only', short: 'Search only',
      hint: 'GLKB finds and selects the literature' },
    { id: 'papers_and_search', label: 'Your papers + search', short: 'Papers + search',
      hint: 'Your papers, and the literature GLKB finds' },
    { id: 'papers', label: 'Your papers only', short: 'Only your papers',
      hint: 'A review of the papers you add, nothing else' },
];
export const sourceById = (id) => SOURCES.find((x) => x.id === id) || SOURCES[0];
export const usesPapers = (id) => id === 'papers' || id === 'papers_and_search';
export const NEEDS_PAPERS = 'No papers added yet: upload at least one (PDF, Word, LaTeX, …) to use this.';
export const SEARCH_ONLY_FILTER = 'Filters what GLKB searches; with your papers only, all of them are used';

/** The sources a review runs with: a search without papers; with them, the reader's choice
 *  (papers + search unless they chose otherwise). */
export const effectiveSources = (scope, paperCount) => {
    if (!paperCount) return 'search';
    return SOURCES.some((x) => x.id === scope?.sources) ? scope.sources : 'papers_and_search';
};

/** What choosing a source stores. "Search only" without papers is what happens anyway, so it is
 *  not pinned: papers added afterwards still get the default, papers + search. */
export const sourcesPatch = (id, paperCount) => ({ sources: paperCount || id !== 'search' ? id : null });

/** The Sources rows: the two that read the reader's papers are blocked until there is one, with
 *  `upload(id)` (when given) offered to add them and keep the choice. */
export const sourceOptions = (paperCount, upload) => SOURCES.map((x) => ({
    ...x,
    blocked: usesPapers(x.id) && !paperCount
        ? { note: NEEDS_PAPERS, action: upload ? { label: 'Upload', onClick: () => upload(x.id) } : undefined }
        : undefined,
}));

export const DEFAULT_SCOPE = {
    targetWords: 6000, startYear: null, cutoffYear: null, notify: true, articleTypes: 'all',
    citationStyle: DEFAULT_STYLE, sources: null,
};
/** The scope a new review starts from: the defaults, in the style this reader last chose. */
export const initialScope = () => ({ ...DEFAULT_SCOPE, citationStyle: getStylePref() });

/** A typed length, or null when it is not a number. Kept in bounds and rounded to 100 words. */
export const clampWords = (value) => {
    const n = Number(String(value ?? '').replace(/[,\s]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(MAX_WORDS, Math.max(MIN_WORDS, Math.round(n / 100) * 100));
};

const thisYear = () => new Date().getFullYear();
/** The end years offered, this year first. */
export const yearOptions = (now = thisYear()) => [now, now - 1, now - 2, now - 3, now - 5];
/** The start years offered, "any year" (null) first. */
export const startYearOptions = (now = thisYear()) => [null, now - 3, now - 5, now - 10, now - 20];
/** A typed year, or null when it is not one this review can use. */
export const clampYear = (value, now = thisYear()) => {
    const n = Number(String(value ?? '').trim());
    return Number.isInteger(n) && n >= MIN_YEAR && n <= now ? n : null;
};
/** "to 2026" (or "Up to 2026"), "2016–2026" once there is a start. */
export const yearsLabel = (scope, now = thisYear(), { long = false } = {}) => {
    const end = scope?.cutoffYear || now;
    if (scope?.startYear) return `${scope.startYear}–${end}`;
    return long ? `Up to ${end}` : `to ${end}`;
};

export const scopeLabels = (scope, now = thisYear()) => ({
    length: `${Number(scope.targetWords || DEFAULT_SCOPE.targetWords).toLocaleString('en-US')} words`,
    years: yearsLabel(scope, now),
    types: articleTypeLabel(scope.articleTypes),
    style: styleById(scope.citationStyle).label,
});

const stop = (event) => { event.preventDefault(); event.stopPropagation(); };

function Chip({ name, value, onOpen, disabled, title, open = false }) {
    return (
        <button
            type="button"
            className={`review-scope-chip${disabled ? ' is-soon' : ''}`}
            aria-haspopup={onOpen ? 'listbox' : undefined}
            aria-expanded={onOpen ? open : undefined}
            aria-disabled={disabled || undefined}
            aria-label={`${name}: ${value}`}
            title={title}
            onMouseDown={stop}
            onClick={(event) => { stop(event); if (!disabled && onOpen) onOpen(event.currentTarget); }}
        >
            <span className="review-scope-name">{name}</span>
            <span className="review-scope-value">{value}</span>
            <ChevronRightIcon className={`option-menu-chevron${open ? ' expanded' : ''}`} />
        </button>
    );
}

/** Any length, typed: Enter or "Set" applies it (kept in bounds), Escape leaves the menu. */
export function CustomLength({ value, onSet }) {
    const [text, setText] = useState(LENGTH_OPTIONS.includes(value) ? '' : String(value || ''));
    const apply = () => {
        const words = clampWords(text);
        if (words) onSet(words);
    };
    return (
        <div className="review-length-custom">
            <input
                type="number"
                inputMode="numeric"
                min={MIN_WORDS}
                max={MAX_WORDS}
                step={100}
                aria-label="Custom length in words"
                placeholder={`Custom, ${MIN_WORDS}–${MAX_WORDS.toLocaleString('en-US')}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                // The panel would take these keys to move between its rows.
                onKeyDown={(e) => {
                    if (e.key === 'Escape') return;
                    e.stopPropagation();
                    if (e.key === 'Enter') { e.preventDefault(); apply(); }
                }}
            />
            <span>words</span>
            <button type="button" onClick={apply} disabled={!clampWords(text)}>Set</button>
        </div>
    );
}

/** The length rows and the typed length under them, for any panel. */
export function LengthOptions({ words, onPick }) {
    return (
        <>
            {LENGTH_OPTIONS.map((n) => (
                <OptionItem key={n} label={`${n.toLocaleString('en-US')} words`} selected={n === words}
                            onClick={() => onPick(n)} />
            ))}
            <div className="option-menu-footer">
                <CustomLength key={words} value={words} onSet={onPick} />
            </div>
        </>
    );
}

/**
 * The years a review reads, as a range: a column of start years (open by default) and one of end
 * years (this year by default), and any two typed. A pick keeps the panel open, so both ends can
 * be set in one visit; a start after the end (or an end before the start) is not offered.
 */
export function YearRange({ startYear, cutoffYear, onChange, now = thisYear() }) {
    const end = cutoffYear || now;
    const start = startYear || null;
    const [from, setFrom] = useState(start ? String(start) : '');
    const [to, setTo] = useState(String(end));
    useEffect(() => { setFrom(start ? String(start) : ''); setTo(String(end)); }, [start, end]);
    const set = (s, e) => onChange({ startYear: s || null, cutoffYear: e === now ? null : e });
    const starts = startYearOptions(now);
    if (start && !starts.includes(start)) starts.push(start);
    const ends = yearOptions(now);
    if (!ends.includes(end)) ends.push(end);
    const typedFrom = from.trim() ? clampYear(from, now) : null;
    const typedTo = clampYear(to, now);
    const typedOk = typedTo && (!from.trim() || (typedFrom && typedFrom <= typedTo));
    const apply = () => { if (typedOk) set(typedFrom, typedTo); };
    const keys = (e) => {
        if (e.key === 'Escape') return;
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); apply(); }
    };
    return (
        <>
            <div className="year-range">
                <div role="group" aria-label="From">
                    <div className="option-menu-heading">From</div>
                    {starts.sort((a, b) => (a === null ? -1 : b === null ? 1 : b - a)).map((y) => (
                        <OptionItem key={y ?? 'any'} label={y ? String(y) : 'Any year'} selected={start === y}
                                    disabled={y !== null && y > end} onClick={() => set(y, end)} />
                    ))}
                </div>
                <div role="group" aria-label="To">
                    <div className="option-menu-heading">To</div>
                    {ends.sort((a, b) => b - a).map((y) => (
                        <OptionItem key={y} label={String(y)} selected={end === y} disabled={Boolean(start) && y < start}
                                    onClick={() => set(start, y)} />
                    ))}
                </div>
            </div>
            <div className="option-menu-footer year-range-custom">
                <input type="number" inputMode="numeric" min={MIN_YEAR} max={now} aria-label="From year"
                       placeholder="Any" value={from} onChange={(e) => setFrom(e.target.value)} onKeyDown={keys} />
                <span>–</span>
                <input type="number" inputMode="numeric" min={MIN_YEAR} max={now} aria-label="To year"
                       value={to} onChange={(e) => setTo(e.target.value)} onKeyDown={keys} />
                <button type="button" onClick={apply} disabled={!typedOk}>Set</button>
            </div>
        </>
    );
}

export default function ReviewScope({ scope, onChange, paperCount = 0, onAddPapers }) {
    const [menu, setMenu] = useState(null); // { which, anchor }
    const [note, setNote] = useState(null); // a blocked source's explanation
    const inputRef = useRef(null);
    const labels = scopeLabels(scope);
    const sources = effectiveSources(scope, paperCount);
    const papersOnly = sources === 'papers';
    const close = () => { setMenu(null); setNote(null); };
    const pick = (patch) => { onChange({ ...scope, ...patch }); close(); };
    const words = scope.targetWords || DEFAULT_SCOPE.targetWords;
    const open = (which) => (anchor) => {
        if (menu?.which === which) { close(); return; }
        setNote(null);
        setMenu({ which, anchor });
    };
    // A blocked source's "Upload": keep the choice, then pick the files (the "+" does the same).
    const upload = onAddPapers ? (id) => { pick(sourcesPatch(id, 1)); inputRef.current?.click(); } : undefined;
    const panel = (which, label, children) => (
        <OptionPanel anchorEl={menu?.anchor} open={menu?.which === which} onClose={close} label={label}
                     placement="bottom-start" className={`review-scope-panel is-${which}`}>
            {children}
        </OptionPanel>
    );

    return (
        <div className="review-scope" onMouseDown={stop} onClick={(event) => event.stopPropagation()}>
            <Chip name="Length" value={labels.length} open={menu?.which === 'length'} onOpen={open('length')} />
            <Chip name="Years" value={labels.years} open={menu?.which === 'years'} onOpen={open('years')}
                  disabled={papersOnly} title={papersOnly ? SEARCH_ONLY_FILTER : undefined} />
            <Chip name="Types" value={labels.types} open={menu?.which === 'types'} onOpen={open('types')}
                  disabled={papersOnly} title={papersOnly ? SEARCH_ONLY_FILTER : undefined} />
            <Chip name="Style" value={labels.style} open={menu?.which === 'style'} onOpen={open('style')} />
            <Chip name="Sources" value={sourceById(sources).short} open={menu?.which === 'sources'}
                  onOpen={open('sources')}
                  title={paperCount ? undefined : `Add your own papers with + (${PAPER_FORMATS_TEXT})`} />
            {onAddPapers && (
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    hidden
                    accept={PAPER_ACCEPT}
                    data-testid="review-papers-input"
                    aria-label="Add your papers"
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                        const files = Array.from(event.target.files || []);
                        event.target.value = '';
                        if (files.length) onAddPapers(files);
                    }}
                />
            )}
            {panel('length', 'Length', <LengthOptions words={words} onPick={(n) => pick({ targetWords: n })} />)}
            {panel('years', 'Years', (
                <YearRange startYear={scope.startYear} cutoffYear={scope.cutoffYear}
                           onChange={(patch) => onChange({ ...scope, ...patch })} />
            ))}
            {panel('types', 'Types', ARTICLE_TYPES.map((t) => (
                <OptionItem key={t.id} label={t.label} hint={t.hint} selected={t.id === (scope.articleTypes || 'all')}
                            onClick={() => pick({ articleTypes: t.id })} />
            )))}
            {panel('style', 'Style', REVIEW_STYLES.map((s) => (
                <OptionItem key={s.id} label={s.label} selected={s.id === styleById(scope.citationStyle).id}
                            hint={s.authorDate ? 'Author–year in the text' : 'Numbered in the text'}
                            onClick={() => pick({ citationStyle: s.id })} />
            )))}
            {panel('sources', 'Sources', (
                <>
                    {sourceOptions(paperCount, upload).map((x) => (
                        <OptionItem key={x.id} label={x.label} hint={x.hint} selected={x.id === sources}
                                    blocked={Boolean(x.blocked)}
                                    onClick={() => (x.blocked ? setNote(x.blocked) : pick(sourcesPatch(x.id, paperCount)))} />
                    ))}
                    {note && <OptionNote action={note.action}>{note.note}</OptionNote>}
                </>
            ))}
        </div>
    );
}
