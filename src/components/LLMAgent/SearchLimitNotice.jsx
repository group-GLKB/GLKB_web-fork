/**
 * The notice under a chat answer whose search the agent cut short (see searchLimit.js), with
 * one button that asks the same question in Investigate.
 *
 * It sits outside the answer's markdown, so Copy, Download and a text selection of the answer
 * never carry it. Nothing here delays the answer: the notice renders with the finished message,
 * and the price on the button comes from the shared pricing request (`fetchTierPricing`, one per
 * page load, which the composer's model picker has normally made already). Until that is known
 * the button simply has no price.
 */
import React, { useEffect, useState } from 'react';

import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';

import { creditsForEffort, fetchTierPricing, tiersFor } from '../../service/serviceTiers';

export const SEARCH_LIMIT_TEXT = 'This question needed more searching than a chat answer can hold, '
    + 'so the answer may be incomplete. Investigate reads many more papers.';

/**
 * What an Investigate run costs at `tierId` — "30 credits" — the way the app prices it
 * everywhere else (GET /credits/pricing, the deep_research rows). With no tier picked, the
 * pipeline's default tier, which is what a request naming none is charged at. `effort` is Extra
 * (the default, priced as the deep_research row) or Max (its own price, from the pricing's
 * `efforts` block when the backend has one). '' when unknown.
 */
export const investigatePriceText = (pricing, tierId, effort = 'extra') => {
    if (!pricing) return '';
    const tier = tierId || tiersFor(pricing, 'deep_research').defaultTier;
    const credits = creditsForEffort(pricing, tier, effort === 'max' ? 'max' : 'extra');
    return credits === null ? '' : `${credits.toLocaleString('en-US')} credit${credits === 1 ? '' : 's'}`;
};

const SearchLimitNotice = ({ reason, serviceTier = '', showPrice = true, onAsk }) => {
    const [pricing, setPricing] = useState(null);
    useEffect(() => {
        if (!showPrice) return undefined;
        let alive = true;
        fetchTierPricing().then((fetched) => { if (alive) setPricing(fetched); });
        return () => { alive = false; };
    }, [showPrice]);
    const price = showPrice ? investigatePriceText(pricing, serviceTier) : '';

    return (
        <div className="search-limit-notice" role="note" data-search-limit={reason || undefined}>
            <p className="search-limit-notice-text">{SEARCH_LIMIT_TEXT}</p>
            <button
                type="button"
                className="search-limit-notice-action"
                aria-label={price ? `Ask in Investigate, ${price}` : 'Ask in Investigate'}
                onClick={onAsk}
            >
                <ScienceOutlinedIcon className="search-limit-notice-icon" aria-hidden="true" />
                <span>Ask in Investigate</span>
                {price ? <span className="search-limit-notice-price">{price}</span> : null}
            </button>
        </div>
    );
};

export default SearchLimitNotice;
