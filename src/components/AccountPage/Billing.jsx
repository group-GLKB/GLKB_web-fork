/**
 * The Account page's money dialogs (Figma GLKB-Tokenized 244:5280, "Settings — Buy more 1-5",
 * "Add Funds", "Billing").
 *
 *   BuyMoreDialog  credits for dollars from the balance (service/balance.js exchangeCredits)
 *   LeavingDialog  the warning before the U-M store, where funds are added
 *   BillingDialog  the payments into the account
 *
 * The design says "queries"; the page says credits, because that is the unit bought and spent
 * (a question costs 1 to 90 of them by tier and effort), so "100 queries" would promise more
 * than 100 credits buy.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';

import { exchangeCredits, formatUsd, newRequestId } from '../../service/balance';
import { parseServerTime } from '../../utils/serverTime';

export const BUY_PRESETS = [100, 500, 1500];
const CUSTOM = 'custom';

/** A whole number of credits, at least 1, or null. */
export const parseCreditCount = (text) => {
    const trimmed = String(text ?? '').replace(/[,\s]/g, '');
    if (!/^\d+$/.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isSafeInteger(n) && n >= 1 ? n : null;
};

const centsOf = (usd) => Math.round(usd * 100);

function Dialog({ title, onClose, className = '', children, labelId }) {
    const ref = useRef(null);
    useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        ref.current?.focus();
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (
        <div
            className="modal-backdrop visible"
            onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
            <div
                className={`modal billing-modal ${className}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelId}
                tabIndex={-1}
                ref={ref}
            >
                <div className="billing-modal-head">
                    <h2 className="billing-modal-title" id={labelId}>{title}</h2>
                    <button type="button" className="billing-modal-close" aria-label="Close" onClick={onClose}>
                        <CloseIcon />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function BuyMoreDialog({ balanceUsd, creditsPerUsd, onClose, onPurchased }) {
    const [choice, setChoice] = useState(BUY_PRESETS[0]);
    const [customText, setCustomText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    // One id per dialog: a double click, or a retry after a lost response, buys once.
    const requestId = useRef(newRequestId());
    const customRef = useRef(null);

    const isCustom = choice === CUSTOM;
    const credits = isCustom ? parseCreditCount(customText) : choice;
    const customInvalid = isCustom && customText.trim() !== '' && credits === null;
    const priced = useMemo(() => {
        if (!credits || !creditsPerUsd) return null;
        const totalCents = Math.ceil((credits * 100) / creditsPerUsd);
        return { totalUsd: totalCents / 100, leftUsd: (centsOf(balanceUsd || 0) - totalCents) / 100 };
    }, [credits, creditsPerUsd, balanceUsd]);
    const insufficient = Boolean(priced) && priced.leftUsd < 0;
    const canBuy = Boolean(priced) && !insufficient && !submitting;

    useEffect(() => { if (isCustom) customRef.current?.focus(); }, [isCustom]);

    const pick = (value) => {
        setChoice(value);
        setError('');
        // A new amount is a new purchase.
        requestId.current = newRequestId();
    };

    const purchase = async () => {
        if (!canBuy) return;
        setSubmitting(true);
        setError('');
        const result = await exchangeCredits({ credits, requestId: requestId.current });
        setSubmitting(false);
        if (result.ok) {
            onPurchased(result);
            return;
        }
        setError(result.code === 'INSUFFICIENT_BALANCE' ? 'Insufficient funds.' : result.message);
    };

    return (
        <Dialog title="Buy more credits" onClose={onClose} labelId="buy-more-title" className="billing-buy">
            <div className="billing-segments" role="radiogroup" aria-label="How many credits">
                {[...BUY_PRESETS, CUSTOM].map((value) => (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={choice === value}
                        className={`billing-segment${choice === value ? ' is-active' : ''}`}
                        onClick={() => pick(value)}
                    >
                        {value === CUSTOM ? 'Custom' : value.toLocaleString('en-US')}
                    </button>
                ))}
            </div>
            {isCustom && (
                <div className="billing-custom">
                    <input
                        ref={customRef}
                        className={`billing-input${customInvalid ? ' is-invalid' : ''}`}
                        inputMode="numeric"
                        placeholder="Enter number of credits"
                        aria-label="Number of credits"
                        aria-invalid={customInvalid || undefined}
                        aria-describedby={customInvalid ? 'buy-more-invalid' : undefined}
                        value={customText}
                        onChange={(event) => { setCustomText(event.target.value); setError(''); requestId.current = newRequestId(); }}
                        onKeyDown={(event) => { if (event.key === 'Enter') purchase(); }}
                    />
                    {customInvalid && (
                        <p className="billing-field-error" id="buy-more-invalid">Please enter a valid number.</p>
                    )}
                </div>
            )}
            <div className="billing-total-row">
                <span className="billing-total">Total: {priced ? formatUsd(priced.totalUsd) : '—'}</span>
                {priced && (insufficient
                    ? <span className="billing-left is-short" role="alert">Insufficient funds.</span>
                    : <span className="billing-left">You’ll have {formatUsd(priced.leftUsd)} left.</span>)}
            </div>
            {error && !insufficient && <p className="billing-field-error" role="alert">{error}</p>}
            <div className="billing-rule" />
            <div className="billing-actions">
                <button type="button" className="billing-btn" onClick={onClose}>Cancel</button>
                <button type="button" className="billing-btn is-primary" onClick={purchase} disabled={!canBuy}>
                    {submitting ? 'Purchasing…' : 'Purchase'}
                </button>
            </div>
        </Dialog>
    );
}

export function LeavingDialog({ url, email, onClose }) {
    const go = () => {
        window.open(url, '_blank', 'noopener,noreferrer');
        onClose();
    };
    return (
        <Dialog title="Leaving GLKB" onClose={onClose} labelId="leaving-title" className="billing-leaving">
            <p className="billing-text">
                You’re about to leave GLKB to add funds through Innovation Partnerships, a separate
                U-M site with its own account. Once your purchase is complete, your balance here may
                take a few minutes to update.
            </p>
            {/* Not in the design, and needed: the store's payment reaches the GLKB account whose
                email it was paid with (glkb-backend elucid_service), so a different address there
                would leave the balance here untouched. */}
            {email ? (
                <p className="billing-text">
                    Check out with <strong className="billing-email">{email}</strong>, the email you
                    sign in with, so the funds reach this account.
                </p>
            ) : null}
            <div className="billing-actions">
                <button type="button" className="billing-btn" onClick={onClose}>Cancel</button>
                <button type="button" className="billing-btn is-primary" onClick={go}>Continue</button>
            </div>
        </Dialog>
    );
}

const formatDate = (value) => {
    const date = parseServerTime(value);
    return date
        ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
};

export function BillingDialog({ rows, onClose }) {
    return (
        <Dialog title="Billing" onClose={onClose} labelId="billing-title" className="billing-history">
            {rows === null ? (
                <p className="billing-text">Billing history could not be loaded. Try again in a moment.</p>
            ) : rows === undefined ? (
                <p className="billing-text">Loading…</p>
            ) : rows.length === 0 ? (
                <p className="billing-text">No payments yet. Funds you add appear here.</p>
            ) : (
                <table className="billing-table">
                    <thead>
                        <tr><th scope="col">Date</th><th scope="col">Total</th><th scope="col">Status</th></tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id}>
                                <td>{formatDate(row.date)}</td>
                                <td>{formatUsd(row.amountUsd)}</td>
                                <td>{row.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Dialog>
    );
}
