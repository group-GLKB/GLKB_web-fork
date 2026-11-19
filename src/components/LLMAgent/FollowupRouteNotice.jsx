/**
 * What a finished answer says about the agent's choice for an Investigate follow-up
 * (service/followupRoute.js; the live panels' line is FollowupRouteLine):
 *
 *   FullInvestigationOffer  under an answer given from the earlier investigation: says so, and
 *                           offers the same question again as a full investigation, priced as
 *                           the model picker prices one.
 *   BuiltOnEarlierNote      a small note on a report that built on the earlier investigation.
 *
 * The offer and the note sit outside the answer's markdown, so Copy, Download and a text
 * selection of the answer never carry them.
 */
import React, { useEffect, useState } from 'react';

import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';

import { fetchTierPricing } from '../../service/serviceTiers';
import { investigatePriceText } from './SearchLimitNotice';

export const ANSWERED_FROM_PRIOR_TEXT = 'Answered from the earlier investigation';
export const RUN_FULL_INVESTIGATION_TEXT = 'Run a full investigation';
export const BUILT_ON_EARLIER_TEXT = 'Built on the earlier investigation';

/**
 * "Answered from the earlier investigation" + "Run a full investigation". The price is the
 * Investigate price at `serviceTier` (the picker's tier, which is what the re-sent question is
 * charged at), read from the shared once-per-page pricing request; until that is known the
 * button simply has no price. `disabled` while this conversation is still answering — a second
 * turn would race the first.
 */
export const FullInvestigationOffer = ({
    serviceTier = '',
    // The level the follow-up was asked at, which the full run keeps: Extra or Max.
    effort = 'extra',
    showPrice = true,
    disabled = false,
    onRun,
}) => {
    const [pricing, setPricing] = useState(null);
    useEffect(() => {
        if (!showPrice) return undefined;
        let alive = true;
        fetchTierPricing().then((fetched) => { if (alive) setPricing(fetched); });
        return () => { alive = false; };
    }, [showPrice]);
    const price = showPrice ? investigatePriceText(pricing, serviceTier, effort) : '';

    return (
        <div className="search-limit-notice routed-answer-notice" role="note" data-followup-route="answer_from_prior">
            <p className="search-limit-notice-text">
                <HistoryEduOutlinedIcon className="routed-answer-notice-icon" aria-hidden="true" />
                <span>{ANSWERED_FROM_PRIOR_TEXT}</span>
            </p>
            <button
                type="button"
                className="search-limit-notice-action"
                aria-label={price ? `${RUN_FULL_INVESTIGATION_TEXT}, ${price}` : RUN_FULL_INVESTIGATION_TEXT}
                disabled={disabled}
                onClick={onRun}
            >
                <ScienceOutlinedIcon className="search-limit-notice-icon" aria-hidden="true" />
                <span>{RUN_FULL_INVESTIGATION_TEXT}</span>
                {price ? <span className="search-limit-notice-price">{price}</span> : null}
            </button>
        </div>
    );
};

export const BuiltOnEarlierNote = () => (
    <p className="routed-report-note" data-followup-route="incremental">
        <HistoryEduOutlinedIcon className="routed-answer-notice-icon" aria-hidden="true" />
        <span>{BUILT_ON_EARLIER_TEXT}</span>
    </p>
);
