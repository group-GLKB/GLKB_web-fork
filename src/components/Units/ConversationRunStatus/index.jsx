import './scoped.css';

import React from 'react';

const LABELS = {
    investigate: 'Investigation in progress',
    literature_review: 'Literature review in progress',
};

/**
 * Figma 2:861 — the live conversation replaces its context button with an 8px status dot.
 * `kind` (activeRun.runKindOf) colours it: Investigate and Literature Review purple, chat blue.
 */
const ConversationRunStatus = ({ className = '', kind = 'chat' }) => {
    const label = LABELS[kind] || 'Conversation is loading';
    const tone = LABELS[kind] ? ' is-purple' : '';
    return (
        <span
            className={`conversation-run-status${tone}${className ? ` ${className}` : ''}`}
            aria-label={label}
            title={label}
        >
            <span className="conversation-run-status-dot" />
        </span>
    );
};

export default ConversationRunStatus;
