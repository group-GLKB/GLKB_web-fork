/**
 * The composer's line about the reader's credits (service/credits.js `creditNotice`), as Claude
 * shows its usage: a quiet "10 credits left this month. … come back on Dec 1." once the month runs
 * low, and a plain "An Investigate run on GPT-6.1 Terra costs 30 credits and you have 10 left. …"
 * when the question as set up cannot be paid for. Sending it then opens `CreditDialog` instead of
 * starting anything, so the reader is not left to find out from a refused answer (or, as on
 * 2026-11-02, from an empty conversation).
 *
 * `useCreditNotice` follows the balance as it changes (`subscribeToUsage`: the page's fetch, and
 * every answer's stream frame) and prices the composer's mode and model from the cached pricing.
 */
import './scoped.css';

import React, { useEffect, useState } from 'react';

import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';

import { CREDITS_PURCHASE_URL } from '../../../config/features';
import {
    affordableChoice,
    creditNotice,
    getUsageSnapshot,
    subscribeToUsage,
} from '../../../service/credits';
import { creditsFor, fetchTierPricing, tierLabel } from '../../../service/serviceTiers';
import { trackGtagEvent } from '../../../utils/gtag';

/** The notice for a question on `pipeline` at `tierId` (the pricing's default when unset), or null. */
export const noticeFor = (usage, pricing, pipeline, tierId) => {
    if (!usage) return null;
    const tier = tierId || pricing?.defaultTier || '';
    const cost = creditsFor(pricing, tier, pipeline);
    return creditNotice(usage, {
        cost,
        pipeline,
        tierId: tier,
        labelFor: tierLabel,
        alternative: Number.isFinite(cost) && usage.remaining < cost
            ? affordableChoice(pricing, pipeline, usage.remaining, tier)
            : null,
    });
};

/** The tier prices (cached for the page), or null until they arrive. */
export const usePricing = () => {
    const [pricing, setPricing] = useState(null);
    useEffect(() => {
        let live = true;
        fetchTierPricing().then((parsed) => { if (live) setPricing(parsed); });
        return () => { live = false; };
    }, []);
    return pricing;
};

/** `noticeFor` the composer's mode and model, following the balance. Off (`enabled`) for a guest. */
export const useCreditNotice = ({ pipeline, tierId, enabled = true }) => {
    const [usage, setUsage] = useState(() => getUsageSnapshot());
    const pricing = usePricing();
    useEffect(() => subscribeToUsage(setUsage), []);
    return enabled ? noticeFor(usage, pricing, pipeline, tierId) : null;
};

const CreditNotice = ({ notice, source = '' }) => {
    if (!notice) return null;
    return (
        <div className={`credit-notice credit-notice-${notice.level}`} role="status">
            <span className="credit-notice-text">{notice.text}</span>
            {/* Once a store is configured (config/features.js). */}
            {CREDITS_PURCHASE_URL && (
                <a
                    className="credit-notice-buy"
                    href={CREDITS_PURCHASE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackGtagEvent('credits_buy_click', { source: `${source}_credit_notice` })}
                >
                    Buy credits
                </a>
            )}
        </div>
    );
};

/**
 * The pop-up when a question cannot be paid for: the composer's own check before sending (the
 * notice's text), or the backend's refusal when the balance changed under it (`refusalText`).
 * Nothing was started and nothing was charged, and the question is still in the box.
 */
export const CreditDialog = ({ notice, onClose, source = '' }) => (
    <Dialog
        open={Boolean(notice)}
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
    >
        <DialogTitle sx={{ fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: '18px' }}>
            Not enough credits
        </DialogTitle>
        <DialogContent sx={{ fontFamily: 'Geist, sans-serif', fontSize: '14px', lineHeight: 1.5 }}>
            {notice?.text || ''}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
            {CREDITS_PURCHASE_URL && (
                <Button
                    href={CREDITS_PURCHASE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackGtagEvent('credits_buy_click', { source: `${source}_credit_dialog` })}
                >
                    Buy credits
                </Button>
            )}
            <Button variant="contained" disableElevation onClick={onClose} autoFocus>
                OK
            </Button>
        </DialogActions>
    </Dialog>
);

export default CreditNotice;
