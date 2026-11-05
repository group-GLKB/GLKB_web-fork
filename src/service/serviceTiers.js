/**
 * Which service tier answers the question.
 *
 * Since the credit system (glkb-backend `docs/frontend-credits.md`, 2026-09-30) a web request
 * names a TIER — `service_tier`, `standard`, `advanced` or `premium` — never a model. The backend prices the
 * tier in credits and the agent decides which model runs it (`SERVICE_TIERS` in glkb-agent
 * `service/model_catalog.py`).
 *
 * The reader still sees MODEL names, not tier names (product decision, 2026-10-04): `standard`
 * is shown as GPT-6 Luna, `advanced` as GPT-6.1 Terra and `premium` as GPT-6.1 Sol. So moving a
 * tier to another model is
 * the agent's table AND `TIER_COPY` below — change both together.
 *
 * The tiers and their prices are FETCHED from `GET /api/v1/credits/pricing` (public), and only
 * the rows marked `enabled` are offered (all three since 2026-10-26, when Advanced became the
 * default). `FALLBACK_PRICING` exists only
 * so the picker still renders when that request fails.
 *
 * The choice persists in localStorage and `subscribeToTierPref` keeps every composer — the home
 * bar and the chat's — in step, across tabs too.
 */
// The configured instance: it carries `baseURL` (the reorg-api prefix) and the auth interceptor.
import axios from '../utils/axiosConfig';
import {
    DEFAULT_EFFORT_BY_PIPELINE,
    effortOf,
    effortPipeline,
    EFFORT_LEVELS,
    setServerEfforts,
} from './effortLevels';

export const SERVICE_TIER_KEY = 'glkb_service_tier';
const CHANGE_EVENT = 'glkb-service-tier-change';
const PRICING_ENDPOINT = '/api/v1/credits/pricing';

export const TIER_STANDARD = 'standard';
export const TIER_ADVANCED = 'advanced';
export const TIER_PREMIUM = 'premium';

/** What a request naming no tier gets when the pricing does not say (the backend's default). */
const DEFAULT_TIER = TIER_ADVANCED;

/** The tier a guest gets by default: GPT-6.1 Terra since 2026-10-26 (GPT-6 Luna before). */
export const GUEST_TIER = TIER_ADVANCED;

/** The tiers a guest may use (2026-10-26): Terra and Luna. The backend refuses Premium with a
 * 403. */
export const GUEST_TIERS = [TIER_ADVANCED, TIER_STANDARD];

export const isGuestTier = (tierId) => GUEST_TIERS.includes(tierId);

// Words only: prices come from the endpoint. Labels name the model the agent runs for the tier
// (glkb-agent SERVICE_TIERS); `shortLabel` is the chip's on a narrow phone, as the model picker had.
const TIER_COPY = {
    standard: { label: 'GPT-6 Luna', shortLabel: '6 Luna', description: 'Fastest and cheapest' },
    advanced: { label: 'GPT-6.1 Terra', shortLabel: '6.1 Terra', description: 'Balanced speed and depth' },
    premium: { label: 'GPT-6.1 Sol', shortLabel: '6.1 Sol', description: 'Most capable' },
};
// Most capable first, the order the picker has always listed in.
const TIER_ORDER = ['premium', 'advanced', 'standard'];

/** Used only when the pricing endpoint cannot be reached. */
export const FALLBACK_PRICING = {
    default_service_tier: DEFAULT_TIER,
    prices: [
        { pipeline: 'chat', service_tier: 'standard', credits: 1, enabled: true },
        { pipeline: 'chat', service_tier: 'advanced', credits: 5, enabled: true },
        { pipeline: 'chat', service_tier: 'premium', credits: 10, enabled: true },
        { pipeline: 'deep_research', service_tier: 'standard', credits: 20, enabled: true },
        { pipeline: 'deep_research', service_tier: 'advanced', credits: 30, enabled: true },
        { pipeline: 'deep_research', service_tier: 'premium', credits: 45, enabled: true },
        { pipeline: 'literature_review', service_tier: 'standard', credits: 10, enabled: true },
        { pipeline: 'literature_review', service_tier: 'advanced', credits: 20, enabled: true },
        { pipeline: 'literature_review', service_tier: 'premium', credits: 50, enabled: true },
    ],
};

/**
 * The pricing's `efforts` block (glkb-backend, 2026-11-05): `[{ id, pipeline, enabled, guest,
 * default, prices: { standard, advanced, premium } }]` in menu order, or null when the backend
 * sent none — which is how the web learns that only Medium and Extra exist
 * (service/effortLevels.js). Rows naming a level this client does not know are dropped; a row's
 * pipeline is the level's own, whatever the row says, so a typo cannot move High onto deep
 * research.
 */
export const parseEfforts = (raw) => {
    if (!Array.isArray(raw?.efforts)) return null;
    const rows = [];
    raw.efforts.forEach((row) => {
        const id = effortOf(row?.id);
        if (!id || rows.some((r) => r.id === id)) return;
        const prices = {};
        Object.entries(row?.prices && typeof row.prices === 'object' ? row.prices : {})
            .forEach(([tier, value]) => {
                const credits = value === null || value === undefined ? NaN : Number(value);
                if (Number.isFinite(credits)) prices[String(tier).trim().toLowerCase()] = credits;
            });
        rows.push({
            id,
            pipeline: effortPipeline(id),
            enabled: row?.enabled === true,
            guest: row?.guest === true,
            default: row?.default === true || DEFAULT_EFFORT_BY_PIPELINE[effortPipeline(id)] === id,
            prices,
        });
    });
    const order = EFFORT_LEVELS.map((level) => level.id);
    rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return rows.length ? rows : null;
};

/**
 * `{ defaultTier, tiers: [{ id, label, description, credits: { chat, deep_research },
 * effortCredits: { low, high, ... } }], efforts }`, where a tier appears only if some pipeline
 * enables it, `credits` holds only the enabled pipelines, and `effortCredits` the per-level
 * prices of the `efforts` block (empty without one; see `creditsForEffort`).
 */
export const parsePricing = (raw) => {
    const prices = Array.isArray(raw?.prices) ? raw.prices : [];
    const efforts = parseEfforts(raw);
    const effortCreditsOf = (tierId) => Object.fromEntries((efforts || [])
        .filter((row) => Number.isFinite(row.prices[tierId]))
        .map((row) => [row.id, row.prices[tierId]]));
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
                shortLabel: TIER_COPY[id]?.shortLabel || TIER_COPY[id]?.label
                    || id.charAt(0).toUpperCase() + id.slice(1),
                description: TIER_COPY[id]?.description || '',
                credits: {},
                effortCredits: effortCreditsOf(id),
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
        : (tiers.find((t) => t.id === DEFAULT_TIER) || tiers[tiers.length - 1])?.id || DEFAULT_TIER;
    return { defaultTier, tiers, efforts };
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
            // The levels the composers offer (service/effortLevels.js); none = Medium and Extra.
            setServerEfforts(parsed.efforts);
            return parsed;
        })
        .catch(() => {
            pricingPromise = null;
            return parsePricing(FALLBACK_PRICING);
        });
    return pricingPromise;
};

/**
 * The tiers a pipeline offers ('chat' | 'deep_research' | 'literature_review'), and its default.
 * A pipeline the pricing does not list (Literature Review before it was charged, 2026-10-13, on a
 * backend that has not caught up) offers the chat's tiers, shown without a price.
 */
export const tiersFor = (pricing, pipeline) => {
    const all = pricing?.tiers || [];
    const priced = all.some((t) => t.credits?.[pipeline] !== undefined);
    const tiers = all.filter((t) => t.credits?.[priced ? pipeline : 'chat'] !== undefined);
    const preferred = pricing?.defaultTier;
    const defaultTier = tiers.some((t) => t.id === preferred)
        ? preferred
        : (tiers.find((t) => t.id === DEFAULT_TIER) || tiers[tiers.length - 1])?.id || '';
    return { tiers, defaultTier };
};

/** The credits one query on `pipeline` at `tierId` costs, or null when unknown. */
export const creditsFor = (pricing, tierId, pipeline) => {
    const hit = (pricing?.tiers || []).find((t) => t.id === tierId);
    const value = hit?.credits?.[pipeline];
    return Number.isFinite(value) ? value : null;
};

/**
 * What one question at `effort` costs on a tier row (`parsePricing`'s): the level's own price
 * from the `efforts` block, else — no block, or Medium and Extra, which are priced as their
 * pipeline — the pipeline's price. Null when unknown. Without an effort, the chat price.
 */
export const tierCreditsForEffort = (tierRow, effort) => {
    const id = effortOf(effort);
    const own = id ? tierRow?.effortCredits?.[id] : undefined;
    if (Number.isFinite(own)) return own;
    const value = tierRow?.credits?.[effortPipeline(id || 'medium')];
    return Number.isFinite(value) ? value : null;
};

/** The credits one question at `effort` on `tierId` costs, or null when unknown. */
export const creditsForEffort = (pricing, tierId, effort) => tierCreditsForEffort(
    (pricing?.tiers || []).find((t) => t.id === tierId),
    effort,
);

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
 * The tier a request should carry: a signed-in reader whatever they chose; a guest their choice
 * if it is one of `GUEST_TIERS`, else `GUEST_TIER` (the backend refuses Premium with a 403).
 */
export const effectiveTier = (tierId, { isGuest = false } = {}) => {
    const chosen = typeof tierId === 'string' ? tierId.trim().toLowerCase() : '';
    if (!isGuest) return chosen;
    return isGuestTier(chosen) ? chosen : GUEST_TIER;
};
