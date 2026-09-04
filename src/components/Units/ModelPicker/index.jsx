/**
 * Which model answers the next question.
 *
 * A chip showing the current model, opening a panel of the deployment's catalogue. It rides
 * in the composer's own row — inside the chat field, left of send; on the home bar, in the
 * control group beside Search Options — rather than on a row of its own, which cost the chat
 * composer 54px of height to say one model's name.
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
import { ClickAwayListener, Popper, useMediaQuery } from '@mui/material';

import { fetchModelCatalog, forPipeline, modelLabel } from '../../../service/models';
import { trackGtagEvent } from '../../../utils/gtag';

const ModelPicker = ({
    value,
    onChange,
    onResolveDefault,
    // Which pipeline the next question runs on. Deep research offers a subset — the gate
    // escalates a load-bearing claim from the cheap tier to the heavy tier to get a BETTER
    // judgement, so a cheap-class model in the heavy slot collapses that check to one tier.
    pipeline = 'chat',
    disabled = false,
}) => {
    const [catalog, setCatalog] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const anchorRef = useRef(null);
    /* On a phone the chip shares its row with the placeholder and the send button, and it
       is the one that must not be truncated (see .model-picker-trigger). 767px is the app
       shell's own breakpoint, so the chip abbreviates exactly when the layout around it
       switches. The PANEL always shows full names — it has the room, and that is where a
       reader compares options. */
    const isNarrow = useMediaQuery('(max-width:767px)');

    useEffect(() => {
        let cancelled = false;
        fetchModelCatalog().then((fetched) => {
            if (!cancelled) setCatalog(fetched);
        });
        return () => { cancelled = true; };
    }, []);

    const { models, defaultModel } = forPipeline(catalog, pipeline);
    const eligible = models.some((m) => m.id === value);

    /* Two reasons the parent may be holding the wrong id, and both are reported the same
       way — as a resolved default, which the parent stores in state but NOT in storage:

         * it holds nothing yet, and the catalogue has just told us what the server uses;
         * it holds a model this pipeline does not offer, because the reader chose it for
           chat and then turned Investigate on.

       The second is a substitution, which is exactly what this feature refuses to do
       silently elsewhere. It is acceptable here only because it is VISIBLE: the chip
       re-renders with the new name before anything is sent. The alternative — sending a
       model the pipeline will reject — is a 400 the reader cannot act on. */
    useEffect(() => {
        if (!defaultModel) return;
        if (value && eligible) return;
        onResolveDefault?.(defaultModel);
        // `onResolveDefault` is left out on purpose: parents pass an inline arrow, so
        // including it would re-run this on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultModel, value, eligible]);

    const selected = eligible ? value : defaultModel;
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
                // The full name, always — an abbreviated chip must not abbreviate what a
                // screen reader announces.
                aria-label={`Model: ${modelLabel(selected, models)}`}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span className="model-picker-trigger-label">
                    {modelLabel(selected, models, { short: isNarrow })}
                </span>
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
