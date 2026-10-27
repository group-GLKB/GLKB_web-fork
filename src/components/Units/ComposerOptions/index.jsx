/**
 * The composer's Options (design: GLKB Effort A) — the button in the composer's row and the
 * drawer it opens: Research tools (Knowledge Graph, Figures: Off / Auto / On) and Search filters
 * (article type, sort).
 *
 * What the choices send (`answerFlags`, `searchFilters`):
 *   Knowledge Graph  -> `graph: true`   (the answer's knowledge-graph view). Auto: on from Medium up.
 *   Figures          -> `figures: true` (figures from the cited papers). Auto: on from High up,
 *                                         so off at Medium.
 * Extra (deep research) always includes both and runs its own retrieval, so at Extra the tools
 * say so and the filters give way to a note.
 *
 * `children` renders above Research tools: the phone puts the model and the effort there, its
 * composer row having no room for the chip.
 */
import './scoped.css';

import React from 'react';

import { Drawer } from '@mui/material';

import { effortLabel, isDeepEffort } from '../../../service/effortLevels';
import { ReactComponent as BarChartIcon } from '../../../img/llm/bar_chart.svg';
import { ReactComponent as GraphIcon } from '../../../img/llm/graph_share.svg';
import { ReactComponent as SearchOptionsIcon } from '../../../img/llm/search_options.svg';
import { trackGtagEvent } from '../../../utils/gtag';

export const DEFAULT_COMPOSER_OPTIONS = {
    kg: 'auto',
    fig: 'off',
    paperType: 'All types',
    sortBy: 'Default',
};

const TOOL_CHOICES = ['off', 'auto', 'on'];

const TOOLS = [
    {
        key: 'kg',
        label: 'Knowledge Graph',
        Icon: GraphIcon,
        description: "Show how GLKB's knowledge graph connects the entities in the answer.",
        hint: 'Auto uses it from Medium effort up.',
    },
    {
        key: 'fig',
        label: 'Figures',
        Icon: BarChartIcon,
        description: 'Add figures from the papers the answer cites to illustrate key findings.',
        hint: 'Auto adds figures from High effort up.',
    },
];

const FILTERS = [
    {
        key: 'paperType',
        label: 'Article type',
        options: [['All types', 'All types'], ['Reviews only', 'Reviews only'], ['Exclude reviews', 'Exclude reviews']],
    },
    {
        key: 'sortBy',
        label: 'Sort by',
        options: [['Default', 'Default'], ['High impact first', 'High impact'], ['Most recent first', 'Most recent']],
    },
];

// Auto's rule: the knowledge graph from Medium up, figures from High up.
const AUTO_FROM = { kg: ['medium', 'high', 'extra', 'max'], fig: ['high', 'extra', 'max'] };

const toolOn = (key, choice, effort) => choice === 'on' || (choice === 'auto' && AUTO_FROM[key].includes(effort));

/** `{ graph?, figures? }` for a chat request; deep research is sent neither (it does both). */
export const answerFlags = (options, effort) => {
    if (isDeepEffort(effort)) return {};
    const value = options || DEFAULT_COMPOSER_OPTIONS;
    return {
        ...(toolOn('fig', value.fig, effort) && { figures: true }),
        ...(toolOn('kg', value.kg, effort) && { graph: true }),
    };
};

/** `{ filters, rankingMode }` as the chat request takes them. */
export const searchFilters = (options) => {
    const value = options || DEFAULT_COMPOSER_OPTIONS;
    let rankingMode = 'default';
    if (value.sortBy === 'High impact first') rankingMode = 'high_impact';
    if (value.sortBy === 'Most recent first') rankingMode = 'recent';
    let filters = [];
    if (value.paperType === 'Reviews only') filters = ['review'];
    if (value.paperType === 'Exclude reviews') filters = ['non_review'];
    return { filters, rankingMode };
};

export const optionsChanged = (options) => Object.keys(DEFAULT_COMPOSER_OPTIONS)
    .some((key) => (options || DEFAULT_COMPOSER_OPTIONS)[key] !== DEFAULT_COMPOSER_OPTIONS[key]);

const stop = (event) => { event.preventDefault(); event.stopPropagation(); };

/** The row's "Options" button; the dot says something is off its default. */
export const OptionsButton = ({ open = false, changed = false, onClick, disabled = false, compact = false }) => (
    <button
        type="button"
        className={`composer-options-trigger${open ? ' is-open' : ''}${compact ? ' is-compact' : ''}`}
        aria-label={changed ? 'Options (changed)' : 'Options'}
        aria-haspopup="dialog"
        disabled={disabled}
        onMouseDown={stop}
        onClick={(event) => { stop(event); onClick?.(); }}
    >
        <SearchOptionsIcon className="composer-options-trigger-icon" aria-hidden="true" />
        {!compact && 'Options'}
        {changed && <span className="composer-options-trigger-dot" aria-hidden="true" />}
    </button>
);

const ComposerOptions = ({
    open,
    onClose,
    effort,
    value = DEFAULT_COMPOSER_OPTIONS,
    onChange,
    onReset,
    // Literature Review has no tools or filters of its own; the phone sheet still opens for
    // the model.
    showTools = true,
    children,
}) => {
    const deep = isDeepEffort(effort);
    const set = (key, next) => {
        trackGtagEvent('composer_option_select', { option: key, value: next });
        onChange?.({ ...value, [key]: next });
    };
    return (
        <Drawer
            anchor="right"
            open={Boolean(open)}
            onClose={onClose}
            ModalProps={{
                keepMounted: true,
                BackdropProps: { sx: { backgroundColor: 'rgba(12, 16, 24, .32)' } },
            }}
            PaperProps={{
                className: 'composer-options-drawer',
                role: 'dialog',
                'aria-label': 'Options',
            }}
        >
            <div className="composer-options-head">
                <div className="composer-options-title">Options</div>
                <button type="button" className="composer-options-close" title="Close" aria-label="Close options" onClick={onClose}>×</button>
            </div>
            <div className="composer-options-body">
                {children}
                {showTools && (<>
                    <div className="composer-options-section-title">Research tools</div>
                    <div className="composer-options-section-sub">
                        Choose which tools to use when answering. Works at every effort level.
                    </div>
                    {TOOLS.map(({ key, label, Icon, description, hint }) => (
                        <div className="composer-options-tool" key={key}>
                            <Icon className="composer-options-tool-icon" aria-hidden="true" />
                            <div className="composer-options-tool-main">
                                <div className="composer-options-tool-label">{label}</div>
                                <div className="composer-options-tool-desc">{description}</div>
                                <div className="composer-options-tool-choices" role="radiogroup" aria-label={label}>
                                    {TOOL_CHOICES.map((choice) => {
                                        const on = value[key] === choice;
                                        return (
                                            <button
                                                key={choice}
                                                type="button"
                                                role="radio"
                                                aria-checked={on}
                                                disabled={deep}
                                                className={`composer-options-choice${on ? ' is-on' : ''}`}
                                                onClick={() => set(key, choice)}
                                            >
                                                <span className="composer-options-radio"><span /></span>
                                                {choice.charAt(0).toUpperCase() + choice.slice(1)}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="composer-options-tool-hint">
                                    {deep ? `${effortLabel(effort)} always includes it.` : hint}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="composer-options-filters">
                        <div className="composer-options-filters-title">Search filters</div>
                        {deep ? (
                            <div className="composer-options-filters-off">
                                {effortLabel(effort)} runs its own multi-channel retrieval, so article type and sort don't apply.
                            </div>
                        ) : FILTERS.map((filter) => (
                            <div className="composer-options-filter" key={filter.key}>
                                <span className="composer-options-filter-label">{filter.label}</span>
                                <div className="composer-options-segmented" role="radiogroup" aria-label={filter.label}>
                                    {filter.options.map(([optionValue, optionLabel]) => {
                                        const on = value[filter.key] === optionValue;
                                        return (
                                            <button
                                                key={optionValue}
                                                type="button"
                                                role="radio"
                                                aria-checked={on}
                                                className={on ? 'is-on' : ''}
                                                onClick={() => set(filter.key, optionValue)}
                                            >
                                                {optionLabel}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </>)}
            </div>
            <div className="composer-options-foot">
                {showTools && (
                    <button type="button" className="composer-options-reset" onClick={() => {
                        trackGtagEvent('composer_options_reset');
                        onReset?.();
                    }}>Reset</button>
                )}
                <button type="button" className="composer-options-done" onClick={onClose}>Done</button>
            </div>
        </Drawer>
    );
};

export default ComposerOptions;
