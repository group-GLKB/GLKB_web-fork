import React, { useEffect, useState } from 'react';

import { shouldResumeAgentInBackground } from '../../service/agentRunSnapshot';
import LLMAgent from '../LLMAgent';

/**
 * Keep the Agent controller mounted across app routes.
 *
 * LLMAgent renders no page UI while inactive, but its request, SSE callbacks, refs and React
 * state continue to live here. Returning to /chat therefore reveals the same run instead of
 * reconstructing it from history or polling after the route already destroyed the live view.
 */
const PersistentAgentSurface = ({ active, children }) => {
    // Avoid fetching Agent history for visitors who never enter /chat. Once activated, the
    // controller stays mounted for the rest of the app session so route changes cannot stop it.
    const [hasActivated, setHasActivated] = useState(
        () => Boolean(active) || shouldResumeAgentInBackground(),
    );

    useEffect(() => {
        if (active) {
            setHasActivated(true);
        }
    }, [active]);

    return (
        <>
            {(active || hasActivated) ? <LLMAgent isRouteActive={active} /> : null}
            {!active ? children : null}
        </>
    );
};

export default PersistentAgentSurface;
