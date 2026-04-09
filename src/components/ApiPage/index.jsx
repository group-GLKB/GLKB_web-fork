import './scoped.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Check as CheckIcon,
  Close as CloseIcon,
  ContentCopyOutlined as ContentCopyOutlinedIcon,
  Edit as EditIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';

import { ReactComponent as AddIcon } from '../../img/navbar/add.svg';
import {
  ReactComponent as CodeBlocksIcon,
} from '../../img/navbar/code_blocks.svg';
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  updateApiKeyName,
  updateApiKeyStatus,
} from '../../service/ApiKeys';

const API_DOCS_TAB = 'api-docs';
const API_KEYS_TAB = 'api-keys';
const API_USAGE_TAB = 'api-usage';
const SHOW_API_USAGE_TAB = true;

const tabs = [
    { id: API_DOCS_TAB, label: 'API Docs' },
    { id: API_KEYS_TAB, label: 'API Keys' },
    { id: API_USAGE_TAB, label: 'Usage' },
];

const subtitleByTab = {
    [API_DOCS_TAB]: 'Browse the GLKB API documentation without leaving the app.',
    [API_KEYS_TAB]: 'Manage authentication keys for GLKB API access.',
    [API_USAGE_TAB]: 'Track your request volume and usage limits.',
};

const maskKeyValue = (value) => {
    if (!value) return '';
    if (value.includes('****') || value.includes('...')) return value;
    const tail = value.slice(-4);
    const lastUnderscore = value.lastIndexOf('_');
    const prefix = lastUnderscore >= 0 ? value.slice(0, lastUnderscore + 1) : value.slice(0, 6);
    return `${prefix}****${tail}`;
};

const formatDateYmd = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
};

const formatRelativeTime = (value) => {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const diffMs = Date.now() - date.getTime();
    const seconds = Math.max(0, Math.floor(diffMs / 1000));
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    return formatDateYmd(value);
};

const formatUsageInteger = (value) => Number(value || 0).toLocaleString('en-US');

const formatUsageCost = (value) => Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const normalizeKey = (entry) => ({
    ...entry,
    value: maskKeyValue(entry.value),
    statusLabel: entry.status === 1 ? 'Active' : 'Inactive',
    createdLabel: formatDateYmd(entry.created),
    lastUsedLabel: formatRelativeTime(entry.last_used),
});

const ApiPage = () => {
    const [activeTab, setActiveTab] = useState(API_KEYS_TAB);
    const [keys, setKeys] = useState([]);
    const [loadingKeys, setLoadingKeys] = useState(false);
    const [keysError, setKeysError] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createError, setCreateError] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [createdKey, setCreatedKey] = useState(null);
    const [editOpen, setEditOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editError, setEditError] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [statusUpdatingId, setStatusUpdatingId] = useState(null);
    const [isCopySuccess, setIsCopySuccess] = useState(false);
    const copySuccessTimerRef = useRef(null);

    const keyCounts = useMemo(() => {
        const total = keys.length;
        const active = keys.filter((entry) => entry.status === 1).length;
        return { total, active };
    }, [keys]);

    const usageRows = useMemo(() => (
        keys.map((entry) => ({
            ...entry,
            requests: 1000,
            token: 100000,
            apiCost: 100,
            queryCount: 10000,
        }))
    ), [keys]);

    const visibleTabs = useMemo(
        () => tabs.filter((tab) => SHOW_API_USAGE_TAB || tab.id !== API_USAGE_TAB),
        []
    );

    const activeTabLabel = useMemo(() => {
        const matched = visibleTabs.find((tab) => tab.id === activeTab);
        return matched ? matched.label : '';
    }, [activeTab, visibleTabs]);

    const loadKeys = async () => {
        setLoadingKeys(true);
        setKeysError('');
        try {
            const data = await listApiKeys();
            const normalized = Array.isArray(data) ? data.map(normalizeKey) : [];
            setKeys(normalized);
        } catch (error) {
            setKeysError(error.response?.data?.detail || 'Unable to load API keys.');
        } finally {
            setLoadingKeys(false);
        }
    };

    useEffect(() => {
        if (activeTab === API_KEYS_TAB || activeTab === API_USAGE_TAB) {
            loadKeys();
        }
    }, [activeTab]);

    const handleCreateSubmit = async () => {
        const trimmed = createName.trim();
        if (!trimmed) {
            setCreateError('Please enter a key name.');
            return;
        }
        setCreateLoading(true);
        setCreateError('');
        try {
            const data = await createApiKey(trimmed);
            setCreatedKey({
                name: data.name,
                value: data.value,
            });
            setCreateName('');
            await loadKeys();
        } catch (error) {
            setCreateError(error.response?.data?.detail || 'Unable to create API key.');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleStatusToggle = async (entry) => {
        const nextStatus = entry.status === 1 ? 0 : 1;
        setStatusUpdatingId(entry.id);
        try {
            await updateApiKeyStatus(entry.id, nextStatus);
            await loadKeys();
        } catch (error) {
            setKeysError(error.response?.data?.detail || 'Unable to update key status.');
        } finally {
            setStatusUpdatingId(null);
        }
    };

    const handleDelete = (entry) => {
        setDeleteTarget(entry);
        setDeleteOpen(true);
    };

    const handleDeleteSubmit = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            await deleteApiKey(deleteTarget.id);
            setDeleteOpen(false);
            setDeleteTarget(null);
            await loadKeys();
        } catch (error) {
            setKeysError(error.response?.data?.detail || 'Unable to delete API key.');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleDeleteClose = () => {
        if (deleteLoading) return;
        setDeleteOpen(false);
        setDeleteTarget(null);
    };

    const handleEdit = (entry) => {
        setEditTarget(entry);
        setEditName(entry.name || '');
        setEditError('');
        setEditOpen(true);
    };

    const handleEditSubmit = async () => {
        const trimmed = editName.trim();
        if (!trimmed) {
            setEditError('Please enter a key name.');
            return;
        }
        if (!editTarget) return;
        setEditLoading(true);
        setEditError('');
        try {
            await updateApiKeyName(editTarget.id, trimmed);
            setEditOpen(false);
            setEditTarget(null);
            await loadKeys();
        } catch (error) {
            setEditError(error.response?.data?.detail || 'Unable to update API key.');
        } finally {
            setEditLoading(false);
        }
    };

    const handleCopy = async (value) => {
        try {
            await navigator.clipboard.writeText(value);
            setIsCopySuccess(true);
            if (copySuccessTimerRef.current) {
                window.clearTimeout(copySuccessTimerRef.current);
            }
            copySuccessTimerRef.current = window.setTimeout(() => {
                setIsCopySuccess(false);
                copySuccessTimerRef.current = null;
            }, 1400);
        } catch (error) {
            setIsCopySuccess(false);
            setKeysError('Copy failed. Please copy the key manually.');
        }
    };

    useEffect(() => {
        if (createOpen && createdKey) return;
        setIsCopySuccess(false);
        if (!copySuccessTimerRef.current) return;
        window.clearTimeout(copySuccessTimerRef.current);
        copySuccessTimerRef.current = null;
    }, [createOpen, createdKey]);

    useEffect(() => () => {
        if (!copySuccessTimerRef.current) return;
        window.clearTimeout(copySuccessTimerRef.current);
    }, []);

    return (
        <div className="api-page">
            <Box className="api-body">
                <Box className="api-content">
                    <Box className="api-header">
                        <Box className="api-title-row">
                            <CodeBlocksIcon className="api-icon" style={{ width: 36, height: 36, color: '#164563' }} />
                            <Typography sx={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontWeight: 600,
                                fontSize: '32px',
                                color: '#164563',
                            }}>
                                API
                            </Typography>
                        </Box>
                        <Box className="api-tabs-row">
                            <Tabs
                                className="api-tabs"
                                value={activeTab}
                                onChange={(_, value) => setActiveTab(value)}
                                variant="scrollable"
                                allowScrollButtonsMobile
                                TabIndicatorProps={{
                                    sx: {
                                        backgroundColor: '#155DFC',
                                        height: 2,
                                    },
                                }}
                                sx={{
                                    minHeight: 0,
                                    '& .MuiTabs-flexContainer': {
                                        gap: '12px',
                                    },
                                    '& .MuiTab-root': {
                                        textTransform: 'none',
                                        fontFamily: 'DM Sans, sans-serif',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#164563',
                                        minHeight: 32,
                                        minWidth: 0,
                                        padding: '12px 24px',
                                    },
                                    '& .MuiTab-root.Mui-selected': {
                                        color: '#155DFC',
                                    },
                                }}
                            >
                                {visibleTabs.map((tab) => (
                                    <Tab key={tab.id} value={tab.id} label={tab.label} />
                                ))}
                            </Tabs>
                        </Box>
                        <Typography sx={{
                            marginTop: '36px',
                            marginBottom: '12px',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 700,
                            fontSize: '24px',
                            color: '#164563',
                        }}>
                            {activeTabLabel}
                        </Typography>
                        <Typography className="api-section-subtitle">
                            {subtitleByTab[activeTab]}
                        </Typography>
                    </Box>
                    {activeTab === API_DOCS_TAB && (
                        <>
                            <Box className="api-frame-wrap">
                                <iframe
                                    className="api-frame"
                                    title="GLKB API Documentation"
                                    src="https://glkb.dcmb.med.umich.edu/docs"
                                    loading="lazy"
                                />
                            </Box>
                            <Typography className="api-note">
                                If the docs do not load, your browser may block embedding for security reasons.
                            </Typography>
                        </>
                    )}
                    {activeTab === API_KEYS_TAB && (
                        <>
                            <Box className="api-keys-toolbar">
                                <div className="api-keys-count">
                                    <span>{keyCounts.total} keys</span>
                                    <span className="api-keys-dot" />
                                    <span>{keyCounts.active} active</span>
                                </div>
                                <button className="api-keys-create" type="button" onClick={() => {
                                    setCreateOpen(true);
                                    setCreatedKey(null);
                                    setCreateError('');
                                }}>
                                    <AddIcon className="api-keys-create-icon" />
                                    Create new secret key
                                </button>
                            </Box>
                            {keysError && (
                                <div className="api-keys-error" role="alert">
                                    <span>{keysError}</span>
                                    <button
                                        type="button"
                                        className="api-keys-error-close"
                                        onClick={() => setKeysError('')}
                                        aria-label="Dismiss"
                                    >
                                        <CloseIcon fontSize="small" />
                                    </button>
                                </div>
                            )}
                            <div className="api-keys-table-wrap">
                                <div className="api-keys-table">
                                    <div className="api-keys-table-row api-keys-table-header">
                                        <span className="api-keys-col api-keys-col--name">Name</span>
                                        <span className="api-keys-col api-keys-col--key">Key</span>
                                        <span className="api-keys-col api-keys-col--created">Created</span>
                                        <span className="api-keys-col api-keys-col--last-used">Last Used</span>
                                        <span className="api-keys-col api-keys-col--status">Status</span>
                                        <span className="api-keys-col api-keys-col--actions">Actions</span>
                                    </div>
                                    {loadingKeys && (
                                        <div className="api-keys-table-row api-keys-table-empty">
                                            Loading keys...
                                        </div>
                                    )}
                                    {!loadingKeys && keys.length === 0 && (
                                        <div className="api-keys-table-row api-keys-table-empty">
                                            No API keys yet.
                                        </div>
                                    )}
                                    {!loadingKeys && keys.map((entry) => (
                                        <div className="api-keys-table-row" key={entry.id}>
                                            <span className="api-keys-col api-keys-col--name">{entry.name}</span>
                                            <span className="api-keys-col api-keys-col--key">
                                                <span className={`api-keys-key-pill ${entry.status === 1 ? 'is-active' : 'is-inactive'}`}>
                                                    {entry.value}
                                                </span>
                                            </span>
                                            <span className="api-keys-col api-keys-col--created">{entry.createdLabel}</span>
                                            <span className="api-keys-col api-keys-col--last-used">{entry.lastUsedLabel}</span>
                                            <span className="api-keys-col api-keys-col--status">
                                                <span className={`api-keys-status ${entry.status === 1 ? 'is-active' : ''}`}>
                                                    {entry.statusLabel}
                                                </span>
                                            </span>
                                            <span className="api-keys-col api-keys-col--actions">
                                                <button
                                                    type="button"
                                                    className="api-keys-action is-icon"
                                                    onClick={() => handleEdit(entry)}
                                                    aria-label="Edit"
                                                >
                                                    <EditIcon fontSize="small" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="api-keys-action"
                                                    onClick={() => handleStatusToggle(entry)}
                                                    disabled={statusUpdatingId === entry.id}
                                                >
                                                    {entry.status === 1 ? 'Disable' : 'Enable'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="api-keys-action is-danger"
                                                    onClick={() => handleDelete(entry)}
                                                >
                                                    Delete
                                                </button>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="api-keys-notice">
                                <div className="api-keys-notice-icon">
                                    <SecurityIcon className="api-keys-notice-icon-svg" />
                                </div>
                                <span>
                                    <span className="api-keys-notice-label">Security notice</span>
                                    : Never expose API keys in client-side code or public repos. Use server-side environment variables.
                                </span>
                            </div>
                        </>
                    )}
                    {SHOW_API_USAGE_TAB && activeTab === API_USAGE_TAB && (
                        <>
                            <Box className="api-keys-toolbar">
                                <div className="api-keys-count">
                                    <span>{keyCounts.total} keys</span>
                                    <span className="api-keys-dot" />
                                    <span>{keyCounts.active} active</span>
                                </div>
                                <div className="api-usage-balance">
                                    <span className="api-usage-balance-label">BALANCE:</span>
                                    <span className="api-usage-balance-value">$999.00</span>
                                </div>
                            </Box>
                            {keysError && (
                                <div className="api-keys-error" role="alert">
                                    <span>{keysError}</span>
                                    <button
                                        type="button"
                                        className="api-keys-error-close"
                                        onClick={() => setKeysError('')}
                                        aria-label="Dismiss"
                                    >
                                        <CloseIcon fontSize="small" />
                                    </button>
                                </div>
                            )}
                            <div className="api-keys-table-wrap">
                                <div className="api-keys-table api-usage-table">
                                    <div className="api-keys-table-row api-keys-table-header api-usage-table-row">
                                        <span className="api-keys-col api-keys-col--name">Name</span>
                                        <span className="api-keys-col api-keys-col--key">Key</span>
                                        <span className="api-keys-col api-keys-col--status">Status</span>
                                        <span className="api-keys-col">Requests</span>
                                        <span className="api-keys-col">Token</span>
                                        <span className="api-keys-col">API Cost</span>
                                        <span className="api-keys-col">Query Count</span>
                                    </div>
                                    {loadingKeys && (
                                        <div className="api-keys-table-row api-keys-table-empty">
                                            Loading usage...
                                        </div>
                                    )}
                                    {!loadingKeys && usageRows.length === 0 && (
                                        <div className="api-keys-table-row api-keys-table-empty">
                                            No usage records yet.
                                        </div>
                                    )}
                                    {!loadingKeys && usageRows.map((entry) => {
                                        const isInactive = entry.status !== 1;
                                        return (
                                            <div className="api-keys-table-row api-usage-table-row" key={`usage-${entry.id}`}>
                                                <span className="api-keys-col api-keys-col--name">{entry.name}</span>
                                                <span className="api-keys-col api-keys-col--key">
                                                    <span className={`api-keys-key-pill ${entry.status === 1 ? 'is-active' : 'is-inactive'}`}>
                                                        {entry.value}
                                                    </span>
                                                </span>
                                                <span className="api-keys-col api-keys-col--status">
                                                    <span className={`api-keys-status ${entry.status === 1 ? 'is-active' : ''}`}>
                                                        {entry.statusLabel}
                                                    </span>
                                                </span>
                                                <span className={`api-usage-metric${isInactive ? ' is-inactive' : ''}`}>{formatUsageInteger(entry.requests)}</span>
                                                <span className={`api-usage-metric${isInactive ? ' is-inactive' : ''}`}>{formatUsageInteger(entry.token)}</span>
                                                <span className={`api-usage-metric${isInactive ? ' is-inactive' : ''}`}>${formatUsageCost(entry.apiCost)}</span>
                                                <span className={`api-usage-metric${isInactive ? ' is-inactive' : ''}`}>{formatUsageInteger(entry.queryCount)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                    <Dialog
                        open={createOpen}
                        onClose={() => setCreateOpen(false)}
                        className="api-keys-dialog-root"
                        maxWidth={false}
                    >
                        <DialogTitle className="api-keys-dialog-title">
                            <div className="api-keys-dialog-header">
                                <span>{createdKey ? 'Save your key' : 'Create New API Key'}</span>
                                <button
                                    type="button"
                                    className="api-keys-dialog-close"
                                    onClick={() => setCreateOpen(false)}
                                    aria-label="Close"
                                >
                                    <CloseIcon fontSize="small" />
                                </button>
                            </div>
                        </DialogTitle>
                        <DialogContent className="api-keys-dialog">
                            {!createdKey && (
                                <div className="api-keys-field">
                                    <label className="api-keys-field-label" htmlFor="api-key-name">
                                        Key name
                                    </label>
                                    <TextField
                                        id="api-key-name"
                                        autoFocus
                                        fullWidth
                                        value={createName}
                                        onChange={(event) => setCreateName(event.target.value)}
                                        placeholder="e.g. Production Server"
                                        error={Boolean(createError)}
                                        helperText={createError}
                                        FormHelperTextProps={{ className: 'api-keys-field-error' }}
                                        InputProps={{ className: 'api-keys-input' }}
                                    />
                                    <div className="api-keys-field-hint">Your key will be shown once after creation</div>
                                </div>
                            )}
                            {createdKey && (
                                <div className="api-keys-created">
                                    <p className="api-keys-created-description">
                                        Please save your secret key in a safe place since <strong>you won&apos;t be able to view it again</strong>. Keep it secure, as
                                        anyone with your API key can make requests on your behalf. If you do lose it, you&apos;ll need to generate a new one.
                                    </p>
                                    <div className="api-keys-created-key-row">
                                        <div className="api-keys-created-key">{createdKey.value}</div>
                                        <button
                                            type="button"
                                            className="api-keys-copy-button"
                                            onClick={() => handleCopy(createdKey.value)}
                                        >
                                            {isCopySuccess ? (
                                                <>
                                                    <CheckIcon fontSize="small" />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <ContentCopyOutlinedIcon fontSize="small" />
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="api-keys-created-permissions">
                                        <div className="api-keys-created-permissions-label">Permissions</div>
                                        <div className="api-keys-created-permissions-value">Read and write API resources</div>
                                    </div>
                                </div>
                            )}
                        </DialogContent>
                        <DialogActions className="api-keys-dialog-actions">
                            {!createdKey && (
                                <Button
                                    onClick={() => setCreateOpen(false)}
                                    className="api-keys-dialog-button"
                                    variant="outlined"
                                >
                                    Cancel
                                </Button>
                            )}
                            {!createdKey && (
                                <Button
                                    onClick={handleCreateSubmit}
                                    disabled={createLoading}
                                    className="api-keys-dialog-button is-primary"
                                    variant="contained"
                                >
                                    Create Key
                                </Button>
                            )}
                            {createdKey && (
                                <Button
                                    onClick={() => setCreateOpen(false)}
                                    className="api-keys-dialog-button is-secondary"
                                    variant="contained"
                                >
                                    Done
                                </Button>
                            )}
                        </DialogActions>
                    </Dialog>

                    <Dialog
                        open={deleteOpen}
                        onClose={handleDeleteClose}
                        className="api-keys-dialog-root"
                        maxWidth={false}
                    >
                        <DialogTitle className="api-keys-dialog-title">
                            <div className="api-keys-dialog-header">
                                <span>Delete API Key</span>
                                <button
                                    type="button"
                                    className="api-keys-dialog-close"
                                    onClick={handleDeleteClose}
                                    aria-label="Close"
                                    disabled={deleteLoading}
                                >
                                    <CloseIcon fontSize="small" />
                                </button>
                            </div>
                        </DialogTitle>
                        <DialogContent className="api-keys-dialog">
                            <Typography
                                sx={{
                                    fontFamily: 'DM Sans, sans-serif',
                                    fontSize: '14px',
                                    lineHeight: 1.6,
                                    color: '#164563',
                                }}
                            >
                                Are you sure you want to delete
                                {' '}
                                <strong>{deleteTarget?.name || 'this API key'}</strong>
                                ? This action cannot be undone.
                            </Typography>
                        </DialogContent>
                        <DialogActions className="api-keys-dialog-actions">
                            <Button
                                onClick={handleDeleteClose}
                                className="api-keys-dialog-button"
                                variant="outlined"
                                disabled={deleteLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeleteSubmit}
                                disabled={deleteLoading}
                                className="api-keys-dialog-button is-primary is-danger"
                                variant="contained"
                            >
                                Delete
                            </Button>
                        </DialogActions>
                    </Dialog>

                    <Dialog
                        open={editOpen}
                        onClose={() => setEditOpen(false)}
                        className="api-keys-dialog-root"
                        maxWidth={false}
                    >
                        <DialogTitle className="api-keys-dialog-title">
                            <div className="api-keys-dialog-header">
                                <span>Rename API Key</span>
                                <button
                                    type="button"
                                    className="api-keys-dialog-close"
                                    onClick={() => setEditOpen(false)}
                                    aria-label="Close"
                                >
                                    <CloseIcon fontSize="small" />
                                </button>
                            </div>
                        </DialogTitle>
                        <DialogContent className="api-keys-dialog">
                            <div className="api-keys-field">
                                <label className="api-keys-field-label" htmlFor="api-key-edit-name">
                                    Key name
                                </label>
                                <TextField
                                    id="api-key-edit-name"
                                    autoFocus
                                    fullWidth
                                    value={editName}
                                    onChange={(event) => setEditName(event.target.value)}
                                    placeholder="e.g. Production Server"
                                    error={Boolean(editError)}
                                    helperText={editError}
                                    FormHelperTextProps={{ className: 'api-keys-field-error' }}
                                    InputProps={{ className: 'api-keys-input' }}
                                />
                            </div>
                        </DialogContent>
                        <DialogActions className="api-keys-dialog-actions">
                            <Button
                                onClick={() => setEditOpen(false)}
                                className="api-keys-dialog-button"
                                variant="outlined"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleEditSubmit}
                                disabled={editLoading}
                                className="api-keys-dialog-button is-primary"
                                variant="contained"
                            >
                                Save
                            </Button>
                        </DialogActions>
                    </Dialog>
                </Box>
            </Box>
        </div>
    );
};

export default ApiPage;
