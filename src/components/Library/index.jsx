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
  TextField,
  Typography,
} from '@mui/material';

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
import { useAuth } from '../Auth/AuthContext';
import CiteDialog from '../Units/CiteDialog';
import ConversationCard from '../Units/ConversationCard';

const ALL_TAB = 'all';
const FOLDERS_TAB = 'folders';
const REFERENCES_TAB = 'references';
const CHATS_TAB = 'chats';
const FOLDER_PREVIEW_LIMIT = 12;
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

const LibraryReferenceCard = ({ entry, onOpen, onRemoveBookmark, onCite, onManageFolders }) => {
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const isMenuOpen = Boolean(menuAnchorEl);
    const authors = entry?.authors || '';

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
                <Box className="history-item-content">
                    <Box className="history-item-title-row">
                        <Typography className="history-title" sx={{
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 600,
                            fontSize: '16px',
                            color: '#164563',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {entry?.title || 'Untitled reference'}
                        </Typography>
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
                    <Typography className="history-subtitle">
                        {getReferenceSubtitle(entry)}
                    </Typography>
                    {authors && (
                        <Typography className="history-timestamp">
                            {authors}
                        </Typography>
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
            <div className="library-folder-title" title={folder?.name || ''}>
                {folder?.name || 'Untitled folder'}
            </div>
            <div className="library-folder-meta">
                {folder?.chat_count ?? 0} chats / {folder?.ref_count ?? 0} references
            </div>
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

    const folderId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('folder');
    }, [location.search]);
    const isFolderView = Boolean(folderId);

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
        if (!folderId || loading || !isAuthenticated) {
            setFolderDetail(null);
            setFolderDetailLoading(false);
            return undefined;
        }

        let isMounted = true;
        setFolderDetailLoading(true);
        getFavoriteFolder(folderId)
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
    }, [folderId, isAuthenticated, loading]);

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

    const handleTabClick = (tab) => {
        if (isFolderView) {
            navigate('/library');
        }
        setActiveTab(tab);
    };

    const handleShowMore = (tab) => {
        setActiveTab(tab);
        if (isFolderView) {
            navigate('/library');
        }
    };

    const handleOpenFolder = (folder) => {
        if (!folder?.fid) return;
        navigate(`/library?folder=${folder.fid}`);
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

    const shouldLimitPreviews = !isFolderView && activeTab === ALL_TAB;
    const visibleFolders = !isFolderView && (activeTab === ALL_TAB || activeTab === FOLDERS_TAB)
        ? (shouldLimitPreviews ? folders.slice(0, FOLDER_PREVIEW_LIMIT) : folders)
        : [];
    const visibleChats = isFolderView
        ? folderChats
        : ((activeTab === ALL_TAB || activeTab === CHATS_TAB)
            ? (shouldLimitPreviews ? conversationBookmarks.slice(0, ENTRY_PREVIEW_LIMIT) : conversationBookmarks)
            : []);
    const visibleReferences = isFolderView
        ? folderReferences
        : ((activeTab === ALL_TAB || activeTab === REFERENCES_TAB)
            ? (shouldLimitPreviews ? bookmarks.slice(0, ENTRY_PREVIEW_LIMIT) : bookmarks)
            : []);
    const showMoreFolders = shouldLimitPreviews && folders.length > FOLDER_PREVIEW_LIMIT;
    const showMoreChats = shouldLimitPreviews && conversationBookmarks.length > ENTRY_PREVIEW_LIMIT;
    const showMoreReferences = shouldLimitPreviews && bookmarks.length > ENTRY_PREVIEW_LIMIT;
    const tabs = [
        { id: ALL_TAB, label: 'All' },
        { id: FOLDERS_TAB, label: 'Folder' },
        { id: REFERENCES_TAB, label: 'Reference' },
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
                            <Box className="library-title-actions">
                                <MuiButton
                                    className="library-new-folder-button"
                                    onClick={() => handleOpenFolderDialog()}
                                >
                                    <AddIcon style={{ width: '16px', height: '16px', color: '#155DFC' }} />
                                    New Folder
                                </MuiButton>
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
                        <div className="library-tabs">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={`library-tab${!isFolderView && activeTab === tab.id ? ' library-tab--active' : ''}`}
                                    onClick={() => handleTabClick(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </Box>
                    <Box className="library-scroll">
                        {isFolderView && (
                            <Typography className="library-folder-page-title">
                                {folderDetail?.name ? `Folder: ${folderDetail.name}` : 'Folder'}
                            </Typography>
                        )}
                        {!isFolderView && (activeTab === ALL_TAB || activeTab === FOLDERS_TAB) && (
                            <Box className="library-section">
                                <Typography className="library-section-title">
                                    Folders
                                </Typography>
                                {visibleFolders.length > 0 ? (
                                    <>
                                        <Box className="library-folder-grid">
                                            {visibleFolders.map((folder) => (
                                                <LibraryFolderCard
                                                    key={folder.fid}
                                                    folder={folder}
                                                    onDelete={handleDeleteFolder}
                                                    onDuplicate={handleDuplicateFolder}
                                                    onRename={handleOpenFolderDialog}
                                                    onOpen={handleOpenFolder}
                                                />
                                            ))}
                                        </Box>
                                        {showMoreFolders && (
                                            <button
                                                type="button"
                                                className="library-show-more"
                                                onClick={() => handleShowMore(FOLDERS_TAB)}
                                            >
                                                Show More
                                                <ChevronRightIcon className="library-show-more-arrow" aria-hidden="true" />
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <Typography className="library-empty-text">
                                        No folders yet. Create one to organize your bookmarks.
                                    </Typography>
                                )}
                            </Box>
                        )}
                        {!isFolderView || !folderDetailLoading ? (
                            (isFolderView || activeTab === ALL_TAB || activeTab === CHATS_TAB) && (
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
                            (isFolderView || activeTab === ALL_TAB || activeTab === REFERENCES_TAB) && (
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
