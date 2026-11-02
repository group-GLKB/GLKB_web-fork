/**
 * The agent's choice for an Investigate follow-up, as a standing line under a progress panel's
 * header for the rest of the run, beside "Interpreted as" (service/followupRoute.js):
 * "Answering from the earlier investigation — <reason>", "Building on the earlier investigation
 * — <reason>". Nothing for a full investigation, which is what the panel already shows (the
 * thoughts still record that choice).
 *
 * Its own file, free of the request layer, because both panels import it and InvestigateProgress
 * is kept from dragging axios in.
 */
import React from 'react';

import { followupRouteLabel, followupRouteOf, routeShowsOnPanel } from '../../service/followupRoute';

const FollowupRouteLine = ({ route, reason = '' }) => {
    if (!routeShowsOnPanel(route)) return null;
    const why = typeof reason === 'string' ? reason.trim() : '';
    return (
        <p className="ip-interpreted ip-route" data-followup-route={followupRouteOf(route)}>
            <span className="ip-interpreted-label">{followupRouteLabel(route)}</span>
            {why ? ` — ${why}` : null}
        </p>
    );
};

export default FollowupRouteLine;
