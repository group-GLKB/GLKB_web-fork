import './scoped.css';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import {
  Tab,
  Tabs,
} from '@mui/material';

import { Switch } from '../Units/Switch';

import {
  upgradeToPro,
} from '../../service/Tier';
import { CHAT_HOME_PATH } from '../../config/entryRoutes';
import { fetchUsage } from '../../service/credits';
import { ADD_FUNDS_URL } from '../../config/features';
import { fetchBalance, fetchBilling, formatUsd } from '../../service/balance';
import { DEFAULT_CREDITS_PER_USD, fetchTierPricing } from '../../service/serviceTiers';
import { BillingDialog, BuyMoreDialog, LeavingDialog } from './Billing';
import { trackGtagEvent } from '../../utils/gtag';
import { useAuth } from '../Auth/AuthContext';
import {
    browserNotifyPermission,
    getNotifyPrefs,
    NOTIFY_BROWSER_KEY,
    NOTIFY_EMAIL_KEY,
    requestBrowserNotifyPermission,
    setNotifyPref,
    subscribeToNotifyPrefs,
} from '../../service/notifications';
import { AVATARS, avatarById } from './avatars';
import useAccountTier from '../../hooks/useAccountTier';

const getSessionValue = (key) => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(key) || '';
};

const setSessionValue = (key, value) => {
    window.sessionStorage.setItem(key, value);
};

const isPhoneViewport = () => window.matchMedia('(max-width: 767px)').matches;

/**
 * "Next reset in 10 days (Dec 1)" (Figma 244:4882). The allowance resets at 00:00 UTC on the
 * 1st, so the date is read in UTC: in the Americas that instant is the evening before, and the
 * reader is told the 1st, the day the credits are theirs again.
 */
export const nextResetText = (resetsAt, now = new Date()) => {
    const day = resetsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const days = Math.max(0, Math.ceil((resetsAt.getTime() - now.getTime()) / 86400000));
    if (days <= 1) return `Next reset ${days === 0 ? 'today' : 'tomorrow'} (${day})`;
    return `Next reset in ${days} days (${day})`;
};

const formatTierLabel = (tier) => {
    if (!tier) return 'Unavailable';
    return `${tier}`.charAt(0).toUpperCase() + `${tier}`.slice(1);
};

/** The presets are the design's now, so choosing one is on. */
const ALLOW_AVATAR_CHANGE = true;

/** The chosen preset, or the default when the user has not picked one. */
const AvatarMark = ({ id, className }) => {
    const preset = avatarById(id);
    if (!preset) {
        return (
            <span className={`${className} settings-avatar-default`}>
                <PersonIcon />
            </span>
        );
    }
    return preset.render({ className });
};

const AccountPage = () => {
    const { user, logout, updateUsername, updateAvatar, refreshUser } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState(() => getSessionValue('account_display_name'));
    const [email, setEmail] = useState(() => getSessionValue('account_email'));
    const [nameDraft, setNameDraft] = useState('');
    const [showNameModal, setShowNameModal] = useState(false);
    const [notifyPrefs, setNotifyPrefs] = useState(() => getNotifyPrefs());
    const [notifyNote, setNotifyNote] = useState('');
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [pickedAvatar, setPickedAvatar] = useState(null);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [avatarError, setAvatarError] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showSignoutModal, setShowSignoutModal] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const { tierInfo, refreshTierInfo } = useAccountTier(user);
    const [activeTab, setActiveTab] = useState(
        () => (location.state?.tab === 'testing' ? 'testing' : 'account')
    );

    // null until the user picks one; the row renders the default in that case.
    const avatarId = avatarById(user?.avatar_id)?.id ?? null;

    // A picture chosen on another device is not in the cached login payload, so
    // read the user back once on arrival.
    useEffect(() => subscribeToNotifyPrefs(setNotifyPrefs), []);

    /**
     * Browser notifications need permission, and the prompt only opens from a
     * gesture — so it is asked for here, on the toggle, rather than on load.
     */
    const toggleBrowserNotify = async (enabled) => {
        setNotifyNote('');
        if (!enabled) {
            setNotifyPref(NOTIFY_BROWSER_KEY, false);
            return;
        }
        const permission = await requestBrowserNotifyPermission();
        if (permission !== 'granted') {
            setNotifyPref(NOTIFY_BROWSER_KEY, false);
            setNotifyNote(permission === 'denied'
                ? 'Your browser is blocking notifications for this site. Allow them in its site settings first.'
                : 'Your browser did not allow notifications.');
            return;
        }
        setNotifyPref(NOTIFY_BROWSER_KEY, true);
    };

    // Only worth re-reading once a picture can differ from the cached payload.
    const readUserOnce = useRef(false);
    useEffect(() => {
        if (!ALLOW_AVATAR_CHANGE || readUserOnce.current || !user) return;
        readUserOnce.current = true;
        refreshUser();
    }, [user, refreshUser]);

    const saveAvatar = async () => {
        if (pickedAvatar === avatarId) {
            setShowAvatarModal(false);
            return;
        }
        // Nothing picked, nothing saved: the row is already showing the default.
        // (The contract takes 1..16 and cannot say "none", so there is no way to
        // go back to the default once a picture is saved either.)
        if (pickedAvatar === null) {
            setShowAvatarModal(false);
            return;
        }
        setSavingAvatar(true);
        setAvatarError('');
        const result = await updateAvatar(pickedAvatar);
        setSavingAvatar(false);

        if (result.success) {
            setShowAvatarModal(false);
            setToastMessage('Profile picture updated');
            return;
        }
        // The endpoint ships on its own branch; say so rather than blaming the user.
        setAvatarError(result.status === 404
            ? 'Profile pictures are not available on this server yet.'
            : result.message);
    };
    const [proPasscode, setProPasscode] = useState('');
    const [proActionLoading, setProActionLoading] = useState(false);
    const [proActionMessage, setProActionMessage] = useState('');
    const [proActionError, setProActionError] = useState('');
    const [isPhoneDevice, setIsPhoneDevice] = useState(isPhoneViewport);

    useEffect(() => {
        const evaluateIsPhone = () => {
            setIsPhoneDevice(isPhoneViewport());
        };

        evaluateIsPhone();
        window.addEventListener('resize', evaluateIsPhone);
        return () => {
            window.removeEventListener('resize', evaluateIsPhone);
        };
    }, []);

    useEffect(() => {
        if (!displayName) {
            setDisplayName(user?.username || user?.email || 'Account');
        }
    }, [displayName, user]);

    useEffect(() => {
        if (!email) {
            setEmail(user?.email || 'your@email.com');
        }
    }, [email, user]);

    useEffect(() => {
        if (!toastMessage) return undefined;
        const timeoutId = window.setTimeout(() => {
            setToastMessage('');
        }, 2200);
        return () => window.clearTimeout(timeoutId);
    }, [toastMessage]);

    /* Credits (service/credits.js): the free monthly allowance and what is left of it, plus
       purchased credits, which never expire. The account tier (the plan badge) still comes from
       /tier/me; its old per-call quota is no longer what limits a reader. */
    const [credits, setCredits] = useState(null);
    useEffect(() => {
        let isMounted = true;
        fetchUsage({ isAuthenticated: true }).then((next) => {
            if (isMounted && next) setCredits(next);
        });
        return () => {
            isMounted = false;
        };
    }, []);

    /* The balance in dollars (service/balance.js) and the exchange rate the Buy more dialog prices
       with; the dialogs open from the rows below, and `?buy=credits` (the chat's "Buy credits"
       links) opens Buy more on arrival. */
    const [balance, setBalance] = useState(null);
    const [creditsPerUsd, setCreditsPerUsd] = useState(DEFAULT_CREDITS_PER_USD);
    const [dialog, setDialog] = useState(
        () => (ADD_FUNDS_URL && new URLSearchParams(location.search).get('buy') === 'credits' ? 'buy' : null),
    );
    const [billingRows, setBillingRows] = useState(undefined);
    const reloadMoney = useCallback(() => {
        fetchBalance().then((next) => setBalance(next));
        fetchUsage({ isAuthenticated: true }).then((next) => { if (next) setCredits(next); });
    }, []);
    useEffect(() => {
        if (!ADD_FUNDS_URL) return undefined;
        let isMounted = true;
        fetchBalance().then((next) => { if (isMounted) setBalance(next); });
        fetchTierPricing().then((pricing) => {
            if (isMounted && pricing?.creditsPerUsd) setCreditsPerUsd(pricing.creditsPerUsd);
        });
        // A purchase at the store lands while this tab sits in the background.
        const onFocus = () => { if (document.visibilityState === 'visible') reloadMoney(); };
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            isMounted = false;
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [reloadMoney]);
    const openBilling = () => {
        setBillingRows(undefined);
        setDialog('billing');
        fetchBilling().then((rows) => setBillingRows(rows));
    };
    const closeDialog = useCallback(() => {
        setDialog(null);
        if (new URLSearchParams(location.search).get('buy')) navigate('/account', { replace: true, state: location.state });
    }, [location.search, location.state, navigate]);
    const onPurchased = (result) => {
        setDialog(null);
        setToastMessage(`${(result.credits || 0).toLocaleString('en-US')} credits added`);
        // fetchUsage publishes the new figure to the rest of the app (service/credits.js).
        reloadMoney();
    };

    const creditsLoading = !credits;
    const monthlyAllowance = Math.max(0, credits?.monthlyAllowance || 0);
    const monthlyRemaining = Math.max(0, Math.min(monthlyAllowance, credits?.monthlyRemaining ?? monthlyAllowance));
    const monthlyUsed = monthlyAllowance - monthlyRemaining;
    const purchasedRemaining = Math.max(0, credits?.purchasedRemaining || 0);
    const usagePercent = monthlyAllowance > 0 ? Math.min(100, (monthlyUsed / monthlyAllowance) * 100) : 0;
    const usageResetText = credits?.resetsAt ? nextResetText(credits.resetsAt) : '--';
    const normalizedTier = `${tierInfo?.tier || 'free'}`.toLowerCase();
    const isUpgradeDisabled = normalizedTier === 'pro' || normalizedTier === 'admin';

    const openNameModal = () => {
        setNameDraft(displayName);
        setShowNameModal(true);
    };

    const handleSaveName = async () => {
        const trimmed = nameDraft.trim();
        if (!trimmed) return;
        const result = await updateUsername(trimmed);
        if (result.success && result.user) {
            const nextName = result.user.username || trimmed;
            setDisplayName(nextName);
            setSessionValue('account_display_name', nextName);
            setToastMessage(result.message || 'Name updated');
            window.dispatchEvent(new Event('glkb-account-updated'));
            setShowNameModal(false);
        } else {
            setToastMessage(result.message || 'Failed to update name');
        }
    };

    const handleSignOut = async () => {
        setShowSignoutModal(false);
        await logout();
        navigate('/');
    };

    const handleBackdropClick = (event, onClose) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    const handleUpgradeToPro = async () => {
        const passcode = proPasscode.trim();
        if (!passcode) {
            setProActionError('Enter pro password first.');
            setProActionMessage('');
            return;
        }

        setProActionLoading(true);
        setProActionError('');
        setProActionMessage('');

        const result = await upgradeToPro(passcode);
        if (result.success) {
            setProActionMessage(result.message || 'Upgraded to pro tier.');
            await refreshTierInfo();
        } else {
            setProActionError(result.message || 'Failed to upgrade to pro tier.');
        }

        setProActionLoading(false);
    };

    return (
        <div className="account-page">
            <div className="settings-wrapper">
                {!isPhoneDevice && (
                    <nav className="settings-nav">
                    <button
                        type="button"
                        className="settings-nav-header"
                        onClick={() => navigate(CHAT_HOME_PATH)}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        Home
                    </button>
                    <button
                        type="button"
                        className={`settings-nav-item${activeTab === 'account' ? ' active' : ''}`}
                        onClick={() => setActiveTab('account')}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Account
                    </button>
                    <button
                        type="button"
                        className={`settings-nav-item${activeTab === 'testing' ? ' active' : ''}`}
                        onClick={() => setActiveTab('testing')}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"></path>
                        </svg>
                        Upgrade with Code
                    </button>
                    </nav>
                )}

                <div className="settings-content">
                    {isPhoneDevice && (
                        <div className="settings-mobile-tabs-row">
                            <Tabs
                                value={activeTab}
                                onChange={(_, value) => setActiveTab(value)}
                                variant="fullWidth"
                                TabIndicatorProps={{
                                    sx: {
                                        backgroundColor: 'var(--color-brand-primary)',
                                        height: 2,
                                    },
                                }}
                                sx={{
                                    minHeight: 0,
                                    '& .MuiTabs-flexContainer': {
                                        gap: 0,
                                    },
                                    '& .MuiTab-root': {
                                        textTransform: 'none',
                                        fontFamily: 'Geist, sans-serif',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: 'var(--color-text-secondary)',
                                        minHeight: 32,
                                        minWidth: '50%',
                                        maxWidth: 'none',
                                        flex: 1,
                                        padding: '12px 0',
                                    },
                                    '& .MuiTab-root.Mui-selected': {
                                        color: 'var(--color-brand-primary)',
                                    },
                                }}
                            >
                                <Tab value="account" label="Account" />
                                <Tab value="testing" label="Upgrade with Code" />
                            </Tabs>
                        </div>
                    )}
                    <div className="settings-inner">
                        {activeTab === 'account' ? (
                            <>
                                <h2 className="settings-title settings-title-first">Account</h2>

                                <div className="settings-row">
                                    <span className="settings-row-label">Email</span>
                                    <span className="settings-row-value">{email}</span>
                                </div>

                                <div className="settings-row">
                                    <span className="settings-row-labels">
                                        <span className="settings-row-label">Display Name</span>
                                        <span className="settings-row-sub">{displayName}</span>
                                    </span>
                                    <button type="button" className="settings-row-action" onClick={openNameModal}>
                                        Edit
                                    </button>
                                </div>

                                {/* Figma 244:5280 — the picture sits on the right of its
                                    own row, and opens the preset picker. */}
                                <div className="settings-row">
                                    <span className="settings-row-label">Avatar</span>
                                    {ALLOW_AVATAR_CHANGE ? (
                                        <button
                                            type="button"
                                            className="settings-avatar-button"
                                            onClick={() => { setAvatarError(''); setPickedAvatar(avatarId); setShowAvatarModal(true); }}
                                            aria-label="Change your profile picture"
                                        >
                                            <AvatarMark id={avatarId} className="settings-avatar" />
                                        </button>
                                    ) : (
                                        <AvatarMark id={avatarId} className="settings-avatar" />
                                    )}
                                </div>

                                {/* Figma 244:5280 — one label, two switches. Email is the
                                    server's job and survives a closed tab; Browser is ours
                                    and needs the reader's permission. */}
                                <div className="settings-row settings-row-last settings-row-notify">
                                    <span className="settings-row-label">
                                        Notify me when Investigate finishes
                                    </span>
                                    <span className="settings-notify-toggles">
                                        <span className="settings-notify-option">
                                            <span className="settings-notify-name">Browser</span>
                                            <Switch
                                                checked={notifyPrefs.browser}
                                                onChange={(event) => toggleBrowserNotify(event.target.checked)}
                                                inputProps={{ 'aria-label': 'Notify me in this browser' }}
                                            />
                                        </span>
                                        <span className="settings-notify-option">
                                            <span className="settings-notify-name">Email</span>
                                            <Switch
                                                checked={notifyPrefs.email}
                                                onChange={(event) => setNotifyPref(NOTIFY_EMAIL_KEY, event.target.checked)}
                                                inputProps={{ 'aria-label': 'Email me when Investigate finishes' }}
                                            />
                                        </span>
                                    </span>
                                </div>
                                {notifyNote ? (
                                    <p className="settings-notify-note">{notifyNote}</p>
                                ) : null}

                                <h2 className="settings-title">Usage &amp; Balance</h2>

                                {/* Figma 244:4882 — the balance in dollars, what the monthly
                                    allowance has left, what was bought on top of it. */}
                                {ADD_FUNDS_URL ? (
                                    <div className="settings-row settings-row-figure">
                                        <span className="settings-row-labels">
                                            <span className="settings-row-label">Balance</span>
                                            <span className="settings-figure">
                                                {balance ? formatUsd(balance.balanceUsd) : '—'}
                                            </span>
                                        </span>
                                        <button
                                            type="button"
                                            className="settings-row-action"
                                            onClick={() => { trackGtagEvent('add_funds_click', { source: 'account_page' }); setDialog('leaving'); }}
                                        >
                                            Add funds
                                        </button>
                                    </div>
                                ) : null}

                                <div className="settings-row settings-row-stacked">
                                    <div className="settings-row-head">
                                        <span className="settings-row-label">Monthly Credits</span>
                                        <span className="settings-row-chip">
                                            {creditsLoading ? 'Loading...' : usageResetText}
                                        </span>
                                    </div>
                                    <div
                                        className="subscription-progress"
                                        role="progressbar"
                                        aria-label="Monthly credits used"
                                        aria-valuemin={0}
                                        aria-valuemax={monthlyAllowance || 100}
                                        aria-valuenow={monthlyUsed}
                                    >
                                        <div
                                            className="subscription-progress-fill"
                                            style={{ width: `${usagePercent}%` }}
                                        />
                                    </div>
                                    <div className="subscription-progress-footer">
                                        <span className="subscription-progress-used">
                                            {creditsLoading ? '-- used' : `${monthlyUsed} used`}
                                        </span>
                                        <span>
                                            {creditsLoading ? '-- remaining' : `${monthlyRemaining} remaining`}
                                        </span>
                                    </div>
                                </div>

                                {ADD_FUNDS_URL ? (
                                    <div className={`settings-row${purchasedRemaining > 0 ? ' settings-row-figure' : ''}`}>
                                        <span className="settings-row-labels">
                                            <span className="settings-row-label">Additional Credits</span>
                                            {/* Before the first purchase the row is the label alone (Figma 244:5005). */}
                                            {purchasedRemaining > 0 ? (
                                                <span className="settings-figure">
                                                    {purchasedRemaining.toLocaleString('en-US')} available
                                                </span>
                                            ) : null}
                                        </span>
                                        <button
                                            type="button"
                                            className="settings-row-action"
                                            onClick={() => { trackGtagEvent('credits_buy_click', { source: 'account_page' }); setDialog('buy'); }}
                                        >
                                            Buy more
                                        </button>
                                    </div>
                                ) : null}

                                <div className="settings-row">
                                    <span className="settings-row-label">Your Subscription</span>
                                    <span className="plan-badge">{formatTierLabel(tierInfo?.tier)}</span>
                                </div>

                                <div className={`settings-row${ADD_FUNDS_URL ? '' : ' settings-row-last'}`}>
                                    <span className="settings-row-label">API Usage</span>
                                    <button
                                        type="button"
                                        className="settings-row-action"
                                        onClick={() => navigate('/api-page')}
                                    >
                                        View dashboard
                                    </button>
                                </div>

                                {ADD_FUNDS_URL ? (
                                    <div className="settings-row settings-row-last">
                                        <span className="settings-row-label">Billing</span>
                                        <button type="button" className="settings-row-action" onClick={openBilling}>
                                            View
                                        </button>
                                    </div>
                                ) : null}

                                <h2 className="settings-title">System</h2>

                                <div className="settings-row">
                                    <span className="settings-row-label">Sign out</span>
                                    <button type="button" className="settings-row-action" onClick={() => setShowSignoutModal(true)}>
                                        Sign out
                                    </button>
                                </div>

                                <div className="settings-row settings-row-last">
                                    <span className="settings-row-label is-danger">Delete account</span>
                                    <button type="button" className="settings-row-action" onClick={() => setShowDeleteModal(true)}>
                                        Learn more
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 className="settings-title settings-title-first">Upgrade with Code</h2>
                                <div className="settings-divider"></div>

                                <div className="flat-row settings-upgrade-row">
                                    <div className="flat-field">
                                        <div className="flat-label">Pro Password</div>
                                        <input
                                            className="settings-inline-input"
                                            type="password"
                                            value={proPasscode}
                                            onChange={(event) => setProPasscode(event.target.value)}
                                            placeholder="Enter pro password"
                                        />
                                        {proActionMessage ? <div className="flat-sub settings-inline-success">{proActionMessage}</div> : null}
                                        {proActionError ? <div className="flat-sub settings-inline-error">{proActionError}</div> : null}
                                    </div>
                                    <button
                                        type="button"
                                        className="flat-btn dark"
                                        onClick={handleUpgradeToPro}
                                        disabled={proActionLoading}
                                    >
                                        {proActionLoading ? 'Upgrading...' : 'Upgrade to Pro'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {ALLOW_AVATAR_CHANGE && showAvatarModal && (
                <div
                    className="modal-backdrop visible"
                    onClick={(event) => handleBackdropClick(event, () => setShowAvatarModal(false))}
                >
                    <div className="modal">
                        <div className="modal-title">Choose a profile picture</div>
                        <div className="avatar-grid" role="radiogroup" aria-label="Profile picture">
                            {/* The default is not a tile. Having chosen nothing is
                                already the default, so listing it would be offering
                                the state you are in as a thing to switch to. */}
                            {AVATARS.map((avatar) => (
                                <button
                                    key={avatar.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={pickedAvatar === avatar.id}
                                    aria-label={`Profile picture ${avatar.id}`}
                                    className={`avatar-option${pickedAvatar === avatar.id ? ' is-picked' : ''}`}
                                    onClick={() => setPickedAvatar(avatar.id)}
                                >
                                    {avatar.render({ className: 'avatar-option-mark' })}
                                </button>
                            ))}
                        </div>
                        {avatarError ? <div className="modal-error">{avatarError}</div> : null}
                        <div className="modal-actions">
                            <button
                                type="button"
                                className="flat-btn"
                                onClick={() => setShowAvatarModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="flat-btn dark"
                                onClick={saveAvatar}
                                disabled={savingAvatar}
                            >
                                {savingAvatar ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showNameModal && (
                <div
                    className="modal-backdrop visible"
                    onClick={(event) => handleBackdropClick(event, () => setShowNameModal(false))}
                >
                    <div className="modal">
                        <div className="modal-title">Edit Display Name</div>
                        <div className="modal-desc">Update your display name.</div>
                        <div className="modal-field">
                            <label className="modal-label" htmlFor="displayNameInput">Display Name</label>
                            <input
                                id="displayNameInput"
                                className="modal-input"
                                type="text"
                                value={nameDraft}
                                onChange={(event) => setNameDraft(event.target.value)}
                            />
                        </div>
                        <div className="modal-actions">
                            <button
                                type="button"
                                className="flat-btn"
                                onClick={() => setShowNameModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="flat-btn dark"
                                onClick={handleSaveName}
                                disabled={!nameDraft.trim()}
                            >
                                Save changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div
                    className="modal-backdrop visible"
                    onClick={(event) => handleBackdropClick(event, () => setShowDeleteModal(false))}
                >
                    <div className="modal modal-danger">
                        <div className="modal-header">
                            <div className="modal-title">Confirm Account Deletion</div>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => setShowDeleteModal(false)}
                            >
                                <CloseIcon fontSize="small" />
                            </button>
                        </div>
                        <p className="modal-text">
                            Before you delete your account, please take a moment to understand what will happen to your data:
                        </p>
                        <ul className="modal-list">
                            <li>Your profile details, preferences, and settings will be removed.</li>
                            <li>Your search history, threads, and any other content you've shared will be deleted.</li>
                            {/* Figma 244:4611: what is paid for goes with the account. GLKB offers no refunds. */}
                            {(balance?.balanceUsd > 0 || purchasedRemaining > 0) && (
                                <li>
                                    Your remaining balance ({formatUsd(balance?.balanceUsd ?? 0)})
                                    {purchasedRemaining > 0 ? ` and additional credits (${purchasedRemaining.toLocaleString('en-US')})` : ''}
                                    {' '}will be forfeited and cannot be refunded.
                                </li>
                            )}
                        </ul>
                        <p className="modal-text">
                            All data will be permanently deleted 30 days after account deletion. Keep in mind that deleting your account can't be undone.
                        </p>
                        <div className="modal-actions">
                            <button
                                type="button"
                                className="flat-btn"
                                onClick={() => setShowDeleteModal(false)}
                            >
                                Cancel
                            </button>
                            <button type="button" className="flat-btn danger" disabled>
                                Confirm Deletion
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSignoutModal && (
                <div
                    className="modal-backdrop visible"
                    onClick={(event) => handleBackdropClick(event, () => setShowSignoutModal(false))}
                >
                    <div className="modal modal-danger">
                        <div className="modal-header">
                            <div className="modal-title">Sign out</div>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => setShowSignoutModal(false)}
                            >
                                <CloseIcon fontSize="small" />
                            </button>
                        </div>
                        <p className="modal-text">Are you sure you want to sign out of your account?</p>
                        <div className="modal-actions">
                            <button
                                type="button"
                                className="flat-btn"
                                onClick={() => setShowSignoutModal(false)}
                            >
                                Cancel
                            </button>
                            <button type="button" className="flat-btn danger" onClick={handleSignOut}>
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {dialog === 'buy' && (
                <BuyMoreDialog
                    balanceUsd={balance?.balanceUsd ?? 0}
                    creditsPerUsd={creditsPerUsd}
                    onClose={closeDialog}
                    onPurchased={onPurchased}
                />
            )}
            {dialog === 'leaving' && <LeavingDialog url={ADD_FUNDS_URL} email={user?.email} onClose={closeDialog} />}
            {dialog === 'billing' && <BillingDialog rows={billingRows} onClose={closeDialog} />}

            {toastMessage && (
                <div className="success-toast" role="status">
                    {toastMessage}
                </div>
            )}
        </div>
    );
};

export default AccountPage;
