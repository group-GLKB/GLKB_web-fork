import React from 'react';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { Drawer } from '@mui/material';

import { ReactComponent as ChatIcon } from '../../img/llm/chat_message.svg';
import { ReactComponent as InvestigateIcon } from '../../img/llm/investigate.svg';
import BetaBadge from '../Units/BetaBadge';

/**
 * The home composer's modes, as tabs along its top edge: Chat and Literature Review, with what
 * the mode does and how long it takes on the right. Investigate was a third tab until 2026-10-27;
 * it is now the chat's Extra effort (Units/EffortPicker), and its entry here serves only a prefill
 * that still asks for it.
 *
 * `compact` drops the hint and the icons, and the tabs share the composer's width. The phone
 * layout no longer uses the tabs: it has ModePill in the composer's bottom row, which opens
 * ModeSheet (the phone design's "Choose how GLKB works").
 *
 * `title` keeps the wording the Investigate chip had ("Investigate on" / "off"): the guest
 * gate and the analytics are keyed to that state, and the tests read it.
 */
export const COMPOSER_MODES = {
    chat: {
        label: 'Chat',
        hint: 'Ask questions. Get cited answers.',
        duration: 'seconds',
        placeholder: 'Ask a question about the biomedical literature...',
        mobilePlaceholder: 'Ask about the biomedical literature...',
    },
    investigate: {
        label: 'Investigate',
        hint: 'Explore deeper. Compare evidence.',
        duration: '3–5 min',
        placeholder: 'What should GLKB investigate? Add constraints like species, assay or drug class…',
        mobilePlaceholder: 'What should GLKB investigate?',
        action: 'Investigate',
        mobileAction: 'Run',
    },
    review: {
        label: 'Literature Review',
        beta: true,
        hint: 'Discover papers. Synthesize findings.',
        duration: '8–12 min',
        placeholder: 'Topic or research question for your review…',
        mobilePlaceholder: 'Topic or research question for your review…',
        action: 'Set up review',
        mobileAction: 'Start',
    },
};

const ICONS = {
    chat: <ChatIcon style={{ width: 18, height: 18 }} />,
    investigate: <InvestigateIcon style={{ width: 18, height: 18 }} />,
    review: <DescriptionOutlinedIcon style={{ width: 18, height: 18 }} />,
};

const SHEET_ICONS = {
    chat: <ChatIcon style={{ width: 22, height: 22 }} />,
    investigate: <InvestigateIcon style={{ width: 22, height: 22 }} />,
    review: <DescriptionOutlinedIcon style={{ width: 22, height: 22 }} />,
};

const stop = (event) => { event.preventDefault(); event.stopPropagation(); };

// "seconds" -> "Seconds"; the hint loses its full stop before the "·".
const capitalize = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text);
const bare = (text) => (text || '').replace(/\.$/, '');

export default function ComposerModes({ modes, mode, onChange, disabled, compact, duration }) {
    const current = COMPOSER_MODES[mode] || COMPOSER_MODES.chat;
    // Chat's time depends on its effort (Medium ~30 s, Extra 3–5 min); the composer says which.
    const shownDuration = duration || current.duration;
    return (
        <div className={`composer-modes${compact ? ' is-compact' : ''}`} onMouseDown={stop}
             onClick={(event) => event.stopPropagation()}>
            <div className="composer-modes-tabs" role="tablist" aria-label="Mode">
                {modes.map((id) => {
                    const active = id === mode;
                    const title = id === 'chat' ? undefined
                        : `${COMPOSER_MODES[id].label} ${active ? 'on' : 'off'}`;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            title={title}
                            disabled={disabled}
                            className={`composer-mode is-${id}${active ? ' is-active' : ''}`}
                            onMouseDown={stop}
                            onClick={(event) => { stop(event); onChange(id); }}
                        >
                            {!compact && <span className="composer-mode-icon">{ICONS[id]}</span>}
                            <span className="composer-mode-label">{COMPOSER_MODES[id].label}</span>
                            {COMPOSER_MODES[id].beta && (compact
                                // On a phone the tabs share the width: the pill sits on the tab's corner, taking none.
                                ? <BetaBadge className="composer-mode-beta" style={{ position: 'absolute', top: -7, right: -2, margin: 0, padding: '0 4px', fontSize: 9, lineHeight: '13px', pointerEvents: 'none' }} />
                                : <BetaBadge style={{ marginLeft: -2 }} />)}
                        </button>
                    );
                })}
            </div>
            {!compact && (
                <div className="composer-modes-hint" aria-live="polite">
                    {current.hint} <span className="composer-modes-sep">·</span>{' '}
                    <span className="composer-modes-duration">{shownDuration}</span>
                </div>
            )}
        </div>
    );
}

/**
 * The phone composer's mode control (design: "Chat ▾" in the bottom row, tinted for Investigate
 * and Literature Review). It opens ModeSheet. `showDot` marks that there is more than Chat to
 * find, until the reader has opened the sheet once.
 */
export function ModePill({ mode, onOpen, disabled, showDot }) {
    const current = COMPOSER_MODES[mode] ? mode : 'chat';
    return (
        <button
            type="button"
            className={`composer-mode-pill is-${current}`}
            aria-haspopup="dialog"
            aria-label={`Mode: ${COMPOSER_MODES[current].label}`}
            disabled={disabled}
            onMouseDown={stop}
            onClick={(event) => { stop(event); onOpen(); }}
        >
            <span className="composer-mode-pill-icon">{ICONS[current]}</span>
            <span className="composer-mode-pill-label">{COMPOSER_MODES[current].label}</span>
            {showDot && <span className="composer-mode-pill-dot" aria-hidden="true" />}
            <ArrowDropDownIcon className="composer-mode-pill-caret" />
        </button>
    );
}

/** The phone's mode picker: a bottom sheet, one row per mode with what it does and how long it takes. */
export function ModeSheet({ open, modes, mode, onClose, onPick }) {
    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            ModalProps={{ BackdropProps: { sx: { backgroundColor: 'rgba(0, 0, 0, 0.32)' } } }}
            PaperProps={{
                className: 'composer-mode-sheet',
                role: 'dialog',
                'aria-labelledby': 'composer-mode-sheet-title',
                sx: { borderTopLeftRadius: '24px', borderTopRightRadius: '24px' },
            }}
        >
            <div className="composer-mode-sheet-handle" aria-hidden="true" />
            <div className="composer-mode-sheet-title" id="composer-mode-sheet-title">Choose how GLKB works</div>
            <div className="composer-mode-sheet-list" role="listbox" aria-labelledby="composer-mode-sheet-title">
                {modes.map((id) => {
                    const active = id === mode;
                    const entry = COMPOSER_MODES[id];
                    return (
                        <button
                            key={id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`composer-mode-sheet-row is-${id}${active ? ' is-active' : ''}`}
                            onClick={() => onPick(id)}
                        >
                            <span className="composer-mode-sheet-icon">{SHEET_ICONS[id]}</span>
                            <span className="composer-mode-sheet-text">
                                <span className="composer-mode-sheet-label">
                                    {entry.label}
                                    {entry.beta && <BetaBadge style={{ marginLeft: 8 }} />}
                                </span>
                                <span className="composer-mode-sheet-hint">
                                    {bare(entry.hint)} <span aria-hidden="true">·</span>{' '}
                                    <span className="composer-mode-sheet-duration">{capitalize(entry.duration)}</span>
                                </span>
                            </span>
                            {active && <CheckIcon className="composer-mode-sheet-check" />}
                        </button>
                    );
                })}
            </div>
        </Drawer>
    );
}
