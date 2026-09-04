import './scoped.css';

import React from 'react';

/** Figma 2:861 — the live conversation replaces its context button with an 8px status dot. */
const ConversationRunStatus = ({ className = '' }) => (
    <span
        className={`conversation-run-status${className ? ` ${className}` : ''}`}
        aria-label="Conversation is loading"
        title="Conversation is loading"
    >
        <span className="conversation-run-status-dot" />
    </span>
);

export default ConversationRunStatus;
