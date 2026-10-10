import React from 'react';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

import { ReactComponent as ChatIcon } from '../../img/llm/chat_message.svg';
import { ReactComponent as InvestigateIcon } from '../../img/llm/investigate.svg';

/**
 * The home composer's three modes, as tabs along its top edge (design: Chat / Investigate /
 * Literature Review, with what the mode does and how long it takes on the right).
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
        <div className="composer-modes" onMouseDown={stop} onClick={(event) => event.stopPropagation()}>
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
                            <span className="composer-mode-icon">{ICONS[id]}</span>
                            <span className="composer-mode-label">{COMPOSER_MODES[id].label}</span>
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
