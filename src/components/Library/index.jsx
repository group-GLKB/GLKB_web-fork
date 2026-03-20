import './scoped.css';

import React, {
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    Navigate,
    useLocation,
    useNavigate,
} from 'react-router-dom';

import {
    Bookmark as BookmarkIcon,
    ChevronRight as ChevronRightIcon,
    DeleteOutline as DeleteOutlineIcon,
    DriveFileRenameOutline as DriveFileRenameOutlineIcon,
    FileCopyOutlined as FileCopyOutlinedIcon,
    FilterListOutlined as FilterListOutlinedIcon,
    FolderOutlined as FolderOutlinedIcon,
    FormatQuoteOutlined as FormatQuoteOutlinedIcon,
    MoreHoriz as MoreHorizIcon,
} from '@mui/icons-material';
import {
    Box,
    Button as MuiButton,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';

import { ReactComponent as FolderOpenIcon } from '../../img/folder_open.svg';
import { ReactComponent as AddIcon } from '../../img/navbar/add.svg';
import { ReactComponent as BookIcon } from '../../img/navbar/book_4.svg';
import {
    createFavoriteFolder,
    duplicateFavoriteFolder,
    getFavoriteFolder,
    listFavoriteFolders,
    removeFavoriteFolder,
    updateFavoriteChatFolder,
    updateFavoriteFolder,
    updateFavoriteGraphFolder,
    updateFavoriteReferenceFolder,
} from '../../service/Favorites';
import {
    fetchBookmarks,
    getBookmarks,
    toggleBookmark,
} from '../../utils/bookmarks';
import {
    setActiveConversationId,
    updateConversationTitle,
} from '../../utils/chatHistory';
import {
    fetchConversationBookmarks,
    getConversationBookmarks,
    toggleConversationBookmark,
} from '../../utils/conversationBookmarks';
import {
    fetchGraphBookmarks,
    getGraphBookmarks,
    toggleGraphBookmark,
} from '../../utils/graphBookmarks';
import { useAuth } from '../Auth/AuthContext';
import nodeStyleColors from '../Graph/nodeStyleColors.json';
import CiteDialog from '../Units/CiteDialog';
import ConversationCard from '../Units/ConversationCard';

const ALL_TAB = 'all';
const REFERENCES_TAB = 'references';
const CHATS_TAB = 'chats';
const GRAPHS_TAB = 'graphs';
const ENTRY_PREVIEW_LIMIT = 5;
const DEFAULT_FOLDER_NAME = 'New Folder';

const getConversationTitle = (conversation) => (
    conversation?.leadingTitle || conversation?.title || 'New Chat'
);

const getConversationSubtitle = (conversation) => {
    const count = typeof conversation?.messageCount === 'number'
        ? conversation.messageCount
        : 0;
    return `${count} ${count === 1 ? 'message' : 'messages'}`;
};

const getReferenceSubtitle = (entry) => {
    const journal = entry?.journal || '';
    const year = entry?.year || '';
    if (journal && year) return `${journal} - ${year}`;
    if (journal) return journal;
    if (year) return year;
    return entry?.authors || '';
};

const buildReferenceCitation = (entry) => ([
    entry?.title || '',
    entry?.url || '',
    entry?.citation_count ?? 0,
    entry?.year ?? '',
    entry?.journal || '',
    entry?.authors || '',
]);

const hexToRgb = (hex) => {
    if (!hex) return { r: 0, g: 0, b: 0 };
    const cleaned = hex.replace('#', '');
    const normalized = cleaned.length === 3
        ? cleaned.split('').map((char) => `${char}${char}`).join('')
        : cleaned;
    const value = parseInt(normalized, 16);
    if (Number.isNaN(value)) return { r: 0, g: 0, b: 0 };
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
};

const rgbToHex = (r, g, b) => {
    const toHex = (value) => value.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixHex = (baseHex, mixHexValue, amount) => {
    const base = hexToRgb(baseHex);
    const mix = hexToRgb(mixHexValue);
    const ratio = Math.min(Math.max(amount, 0), 1);
    const r = Math.round(base.r * (1 - ratio) + mix.r * ratio);
    const g = Math.round(base.g * (1 - ratio) + mix.g * ratio);
    const b = Math.round(base.b * (1 - ratio) + mix.b * ratio);
    return rgbToHex(r, g, b);
};

const toRgba = (hex, alpha) => {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getPillColors = (label) => {
    const base = nodeStyleColors[label] || nodeStyleColors.default || '#E5E5E5';
    return {
        base,
        background: mixHex(base, '#ffffff', 0.75),
        text: mixHex(base, '#000000', 0.35),
        shadow: toRgba(base, 0.3),
    };
};

const getUniqueFolderName = (existingFolders, baseName = DEFAULT_FOLDER_NAME) => {
    const names = new Set(
        (existingFolders || [])
            .map((folder) => (folder?.name || '').trim())
            .filter(Boolean)
    );

    if (!names.has(baseName)) return baseName;
    let index = 1;
    while (names.has(`${baseName} ${index}`)) {
        index += 1;
    }
    return `${baseName} ${index}`;
};

const normalizeFolderChat = (session) => {
    const hid = session?.hid ?? session?.id;
    const messages = Array.isArray(session?.messages) ? session.messages : [];
    if (!hid) return null;
    return {
        id: String(hid),
        hid,
        leadingTitle: session?.leading_title || session?.title || 'New Chat',
        title: session?.leading_title || session?.title || 'New Chat',
        createdAt: session?.created_at || null,
        updatedAt: session?.last_accessed_time || session?.updatedAt || session?.created_at || null,
        messageCount: session?.message_count ?? messages.length,
        messages,
    };
};

const normalizeFolderReference = (entry) => {
    const ref = entry?.ref_json || entry;
    const pmid = ref?.pmid || entry?.pmid || entry?.id || '';
    const authors = Array.isArray(ref?.authors)
        ? ref.authors.join(', ')
        : (ref?.authors || '');
    if (!pmid && !ref?.url) return null;
    return {
        id: String(pmid || ref?.url || ''),
        pmid: pmid ? String(pmid) : '',
        title: ref?.title || '',
        url: ref?.url || '',
        citation_count: ref?.n_citation ?? ref?.citation_count ?? 0,
        year: ref?.date ?? ref?.year ?? '',
        journal: ref?.journal || '',
        authors,
        evidence: Array.isArray(ref?.evidence) ? ref.evidence : [],
        source_hid: entry?.source_hid ?? ref?.source_hid ?? null,
        created_at: entry?.created_at || null,
        ref_json: ref,
    };
};

const normalizeFolderGraph = (entry) => {
    if (!entry) return null;
    const ghid = entry?.ghid ?? entry?.id;
    if (!ghid) return null;
    return {
        id: String(ghid),
        ghid,
        title: entry?.title || '',
        endpointType: entry?.endpoint_type || entry?.endpointType || '',
        createdAt: entry?.created_at || entry?.createdAt || null,
        updatedAt: entry?.last_accessed_time || entry?.updatedAt || entry?.created_at || entry?.createdAt || null,
        terms: Array.isArray(entry?.terms) ? entry.terms : [],
    };
};

const LibraryReferenceCard = ({ entry, onOpen, onRemoveBookmark, onCite, onManageFolders }) => {
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const isMenuOpen = Boolean(menuAnchorEl);
    const authors = entry?.authors || '';
    const pmid = entry?.pmid || '';
    const journal = entry?.journal || '';
    const year = entry?.year || '';
    const hasMetaRow = Boolean(journal || year);

    const handleOpenMenu = (event) => {
        event.stopPropagation();
        setMenuAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchorEl(null);
    };

    const handleRemoveBookmark = () => {
        handleCloseMenu();
        if (onRemoveBookmark) {
            onRemoveBookmark(entry);
        }
    };

    const handleCite = () => {
        handleCloseMenu();
        if (onCite) {
            onCite(entry);
        }
    };

    const handleManageFolders = () => {
        handleCloseMenu();
        if (onManageFolders) {
            onManageFolders(entry);
        }
    };

    return (
        <Box className="history-item-row">
            <div
                role="button"
                tabIndex={0}
                className="history-item"
                onClick={() => {
                    if (onOpen) {
                        onOpen(entry);
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (onOpen) {
                            onOpen(entry);
                        }
                    }
                }}
            >
                <Box className="history-item-content" sx={{ gap: '4px' }}>
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        height: '21px',
                    }}>
                        {pmid ? (
                            <Typography sx={{
                                color: '#969696',
                                fontSize: '14px',
                                fontWeight: 700,
                            }}>
                                PubMed ID: {pmid}
                            </Typography>
                        ) : (
                            <span />
                        )}
                        <IconButton
                            size="small"
                            className="history-item-more"
                            onClick={handleOpenMenu}
                            aria-label="Open reference menu"
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '8px',
                                color: '#164563',
                            }}
                        >
                            <MoreHorizIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Box>
                    <Typography sx={{
                        color: '#323232',
                        fontWeight: 600,
                        fontSize: '16px',
                        display: 'block',
                        wordBreak: 'break-word',
                    }}>
                        {entry?.title || 'Untitled reference'}
                    </Typography>
                    {authors && (
                        <Box sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px',
                            fontSize: '14px',
                            fontWeight: 400,
                            fontStyle: 'italic',
                            color: '#969696',
                        }}>
                            {authors}
                        </Box>
                    )}
                    {hasMetaRow && (
                        <Box
                            className="library-reference-meta"
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '12px',
                            }}
                        >
                            <Typography sx={{
                                fontSize: '14px',
                                fontWeight: 400,
                                color: '#323232',
                                wordBreak: 'break-word',
                                flex: 1,
                            }} title="Journal">
                                {journal}
                            </Typography>
                            {year && (
                                <Typography
                                    className="library-reference-year"
                                    sx={{
                                        fontSize: '14px',
                                        fontWeight: 400,
                                        color: '#323232',
                                        flexShrink: 0,
                                    }}
                                >
                                    {year}
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            </div>
            <Menu
                anchorEl={menuAnchorEl}
                open={isMenuOpen}
                onClose={handleCloseMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                MenuListProps={{
                    sx: {
                        py: 0.5,
                    },
                }}
                PaperProps={{
                    sx: {
                        minWidth: 176,
                        borderRadius: 2,
                        boxShadow: '0px 4px 6px -2px rgba(16,24,40,0.03), 0px 12px 16px -4px rgba(16,24,40,0.08)',
                        '& .MuiMenuItem-root': {
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#164563',
                            py: 0.75,
                            px: 1.25,
                        },
                    },
                }}
            >
                <MenuItem onClick={handleRemoveBookmark}>
                    <ListItemIcon sx={{ minWidth: 26, color: '#164563' }}>
                        <BookmarkIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>
                        Remove bookmark
                    </ListItemText>
                </MenuItem>
                {onManageFolders && (
                    <MenuItem onClick={handleManageFolders}>
                        <ListItemIcon sx={{ minWidth: 26, color: '#164563' }}>
                            <FolderOutlinedIcon sx={{ fontSize: 18 }} />
                        </ListItemIcon>
                        <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>
                            Add to folder
                        </ListItemText>
                    </MenuItem>
                )}
                <MenuItem onClick={handleCite}>
                    <ListItemIcon sx={{ minWidth: 26, color: '#164563' }}>
                        <FormatQuoteOutlinedIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>
                        Cite
                    </ListItemText>
                </MenuItem>
            </Menu>
        </Box>
    );
};

const LibraryFolderCard = ({ folder, onDelete, onDuplicate, onRename, onOpen }) => {
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const isMenuOpen = Boolean(menuAnchorEl);

    const handleOpenMenu = (event) => {
        event.stopPropagation();
        setMenuAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchorEl(null);
    };

    const handleOpen = () => {
        if (onOpen) {
            onOpen(folder);
        }
    };

    return (
        <div
            className="library-folder-card"
            role="button"
            tabIndex={0}
            onClick={handleOpen}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleOpen();
                }
            }}
        >
            <div className="library-folder-top">
                <div className="library-folder-icon">
                    <FolderOpenIcon className="library-folder-icon-image" />
                </div>
                <div className="library-folder-menu-slot">
                    <IconButton
                        size="small"
                        className="library-folder-menu"
                        onClick={handleOpenMenu}
                        aria-label="Open folder menu"
                        sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '8px',
                            color: '#164563',
                        }}
                    >
                        <MoreHorizIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </div>
            </div>
            <div className="library-folder-title" title={folder?.name || ''}>
                {folder?.name || 'Untitled folder'}
            </div>
            <div className="library-folder-meta">
                {folder?.chat_count ?? 0} chats / {folder?.ref_count ?? 0} references
            </div>
            <Menu
                anchorEl={menuAnchorEl}
                open={isMenuOpen}
                onClose={handleCloseMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                MenuListProps={{
                    sx: {
                        py: 0.5,
                    },
                }}
                PaperProps={{
                    sx: {
                        minWidth: 176,
                        borderRadius: 2,
                        boxShadow: '0px 4px 6px -2px rgba(16,24,40,0.03), 0px 12px 16px -4px rgba(16,24,40,0.08)',
                        '& .MuiMenuItem-root': {
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#164563',
                            py: 0.75,
                            px: 1.25,
                        },
                    },
                }}
            >
                <MenuItem
                    onClick={() => {
                        handleCloseMenu();
                        if (onRename) {
                            onRename(folder);
                        }
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 26, color: '#164563' }}>
                        <DriveFileRenameOutlineIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>
                        Rename
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        handleCloseMenu();
                        if (onDuplicate) {
                            onDuplicate(folder);
                        }
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 26, color: '#164563' }}>
                        <FileCopyOutlinedIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>
                        Duplicate
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        handleCloseMenu();
                        if (onDelete) {
                            onDelete(folder);
                        }
                    }}
                    sx={{ color: '#B42318 !important' }}
                >
                    <ListItemIcon sx={{ minWidth: 26, color: '#B42318' }}>
                        <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: {
                                color: '#B42318',
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '13px',
                                fontWeight: 500,
                            },
                        }}
                    >
                        Delete
                    </ListItemText>
                </MenuItem>
            </Menu>
        </div>
    );
};

const Library = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [bookmarks, setBookmarks] = useState([]);
    const [conversationBookmarks, setConversationBookmarks] = useState([]);
    const [graphBookmarks, setGraphBookmarks] = useState([]);
    const [folders, setFolders] = useState([]);
    const [folderDetail, setFolderDetail] = useState(null);
    const [folderDetailLoading, setFolderDetailLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(ALL_TAB);
    const [citeDialogOpen, setCiteDialogOpen] = useState(false);
    const [selectedCitation, setSelectedCitation] = useState(null);
    const [folderDialogOpen, setFolderDialogOpen] = useState(false);
    const [folderDialogName, setFolderDialogName] = useState('');
    const [folderRenameTarget, setFolderRenameTarget] = useState(null);
    const [folderPickerOpen, setFolderPickerOpen] = useState(false);
    const [folderPickerItem, setFolderPickerItem] = useState(null);
    const [folderPickerType, setFolderPickerType] = useState('chat');
    const [folderPickerSelections, setFolderPickerSelections] = useState({});
    const [folderPickerInitial, setFolderPickerInitial] = useState({});
    const [folderPickerLoading, setFolderPickerLoading] = useState(false);
    const { isAuthenticated, loading } = useAuth();

    const [selectedFolderId, setSelectedFolderId] = useState(() => {
        const params = new URLSearchParams(location.search);
        return params.get('folder');
    });
    const isFolderView = Boolean(selectedFolderId);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setSelectedFolderId(params.get('folder'));
    }, [location.search]);

    useEffect(() => {
        if (loading || !isAuthenticated) {
            setBookmarks([]);
            return undefined;
        }

        let isMounted = true;
        fetchBookmarks()
            .then((list) => {
                if (!isMounted) return;
                setBookmarks(list);
            })
            .catch(() => {
                if (!isMounted) return;
                setBookmarks(getBookmarks());
            });

        return () => {
            isMounted = false;
        };
    }, [isAuthenticated, loading]);

    useEffect(() => {
        if (loading || !isAuthenticated) {
            setConversationBookmarks([]);
            return undefined;
        }

        let isMounted = true;
        const update = (event) => {
            const next = event?.detail || getConversationBookmarks();
            if (!isMounted) return;
            setConversationBookmarks(next);
        };

        fetchConversationBookmarks()
            .then((list) => {
                if (!isMounted) return;
                setConversationBookmarks(list);
            })
            .catch(() => update());

        window.addEventListener('glkb-conversation-bookmarks-updated', update);
        return () => {
            isMounted = false;
            window.removeEventListener('glkb-conversation-bookmarks-updated', update);
        };
    }, [isAuthenticated, loading]);

    useEffect(() => {
        if (loading || !isAuthenticated) {
            setGraphBookmarks([]);
            return undefined;
        }

        let isMounted = true;
        const update = (event) => {
            const next = event?.detail || getGraphBookmarks();
            if (!isMounted) return;
            setGraphBookmarks(next);
        };

        fetchGraphBookmarks()
            .then((list) => {
                if (!isMounted) return;
                setGraphBookmarks(list);
            })
            .catch(() => update());

        window.addEventListener('glkb-graph-bookmarks-updated', update);
        return () => {
            isMounted = false;
            window.removeEventListener('glkb-graph-bookmarks-updated', update);
        };
    }, [isAuthenticated, loading]);

    useEffect(() => {
        if (loading || !isAuthenticated) {
            setFolders([]);
            return undefined;
        }

        let isMounted = true;
        listFavoriteFolders()
            .then((data) => {
                if (!isMounted) return;
                const list = Array.isArray(data?.folders) ? data.folders : [];
                setFolders(list);
            })
            .catch(() => {
                if (!isMounted) return;
                setFolders([]);
            });

        return () => {
            isMounted = false;
        };
    }, [isAuthenticated, loading]);

    useEffect(() => {
        if (!selectedFolderId || loading || !isAuthenticated) {
            setFolderDetail(null);
            setFolderDetailLoading(false);
            return undefined;
        }

        let isMounted = true;
        setFolderDetailLoading(true);
        getFavoriteFolder(selectedFolderId)
            .then((data) => {
                if (!isMounted) return;
                setFolderDetail(data);
                setFolderDetailLoading(false);
            })
            .catch(() => {
                if (!isMounted) return;
                setFolderDetail(null);
                setFolderDetailLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [selectedFolderId, isAuthenticated, loading]);

    const handleCiteClick = (citation) => {
        setSelectedCitation(citation);
        setCiteDialogOpen(true);
    };

    const handleCloseCiteDialog = () => {
        setCiteDialogOpen(false);
        setSelectedCitation(null);
    };

    const handleOpenConversation = (conversationId) => {
        if (!conversationId) return;
        setActiveConversationId(String(conversationId));
        navigate('/chat', { state: { conversationId: String(conversationId) } });
    };

    const handleBookmarkConversation = async (conversation) => {
        if (!conversation) return;
        const entry = {
            id: String(conversation.id),
            title: getConversationTitle(conversation),
            updatedAt: conversation.updatedAt || new Date().toISOString(),
            messageCount: conversation.messageCount ?? 0,
        };
        try {
            const next = await toggleConversationBookmark(entry);
            setConversationBookmarks(next);
        } catch (error) {
            setConversationBookmarks(getConversationBookmarks());
        }
    };

    const handleBookmarkGraph = async (graph) => {
        if (!graph) return;
        const entry = {
            id: String(graph.ghid ?? graph.id),
            ghid: graph.ghid ?? graph.id,
            title: graph.title || '',
            endpointType: graph.endpointType || graph.endpoint_type || '',
            updatedAt: graph.updatedAt || graph.createdAt || new Date().toISOString(),
        };
        try {
            const next = await toggleGraphBookmark(entry, graph.terms || []);
            setGraphBookmarks(next);
        } catch (error) {
            setGraphBookmarks(getGraphBookmarks());
        }
    };

    const handleRenameConversation = async (conversation, nextTitle) => {
        if (!conversation?.id) return;
        try {
            await updateConversationTitle(String(conversation.id), nextTitle);
        } catch (error) {
            // Ignore rename failures.
        }
        setConversationBookmarks((prev) => (
            prev.map((item) => (
                String(item.id) === String(conversation.id)
                    ? { ...item, title: nextTitle, leadingTitle: nextTitle }
                    : item
            ))
        ));
    };

    const refreshFolders = async () => {
        try {
            const data = await listFavoriteFolders();
            const list = Array.isArray(data?.folders) ? data.folders : [];
            setFolders(list);
        } catch (error) {
            setFolders([]);
        }
    };

    const handleOpenFolderDialog = (folder = null) => {
        setFolderRenameTarget(folder);
        setFolderDialogName(folder?.name || '');
        setFolderDialogOpen(true);
    };

    const handleCloseFolderDialog = () => {
        setFolderDialogOpen(false);
        setFolderDialogName('');
        setFolderRenameTarget(null);
    };

    const handleSaveFolderDialog = async () => {
        const trimmed = folderDialogName.trim();
        if (!trimmed && folderRenameTarget?.fid) {
            handleCloseFolderDialog();
            return;
        }
        const nameToUse = trimmed || getUniqueFolderName(folders);
        try {
            if (folderRenameTarget?.fid) {
                await updateFavoriteFolder(folderRenameTarget.fid, nameToUse);
            } else {
                await createFavoriteFolder(nameToUse);
            }
            await refreshFolders();
        } catch (error) {
            // Ignore folder save failures.
        }
        handleCloseFolderDialog();
    };

    const handleDeleteFolder = async (folder) => {
        if (!folder?.fid) return;
        try {
            await removeFavoriteFolder(folder.fid);
            await refreshFolders();
        } catch (error) {
            // Ignore delete failures.
        }
    };

    const handleDuplicateFolder = async (folder) => {
        if (!folder?.fid) return;
        try {
            await duplicateFavoriteFolder(folder.fid);
            await refreshFolders();
        } catch (error) {
            // Ignore duplicate failures.
        }
    };

    const openFolderPicker = async (item, type) => {
        setFolderPickerItem(item);
        setFolderPickerType(type);
        setFolderPickerOpen(true);
        setFolderPickerLoading(true);

        const membership = {};
        const tasks = folders.map(async (folder) => {
            if (!folder?.fid) return;
            try {
                const detail = await getFavoriteFolder(folder.fid);
                if (type === 'chat') {
                    const sessions = Array.isArray(detail?.sessions) ? detail.sessions : [];
                    const match = sessions.some((session) => String(session?.hid ?? session?.id ?? '') === String(item?.id));
                    membership[folder.fid] = match;
                } else if (type === 'graph') {
                    const graphs = Array.isArray(detail?.graphs)
                        ? detail.graphs
                        : (Array.isArray(detail?.graph_histories) ? detail.graph_histories : []);
                    const match = graphs.some((graph) => String(graph?.ghid ?? graph?.id ?? '') === String(item?.ghid ?? item?.id ?? ''));
                    membership[folder.fid] = match;
                } else {
                    const references = Array.isArray(detail?.references) ? detail.references : [];
                    const match = references.some((ref) => String(ref?.pmid ?? ref?.id ?? '') === String(item?.pmid ?? item?.id ?? ''));
                    membership[folder.fid] = match;
                }
            } catch (error) {
                membership[folder.fid] = false;
            }
        });

        await Promise.all(tasks);
        setFolderPickerSelections(membership);
        setFolderPickerInitial(membership);
        setFolderPickerLoading(false);
    };

    const handleCloseFolderPicker = () => {
        setFolderPickerOpen(false);
        setFolderPickerItem(null);
        setFolderPickerSelections({});
        setFolderPickerInitial({});
    };

    const handleToggleFolderSelection = (fid) => {
        setFolderPickerSelections((prev) => ({
            ...prev,
            [fid]: !prev?.[fid],
        }));
    };

    const handleSaveFolderAssignments = async () => {
        const item = folderPickerItem;
        if (!item) {
            handleCloseFolderPicker();
            return;
        }

        const updates = folders.map((folder) => {
            const fid = folder?.fid;
            if (!fid) return null;
            const wasSelected = Boolean(folderPickerInitial?.[fid]);
            const isSelected = Boolean(folderPickerSelections?.[fid]);
            if (wasSelected === isSelected) return null;
            return { fid, action: isSelected ? 'add' : 'remove' };
        }).filter(Boolean);

        try {
            await Promise.all(updates.map(({ fid, action }) => (
                folderPickerType === 'chat'
                    ? updateFavoriteChatFolder(String(item?.id ?? ''), fid, action)
                    : folderPickerType === 'graph'
                        ? updateFavoriteGraphFolder(String(item?.ghid ?? item?.id ?? ''), fid, action)
                        : updateFavoriteReferenceFolder(String(item?.pmid ?? item?.id ?? ''), fid, action)
            )));
            await refreshFolders();
        } catch (error) {
            // Ignore folder assignment failures.
        }

        handleCloseFolderPicker();
    };

    const handleOpenReference = (entry) => {
        if (!entry?.url) return;
        window.open(entry.url, '_blank');
    };

    const handleRemoveReferenceBookmark = async (entry) => {
        if (!entry) return;
        try {
            const next = await toggleBookmark(entry, { sourceHid: entry.source_hid });
            setBookmarks(next);
        } catch (error) {
            setBookmarks(getBookmarks());
        }
    };

    const handleCiteReference = (entry) => {
        handleCiteClick(buildReferenceCitation(entry));
    };

    const handleManageChatFolders = (conversation) => {
        openFolderPicker(conversation, 'chat');
    };

    const handleManageReferenceFolders = (entry) => {
        openFolderPicker(entry, 'reference');
    };

    const handleManageGraphFolders = (graph) => {
        openFolderPicker(graph, 'graph');
    };

    const handleTabClick = (tab) => {
        setActiveTab(tab);
    };

    const handleShowMore = (tab) => {
        setActiveTab(tab);
    };

    const handleSelectFolder = (folderId) => {
        const nextId = folderId ? String(folderId) : null;
        setSelectedFolderId(nextId);
        if (nextId) {
            navigate(`/library?folder=${nextId}`, { replace: true });
        } else {
            navigate('/library', { replace: true });
        }
    };

    const folderChats = useMemo(() => {
        if (!isFolderView || !folderDetail) return [];
        const sessions = Array.isArray(folderDetail?.sessions) ? folderDetail.sessions : [];
        return sessions.map(normalizeFolderChat).filter(Boolean);
    }, [folderDetail, isFolderView]);

    const folderReferences = useMemo(() => {
        if (!isFolderView || !folderDetail) return [];
        const references = Array.isArray(folderDetail?.references) ? folderDetail.references : [];
        return references.map(normalizeFolderReference).filter(Boolean);
    }, [folderDetail, isFolderView]);

    const folderGraphs = useMemo(() => {
        if (!isFolderView || !folderDetail) return [];
        const graphs = Array.isArray(folderDetail?.graphs)
            ? folderDetail.graphs
            : (Array.isArray(folderDetail?.graph_histories) ? folderDetail.graph_histories : []);
        return graphs
            .map(normalizeFolderGraph)
            .map((graph) => {
                if (!graph) return null;
                if (graph.terms?.length) return graph;
                const cached = graphBookmarks.find((item) => String(item.id) === String(graph.id));
                return cached?.terms?.length ? { ...graph, terms: cached.terms } : graph;
            })
            .filter(Boolean);
    }, [folderDetail, graphBookmarks, isFolderView]);

    const shouldLimitPreviews = !isFolderView && activeTab === ALL_TAB;
    const showChatsSection = activeTab === ALL_TAB || activeTab === CHATS_TAB;
    const showReferencesSection = activeTab === ALL_TAB || activeTab === REFERENCES_TAB;
    const showGraphsSection = activeTab === ALL_TAB || activeTab === GRAPHS_TAB;
    const visibleChats = isFolderView
        ? (showChatsSection ? folderChats : [])
        : (showChatsSection
            ? (shouldLimitPreviews ? conversationBookmarks.slice(0, ENTRY_PREVIEW_LIMIT) : conversationBookmarks)
            : []);
    const visibleReferences = isFolderView
        ? (showReferencesSection ? folderReferences : [])
        : (showReferencesSection
            ? (shouldLimitPreviews ? bookmarks.slice(0, ENTRY_PREVIEW_LIMIT) : bookmarks)
            : []);
    const visibleGraphs = isFolderView
        ? (showGraphsSection ? folderGraphs : [])
        : (showGraphsSection
            ? (shouldLimitPreviews ? graphBookmarks.slice(0, ENTRY_PREVIEW_LIMIT) : graphBookmarks)
            : []);
    const showMoreChats = shouldLimitPreviews && conversationBookmarks.length > ENTRY_PREVIEW_LIMIT;
    const showMoreReferences = shouldLimitPreviews && bookmarks.length > ENTRY_PREVIEW_LIMIT;
    const showMoreGraphs = shouldLimitPreviews && graphBookmarks.length > ENTRY_PREVIEW_LIMIT;
    const allItemsCount = conversationBookmarks.length + bookmarks.length + graphBookmarks.length;
    const getFolderItemCount = (folder) => (
        (folder?.chat_count ?? 0)
        + (folder?.ref_count ?? 0)
        + (folder?.graph_count ?? 0)
    );
    const tabs = [
        { id: ALL_TAB, label: 'All' },
        { id: REFERENCES_TAB, label: 'Reference' },
        { id: GRAPHS_TAB, label: 'Explore' },
        { id: CHATS_TAB, label: 'AI Chat' },
    ];

    if (loading) {
        return null;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="library-page">
            <CiteDialog
                open={citeDialogOpen}
                onClose={handleCloseCiteDialog}
                citation={selectedCitation}
            />
            <Dialog
                open={folderDialogOpen}
                onClose={handleCloseFolderDialog}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle sx={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 600,
                    fontSize: '18px',
                }}>
                    {folderRenameTarget ? 'Rename Folder' : 'New Folder'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        margin="dense"
                        label="Folder name"
                        placeholder={DEFAULT_FOLDER_NAME}
                        value={folderDialogName}
                        onChange={(event) => setFolderDialogName(event.target.value)}
                        inputProps={{ maxLength: 60 }}
                        sx={{
                            '& .MuiInputBase-input': {
                                fontFamily: 'DM Sans, sans-serif',
                            },
                            '& .MuiInputLabel-root': {
                                fontFamily: 'DM Sans, sans-serif',
                            },
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <MuiButton onClick={handleCloseFolderDialog}>
                        Cancel
                    </MuiButton>
                    <MuiButton
                        onClick={handleSaveFolderDialog}
                        disabled={folderRenameTarget ? !folderDialogName.trim() : false}
                        variant="contained"
                    >
                        Save
                    </MuiButton>
                </DialogActions>
            </Dialog>
            <Dialog
                open={folderPickerOpen}
                onClose={handleCloseFolderPicker}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle sx={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 600,
                    fontSize: '18px',
                }}>
                    Manage folders
                </DialogTitle>
                <DialogContent>
                    {folders.length === 0 ? (
                        <Typography sx={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: '#646464' }}>
                            No folders yet. Create one to organize your bookmarks.
                        </Typography>
                    ) : (
                        folders.map((folder) => (
                            <Box
                                key={folder.fid}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    py: 0.5,
                                }}
                            >
                                <Typography sx={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: '#164563' }}>
                                    {folder.name}
                                </Typography>
                                <Checkbox
                                    size="small"
                                    checked={Boolean(folderPickerSelections?.[folder.fid])}
                                    disabled={folderPickerLoading}
                                    onChange={() => handleToggleFolderSelection(folder.fid)}
                                    sx={{ color: '#155DFC', '&.Mui-checked': { color: '#155DFC' } }}
                                />
                            </Box>
                        ))
                    )}
                </DialogContent>
                <DialogActions>
                    <MuiButton onClick={handleCloseFolderPicker}>
                        Cancel
                    </MuiButton>
                    <MuiButton
                        onClick={handleSaveFolderAssignments}
                        variant="contained"
                        disabled={folderPickerLoading || folders.length === 0}
                    >
                        Save
                    </MuiButton>
                </DialogActions>
            </Dialog>
            <Box className="library-body">
                <Box className="library-folder-manager">
                    <button
                        type="button"
                        className={`library-folder-manager-item${!selectedFolderId ? ' is-active' : ''}`}
                        onClick={() => handleSelectFolder(null)}
                    >
                        <span className="library-folder-manager-icon">
                            <BookIcon style={{ width: 18, height: 18 }} />
                        </span>
                        <span className="library-folder-manager-label">All Items</span>
                        <span className="library-folder-manager-count">{allItemsCount}</span>
                    </button>
                    <Box className="library-folder-manager-section">
                        <div className="library-folder-manager-section-header">
                            <span className="library-folder-manager-section-title">Folders</span>
                            <div className="library-folder-manager-actions">
                                <IconButton
                                    size="small"
                                    aria-label="Filter folders"
                                    className="library-folder-manager-action"
                                    disabled
                                >
                                    <FilterListOutlinedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    aria-label="Add folder"
                                    className="library-folder-manager-action"
                                    onClick={() => handleOpenFolderDialog()}
                                >
                                    <AddIcon style={{ width: 18, height: 18 }} />
                                </IconButton>
                            </div>
                        </div>
                        <div className="library-folder-manager-list">
                            {folders.length > 0 ? (
                                folders.map((folder) => (
                                    <button
                                        key={folder.fid}
                                        type="button"
                                        className={`library-folder-manager-item${String(selectedFolderId) === String(folder.fid) ? ' is-active' : ''}`}
                                        onClick={() => handleSelectFolder(folder.fid)}
                                    >
                                        <span className="library-folder-manager-icon">
                                            <FolderOpenIcon style={{ width: 18, height: 18 }} />
                                        </span>
                                        <span className="library-folder-manager-label">{folder?.name || 'Untitled folder'}</span>
                                        <span className="library-folder-manager-count">{getFolderItemCount(folder)}</span>
                                    </button>
                                ))
                            ) : (
                                <div className="library-folder-manager-empty">No folders yet.</div>
                            )}
                        </div>
                    </Box>
                </Box>
                <Box className="library-content">
                    <Box className="library-header">
                        <Box className="library-title-bar">
                            <Box className="library-title-row">
                                <BookIcon className="library-book-icon" style={{ width: 36, height: 36, color: '#164563' }} />
                                <Typography sx={{
                                    fontFamily: 'DM Sans, sans-serif',
                                    fontWeight: 600,
                                    fontSize: '32px',
                                    color: '#164563',
                                }}>
                                    Library
                                </Typography>
                            </Box>
                        </Box>
                        <Typography sx={{
                            marginTop: '8px',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 500,
                            fontSize: '14px',
                            color: '#646464',
                            textAlign: 'left',
                            width: '100%',
                        }}>
                            Collect papers, explore connections, and organize your research journey.
                        </Typography>
                        <Tabs
                            className="library-tabs"
                            value={activeTab}
                            onChange={(_, value) => handleTabClick(value)}
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
                                '& .MuiTabs-scroller': {
                                    borderBottom: '1px solid #D9D9D9',
                                },
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
                            {tabs.map((tab) => (
                                <Tab key={tab.id} value={tab.id} label={tab.label} />
                            ))}
                        </Tabs>
                    </Box>
                    <Box className="library-scroll">
                        {!isFolderView || !folderDetailLoading ? (
                            showChatsSection && (
                                <Box className="library-section">
                                    <Typography className="library-section-title">
                                        Chats
                                    </Typography>
                                    {visibleChats.length > 0 ? (
                                        <>
                                            <Box className="library-chat-list">
                                                {visibleChats.map((conversation) => (
                                                    <ConversationCard
                                                        key={conversation.id}
                                                        conversation={conversation}
                                                        title={getConversationTitle(conversation)}
                                                        subtitle={getConversationSubtitle(conversation)}
                                                        onOpen={(item) => handleOpenConversation(item.id)}
                                                        onRename={handleRenameConversation}
                                                        onBookmark={handleBookmarkConversation}
                                                        onManageFolders={handleManageChatFolders}
                                                        isBookmarked
                                                        bookmarkLabel="Remove bookmark"
                                                    />
                                                ))}
                                            </Box>
                                            {showMoreChats && (
                                                <button
                                                    type="button"
                                                    className="library-show-more"
                                                    onClick={() => handleShowMore(CHATS_TAB)}
                                                >
                                                    Show More
                                                    <ChevronRightIcon className="library-show-more-arrow" aria-hidden="true" />
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <Typography className="library-empty-text">
                                            {isFolderView
                                                ? 'No chats in this folder yet.'
                                                : 'No saved chats yet. Bookmark a chat to see it here.'}
                                        </Typography>
                                    )}
                                </Box>
                            )
                        ) : null}
                        {!isFolderView || !folderDetailLoading ? (
                            showGraphsSection && (
                                <Box className="library-section">
                                    <Typography className="library-section-title">
                                        Explore
                                    </Typography>
                                    {visibleGraphs.length > 0 ? (
                                        <>
                                            <Box className="library-graph-list">
                                                {visibleGraphs.map((graph) => {
                                                    const fallbackTitle = graph?.title && graph.title !== 'N/A'
                                                        ? graph.title
                                                        : 'Graph search';
                                                    return (
                                                        <ConversationCard
                                                            key={graph.id}
                                                            conversation={graph}
                                                            titleContent={graph?.terms?.length ? (
                                                                <Box className="library-graph-pill-row">
                                                                    {graph.terms.map((term, index) => {
                                                                        const label = term?.name || term?.label || '';
                                                                        if (!label) return null;
                                                                        const colors = getPillColors(term?.type || 'default');
                                                                        return (
                                                                            <Box
                                                                                key={`${graph.id}-pill-${index}`}
                                                                                className="library-graph-pill"
                                                                                sx={{
                                                                                    borderColor: colors.base,
                                                                                    backgroundColor: colors.background,
                                                                                    color: colors.text,
                                                                                    boxShadow: `0px 4px 6px ${colors.shadow}`,
                                                                                }}
                                                                            >
                                                                                <span className="library-graph-pill-label">{label}</span>
                                                                            </Box>
                                                                        );
                                                                    })}
                                                                </Box>
                                                            ) : (
                                                                <Typography className="history-title" sx={{
                                                                    fontFamily: 'DM Sans, sans-serif',
                                                                    fontWeight: 600,
                                                                    fontSize: '16px',
                                                                    color: '#164563',
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                }}>
                                                                    {fallbackTitle}
                                                                </Typography>
                                                            )}
                                                            subtitle=""
                                                            onBookmark={handleBookmarkGraph}
                                                            onManageFolders={handleManageGraphFolders}
                                                            isBookmarked
                                                            bookmarkLabel="Remove bookmark"
                                                        />
                                                    );
                                                })}
                                            </Box>
                                            {showMoreGraphs && (
                                                <button
                                                    type="button"
                                                    className="library-show-more"
                                                    onClick={() => handleShowMore(GRAPHS_TAB)}
                                                >
                                                    Show More
                                                    <ChevronRightIcon className="library-show-more-arrow" aria-hidden="true" />
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <Typography className="library-empty-text">
                                            {isFolderView
                                                ? 'No graph searches in this folder yet.'
                                                : 'No saved graph searches yet. Bookmark an Explore result to see it here.'}
                                        </Typography>
                                    )}
                                </Box>
                            )
                        ) : null}
                        {!isFolderView || !folderDetailLoading ? (
                            showReferencesSection && (
                                <Box className="library-section">
                                    <Typography className="library-section-title">
                                        References
                                    </Typography>
                                    <Box className="library-reference-list">
                                        {visibleReferences.length > 0 ? (
                                            <>
                                                {visibleReferences.map((entry) => (
                                                    <LibraryReferenceCard
                                                        key={entry.id}
                                                        entry={entry}
                                                        onOpen={handleOpenReference}
                                                        onRemoveBookmark={handleRemoveReferenceBookmark}
                                                        onCite={handleCiteReference}
                                                        onManageFolders={handleManageReferenceFolders}
                                                    />
                                                ))}
                                                {showMoreReferences && (
                                                    <button
                                                        type="button"
                                                        className="library-show-more"
                                                        onClick={() => handleShowMore(REFERENCES_TAB)}
                                                    >
                                                        Show More
                                                        <ChevronRightIcon className="library-show-more-arrow" aria-hidden="true" />
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <Typography className="library-empty-text">
                                                {isFolderView
                                                    ? 'No references in this folder yet.'
                                                    : 'No bookmarks yet. Save references to see them here.'}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            )
                        ) : null}
                        {isFolderView && folderDetailLoading && (
                            <Typography className="library-empty-text">
                                Loading folder...
                            </Typography>
                        )}
                        {isFolderView && !folderDetailLoading && !folderDetail && (
                            <Typography className="library-empty-text">
                                Folder not found.
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
        </div>
    );
};

export default Library;
