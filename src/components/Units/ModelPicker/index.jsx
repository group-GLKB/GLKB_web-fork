/**
 * Which model answers the next question.
 *
 * Sits in a control row under the composer's text field, the way ChatGPT's picker does —
 * a chip showing the current model, opening a panel of the deployment's catalogue.
 *
 * The catalogue is FETCHED, never hardcoded here: the agent owns the list and the backend
 * proxies it (`GET /api/v1/new-llm-agent/models`). A picker with its own copy eventually
 * offers an id the request path rejects, and the user sees a 400 on a name this component
 * invited them to choose.
 *
 * Two ways the value changes, and they are not the same event:
 *
 *   onChange        — the reader picked a row. Worth remembering across sessions.
 *   onResolveDefault — the catalogue arrived and nothing was stored, so this is what the
 *                      server would use anyway. NOT remembered: storing it would pin the
 *                      id that happened to be default today, and a later change of the
 *                      deployment's default would never reach this reader.
 *
 * Either way the parent ends up holding a concrete id, which matters beyond display: the
 * request carries it explicitly, so an Investigate run's heavy tier is the model the chip
 * says it is rather than whatever the harness config independently defaults to.
 */
import './scoped.css';

import React, { useEffect, useRef, useState } from 'react';

import CheckIcon from '@mui/icons-material/Check';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { ClickAwayListener, Popper } from '@mui/material';

import { fetchModelCatalog, modelLabel } from '../../../service/models';
import { trackGtagEvent } from '../../../utils/gtag';

const ModelPicker = ({
    value,
    onChange,
    onResolveDefault,
    disabled = false,
}) => {
    const [models, setModels] = useState([]);
    const [defaultModel, setDefaultModel] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const anchorRef = useRef(null);
    // The resolve is reported at most once per mount. Without the latch a parent that
    // re-renders on the reported value would report it again on every render.
    const resolvedRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        fetchModelCatalog().then((catalog) => {
            if (cancelled) return;
            setModels(catalog.models);
            setDefaultModel(catalog.defaultModel);
            if (!value && !resolvedRef.current) {
                resolvedRef.current = true;
                onResolveDefault?.(catalog.defaultModel);
            }
        });
        return () => { cancelled = true; };
        // Deliberately mount-only. `value` is read above but must not re-trigger the fetch:
        // the catalogue is cached in the service module anyway, and re-running this on every
        // keystroke-driven parent render would re-report the default.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selected = value || defaultModel;
    // Before the catalogue lands there is nothing honest to show, and a chip reading
    // "GPT-…" that changes under the reader is worse than one that appears a moment late.
    if (!selected) return null;

    const close = () => setIsOpen(false);

    return (
        <>
            <button
                type="button"
                ref={anchorRef}
                className="model-picker-trigger"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={`Model: ${modelLabel(selected, models)}`}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span className="model-picker-trigger-label">{modelLabel(selected, models)}</span>
                <ChevronRightIcon className={`model-picker-chevron${isOpen ? ' expanded' : ''}`} />
            </button>

            {isOpen && (
                <Popper
                    open
                    anchorEl={anchorRef.current}
                    placement="top-start"
                    modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
                    className="model-picker-layer"
                >
                    <ClickAwayListener onClickAway={close}>
                        <div className="model-picker-panel" role="listbox" aria-label="Model">
                            {models.map((entry) => {
                                const isSelected = entry.id === selected;
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`model-picker-option${isSelected ? ' selected' : ''}`}
                                        onClick={() => {
                                            close();
                                            if (isSelected) return;
                                            trackGtagEvent('chat_model_select', {
                                                source: 'chat_searchbar',
                                                model: entry.id,
                                            });
                                            onChange?.(entry.id);
                                        }}
                                    >
                                        <span className="model-picker-option-text">
                                            <span className="model-picker-option-label">
                                                {entry.label}
                                                {entry.id === defaultModel && (
                                                    <span className="model-picker-option-badge">Default</span>
                                                )}
                                            </span>
                                            <span className="model-picker-option-description">
                                                {entry.description}
                                            </span>
                                        </span>
                                        {isSelected && <CheckIcon className="model-picker-check" />}
                                    </button>
                                );
                            })}
                        </div>
                    </ClickAwayListener>
                </Popper>
            )}
        </>
    );
};

export default ModelPicker;
