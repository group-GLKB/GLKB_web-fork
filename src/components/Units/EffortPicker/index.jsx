/**
 * The composer's model-and-effort control (design: GLKB Effort A).
 *
 * A chip reading "✦ GPT-6.1 Terra · Medium ▾" opens a menu of the models, then an "Effort ›" row
 * whose submenu lists the effort levels (service/effortLevels.js). Medium runs the chat agent and
 * Extra deep research; the other levels are greyed out until a pipeline backs them.
 *
 * The menu hangs off the COMPOSER's edge, right-aligned to the chip: below the box on the home
 * page (`placement="down"`), above it at the foot of a conversation (`"up"`). `anchorRef` is the
 * composer; without one the chip itself is the anchor.
 *
 * A guest may use GPT-6.1 Terra and GPT-6 Luna at Medium. Choosing Sol or Extra asks them to sign
 * in (`onRequireSignIn(kind, entry)`) instead of selecting it, and the row says so.
 */
import './scoped.css';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { ClickAwayListener, Popper } from '@mui/material';

import {
    EFFORT_LEVELS,
    effortLabel,
    effortPipeline,
    isDeepEffort,
    isEffortEnabled,
} from '../../../service/effortLevels';
import { isGuestTier } from '../../../service/serviceTiers';
import { ReactComponent as SparkleIcon } from '../../../img/llm/sparkle.svg';
import { trackGtagEvent } from '../../../utils/gtag';
import useTierChoice from '../TierPicker/useTierChoice';

const MENU_WIDTH = 300;
const SUB_WIDTH = 320;
const GAP = 8;

/** The effort levels as the submenu lists them; the phone's Options sheet lists them too. */
export const EffortLevels = ({ effort, isGuest = false, hasFiles = false, onPick }) => (
    <>
        <p className="effort-submenu-intro">
            Higher effort gives more thorough analysis, but takes longer and uses more credits.
        </p>
        {EFFORT_LEVELS.map((level) => {
            const enabled = isEffortEnabled(level.id);
            const locked = enabled && isGuest && isDeepEffort(level.id);
            const note = enabled && hasFiles && isDeepEffort(level.id) ? "Doesn't read attached files" : '';
            return (
                <button
                    key={level.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={level.id === effort}
                    aria-disabled={!enabled}
                    title={enabled ? undefined : 'Coming soon'}
                    className={`effort-level-row${enabled ? '' : ' is-disabled'}`}
                    onClick={() => { if (enabled) onPick?.(level); }}
                >
                    <span className="effort-level-text">
                        <span className="effort-level-label">
                            {level.label}
                            {level.warn && !locked && (
                                <span className="effort-badge is-warn">Higher credit use</span>
                            )}
                            {locked && <span className="effort-badge">Sign in</span>}
                        </span>
                        {note && <span className="effort-level-note">{note}</span>}
                    </span>
                    <span className="effort-level-time">{level.time}</span>
                    <span className="effort-mark">{level.id === effort ? '✓' : ''}</span>
                </button>
            );
        })}
    </>
);

/**
 * Picking an effort, shared by the chip's submenu and the phone's sheet: a level not yet
 * offered does nothing; a guest reaching for a deep one is asked to sign in.
 */
export const chooseEffort = ({ level, effort, isGuest, onEffortChange, onRequireSignIn }) => {
    if (!isEffortEnabled(level.id) || level.id === effort) return;
    if (isGuest && isDeepEffort(level.id)) {
        trackGtagEvent('effort_sign_in_prompt', { effort: level.id });
        onRequireSignIn?.('effort', level);
        return;
    }
    trackGtagEvent('effort_select', { effort: level.id });
    onEffortChange?.(level.id);
};

const EffortPicker = ({
    tier,
    onTierChange,
    onTierResolveDefault,
    effort,
    onEffortChange,
    isGuest = false,
    // (kind: 'model' | 'effort', entry) — a guest reached for something that needs an account.
    onRequireSignIn,
    // Files are waiting on the question: deep levels say they do not read them.
    hasFiles = false,
    placement = 'down',
    anchorRef = null,
    disabled = false,
    onOpenChange,
    // The phone's chip names the model short ("6.1 Terra").
    short = false,
}) => {
    const [open, setOpen] = useState(false);
    const [subOpen, setSubOpen] = useState(false);
    const [subSide, setSubSide] = useState('right');
    const chipRef = useRef(null);
    const pipeline = effortPipeline(effort);
    const { tiers, selected, selectedRow, clearResolved } = useTierChoice({
        value: tier, pipeline, isGuest, onResolveDefault: onTierResolveDefault,
    });

    const onOpenChangeRef = useRef(onOpenChange);
    onOpenChangeRef.current = onOpenChange;
    useEffect(() => { onOpenChangeRef.current?.(open); }, [open]);

    /* The menu is right-aligned to the chip and sits GAP px off the composer's edge, so the
       anchor is the chip's horizontal extent over the composer's vertical one. */
    const anchorEl = useMemo(() => ({
        getBoundingClientRect: () => {
            const chip = chipRef.current?.getBoundingClientRect();
            const box = (anchorRef?.current || chipRef.current)?.getBoundingClientRect();
            const rect = (left, top, width, height) => ({
                left, top, width, height, x: left, y: top, right: left + width, bottom: top + height,
            });
            if (!chip || !box) return rect(0, 0, 0, 0);
            return rect(chip.left, box.top, chip.width, box.height);
        },
    }), [anchorRef]);

    const close = () => { setOpen(false); setSubOpen(false); };
    const toggle = () => {
        if (disabled) return;
        if (open) { close(); return; }
        // The submenu goes right of the menu when the window has room for it, else left.
        const chip = chipRef.current?.getBoundingClientRect();
        const roomRight = chip ? window.innerWidth - (chip.right + GAP + SUB_WIDTH) - 16 : 0;
        setSubSide(roomRight >= 0 ? 'right' : 'left');
        setSubOpen(false);
        setOpen(true);
    };

    const fileConflict = hasFiles && isDeepEffort(effort);
    const modelLabel = (short ? selectedRow?.shortLabel : selectedRow?.label) || selectedRow?.label || '';

    const pickModel = (entry) => {
        if (entry.id === selected) { close(); return; }
        if (isGuest && !isGuestTier(entry.id)) {
            close();
            trackGtagEvent('chat_tier_sign_in_prompt', { source: 'effort_picker', tier: entry.id });
            onRequireSignIn?.('model', entry);
            return;
        }
        trackGtagEvent('chat_tier_select', { source: 'effort_picker', tier: entry.id, pipeline });
        clearResolved();
        onTierChange?.(entry.id);
        // A model click keeps the menu open (design): the effort is often the next thing set.
    };

    const pickEffort = (level) => {
        if (!isEffortEnabled(level.id)) return;
        close();
        chooseEffort({ level, effort, isGuest, onEffortChange, onRequireSignIn });
    };

    return (
        <>
            <button
                ref={chipRef}
                type="button"
                className={`effort-chip${open ? ' is-open' : ''}`}
                disabled={disabled || !selected}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Model and effort: ${selectedRow?.label || ''} · ${effortLabel(effort)}`}
                onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(); }}
            >
                <SparkleIcon className="effort-chip-icon" aria-hidden="true" />
                <span className="effort-chip-label">{modelLabel} · {effortLabel(effort)}</span>
                {fileConflict && <span className="effort-warn-dot" aria-hidden="true" />}
                <span className="effort-chip-caret" aria-hidden="true">▾</span>
            </button>
            {open && (
                <Popper
                    open
                    anchorEl={anchorEl}
                    placement={placement === 'up' ? 'top-end' : 'bottom-end'}
                    modifiers={[
                        { name: 'offset', options: { offset: [0, GAP] } },
                        { name: 'flip', enabled: false },
                    ]}
                    className="effort-layer"
                >
                    <ClickAwayListener
                        onClickAway={(event) => {
                            if (chipRef.current?.contains(event.target)) return;
                            close();
                        }}
                    >
                        <div
                            className="effort-menu-wrap"
                            style={{ width: MENU_WIDTH }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
                        >
                            <div className="effort-menu" role="menu" aria-label="Model and effort">
                                {tiers.map((entry) => {
                                    const locked = isGuest && !isGuestTier(entry.id);
                                    const isSelected = entry.id === selected;
                                    // One line, as the design's: "Balanced speed and depth · 5 credits".
                                    const credits = entry.credits[pipeline];
                                    const desc = [entry.description, Number.isFinite(credits)
                                        ? `${credits} credit${credits === 1 ? '' : 's'}` : '']
                                        .filter(Boolean).join(' · ');
                                    return (
                                        <button
                                            key={entry.id}
                                            type="button"
                                            role="menuitemradio"
                                            aria-checked={isSelected}
                                            className="effort-model-row"
                                            onMouseEnter={() => setSubOpen(false)}
                                            onClick={() => pickModel(entry)}
                                        >
                                            <span className="effort-model-text">
                                                <span className="effort-model-label">{entry.label}</span>
                                                <span className="effort-model-desc">{desc}</span>
                                            </span>
                                            <span className="effort-row-end">
                                                {locked && <span className="effort-badge">Sign in</span>}
                                                <span className="effort-mark">{isSelected ? '✓' : ''}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                                <div className="effort-divider" />
                                <button
                                    type="button"
                                    className={`effort-sub-row${subOpen ? ' is-open' : ''}`}
                                    aria-haspopup="menu"
                                    aria-expanded={subOpen}
                                    onMouseEnter={() => setSubOpen(true)}
                                    onClick={() => setSubOpen(true)}
                                >
                                    Effort
                                    <span className="effort-sub-spacer" />
                                    <span className="effort-sub-value">{effortLabel(effort)}</span>
                                    {fileConflict && <span className="effort-warn-dot" aria-hidden="true" />}
                                    <span className="effort-sub-caret" aria-hidden="true">›</span>
                                </button>
                            </div>
                            {subOpen && (
                                <div
                                    className={`effort-submenu is-${placement} is-${subSide}`}
                                    style={{ width: SUB_WIDTH }}
                                    role="menu"
                                    aria-label="Effort"
                                >
                                    <EffortLevels effort={effort} isGuest={isGuest} hasFiles={hasFiles} onPick={pickEffort} />
                                </div>
                            )}
                        </div>
                    </ClickAwayListener>
                </Popper>
            )}
        </>
    );
};

export default EffortPicker;
