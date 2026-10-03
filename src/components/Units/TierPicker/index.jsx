/**
 * Which service tier answers the next question — Standard or Premium.
 *
 * A chip showing the current tier, opening a panel of the tiers this pipeline offers with what
 * each costs in credits (service/serviceTiers.js). It replaced the model picker when the backend
 * stopped taking a `model` from the web app: the reader chooses a tier, the agent chooses the
 * model, and no model name is shown. The chip rides in the composer's own row, as the model chip
 * did.
 *
 * Two ways the value changes, and they are not the same event:
 *
 *   onChange         — the reader picked a row. Worth remembering across sessions.
 *   onResolveDefault — the prices arrived and nothing usable was held, so this is what the server
 *                      would use anyway. NOT remembered: storing it would pin today's default.
 *
 * A guest is held to Standard (the backend refuses anything else with a 403). The panel still
 * lists Premium — a guest should see what signing in unlocks — but choosing it asks them to sign
 * in (`onRequireSignIn`) instead of selecting it.
 */
import './scoped.css';

import React, { useEffect, useRef, useState } from 'react';

import CheckIcon from '@mui/icons-material/Check';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { ClickAwayListener, Popper } from '@mui/material';

import {
    fetchTierPricing,
    GUEST_TIER,
    tiersFor,
} from '../../../service/serviceTiers';
import { trackGtagEvent } from '../../../utils/gtag';

const creditsText = (credits) => (
    Number.isFinite(credits) ? `${credits} credit${credits === 1 ? '' : 's'}/query` : ''
);

const TierPicker = ({
    value,
    onChange,
    onResolveDefault,
    // 'chat' | 'deep_research' — the two price differently (Investigate costs more per query).
    pipeline = 'chat',
    /* Told when the menu opens and closes, so a composer can move its own popup (the home
       page's example list) out of the way. Optional. */
    onOpenChange,
    disabled = false,
    isGuest = false,
    // Called when a guest picks a tier only signed-in readers may use.
    onRequireSignIn,
}) => {
    const [pricing, setPricing] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const anchorRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        fetchTierPricing().then((fetched) => {
            if (!cancelled) setPricing(fetched);
        });
        return () => { cancelled = true; };
    }, []);

    // Through a ref so a parent passing an inline arrow cannot make this fire every render.
    const onOpenChangeRef = useRef(onOpenChange);
    onOpenChangeRef.current = onOpenChange;
    useEffect(() => {
        onOpenChangeRef.current?.(isOpen);
    }, [isOpen]);

    const { tiers, defaultTier: pipelineDefault } = tiersFor(pricing, pipeline);
    const defaultTier = isGuest && tiers.some((t) => t.id === GUEST_TIER) ? GUEST_TIER : pipelineDefault;
    const eligible = tiers.some((t) => t.id === value) && (!isGuest || value === GUEST_TIER);

    /* The parent may hold nothing yet, a tier this pipeline does not offer, or (a guest) a tier
       they may not use. Each is replaced by the default, VISIBLY — the chip re-renders before
       anything is sent — and reported as a resolved default so it is not stored. Only a value
       this picker resolved itself is replaceable later; a row the reader clicked is not. */
    const resolvedRef = useRef('');
    useEffect(() => {
        if (!defaultTier) return;
        const holdingOurOwnDefault = Boolean(value) && value === resolvedRef.current;
        if (value && eligible && !holdingOurOwnDefault) return;
        resolvedRef.current = defaultTier;
        if (value === defaultTier) return;
        onResolveDefault?.(defaultTier);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultTier, value, eligible]);

    const selected = eligible ? value : defaultTier;
    // Nothing honest to show before the prices land.
    if (!selected) return null;
    const selectedRow = tiers.find((t) => t.id === selected);

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
                aria-label={`Service tier: ${selectedRow?.label || selected}`}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span className="model-picker-trigger-label">{selectedRow?.label || selected}</span>
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
                        <div className="model-picker-panel" role="listbox" aria-label="Service tier">
                            {tiers.map((entry) => {
                                const isSelected = entry.id === selected;
                                const needsSignIn = isGuest && entry.id !== GUEST_TIER;
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
                                            if (needsSignIn) {
                                                trackGtagEvent('chat_tier_sign_in_prompt', {
                                                    source: 'tier_picker',
                                                    tier: entry.id,
                                                });
                                                onRequireSignIn?.(entry);
                                                return;
                                            }
                                            trackGtagEvent('chat_tier_select', {
                                                source: 'tier_picker',
                                                tier: entry.id,
                                                pipeline,
                                            });
                                            resolvedRef.current = '';
                                            onChange?.(entry.id);
                                        }}
                                    >
                                        <span className="model-picker-option-text">
                                            <span className="model-picker-option-label">
                                                {entry.label}
                                                {needsSignIn ? (
                                                    <span className="model-picker-option-badge">Sign in</span>
                                                ) : entry.id === defaultTier && (
                                                    <span className="model-picker-option-badge">Default</span>
                                                )}
                                            </span>
                                            <span className="model-picker-option-description">
                                                {[creditsText(entry.credits[pipeline]), entry.description]
                                                    .filter(Boolean).join(' · ')}
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

export default TierPicker;
