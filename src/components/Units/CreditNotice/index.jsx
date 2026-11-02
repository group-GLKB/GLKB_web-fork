/**
 * The notice about the reader's credits (service/credits.js `creditNotice`), as Claude shows its
 * usage — a few words floating by the composer, with an × to close it: a quiet "10 credits left this month. … come back on Dec 1." once the month runs
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

import CloseIcon from '@mui/icons-material/Close';
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

/* A notice the reader closed stays closed for the browser session — across the home page and
   the chat page — until it changes: another answer spends credits (a new number), or the mode or
   model now cannot be paid for. Keyed by its words for that reason. */
const DISMISSED_KEY = 'glkb_credit_notice_dismissed';

const DISMISS_EVENT = 'glkb-credit-notice-dismiss';

const readDismissed = () => {
    try {
        return sessionStorage.getItem(DISMISSED_KEY) || '';
    } catch (error) {
        return '';
    }
};

// Both composers can be mounted at once (the chat page stays alive behind the home page), so a
// close in one is told to the other.
const dismiss = (key) => {
    try {
        sessionStorage.setItem(DISMISSED_KEY, key);
    } catch (error) {
        /* storage blocked: closed for this page load only */
    }
    window.dispatchEvent(new CustomEvent(DISMISS_EVENT, { detail: key }));
};

/**
 * `variant`:
 *   'float'  the chat page: a small card floating just above the composer, its corners the
 *            composer's;
 *   'strip'  the home page: under the news strip, drawn as one (the same pill, tag, text and ×;
 *            `compact` on a phone, as the strip is).
 * Either shows the few words (`brief`); the whole sentence is the pop-up's and the tooltip's.
 */
const CreditNotice = ({ notice, source = '', variant = 'float', compact = false }) => {
    const [dismissed, setDismissed] = useState(readDismissed);
    useEffect(() => {
        const onDismiss = (event) => setDismissed(event.detail);
        window.addEventListener(DISMISS_EVENT, onDismiss);
        return () => window.removeEventListener(DISMISS_EVENT, onDismiss);
    }, []);
    if (!notice) return null;
    const key = `${notice.level}:${notice.text}`;
    if (dismissed === key) return null;
    const close = (event) => {
        event.stopPropagation();
        dismiss(key);
        trackGtagEvent('credit_notice_close', { source, level: notice.level });
    };
    const words = notice.brief || notice.text;
    const buy = CREDITS_PURCHASE_URL ? (
        <a
            className={variant === 'strip' ? 'news-strip-cta' : 'credit-float-buy'}
            href={CREDITS_PURCHASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackGtagEvent('credits_buy_click', { source: `${source}_credit_notice` })}
        >
            Buy credits
        </a>
    ) : null;
    if (variant === 'strip') {
        return (
            <div className={`news-strip-region credit-strip${compact ? ' is-compact' : ''}`} role="status">
                <div className="news-strip">
                    <span className={`news-strip-tag ${notice.level === 'short' ? 'is-amber' : 'is-blue'}`}>Credits</span>
                    <span className="news-strip-text" title={notice.text}>{words}</span>
                    {buy}
                    <button type="button" className="news-strip-close" aria-label="Dismiss" onClick={close}>
                        <CloseIcon style={{ width: compact ? 16 : 14, height: compact ? 16 : 14 }} />
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className={`credit-float credit-float-${notice.level}`} role="status">
            <span className="credit-float-dot" aria-hidden="true" />
            <span className="credit-float-text" title={notice.text}>{words}</span>
            {buy}
            <button
                type="button"
                className="credit-float-close"
                aria-label="Dismiss"
                title="Dismiss"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={close}
            >
                <CloseIcon fontSize="inherit" />
            </button>
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
