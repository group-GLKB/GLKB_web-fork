import React from 'react';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

import { ReactComponent as ChatIcon } from '../../img/llm/chat_message.svg';
import { ReactComponent as InvestigateIcon } from '../../img/llm/investigate.svg';
import BetaBadge from '../Units/BetaBadge';

/**
 * The home composer's three modes, as tabs along its top edge (design: Chat / Investigate /
 * Literature Review, with what the mode does and how long it takes on the right).
 *
 * `compact` (the phone layout) drops the hint and the icons, and the tabs share the composer's
 * width: with icons the three tabs are ~350px wide, wider than a 390px phone's composer.
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
    },
    review: {
        label: 'Literature Review',
        beta: true,
        hint: 'Discover papers. Synthesize findings.',
        duration: '8–12 min',
        placeholder: 'Topic or research question for your review…',
        mobilePlaceholder: 'Topic for your review…',
        action: 'Set up review',
    },
};

const ICONS = {
    chat: <ChatIcon style={{ width: 18, height: 18 }} />,
    investigate: <InvestigateIcon style={{ width: 18, height: 18 }} />,
    review: <DescriptionOutlinedIcon style={{ width: 18, height: 18 }} />,
};

const stop = (event) => { event.preventDefault(); event.stopPropagation(); };

export default function ComposerModes({ modes, mode, onChange, disabled, compact }) {
    const current = COMPOSER_MODES[mode] || COMPOSER_MODES.chat;
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
                    <span className="composer-modes-duration">{current.duration}</span>
                </div>
            )}
        </div>
    );
}
