/**
 * The tier a picker shows, and the tiers it offers: shared by TierPicker and the composer's
 * model-and-effort menu (Units/EffortPicker), which list the same rows.
 *
 * The parent may hold nothing yet, a tier this pipeline does not offer, or (a guest) a tier they
 * may not use. Each is replaced by the default, VISIBLY — the chip re-renders before anything is
 * sent — and reported through `onResolveDefault` so it is not stored. Only a value this hook
 * resolved itself is replaceable later; a row the reader clicked is not (`clearResolved`).
 */
import { useEffect, useRef, useState } from 'react';

import {
    fetchTierPricing,
    GUEST_TIER,
    isGuestTier,
    tiersFor,
} from '../../../service/serviceTiers';

// A literature review is charged once per review, not per question.
export const creditsText = (credits, pipeline) => (
    Number.isFinite(credits)
        ? `${credits} credit${credits === 1 ? '' : 's'}/${pipeline === 'literature_review' ? 'review' : 'query'}`
        : ''
);

const useTierChoice = ({ value, pipeline = 'chat', isGuest = false, onResolveDefault }) => {
    const [pricing, setPricing] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetchTierPricing().then((fetched) => {
            if (!cancelled) setPricing(fetched);
        });
        return () => { cancelled = true; };
    }, []);

    const { tiers, defaultTier: pipelineDefault } = tiersFor(pricing, pipeline);
    const defaultTier = isGuest && !isGuestTier(pipelineDefault) && tiers.some((t) => t.id === GUEST_TIER)
        ? GUEST_TIER : pipelineDefault;
    const eligible = tiers.some((t) => t.id === value) && (!isGuest || isGuestTier(value));

    const resolvedRef = useRef('');
    useEffect(() => {
        if (!defaultTier) return;
        const holdingOurOwnDefault = Boolean(value) && value === resolvedRef.current;
        if (value && eligible && !holdingOurOwnDefault) return;
        resolvedRef.current = defaultTier;
        if (value === defaultTier) return;
        onResolveDefault?.(defaultTier);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultTier, value, eligible]);

    const selected = eligible ? value : defaultTier;
    return {
        pricing,
        tiers,
        defaultTier,
        selected,
        selectedRow: tiers.find((t) => t.id === selected) || null,
        clearResolved: () => { resolvedRef.current = ''; },
    };
};

export default useTierChoice;
