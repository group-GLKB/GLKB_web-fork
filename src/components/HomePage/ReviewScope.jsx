import React, { useState } from 'react';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Menu, MenuItem } from '@mui/material';

/**
 * A literature review's scope, set in the home composer (design: Length · Years · Types ·
 * Style · + Add your papers).
 *
 * Length and Years are real: they become the review service's `target_words` and
 * `cutoff_year` (glkb-agent literature_review/service.py). Years is an END year only — the
 * pipeline's selection stratifies by era over everything up to the cutoff, and a start year
 * would cut into that. Types, Style and your own papers have no counterpart in the pipeline
 * yet, so they are shown as coming rather than offered and silently ignored.
 */
export const LENGTH_OPTIONS = [3000, 4500, 6000, 8000, 10000];
export const DEFAULT_SCOPE = { targetWords: 6000, cutoffYear: null, notify: true };

const thisYear = () => new Date().getFullYear();
export const yearOptions = (now = thisYear()) => [now, now - 1, now - 2, now - 3, now - 5];

export const scopeLabels = (scope, now = thisYear()) => ({
    length: `${Number(scope.targetWords || DEFAULT_SCOPE.targetWords).toLocaleString('en-US')} words`,
    years: `to ${scope.cutoffYear || now}`,
});

const stop = (event) => { event.preventDefault(); event.stopPropagation(); };

function Chip({ name, value, onOpen, disabled, title, dashed, children }) {
    return (
        <button
            type="button"
            className={`review-scope-chip${dashed ? ' is-dashed' : ''}${disabled ? ' is-soon' : ''}`}
            aria-haspopup={onOpen ? 'menu' : undefined}
            aria-disabled={disabled || undefined}
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

export default function ReviewScope({ scope, onChange }) {
    const [menu, setMenu] = useState(null); // { which, anchor }
    const labels = scopeLabels(scope);
    const close = () => setMenu(null);
    const pick = (patch) => { onChange({ ...scope, ...patch }); close(); };
    const soon = 'Coming soon — reviews draw on every article type for now';

    return (
        <div className="review-scope" onMouseDown={stop} onClick={(event) => event.stopPropagation()}>
            <Chip name="Length" value={labels.length} onOpen={(anchor) => setMenu({ which: 'length', anchor })} />
            <Chip name="Years" value={labels.years} onOpen={(anchor) => setMenu({ which: 'years', anchor })} />
            <Chip name="Types" value="All types" disabled title={soon} />
            <Chip name="Style" value="Vancouver" disabled title="Coming soon — reviews are cited in Vancouver style for now" />
            <Chip dashed disabled title="Coming soon">+ Add your papers</Chip>
            <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={close}>
                {menu?.which === 'length' && LENGTH_OPTIONS.map((n) => (
                    <MenuItem key={n} selected={n === (scope.targetWords || DEFAULT_SCOPE.targetWords)}
                              onClick={() => pick({ targetWords: n })}>
                        ~{n.toLocaleString('en-US')} words
                    </MenuItem>
                ))}
                {menu?.which === 'years' && yearOptions().map((year, i) => (
                    <MenuItem key={year} selected={year === (scope.cutoffYear || thisYear())}
                              onClick={() => pick({ cutoffYear: i === 0 ? null : year })}>
                        Published up to {year}
                    </MenuItem>
                ))}
            </Menu>
        </div>
    );
}
