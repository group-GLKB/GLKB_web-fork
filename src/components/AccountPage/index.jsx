import './scoped.css';

import React, {
  useEffect,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Close as CloseIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

import {
  getMyTier,
  upgradeToAdmin,
} from '../../service/Tier';
import { useAuth } from '../Auth/AuthContext';

const getSessionValue = (key) => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(key) || '';
};

const setSessionValue = (key, value) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(key, value);
};

const parseNaiveUtcDate = (value) => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
    const parsed = new Date(hasTimezone ? trimmed : `${trimmed}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatResetTime = (value) => {
    const parsed = parseNaiveUtcDate(value);
    if (!parsed) return '--';
    return parsed.toLocaleString('en-US', {
        weekday: 'short',
        month: 'long',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

const formatTierLabel = (tier) => {
    if (!tier) return 'Free';
    return `${tier}`.charAt(0).toUpperCase() + `${tier}`.slice(1);
};

const AccountPage = () => {
    const { user, logout, updateUsername } = useAuth();
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState(() => getSessionValue('account_display_name'));
    const [email, setEmail] = useState(() => getSessionValue('account_email'));
    const [nameDraft, setNameDraft] = useState('');
    const [showNameModal, setShowNameModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showSignoutModal, setShowSignoutModal] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [tierInfo, setTierInfo] = useState(null);
    const [tierLoading, setTierLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('account');
    const [adminPasscode, setAdminPasscode] = useState('');
    const [adminActionLoading, setAdminActionLoading] = useState(false);
    const [adminActionMessage, setAdminActionMessage] = useState('');
    const [adminActionError, setAdminActionError] = useState('');

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

    useEffect(() => {
        let isMounted = true;

        getMyTier()
            .then((result) => {
                if (!isMounted) return;
                if (result.success) {
                    setTierInfo(result.data || null);
                } else {
                    setTierInfo(null);
                }
            })
            .finally(() => {
                if (!isMounted) return;
                setTierLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const quotaLimit = Math.max(0, Number(tierInfo?.quota_limit) || 0);
    const quotaUsed = Math.min(quotaLimit, Math.max(0, Number(tierInfo?.quota_used) || 0));
    const quotaRemaining = Math.max(0, Number(tierInfo?.quota_remaining) || (quotaLimit - quotaUsed));
    const usagePercent = quotaLimit > 0 ? Math.min(100, (quotaUsed / quotaLimit) * 100) : 0;
    const usageResetText = formatResetTime(tierInfo?.end_time || tierInfo?.period_start);
    const normalizedTier = `${tierInfo?.tier || 'free'}`.toLowerCase();
    const isFreeTier = normalizedTier === 'free';
    const isUpgradeDisabled = normalizedTier === 'pro' || normalizedTier === 'admin';
    const queryUsageText = normalizedTier === 'admin'
        ? 'INF/INF'
        : (tierLoading ? '--/--' : `${quotaUsed}/${quotaLimit}`);

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

    const refreshTierInfo = async () => {
        const result = await getMyTier();
        if (result.success) {
            setTierInfo(result.data || null);
        }
    };

    const handleUpgradeToAdmin = async () => {
        const passcode = adminPasscode.trim();
        if (!passcode) {
            setAdminActionError('Enter admin password first.');
            setAdminActionMessage('');
            return;
        }

        setAdminActionLoading(true);
        setAdminActionError('');
        setAdminActionMessage('');

        const result = await upgradeToAdmin(passcode);
        if (result.success) {
            setAdminActionMessage(result.message || 'Upgraded to admin tier.');
            await refreshTierInfo();
        } else {
            setAdminActionError(result.message || 'Failed to upgrade to admin tier.');
        }

        setAdminActionLoading(false);
    };

    return (
        <div className="account-page">
            <div className="settings-wrapper">
                <nav className="settings-nav">
                    <button
                        type="button"
                        className="settings-nav-header"
                        onClick={() => navigate('/')}
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
                        Testing Functions
                    </button>
                </nav>

                <div className="settings-content">
                    <div className="settings-inner">
                        {activeTab === 'account' ? (
                            <>
                                <div className="flat-row">
                                    <div className="flat-row-main">
                                        <div className="card-avatar" aria-hidden="true">
                                            <PersonIcon className="card-avatar-icon" />
                                        </div>
                                        <div>
                                            <div className="flat-name">{displayName}</div>
                                            <div className="flat-sub">{email}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flat-row">
                                    <div className="flat-field">
                                        <div className="flat-label">Display Name</div>
                                        <div className="flat-value">{displayName}</div>
                                    </div>
                                    <button type="button" className="flat-btn" onClick={openNameModal}>
                                        Change name
                                    </button>
                                </div>

                                <div className="flat-row">
                                    <div className="flat-field">
                                        <div className="flat-label">Email</div>
                                        <div className="flat-value">{email}</div>
                                    </div>
                                </div>

                                <h2 className="settings-title">Subscription</h2>
                                <div className="settings-divider"></div>

                                <div className="flat-row">
                                    <div className="flat-field">
                                        <div className="flat-label-row">
                                            <div className="flat-label">Your Subscription</div>
                                            <span className="plan-badge">{formatTierLabel(tierInfo?.tier)}</span>
                                        </div>
                                        {isFreeTier ? (
                                            <div className="flat-value">
                                                Upgrade to Pro for unlimited access to GLKB's full research capabilities.
                                            </div>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        className="flat-btn dark"
                                        disabled={isUpgradeDisabled}
                                        onClick={() => {
                                            if (isUpgradeDisabled) return;
                                            navigate('/about#pricing');
                                        }}
                                    >
                                        Upgrade plan
                                    </button>
                                </div>

                                <div className="flat-row">
                                    <div className="flat-field">
                                        <div className="subscription-inline-meta">
                                            <span className="flat-label subscription-inline-label">Usage Resets</span>
                                            <span className="flat-value subscription-inline-value">{tierLoading ? 'Loading...' : usageResetText}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flat-row flat-row-no-border">
                                    <div className="flat-field">
                                        <div className="subscription-inline-meta">
                                            <span className="flat-label subscription-inline-label">Queries per month</span>
                                            <span className="flat-value subscription-inline-value">
                                                {queryUsageText}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flat-row subscription-progress-row">
                                    <div className="flat-field">
                                        <div className="subscription-progress" role="progressbar" aria-valuemin={0} aria-valuemax={quotaLimit || 100} aria-valuenow={quotaUsed}>
                                            <div
                                                className="subscription-progress-fill"
                                                style={{ width: `${usagePercent}%` }}
                                            />
                                        </div>
                                        <div className="subscription-progress-footer">
                                            <span>{tierLoading ? '-- used' : `${quotaUsed} used`}</span>
                                            <span>{tierLoading ? '-- remaining' : `${quotaRemaining} remaining`}</span>
                                        </div>
                                    </div>
                                </div>

                                <h2 className="settings-title">System</h2>
                                <div className="settings-divider"></div>

                                <div className="flat-row">
                                    <div className="flat-field">
                                        <div className="flat-label">Sign Out</div>
                                        <div className="flat-value">You are signed in as {displayName}</div>
                                    </div>
                                    <button type="button" className="flat-btn" onClick={() => setShowSignoutModal(true)}>
                                        Sign out
                                    </button>
                                </div>

                                <div className="flat-row">
                                    <div className="flat-field">
                                        <div className="flat-label">Delete Account</div>
                                        <div className="flat-sub">Permanently delete your account and data</div>
                                    </div>
                                    <button type="button" className="flat-btn" onClick={() => setShowDeleteModal(true)}>
                                        Learn more
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 className="settings-title settings-title-first">Testing Functions</h2>
                                <div className="settings-divider"></div>

                                <div className="flat-row">
                                    <div className="flat-field">
                                        <div className="flat-label">Admin Password</div>
                                        <input
                                            className="settings-inline-input"
                                            type="password"
                                            value={adminPasscode}
                                            onChange={(event) => setAdminPasscode(event.target.value)}
                                            placeholder="Enter admin password"
                                        />
                                        {adminActionMessage ? <div className="flat-sub settings-inline-success">{adminActionMessage}</div> : null}
                                        {adminActionError ? <div className="flat-sub settings-inline-error">{adminActionError}</div> : null}
                                    </div>
                                    <button
                                        type="button"
                                        className="flat-btn dark"
                                        onClick={handleUpgradeToAdmin}
                                        disabled={adminActionLoading}
                                    >
                                        {adminActionLoading ? 'Upgrading...' : 'Upgrade to Admin'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

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

            {toastMessage && (
                <div className="success-toast" role="status">
                    {toastMessage}
                </div>
            )}
        </div>
    );
};

export default AccountPage;
