/**
 * Which service tier answers the question.
 *
 * Since the credit system (glkb-backend `docs/frontend-credits.md`, 2026-09-30) a web request
 * names a TIER — `service_tier`, Standard or Premium — never a model. The backend prices the
 * tier in credits and the agent decides which model runs it, so changing a tier's model touches
 * neither this file nor a price, and no model name is shown to the reader.
 *
 * The tiers and their prices are FETCHED from `GET /api/v1/credits/pricing` (public), and only
 * the rows marked `enabled` are offered (Advanced is off today). `FALLBACK_PRICING` exists only
 * so the picker still renders when that request fails.
 *
 * The choice persists in localStorage and `subscribeToTierPref` keeps every composer — the home
 * bar and the chat's — in step, across tabs too.
 */
// The configured instance: it carries `baseURL` (the reorg-api prefix) and the auth interceptor.
import axios from '../utils/axiosConfig';

export const SERVICE_TIER_KEY = 'glkb_service_tier';
const CHANGE_EVENT = 'glkb-service-tier-change';
const PRICING_ENDPOINT = '/api/v1/credits/pricing';

export const TIER_STANDARD = 'standard';
export const TIER_PREMIUM = 'premium';

/** The tier a guest is held to; the backend refuses any other with a 403. */
export const GUEST_TIER = TIER_STANDARD;

// Words only: prices come from the endpoint, and the model behind a tier is the agent's call.
const TIER_COPY = {
    standard: { label: 'Standard', description: 'Fast answers for everyday questions' },
    advanced: { label: 'Advanced', description: 'More depth for harder questions' },
    premium: { label: 'Premium', description: 'Most capable, for the hardest questions' },
};
// Most capable first, the order the picker has always listed in.
const TIER_ORDER = ['premium', 'advanced', 'standard'];

/** Used only when the pricing endpoint cannot be reached. */
export const FALLBACK_PRICING = {
    default_service_tier: TIER_STANDARD,
    prices: [
        { pipeline: 'chat', service_tier: 'standard', credits: 1, enabled: true },
        { pipeline: 'chat', service_tier: 'premium', credits: 10, enabled: true },
        { pipeline: 'deep_research', service_tier: 'standard', credits: 20, enabled: true },
        { pipeline: 'deep_research', service_tier: 'premium', credits: 45, enabled: true },
    ],
};

/**
 * `{ defaultTier, tiers: [{ id, label, description, credits: { chat, deep_research } }] }`,
 * where a tier appears only if some pipeline enables it and `credits` holds only the enabled
 * pipelines.
 */
export const parsePricing = (raw) => {
    const prices = Array.isArray(raw?.prices) ? raw.prices : [];
    const byTier = {};
    prices.forEach((row) => {
        const id = String(row?.service_tier || '').trim().toLowerCase();
        const pipeline = String(row?.pipeline || '').trim();
        if (!id || !pipeline || !row?.enabled) return;
        const credits = row.credits === null || row.credits === undefined ? NaN : Number(row.credits);
        if (!byTier[id]) {
            byTier[id] = {
                id,
                label: TIER_COPY[id]?.label || id.charAt(0).toUpperCase() + id.slice(1),
                description: TIER_COPY[id]?.description || '',
                credits: {},
            };
        }
        byTier[id].credits[pipeline] = Number.isFinite(credits) ? credits : null;
    });
    const rank = (id) => {
        const i = TIER_ORDER.indexOf(id);
        return i === -1 ? TIER_ORDER.length : i;
    };
    const tiers = Object.values(byTier).sort((a, b) => rank(a.id) - rank(b.id));
    const preferred = String(raw?.default_service_tier || '').trim().toLowerCase();
    const defaultTier = tiers.some((t) => t.id === preferred)
        ? preferred
        : (tiers.find((t) => t.id === TIER_STANDARD) || tiers[tiers.length - 1])?.id || TIER_STANDARD;
    return { defaultTier, tiers };
};

let pricingPromise = null;
let pricingCache = null;

/** One shared request per page load; a failure is not cached, so the next caller retries. */
export const fetchTierPricing = () => {
    if (pricingCache) return Promise.resolve(pricingCache);
    if (pricingPromise) return pricingPromise;
    pricingPromise = axios.get(PRICING_ENDPOINT)
        .then((response) => {
            const parsed = parsePricing(response?.data);
            if (!parsed.tiers.length) throw new Error('no enabled service tier');
            pricingCache = parsed;
            return parsed;
        })
        .catch(() => {
            pricingPromise = null;
            return parsePricing(FALLBACK_PRICING);
        });
    return pricingPromise;
};

/** The tiers a pipeline offers ('chat' | 'deep_research'), and its default. */
export const tiersFor = (pricing, pipeline) => {
    const tiers = (pricing?.tiers || []).filter((t) => t.credits?.[pipeline] !== undefined);
    const preferred = pricing?.defaultTier;
    const defaultTier = tiers.some((t) => t.id === preferred)
        ? preferred
        : (tiers.find((t) => t.id === TIER_STANDARD) || tiers[tiers.length - 1])?.id || '';
    return { tiers, defaultTier };
};

/** The credits one query on `pipeline` at `tierId` costs, or null when unknown. */
export const creditsFor = (pricing, tierId, pipeline) => {
    const hit = (pricing?.tiers || []).find((t) => t.id === tierId);
    const value = hit?.credits?.[pipeline];
    return Number.isFinite(value) ? value : null;
};

export const tierLabel = (tierId) => TIER_COPY[tierId]?.label
    || (tierId ? tierId.charAt(0).toUpperCase() + tierId.slice(1) : '');

/** What the picker last showed, or '' for "the default tier". */
export const getTierPref = () => {
    try {
        const stored = localStorage.getItem(SERVICE_TIER_KEY);
        return typeof stored === 'string' ? stored.trim().toLowerCase() : '';
    } catch (error) {
        return '';
    }
};

export const setTierPref = (tierId) => {
    const value = typeof tierId === 'string' ? tierId.trim().toLowerCase() : '';
    try {
        if (value) {
            localStorage.setItem(SERVICE_TIER_KEY, value);
        } else {
            localStorage.removeItem(SERVICE_TIER_KEY);
        }
    } catch (error) {
        /* private mode: the choice still holds for this page's lifetime */
    }
    try {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { tier: value } }));
    } catch (error) {
        /* no window: nothing is listening anyway */
    }
};

/** Fires on our own writes and on another tab's. */
export const subscribeToTierPref = (listener) => {
    const onLocal = () => listener(getTierPref());
    const onStorage = (event) => {
        if (!event.key || event.key === SERVICE_TIER_KEY) listener(getTierPref());
    };
    window.addEventListener(CHANGE_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onLocal);
        window.removeEventListener('storage', onStorage);
    };
};

/**
 * The tier a request should carry: a guest is always Standard (the backend refuses anything
 * else with a 403), a signed-in reader whatever they chose.
 */
export const effectiveTier = (tierId, { isGuest = false } = {}) => (
    isGuest ? GUEST_TIER : (typeof tierId === 'string' ? tierId.trim().toLowerCase() : '')
);
