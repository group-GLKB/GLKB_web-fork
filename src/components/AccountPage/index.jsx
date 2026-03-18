import './scoped.css';

import React, {
    useEffect,
    useRef,
    useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
    Close as CloseIcon,
    Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../Auth/AuthContext';

const getSessionValue = (key) => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(key) || '';
};

const setSessionValue = (key, value) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(key, value);
};

const AccountPage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const avatarInputRef = useRef(null);
    const [displayName, setDisplayName] = useState(() => getSessionValue('account_display_name'));
    const [email, setEmail] = useState(() => getSessionValue('account_email'));
    const [avatarData, setAvatarData] = useState(() => getSessionValue('account_avatar'));
    const [avatarDraft, setAvatarDraft] = useState('');
    const [nameDraft, setNameDraft] = useState('');
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showSignoutModal, setShowSignoutModal] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

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

    const openAvatarModal = () => {
        setAvatarDraft(avatarData);
        setShowAvatarModal(true);
    };

    const openNameModal = () => {
        setNameDraft(displayName);
        setShowNameModal(true);
    };

    const handleAvatarFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setAvatarDraft(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSaveAvatar = () => {
        if (avatarDraft) {
            setAvatarData(avatarDraft);
            setSessionValue('account_avatar', avatarDraft);
            setToastMessage('Avatar updated');
            window.dispatchEvent(new Event('glkb-account-updated'));
        }
        setShowAvatarModal(false);
    };

    const handleSaveName = () => {
        const trimmed = nameDraft.trim();
        if (!trimmed) return;
        setDisplayName(trimmed);
        setSessionValue('account_display_name', trimmed);
        setToastMessage('Name updated');
        window.dispatchEvent(new Event('glkb-account-updated'));
        setShowNameModal(false);
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
                    <div className="settings-nav-item active">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Account
                    </div>
                    <div className="settings-nav-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"></path>
                        </svg>
                        Privacy Notice
                    </div>
                </nav>

                <div className="settings-content">
                    <div className="settings-inner">
                        <div className="flat-row">
                            <div className="flat-row-main">
                                <div className="card-avatar" aria-hidden="true">
                                    {avatarData ? (
                                        <img src={avatarData} alt="Account" className="card-avatar-image" />
                                    ) : (
                                        <PersonIcon className="card-avatar-icon" />
                                    )}
                                </div>
                                <div>
                                    <div className="flat-name">{displayName}</div>
                                    <div className="flat-sub">{email}</div>
                                </div>
                            </div>
                            <button type="button" className="flat-btn" onClick={openAvatarModal}>
                                Change avatar
                            </button>
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

                        <h2 className="settings-title">Your Subscription</h2>
                        <div className="settings-divider"></div>

                        <div className="flat-row">
                            <div className="flat-field">
                                <div className="flat-label-row">
                                    <div className="flat-label">Your Subscription</div>
                                    <span className="plan-badge">Free</span>
                                </div>
                                <div className="flat-value">
                                    Upgrade to Pro for unlimited access to GLKB's full research capabilities.
                                </div>
                            </div>
                            <button type="button" className="flat-btn dark">Upgrade plan</button>
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
                    </div>
                </div>
            </div>

            {showAvatarModal && (
                <div
                    className="modal-backdrop visible"
                    onClick={(event) => handleBackdropClick(event, () => setShowAvatarModal(false))}
                >
                    <div className="modal">
                        <div className="modal-title">Change Avatar</div>
                        <div className="modal-desc">
                            Upload a new profile photo. It will be visible across your account.
                        </div>
                        <div className="avatar-upload-area">
                            <button
                                type="button"
                                className="avatar-preview"
                                onClick={() => avatarInputRef.current?.click()}
                            >
                                {avatarDraft ? (
                                    <img src={avatarDraft} alt="Avatar preview" />
                                ) : (
                                    <PersonIcon />
                                )}
                            </button>
                            <div className="avatar-upload-info">
                                <button
                                    type="button"
                                    className="flat-btn dark"
                                    onClick={() => avatarInputRef.current?.click()}
                                >
                                    Upload avatar
                                </button>
                                <div className="avatar-hint">
                                    Click the avatar or button to browse. JPG or PNG.
                                </div>
                            </div>
                        </div>
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarFileChange}
                            className="visually-hidden"
                        />
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
                                onClick={handleSaveAvatar}
                                disabled={!avatarDraft}
                            >
                                Save photo
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
