import './scoped.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  ContentCopyOutlined as ContentCopyOutlinedIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  NorthEast as NorthEastIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';

import { SHOW_API_DOCS } from '../../config/features';
import { ReactComponent as AddFundsIcon } from '../../img/api/add_funds.svg';
import { ReactComponent as BillingIcon } from '../../img/api/billing.svg';
import { ReactComponent as ConnectKeyIcon } from '../../img/api/connect_key.svg';
import { ReactComponent as DeleteIcon } from '../../img/api/delete.svg';
import { ReactComponent as InfoIcon } from '../../img/api/info.svg';
import { ReactComponent as RevokeIcon } from '../../img/api/revoke.svg';
import { ReactComponent as SetLimitIcon } from '../../img/api/set_limit.svg';
import { ReactComponent as AddIcon } from '../../img/navbar/add.svg';
import {
  createApiKey,
  deleteApiKey,
  getApiKeyUsage,
  listApiKeys,
  updateApiKeyName,
  updateApiKeyStatus,
} from '../../service/ApiKeys';
import { withServerTimezone } from '../../utils/serverTime';

const isPhoneViewport = () => window.matchMedia('(max-width: 767px)').matches;

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
    // The API writes naive UTC with no designator; `new Date()` would read it as local time.
    // See utils/serverTime.js — a key created at 22:00 UTC showed tomorrow's date without it.
    const date = new Date(withServerTimezone(value));
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
};

const formatRelativeTime = (value) => {
    if (!value) return 'Never';
    const date = new Date(withServerTimezone(value));
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

const formatCompactUsageValue = (value) => Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
});

const formatOptionalUsageInteger = (value) => (
    value == null ? '—' : formatUsageInteger(value)
);

const formatOptionalUsageCost = (value) => (
    value == null ? '—' : `$${formatUsageCost(value)}`
);

const centsToDollars = (value) => Number(value || 0) / 100;

const normalizeKey = (entry) => ({
    ...entry,
    value: maskKeyValue(entry.value),
    statusLabel: entry.status === 1 ? 'Active' : 'Inactive',
    createdLabel: formatDateYmd(entry.created),
    lastUsedLabel: formatRelativeTime(entry.last_used),
});

const ApiPage = () => {
    const navigate = useNavigate();
    const [keys, setKeys] = useState([]);
    const [isPhoneDevice, setIsPhoneDevice] = useState(isPhoneViewport);
    const [mobileDrawerKeyId, setMobileDrawerKeyId] = useState(null);
    const [loadingKeys, setLoadingKeys] = useState(false);
    const [loadingUsage, setLoadingUsage] = useState(false);
    const [keysError, setKeysError] = useState('');
    const [usageSummary, setUsageSummary] = useState({
        apiList: [],
        balanceRemaining: 0,
    });
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
    const [rowMenuAnchorEl, setRowMenuAnchorEl] = useState(null);
    const [rowMenuTarget, setRowMenuTarget] = useState(null);
    const [limitOpen, setLimitOpen] = useState(false);
    const [limitTarget, setLimitTarget] = useState(null);
    const [limitValue, setLimitValue] = useState('');
    const [keyLimits, setKeyLimits] = useState({});
    const copySuccessTimerRef = useRef(null);

    const keyCounts = useMemo(() => {
        const total = keys.length;
        const active = keys.filter((entry) => entry.status === 1).length;
        return { total, active };
    }, [keys]);

    const usageById = useMemo(() => {
        const map = new Map();
        (usageSummary.apiList || [])
            .filter((entry) => Number(entry?.is_delete || 0) !== 1)
            .forEach((entry) => {
                map.set(entry.id, {
                    requests: entry.queries,
                    token: entry.token ?? entry.token_usage,
                    apiCost: centsToDollars(entry.api_costs),
                    queryCount: entry.query_count ?? entry.queries,
                });
            });
        return map;
    }, [usageSummary.apiList]);

    const mergedKeys = useMemo(
        () => keys.map((entry) => ({
            ...entry,
            usage: usageById.get(entry.id) || null,
        })),
        [keys, usageById]
    );

    const usageTotals = useMemo(() => (usageSummary.apiList || [])
        .filter((entry) => Number(entry?.is_delete || 0) !== 1)
        .reduce((acc, entry) => {
            acc.queries += Number(entry.query_count ?? entry.queries ?? 0);
            acc.tokens += Number(entry.token ?? entry.token_usage ?? 0);
            acc.cost += centsToDollars(entry.api_costs);
            return acc;
        }, { queries: 0, tokens: 0, cost: 0 }), [usageSummary.apiList]);

    const mobileDrawerEntry = useMemo(
        () => mergedKeys.find((entry) => entry.id === mobileDrawerKeyId) || null,
        [mergedKeys, mobileDrawerKeyId]
    );

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

    const loadUsage = async () => {
        setLoadingUsage(true);
        try {
            const data = await getApiKeyUsage();
            const apiList = Array.isArray(data?.api_list) ? data.api_list : [];
            setUsageSummary({
                apiList,
                balanceRemaining: centsToDollars(data?.balance_remaining),
            });
        } catch (error) {
            setUsageSummary({ apiList: [], balanceRemaining: 0 });
        } finally {
            setLoadingUsage(false);
        }
    };

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
        if (!isPhoneDevice) {
            setMobileDrawerKeyId(null);
        }
    }, [isPhoneDevice]);

    useEffect(() => {
        loadKeys();
        loadUsage();
    }, []);

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

    const handleRowMenuOpen = (event, entry) => {
        setRowMenuAnchorEl(event.currentTarget);
        setRowMenuTarget(entry);
    };

    const handleRowMenuClose = () => {
        setRowMenuAnchorEl(null);
        setRowMenuTarget(null);
    };

    const handleLimitOpen = (entry) => {
        if (!entry) return;
        setLimitTarget(entry);
        setLimitValue(keyLimits[entry.id] == null ? '' : String(keyLimits[entry.id]));
        setLimitOpen(true);
    };

    const handleLimitClose = () => {
        setLimitOpen(false);
        setLimitTarget(null);
        setLimitValue('');
    };

    const handleLimitSave = () => {
        const parsed = Number(limitValue);
        if (!limitTarget || !Number.isFinite(parsed) || parsed <= 0) return;
        setKeyLimits((current) => ({ ...current, [limitTarget.id]: parsed }));
        handleLimitClose();
    };

    const handleLimitRemove = () => {
        if (!limitTarget) return;
        setKeyLimits((current) => {
            const next = { ...current };
            delete next[limitTarget.id];
            return next;
        });
        handleLimitClose();
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

    const renderUsageCell = (value, formatter = formatUsageInteger) => (
        value === null || value === undefined ? (
            <span className="api-usage-metric-empty">—</span>
        ) : (
            <span className="api-usage-metric">{formatter(value)}</span>
        )
    );

    return (
        <div className="api-page">
            <Box className="api-body">
                <Box className="api-content">
                    <Box className="api-header">
                        <Box className="api-header-top">
                            <Box className="api-header-titles">
                                <Typography className="api-title">API Dashboard</Typography>
                                <Typography className="api-subtitle">
                                    Manage keys and monitor usage for GLKB API access.
                                </Typography>
                            </Box>
                            {SHOW_API_DOCS && (
                                <Button
                                    className="api-docs-button"
                                    onClick={() => navigate('/api-docs/overview')}
                                    startIcon={<NorthEastIcon sx={{ fontSize: 16 }} />}
                                >
                                    API Docs
                                </Button>
                            )}
                        </Box>
                    </Box>

                    <Box className="api-section">
                        <Box className="api-keys-toolbar">
                            <div className="api-keys-count-row">
                                <Typography className="api-section-title">Keys</Typography>
                                <span className="api-keys-count-pill">
                                    {keyCounts.total} key{keyCounts.total === 1 ? '' : 's'} &middot; {keyCounts.active} active
                                </span>
                            </div>
                            <div className="api-keys-toolbar-actions">
                                <button className="api-toolbar-action" type="button" disabled>
                                    <ConnectKeyIcon />
                                    Connect key
                                </button>
                                <button
                                    className="api-toolbar-action api-keys-create"
                                    type="button"
                                    onClick={() => {
                                        setCreateOpen(true);
                                        setCreatedKey(null);
                                        setCreateError('');
                                    }}
                                >
                                    <AddIcon className="api-keys-create-icon" />
                                    Create key
                                </button>
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

                        {!isPhoneDevice && (
                            <div className="api-keys-table-wrap">
                                <div className="api-keys-table">
                                    <div className="api-keys-table-row api-keys-table-header">
                                        <span className="api-keys-col api-keys-col--key">Key</span>
                                        <span className="api-keys-col">Created</span>
                                        <span className="api-keys-col">Last Used</span>
                                        <span className="api-keys-col">Status</span>
                                        <span className="api-keys-col api-keys-col--metric">Query</span>
                                        <span className="api-keys-col api-keys-col--metric">Request</span>
                                        <span className="api-keys-col api-keys-col--metric">Token</span>
                                        <span className="api-keys-col api-keys-col--metric">Cost</span>
                                        <span className="api-keys-col api-keys-col--actions" />
                                    </div>
                                    {(loadingKeys || loadingUsage) && (
                                        <div className="api-keys-table-row api-keys-table-empty">
                                            Loading keys...
                                        </div>
                                    )}
                                    {!loadingKeys && !loadingUsage && mergedKeys.length === 0 && (
                                        <div className="api-keys-table-row api-keys-table-empty">
                                            No API keys yet.
                                        </div>
                                    )}
                                    {!loadingKeys && !loadingUsage && mergedKeys.map((entry) => (
                                        <div className="api-keys-table-row" key={entry.id}>
                                            <span className="api-keys-col api-keys-col--key">
                                                <span className="api-keys-col--key-name">{entry.name}</span>
                                                <span className="api-keys-col--key-value">{entry.value}</span>
                                            </span>
                                            <span className="api-keys-col">{entry.createdLabel}</span>
                                            <span className="api-keys-col">{entry.lastUsedLabel}</span>
                                            <span className="api-keys-col">
                                                <span className={`api-keys-status ${entry.status === 1 ? 'is-active' : ''}`}>
                                                    {entry.statusLabel}
                                                </span>
                                            </span>
                                            <span className="api-keys-col api-keys-col--metric">
                                                {renderUsageCell(entry.usage?.queryCount)}
                                            </span>
                                            <span className="api-keys-col api-keys-col--metric">
                                                {renderUsageCell(entry.usage?.requests)}
                                            </span>
                                            <span className="api-keys-col api-keys-col--metric">
                                                {renderUsageCell(entry.usage?.token)}
                                            </span>
                                            <span className="api-keys-col api-keys-col--metric">
                                                {renderUsageCell(entry.usage?.apiCost, formatUsageCost)}
                                            </span>
                                            <span className="api-keys-col api-keys-col--actions">
                                                <IconButton
                                                    size="small"
                                                    className="api-keys-row-menu-button"
                                                    onClick={(event) => handleRowMenuOpen(event, entry)}
                                                    aria-label="Row actions"
                                                >
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isPhoneDevice && (
                            <>
                                <div className="api-keys-mobile-list" role="list">
                                    {(loadingKeys || loadingUsage) && (
                                        <div className="api-keys-mobile-empty">Loading keys...</div>
                                    )}
                                    {!loadingKeys && !loadingUsage && mergedKeys.length === 0 && (
                                        <div className="api-keys-mobile-empty">No API keys yet.</div>
                                    )}
                                    {!loadingKeys && !loadingUsage && mergedKeys.map((entry) => (
                                        <div className="api-keys-mobile-item" key={entry.id} role="listitem">
                                            <button
                                                type="button"
                                                className="api-keys-mobile-row"
                                                onClick={() => setMobileDrawerKeyId(entry.id)}
                                            >
                                                <span className="api-keys-mobile-main">
                                                    <span className="api-keys-mobile-name">{entry.name}</span>
                                                    <span className="api-keys-mobile-key">{entry.value}</span>
                                                </span>
                                                <span className="api-keys-mobile-side">
                                                    <span className={`api-keys-status ${entry.status === 1 ? 'is-active' : ''}`}>
                                                        {entry.statusLabel}
                                                    </span>
                                                    <span className="api-keys-mobile-last-used">{entry.lastUsedLabel}</span>
                                                </span>
                                                <ChevronRightIcon className="api-keys-mobile-chevron" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="api-keys-mobile-toolbar">
                                    <button type="button" disabled>
                                        <ConnectKeyIcon />
                                        Connect key
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreateOpen(true);
                                            setCreatedKey(null);
                                            setCreateError('');
                                        }}
                                    >
                                        <AddIcon />
                                        Create key
                                    </button>
                                </div>
                            </>
                        )}

                        {isPhoneDevice && (
                            <Drawer
                                anchor="bottom"
                                open={Boolean(mobileDrawerEntry)}
                                onClose={() => setMobileDrawerKeyId(null)}
                                ModalProps={{
                                    BackdropProps: {
                                        sx: { backgroundColor: 'rgba(0, 0, 0, 0.32)' },
                                    },
                                }}
                                PaperProps={{ className: 'api-keys-mobile-page-drawer' }}
                            >
                                {mobileDrawerEntry && (
                                    <div className="api-keys-mobile-page-drawer-body">
                                        <div className="api-keys-mobile-page-drawer-handle" aria-hidden="true" />
                                        <div className="api-keys-mobile-page-drawer-header">
                                            <div className="api-keys-mobile-page-drawer-head-main">
                                                <span className="api-keys-mobile-page-drawer-heading">
                                                    <span className="api-keys-mobile-page-drawer-title-line">
                                                        <span className="api-keys-mobile-page-drawer-title">{mobileDrawerEntry.name}</span>
                                                        <button
                                                            type="button"
                                                            className="api-keys-action is-icon"
                                                            onClick={() => {
                                                                setMobileDrawerKeyId(null);
                                                                handleEdit(mobileDrawerEntry);
                                                            }}
                                                            aria-label="Edit API key"
                                                        >
                                                            <EditIcon fontSize="small" />
                                                        </button>
                                                    </span>
                                                    <span className="api-keys-mobile-page-drawer-key">{mobileDrawerEntry.value}</span>
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="api-keys-dialog-close"
                                                onClick={() => setMobileDrawerKeyId(null)}
                                                aria-label="Close"
                                            >
                                                <CloseIcon fontSize="small" />
                                            </button>
                                        </div>
                                        <div className="api-keys-mobile-detail-grid">
                                            <div className="api-keys-mobile-detail-card">
                                                <span className="api-keys-mobile-label">Status <ChevronRightIcon /></span>
                                                <span className={`api-keys-mobile-value is-status ${mobileDrawerEntry.status === 1 ? 'is-active' : ''}`}>
                                                    <span className="api-keys-mobile-value-status-dot" />{mobileDrawerEntry.statusLabel}
                                                </span>
                                            </div>
                                            <div className="api-keys-mobile-detail-card">
                                                <span className="api-keys-mobile-label">Limit <ChevronRightIcon /></span>
                                                <span className="api-keys-mobile-value">—</span>
                                            </div>
                                            <div className="api-keys-mobile-detail-card">
                                                <span className="api-keys-mobile-label">Last used</span>
                                                <span className="api-keys-mobile-value">{mobileDrawerEntry.lastUsedLabel}</span>
                                            </div>
                                            <div className="api-keys-mobile-detail-card">
                                                <span className="api-keys-mobile-label">Created</span>
                                                <span className="api-keys-mobile-value">{mobileDrawerEntry.createdLabel}</span>
                                            </div>
                                            <div className="api-keys-mobile-detail-card">
                                                <span className="api-keys-mobile-label">Query</span>
                                                <span className="api-keys-mobile-value">{formatOptionalUsageInteger(mobileDrawerEntry.usage?.queryCount)}</span>
                                            </div>
                                            <div className="api-keys-mobile-detail-card">
                                                <span className="api-keys-mobile-label">Request</span>
                                                <span className="api-keys-mobile-value">{formatOptionalUsageInteger(mobileDrawerEntry.usage?.requests)}</span>
                                            </div>
                                            <div className="api-keys-mobile-detail-card">
                                                <span className="api-keys-mobile-label">Token</span>
                                                <span className="api-keys-mobile-value">{formatOptionalUsageInteger(mobileDrawerEntry.usage?.token)}</span>
                                            </div>
                                            <div className="api-keys-mobile-detail-card">
                                                <span className="api-keys-mobile-label">Cost</span>
                                                <span className="api-keys-mobile-value">{formatOptionalUsageCost(mobileDrawerEntry.usage?.apiCost)}</span>
                                            </div>
                                        </div>
                                        <div className="api-keys-mobile-actions">
                                            <button
                                                type="button"
                                                className="api-keys-action"
                                                onClick={() => setMobileDrawerKeyId(null)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                className="api-keys-action is-danger"
                                                onClick={() => {
                                                    setMobileDrawerKeyId(null);
                                                    handleDelete(mobileDrawerEntry);
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </Drawer>
                        )}
                    </Box>

                    <Box className="api-section">
                        <Box className="api-usage-toolbar">
                            <Typography className="api-section-title">Usage this month</Typography>
                            <div className="api-usage-actions api-usage-actions--desktop">
                                <button type="button" disabled>
                                    <AddFundsIcon />
                                    Add funds
                                </button>
                                <button type="button" disabled>
                                    <BillingIcon />
                                    Billing
                                </button>
                            </div>
                        </Box>
                        <div className="api-usage-stats-grid">
                            <div className="api-usage-stat-tile">
                                <span className="api-usage-stat-label">Total Queries</span>
                                <span className="api-usage-stat-value">{formatUsageInteger(usageTotals.queries)}</span>
                            </div>
                            <div className="api-usage-stat-tile">
                                <span className="api-usage-stat-label">Total Tokens</span>
                                <span className="api-usage-stat-value">{formatUsageInteger(usageTotals.tokens)}</span>
                            </div>
                            <div className="api-usage-stat-tile">
                                <span className="api-usage-stat-label">Total Cost</span>
                                <span className="api-usage-stat-value">
                                    {isPhoneDevice
                                        ? formatCompactUsageValue(usageTotals.cost)
                                        : `$${formatUsageCost(usageTotals.cost)}`}
                                </span>
                            </div>
                            <div className="api-usage-stat-tile">
                                <span className="api-usage-stat-label">Balance</span>
                                <span className="api-usage-stat-value">
                                    ${isPhoneDevice
                                        ? formatCompactUsageValue(usageSummary.balanceRemaining)
                                        : formatUsageCost(usageSummary.balanceRemaining)}
                                </span>
                            </div>
                        </div>
                        {isPhoneDevice && (
                            <div className="api-usage-mobile-actions">
                                <button type="button" disabled>
                                    <AddFundsIcon />
                                    Add funds
                                </button>
                                <button type="button" disabled>
                                    <BillingIcon />
                                    Billing
                                </button>
                            </div>
                        )}
                    </Box>

                    <div className="api-keys-notice">
                        <InfoIcon className="api-keys-notice-icon" />
                        <span>
                            <span className="api-keys-notice-label">Security notice</span>
                            : Never expose API keys in client-side code or public repos. Use server-side environment variables.
                        </span>
                    </div>

                    <Menu
                        anchorEl={rowMenuAnchorEl}
                        open={Boolean(rowMenuAnchorEl)}
                        onClose={handleRowMenuClose}
                        className="api-keys-row-menu"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                        <MenuItem onClick={() => { const target = rowMenuTarget; handleRowMenuClose(); handleLimitOpen(target); }}>
                            <SetLimitIcon className="api-keys-row-menu-icon" />
                            Set limit
                        </MenuItem>
                        <MenuItem
                            onClick={() => { const target = rowMenuTarget; handleRowMenuClose(); handleStatusToggle(target); }}
                            disabled={statusUpdatingId === rowMenuTarget?.id}
                        >
                            <RevokeIcon className="api-keys-row-menu-icon" />
                            {rowMenuTarget?.status === 1 ? 'Revoke' : 'Activate'}
                        </MenuItem>
                        <MenuItem
                            onClick={() => { const target = rowMenuTarget; handleRowMenuClose(); handleDelete(target); }}
                            className="is-danger"
                        >
                            <DeleteIcon className="api-keys-row-menu-icon" />
                            Delete
                        </MenuItem>
                    </Menu>

                    <Dialog
                        open={createOpen}
                        onClose={() => setCreateOpen(false)}
                        className="api-keys-dialog-root"
                        maxWidth={false}
                    >
                        <DialogTitle className="api-keys-dialog-title">
                            <div className="api-keys-dialog-header">
                                <span>{createdKey ? 'Save your key' : 'Create new key'}</span>
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
                                        placeholder="e.g., Production Server"
                                        error={Boolean(createError)}
                                        helperText={createError}
                                        FormHelperTextProps={{ className: 'api-keys-field-error' }}
                                        InputProps={{ className: 'api-keys-input' }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && createName.trim() && !createLoading) {
                                                handleCreateSubmit();
                                            }
                                        }}
                                    />
                                </div>
                            )}
                            {createdKey && (
                                <div className="api-keys-created">
                                    <p className="api-keys-created-description">
                                        Copy and store it securely now. Anyone with it can act on your behalf.
                                        {' '}
                                        <strong>You won&apos;t be able to view this key again.</strong>
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
                                        <span className="api-keys-created-permissions-label">Permissions:</span>
                                        <span className="api-keys-created-permissions-value">Read and write API resources</span>
                                    </div>
                                </div>
                            )}
                        </DialogContent>
                        <DialogActions className={`api-keys-dialog-actions ${!createdKey ? 'api-create-actions' : ''}`}>
                            {!createdKey && (
                                <>
                                    <div className="api-keys-field-hint">Your key will be shown once after creation.</div>
                                    <Button
                                        onClick={handleCreateSubmit}
                                        disabled={createLoading || !createName.trim()}
                                        className="api-keys-dialog-button is-primary"
                                        variant="contained"
                                    >
                                        Next
                                    </Button>
                                </>
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
                                <span>Delete API key</span>
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
                            <Typography className="api-keys-confirm-text">
                                Are you sure you want to delete {deleteTarget?.name || 'this API key'}?
                                <strong>This action can&apos;t be undone.</strong>
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
                        open={limitOpen}
                        onClose={handleLimitClose}
                        className="api-keys-dialog-root api-limit-dialog-root"
                        maxWidth={false}
                    >
                        <DialogTitle className="api-keys-dialog-title">
                            <div className="api-keys-dialog-header">
                                <span>Set limit</span>
                                <button
                                    type="button"
                                    className="api-keys-dialog-close"
                                    onClick={handleLimitClose}
                                    aria-label="Close"
                                >
                                    <CloseIcon fontSize="small" />
                                </button>
                            </div>
                        </DialogTitle>
                        <DialogContent className="api-keys-dialog">
                            <div className="api-limit-target-row">
                                <span>For {limitTarget?.name || 'API key'}</span>
                                <span className="api-limit-target-key">{limitTarget?.value}</span>
                            </div>
                            <div className="api-limit-input-wrap">
                                <span aria-hidden="true">$</span>
                                <input
                                    autoFocus
                                    type="number"
                                    min="0"
                                    step="1"
                                    inputMode="decimal"
                                    value={limitValue}
                                    onChange={(event) => setLimitValue(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' && Number(limitValue) > 0) handleLimitSave();
                                    }}
                                    placeholder="Enter spend cap here"
                                    aria-label="Spend cap"
                                />
                            </div>
                            <div className="api-limit-hint">
                                {keyLimits[limitTarget?.id] == null
                                    ? 'The key pauses once usage reaches this amount.'
                                    : `Current usage: $${formatUsageCost(limitTarget?.usage?.apiCost)} of $${formatCompactUsageValue(keyLimits[limitTarget?.id])}`}
                            </div>
                        </DialogContent>
                        <DialogActions className="api-keys-dialog-actions">
                            <Button onClick={handleLimitClose} className="api-keys-dialog-button is-secondary">
                                Cancel
                            </Button>
                            {keyLimits[limitTarget?.id] != null && (
                                <Button onClick={handleLimitRemove} className="api-keys-dialog-button is-secondary">
                                    Remove Limit
                                </Button>
                            )}
                            <Button
                                onClick={handleLimitSave}
                                disabled={!Number.isFinite(Number(limitValue)) || Number(limitValue) <= 0}
                                className="api-keys-dialog-button is-primary"
                            >
                                Save
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
