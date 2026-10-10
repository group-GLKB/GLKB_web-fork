import './ReviewScope.css';

import React, { useState } from 'react';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Menu, MenuItem } from '@mui/material';

import { DEFAULT_STYLE, getStylePref, REVIEW_STYLES, styleById } from '../LiteratureReview/citationStyle';

/**
 * A literature review's scope, set in the home composer (design: Length · Years · Types ·
 * Style · + Add your papers).
 *
 *   Length  the review service's `target_words` — a preset or any length in MIN_WORDS..MAX_WORDS
 *   Years   its `cutoff_year`. An END year only: the pipeline's selection stratifies by era over
 *           everything up to the cutoff, and a start year would cut into that
 *   Types   its `article_types` (PubMed publication types; glkb-agent literature_review/sources.py)
 *   Style   the citation style the finished review is shown and exported in. Applied by the page
 *           (LiteratureReview/citationStyle.js), never sent: it can be changed after writing too
 *
 * Your own papers have no counterpart in the pipeline yet, so that chip is shown as coming.
 */
export const LENGTH_OPTIONS = [3000, 4500, 6000, 8000, 10000];
// The review service's own bounds (glkb-agent literature_review/service.py ReviewRequest).
export const MIN_WORDS = 500;
export const MAX_WORDS = 12000;

export const ARTICLE_TYPES = [
    { id: 'all', label: 'All types', hint: 'Every kind of article' },
    { id: 'research', label: 'Research & reviews', hint: 'No editorials, comments, letters or news' },
    { id: 'primary', label: 'Primary research', hint: 'No reviews or meta-analyses either' },
];
export const articleTypeLabel = (id) => (ARTICLE_TYPES.find((t) => t.id === id) || ARTICLE_TYPES[0]).label;

export const DEFAULT_SCOPE = {
    targetWords: 6000, cutoffYear: null, notify: true, articleTypes: 'all', citationStyle: DEFAULT_STYLE,
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
export const yearOptions = (now = thisYear()) => [now, now - 1, now - 2, now - 3, now - 5];

export const scopeLabels = (scope, now = thisYear()) => ({
    length: `${Number(scope.targetWords || DEFAULT_SCOPE.targetWords).toLocaleString('en-US')} words`,
    years: `to ${scope.cutoffYear || now}`,
    types: articleTypeLabel(scope.articleTypes),
    style: styleById(scope.citationStyle).label,
});

const stop = (event) => { event.preventDefault(); event.stopPropagation(); };

function Chip({ name, value, onOpen, disabled, title, dashed, children }) {
    return (
        <button
            type="button"
            className={`review-scope-chip${dashed ? ' is-dashed' : ''}${disabled ? ' is-soon' : ''}`}
            aria-haspopup={onOpen ? 'menu' : undefined}
            aria-disabled={disabled || undefined}
            aria-label={name ? `${name}: ${value}` : undefined}
            title={title}
            onMouseDown={stop}
            onClick={(event) => { stop(event); if (!disabled && onOpen) onOpen(event.currentTarget); }}
        >
            {children || (
                <>
                    <span className="review-scope-name">{name}</span>
                    <span className="review-scope-value">{value}</span>
                    <ArrowDropDownIcon style={{ width: 16, height: 16 }} />
                </>
            )}
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
                // The Menu would take these keys for its own type-ahead.
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

export default function ReviewScope({ scope, onChange }) {
    const [menu, setMenu] = useState(null); // { which, anchor }
    const labels = scopeLabels(scope);
    const close = () => setMenu(null);
    const pick = (patch) => { onChange({ ...scope, ...patch }); close(); };
    const words = scope.targetWords || DEFAULT_SCOPE.targetWords;
    const open = (which) => (anchor) => setMenu({ which, anchor });

    return (
        <div className="review-scope" onMouseDown={stop} onClick={(event) => event.stopPropagation()}>
            <Chip name="Length" value={labels.length} onOpen={open('length')} />
            <Chip name="Years" value={labels.years} onOpen={open('years')} />
            <Chip name="Types" value={labels.types} onOpen={open('types')} />
            <Chip name="Style" value={labels.style} onOpen={open('style')} />
            <Chip dashed disabled title="Coming soon">+ Add your papers</Chip>
            <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={close}>
                {menu?.which === 'length' && [
                    ...LENGTH_OPTIONS.map((n) => (
                        <MenuItem key={n} selected={n === words} onClick={() => pick({ targetWords: n })}>
                            ~{n.toLocaleString('en-US')} words
                        </MenuItem>
                    )),
                    <CustomLength key="custom" value={words} onSet={(n) => pick({ targetWords: n })} />,
                ]}
                {menu?.which === 'years' && yearOptions().map((year, i) => (
                    <MenuItem key={year} selected={year === (scope.cutoffYear || thisYear())}
                              onClick={() => pick({ cutoffYear: i === 0 ? null : year })}>
                        Published up to {year}
                    </MenuItem>
                ))}
                {menu?.which === 'types' && ARTICLE_TYPES.map((t) => (
                    <MenuItem key={t.id} selected={t.id === (scope.articleTypes || 'all')}
                              onClick={() => pick({ articleTypes: t.id })}>
                        <span className="review-menu-option">
                            <span>{t.label}</span>
                            <span className="review-menu-hint">{t.hint}</span>
                        </span>
                    </MenuItem>
                ))}
                {menu?.which === 'style' && REVIEW_STYLES.map((s) => (
                    <MenuItem key={s.id} selected={s.id === styleById(scope.citationStyle).id}
                              onClick={() => pick({ citationStyle: s.id })}>
                        <span className="review-menu-option">
                            <span>{s.label}</span>
                            <span className="review-menu-hint">{s.authorDate ? 'Author–year in the text' : 'Numbered in the text'}</span>
                        </span>
                    </MenuItem>
                ))}
            </Menu>
        </div>
    );
}
