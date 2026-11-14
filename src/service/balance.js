/**
 * The account's money (glkb-backend app/api/v1/balance.py; docs/api-billing.md).
 *
 *   balance   dollars: what a payment at the U-M store adds (config/features.js ADD_FUNDS_URL,
 *             matched to the account by the checkout email) and what API keys spend
 *   credits   what the web app spends. Only an exchange turns dollars into credits: the
 *             "Buy more" dialog names a whole number of credits and `credits / credits_per_usd`
 *             dollars are taken from the balance. Bought credits never expire and never turn
 *             back into dollars.
 *
 * Every figure comes from the server; nothing here computes a balance.
 */
import axios from '../utils/axiosConfig';

const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

export const parseBalance = (data) => ({
    balanceUsd: num(data?.balance_usd),
    purchasedCredits: num(data?.purchased_credits_remaining) ?? 0,
});

/** The balance, or null when it cannot be read (a server error, or an account without one). */
export const fetchBalance = () => axios.get('/api/v1/balance/me')
    .then((response) => parseBalance(response?.data))
    .catch(() => null);

/**
 * The payments into the account, newest first: top-ups (paid) and refunds. Exchanges and API
 * charges are spending, not billing, and are left out.
 */
export const BILLING_KINDS = { topup: 'Paid', refund: 'Refunded' };

export const fetchBilling = () => axios.get('/api/v1/balance/transactions', { params: { limit: 200 } })
    .then((response) => (response?.data?.items || [])
        .filter((item) => BILLING_KINDS[item?.kind])
        .map((item) => ({
            id: item.id,
            date: item.created_at,
            amountUsd: Math.abs(num(item.amount_usd) || 0),
            status: BILLING_KINDS[item.kind],
            order: item.order_uid || null,
        })))
    .catch(() => null);

/** A fresh idempotency key, so a retried Purchase never buys twice. */
export const newRequestId = () => {
    try {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    } catch (error) { /* fall through */ }
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Buys `credits` with the balance. Resolves to `{ ok: true, credits, balanceUsd, purchasedCredits }`
 * or `{ ok: false, code, message, maxCredits }` — INSUFFICIENT_BALANCE (402) carries the most the
 * balance covers.
 */
export const exchangeCredits = ({ credits, requestId }) => axios.post('/api/v1/balance/exchange', {
    credits,
    request_id: requestId,
})
    .then((response) => ({
        ok: true,
        credits: num(response?.data?.credits),
        balanceUsd: num(response?.data?.balance_usd),
        purchasedCredits: num(response?.data?.purchased_credits_remaining),
    }))
    .catch((error) => {
        const detail = error?.response?.data?.detail;
        const body = detail && typeof detail === 'object' ? detail : {};
        return {
            ok: false,
            code: body.code || (error?.response ? `HTTP_${error.response.status}` : 'NETWORK'),
            message: body.message || (typeof detail === 'string' ? detail : 'The purchase did not go through. Nothing was charged.'),
            maxCredits: num(body.max_credits),
        };
    });

export const formatUsd = (value) => (Number.isFinite(value)
    ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : '—');
