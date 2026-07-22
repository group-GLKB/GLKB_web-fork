import './scoped.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  DeleteOutline as DeleteOutlineIcon,
  DriveFileRenameOutline as DriveFileRenameOutlineIcon,
  InfoOutlined as InfoOutlinedIcon,
  Menu as MenuIcon,
  MoreHoriz as MoreHorizIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
  Box,
  Divider,
  Drawer as MuiDrawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  styled,
  useTheme,
} from '@mui/material/styles';

import logo from '../../../img/GLKB_logo_icon.png';
import { ReactComponent as AddIcon } from '../../../img/navbar/add.svg';
import { ReactComponent as BookIcon } from '../../../img/navbar/book_4.svg';
import {
  ReactComponent as CategorySearchIcon,
} from '../../../img/navbar/category_search.svg';
import {
  ReactComponent as CodeBlocksIcon,
} from '../../../img/navbar/code_blocks.svg';
import { ReactComponent as HistoryIcon } from '../../../img/navbar/history.svg';
import logoWordmark from '../../../img/navbar/logo.png';
import {
  ReactComponent as SidebarLeftIcon,
} from '../../../img/navbar/sidebar.left.svg';
import userAccountIcon from '../../../img/user/ic_outline-account-circle.svg';
import userLogoutIcon from '../../../img/user/mynaui_logout.svg';
import {
  fetchConversations,
  getActiveConversationId,
  getConversations,
  removeConversation,
  setActiveConversationId,
  updateConversationTitle,
} from '../../../utils/chatHistory';
import {
  fetchConversationBookmarks,
  getConversationBookmarks,
  toggleConversationBookmark,
} from '../../../utils/conversationBookmarks';
import { trackGtagEvent } from '../../../utils/gtag';
import { useAuth } from '../../Auth/AuthContext';

const drawerWidth = 240;
const collapsedWidth = 64;
const compactRailWidth = 52;
const MAX_RECENT_COUNT = 50;
const DEBUG_HIDE_EXPLORE = true;
const SIDEBAR_OPEN_EVENT = 'glkb-open-sidebar';

const getStoredAccountProfile = () => {
    if (typeof window === 'undefined') {
        return { name: '', avatar: '' };
    }
    return {
        name: window.sessionStorage.getItem('account_display_name') || '',
        avatar: window.sessionStorage.getItem('account_avatar') || '',
    };
};

const openedMixin = (theme) => ({
    width: drawerWidth,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: 'hidden',
    borderRight: '1px solid var(--color-grey-100)',
    backgroundColor: 'var(--color-neutral-white)',
});

const closedMixin = (theme) => ({
    width: collapsedWidth,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    overflowX: 'hidden',
    borderRight: '1px solid var(--color-grey-100)',
    backgroundColor: 'var(--color-neutral-white)',
});

const PermanentDrawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
    ({ theme, open }) => ({
        width: drawerWidth,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        ...(open && {
            ...openedMixin(theme),
            '& .MuiDrawer-paper': openedMixin(theme),
        }),
        ...(!open && {
            ...closedMixin(theme),
            '& .MuiDrawer-paper': closedMixin(theme),
        }),
    })
);

function NavBarWhite({ showLogo = true, hideCompactRail = false }) {
    const { isAuthenticated, user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const isCompactSidebar = useMediaQuery('(max-width:532px)');
    const previousPathRef = useRef(location.pathname);
    const [open, setOpen] = useState(() => {
        if (typeof window === 'undefined') {
            return true;
        }
        if (location.pathname === '/chat' && !isSmallScreen) {
            return true;
        }
        const storedOpen = window.localStorage.getItem('sidebar-open');
        if (storedOpen === null) {
            return !isSmallScreen;
        }
        return storedOpen === 'true';
    });
    const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null);
    const [recentConversations, setRecentConversations] = useState([]);
    const [activeConversationId, setActiveConversationIdState] = useState(null);
    const [maxRecentCount] = useState(MAX_RECENT_COUNT);
    const [recentMenuAnchorEl, setRecentMenuAnchorEl] = useState(null);
    const [recentMenuConversation, setRecentMenuConversation] = useState(null);
    const [editingRecentId, setEditingRecentId] = useState(null);
    const [editingRecentTitle, setEditingRecentTitle] = useState('');
    const [conversationBookmarks, setConversationBookmarks] = useState([]);
    const [storedProfile, setStoredProfile] = useState(() => getStoredAccountProfile());

    useEffect(() => {
        if (isSmallScreen) {
            setOpen(false);
            return;
        }

        if (location.pathname === '/chat') {
            setOpen(true);
            return;
        }

        const storedOpen = window.localStorage.getItem('sidebar-open');
        if (storedOpen !== null) {
            setOpen(storedOpen === 'true');
        }
    }, [isSmallScreen, location.pathname]);

    useEffect(() => {
        if (!isCompactSidebar) {
            previousPathRef.current = location.pathname;
            return;
        }

        if (previousPathRef.current !== location.pathname && open) {
            setOpen(false);
        }

        previousPathRef.current = location.pathname;
    }, [location.pathname, isCompactSidebar, open]);

    useEffect(() => {
        if (!location.pathname.startsWith('/library')) {
            return;
        }
        setOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (typeof window === 'undefined' || isSmallScreen) {
            return;
        }

        window.localStorage.setItem('sidebar-open', String(open));
    }, [open, isSmallScreen]);

    useEffect(() => {
        const body = document.body;
        body.setAttribute('data-has-sidebar', 'true');
        const sidebarWidth = isCompactSidebar
            ? '0px'
            : (open ? `${drawerWidth}px` : `${collapsedWidth}px`);
        body.style.setProperty('--sidebar-width', sidebarWidth);

        if (isCompactSidebar) {
            body.setAttribute('data-sidebar-compact', 'true');
        } else {
            body.removeAttribute('data-sidebar-compact');
        }

        if (isCompactSidebar && open) {
            body.setAttribute('data-sidebar-overlay', 'true');
        } else {
            body.removeAttribute('data-sidebar-overlay');
        }

        return () => {
            body.removeAttribute('data-has-sidebar');
            body.removeAttribute('data-sidebar-compact');
            body.removeAttribute('data-sidebar-overlay');
            body.style.removeProperty('--sidebar-width');
        };
    }, [open, isCompactSidebar]);

    useEffect(() => {
        let isMounted = true;

        if (!isAuthenticated) {
            setRecentConversations([]);
            setActiveConversationIdState(null);
            return () => {
                isMounted = false;
            };
        }

        const updateRecent = (event) => {
            const next = event?.detail || getConversations();
            setRecentConversations(next);
            setActiveConversationIdState(getActiveConversationId());
        };

        updateRecent();
        fetchConversations()
            .then((list) => {
                if (!isMounted) return;
                setRecentConversations(list);
                setActiveConversationIdState(getActiveConversationId());
            })
            .catch(() => {
                if (!isMounted) return;
                setRecentConversations(getConversations());
            });

        window.addEventListener('glkb-conversations-updated', updateRecent);
        return () => {
            isMounted = false;
            window.removeEventListener('glkb-conversations-updated', updateRecent);
        };
    }, [isAuthenticated]);

    useEffect(() => {
        const handleOpenSidebar = () => {
            setOpen(true);
        };

        window.addEventListener(SIDEBAR_OPEN_EVENT, handleOpenSidebar);
        return () => {
            window.removeEventListener(SIDEBAR_OPEN_EVENT, handleOpenSidebar);
        };
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
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
    }, [isAuthenticated]);

    useEffect(() => {
        const handleAccountUpdate = () => {
            setStoredProfile(getStoredAccountProfile());
        };

        handleAccountUpdate();
        window.addEventListener('glkb-account-updated', handleAccountUpdate);
        return () => {
            window.removeEventListener('glkb-account-updated', handleAccountUpdate);
        };
    }, []);

    const topItems = useMemo(() => (
        [
            {
                label: 'New Chat',
                to: '/',
                icon: <AddIcon style={{ width: 22, height: 22 }} />,
                exact: true,
            },
        ]
    ), []);

    const middleItems = useMemo(() => (
        [
            { label: 'Explore', to: '/search', icon: <CategorySearchIcon style={{ width: 22, height: 22 }} /> },
            { label: 'API', to: '/api-page', icon: <CodeBlocksIcon style={{ width: 22, height: 22 }} /> },
            { label: 'Library', to: '/library', icon: <BookIcon className="sidebar-book-icon" style={{ width: 22, height: 22 }} /> },
            { label: 'History', to: '/history', icon: <HistoryIcon className="sidebar-history-icon" style={{ width: 22, height: 22 }} /> },
        ].filter((item) => !(DEBUG_HIDE_EXPLORE && item.label === 'Explore'))
    ), []);

    const bottomItems = useMemo(() => (
        [
            { label: 'About', to: '/about', icon: <InfoOutlinedIcon sx={{ fontSize: 22 }} /> },
        ]
    ), []);

    const loginItem = useMemo(() => (
        {
            label: 'Login',
            to: '/login',
            icon: <PersonIcon sx={{ fontSize: 22 }} />,
            iconBoxSx: {
                backgroundColor: 'var(--color-blue-500)',
                color: 'var(--color-neutral-white)',
            },
        }
    ), []);

    const userDisplayName = storedProfile.name || user?.username || user?.email || 'Account';
    const isUserMenuOpen = Boolean(userMenuAnchorEl);
    const isRecentMenuOpen = Boolean(recentMenuAnchorEl);
    const bookmarkedConversationIds = useMemo(
        () => new Set(conversationBookmarks.map((item) => String(item?.id ?? item?.hid ?? ''))),
        [conversationBookmarks]
    );
    const isRecentBookmarked = recentMenuConversation
        ? bookmarkedConversationIds.has(String(recentMenuConversation?.id ?? recentMenuConversation?.hid ?? ''))
        : false;
    const isHomeRoute = location.pathname === '/';

    const handleOpenUserMenu = (event) => {
        setUserMenuAnchorEl(event.currentTarget);
    };

    const handleCloseUserMenu = () => {
        setUserMenuAnchorEl(null);
    };

    const handleAccountClick = () => {
        handleCloseUserMenu();
        trackGtagEvent('nav_account_click', { source: 'sidebar_user_menu' });
        navigate('/account');
    };

    const handleUpgradeWithCodeClick = () => {
        handleCloseUserMenu();
        trackGtagEvent('nav_upgrade_code_click', { source: 'sidebar_user_menu' });
        navigate('/account', { state: { tab: 'testing' } });
    };

    const handleLogoutClick = async () => {
        handleCloseUserMenu();
        trackGtagEvent('nav_logout_click', { source: 'sidebar_user_menu' });
        await logout();
        window.location.href = '/';
    };

    const handleOpenRecentMenu = (event, conversation) => {
        event.stopPropagation();
        setRecentMenuAnchorEl(event.currentTarget);
        setRecentMenuConversation(conversation);
    };

    const handleCloseRecentMenu = () => {
        setRecentMenuAnchorEl(null);
        setRecentMenuConversation(null);
    };

    const handleRenameRecent = async () => {
        if (!recentMenuConversation?.id) return;
        trackGtagEvent('recent_rename_click', { source: 'sidebar_recent_menu' });
        const idToEdit = String(recentMenuConversation.id);
        const titleToEdit = getConversationTitle(recentMenuConversation);
        handleCloseRecentMenu();
        window.setTimeout(() => {
            setEditingRecentId(idToEdit);
            setEditingRecentTitle(titleToEdit);
        }, 0);
    };

    const commitInlineRecentRename = async () => {
        if (!editingRecentId) return;
        const idToUpdate = String(editingRecentId);
        const conversation = recentConversations.find((item) => String(item.id) === idToUpdate);
        const currentTitle = getConversationTitle(conversation);
        const trimmedTitle = editingRecentTitle.trim();

        if (trimmedTitle && trimmedTitle !== currentTitle) {
            try {
                await updateConversationTitle(idToUpdate, trimmedTitle);
            } catch (error) {
                // Ignore failures and keep existing title.
            }
        }

        setEditingRecentId(null);
        setEditingRecentTitle('');
    };

    const cancelInlineRecentRename = () => {
        setEditingRecentId(null);
        setEditingRecentTitle('');
    };

    const handleBookmarkRecent = async () => {
        if (!recentMenuConversation?.id) return;
        trackGtagEvent('recent_bookmark_click', { source: 'sidebar_recent_menu' });
        try {
            await toggleConversationBookmark(recentMenuConversation);
        } catch (error) {
            // Ignore bookmark failures to avoid breaking navigation UI.
        }
        handleCloseRecentMenu();
    };

    const handleDeleteRecent = async () => {
        if (!recentMenuConversation?.id) return;
        trackGtagEvent('recent_delete_click', { source: 'sidebar_recent_menu' });
        const idToDelete = String(recentMenuConversation.id);
        const deletingActiveConversation = String(activeConversationId) === idToDelete;
        try {
            await removeConversation(idToDelete);
            if (deletingActiveConversation && location.pathname === '/chat') {
                navigate('/');
            }
        } catch (error) {
            // Ignore delete failures and keep current state.
        }
        handleCloseRecentMenu();
    };

    const isSelected = (item) => {
        if (!item.to) {
            return false;
        }

        if (item.exact) {
            return location.pathname === item.to;
        }

        return location.pathname.startsWith(item.to);
    };

    const getConversationTitle = (conversation) => (
        conversation?.leadingTitle || 'Untitled conversation'
    );

    const isActiveConversation = (conversation) => {
        if (!conversation?.id) return false;
        if (location.pathname !== '/chat') return false;
        return String(conversation.id) === String(activeConversationId || '');
    };

    const tooltipProps = {
        placement: 'right',
        componentsProps: {
            tooltip: {
                sx: {
                    backgroundColor: 'var(--color-blue-50)',
                    color: 'var(--color-grey-900)',
                    fontFamily: 'var(--font-family-ui)',
                    fontWeight: 500,
                    fontSize: '14px',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-2)',
                    boxShadow: 'none',
                },
            },
        },
    };

    const renderNavItem = (item) => {
        const linkProps = item.onClick
            ? { component: 'button', type: 'button' }
            : item.to
                ? { component: Link, to: item.to }
                : { component: 'a', href: item.href, target: '_blank', rel: 'noopener noreferrer' };

        const icon = item.icon;

        const button = (
            <ListItemButton
                selected={isSelected(item)}
                aria-label={item.label}
                onClick={(event) => {
                    trackGtagEvent('nav_item_click', {
                        label: item.label,
                        target: item.to || item.href || '',
                    });
                    if (item.onClick) {
                        item.onClick(event);
                    }
                }}
                {...linkProps}
                sx={{
                    width: '100%',
                    minHeight: 36,
                    mb: item.noBottomMargin ? 0 : 2,
                    py: 0,
                    borderRadius: 'var(--radius-1)',
                    justifyContent: 'flex-start',
                    px: 0,
                    color: 'var(--color-grey-800)',
                    '&.Mui-selected': {
                        backgroundColor: 'transparent',
                        color: 'var(--color-grey-800)',
                        '& .sidebar-nav-icon': {
                            backgroundColor: 'var(--color-blue-100)',
                            color: 'var(--color-blue-500)',
                        },
                        '&:hover': {
                            backgroundColor: 'transparent',
                        },
                    },
                    '&:hover': {
                        backgroundColor: 'rgba(1, 105, 176, 0.04)',
                    },
                }}
            >
                <ListItemIcon
                    sx={{
                        minWidth: 0,
                        mr: 1.5,
                        justifyContent: 'center',
                        color: 'inherit',
                    }}
                >
                    <Box
                        className="sidebar-nav-icon"
                        sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--radius-1)',
                            backgroundColor: 'transparent',
                            color: 'var(--color-grey-400)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            ...item.iconBoxSx,
                        }}
                    >
                        {icon}
                    </Box>
                </ListItemIcon>
                <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                        fontFamily: 'var(--font-family-sans)',
                        fontWeight: 500,
                        fontSize: '16px',
                        lineHeight: '28px',
                        color: 'var(--color-grey-800)',
                    }}
                    sx={{
                        opacity: open ? 1 : 0,
                        width: open ? 'auto' : 0,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        transition: 'opacity 0.2s ease, width 0.2s ease',
                    }}
                />
            </ListItemButton>
        );

        if (open) {
            return (
                <Box key={item.label}>
                    {button}
                </Box>
            );
        }

        return (
            <Tooltip key={item.label} title={item.label} {...tooltipProps}>
                {button}
            </Tooltip>
        );
    };

    const drawerContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', px: open ? 2 : 1.75, py: 3 }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0,
                        px: 0,
                        py: 0,
                    }}
                >
                    {showLogo && (
                        <Box
                            sx={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                pl: 0,
                            }}
                        >
                            <Tooltip
                                title={open ? '' : 'Open sidebar'}
                                disableHoverListener={open}
                                {...tooltipProps}
                                PopperProps={{
                                    modifiers: [
                                        {
                                            name: 'offset',
                                            options: {
                                                offset: [0, 12],
                                            },
                                        },
                                    ],
                                }}
                            >
                                <IconButton
                                    aria-label={open ? 'Go to home' : 'Expand sidebar'}
                                    component={open ? Link : 'button'}
                                    to={open ? '/' : undefined}
                                    onClick={(event) => {
                                        if (open) {
                                            trackGtagEvent('nav_logo_click', { action: 'go_home' });
                                            return;
                                        }
                                        event.preventDefault();
                                        trackGtagEvent('nav_sidebar_expand_click', { source: 'logo_button' });
                                        setOpen(true);
                                    }}
                                    size="small"
                                    className="sidebar-logo-link"
                                    sx={{
                                        p: 0,
                                        width: 36,
                                        height: 36,
                                        borderRadius: '50%',
                                        '&:hover': {
                                            backgroundColor: 'rgba(1, 105, 176, 0.04)',
                                        },
                                        '& .sidebar-logo-image': {
                                            opacity: 1,
                                            transition: 'opacity 0.2s ease',
                                        },
                                        '& .sidebar-logo-chevron': {
                                            opacity: 0,
                                            transition: 'opacity 0.2s ease',
                                        },
                                        ...(!open && {
                                            '&:hover .sidebar-logo-image, &:focus-visible .sidebar-logo-image': {
                                                opacity: 0,
                                            },
                                            '&:hover .sidebar-logo-chevron, &:focus-visible .sidebar-logo-chevron': {
                                                opacity: 1,
                                            },
                                        }),
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative',
                                        }}
                                    >
                                        <Box
                                            component="img"
                                            src={logo}
                                            alt="GLKB logo"
                                            className="sidebar-logo-image"
                                            sx={{
                                                height: 36,
                                                width: 'auto',
                                                objectFit: 'contain',
                                            }}
                                        />
                                        <SidebarLeftIcon
                                            className="sidebar-logo-chevron"
                                            style={{
                                                width: 22,
                                                height: 22,
                                                position: 'absolute',
                                                color: 'var(--color-blue-500)',
                                            }}
                                        />
                                    </Box>
                                </IconButton>
                            </Tooltip>
                            <Box
                                component={Link}
                                to="/"
                                className="sidebar-logo-text sidebar-logo-wordmark-link"
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    opacity: open ? 1 : 0,
                                    width: open ? 'auto' : 0,
                                    overflow: 'hidden',
                                    marginLeft: '12px',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    transition: 'opacity 0.2s ease, width 0.2s ease',
                                }}
                            >
                                <Box
                                    component="img"
                                    src={logoWordmark}
                                    alt="GLKB"
                                    sx={{
                                        height: 36,
                                        width: 'auto',
                                        transform: 'translateY(1px)',
                                        objectFit: 'contain'
                                    }}
                                />
                            </Box>
                            {open && (
                                <Tooltip title="Collapse sidebar" {...tooltipProps}>
                                    <IconButton
                                        aria-label="Collapse sidebar"
                                        onClick={() => {
                                            trackGtagEvent('nav_sidebar_collapse_click', { source: 'sidebar_header' });
                                            setOpen(false);
                                        }}
                                        size="small"
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            ml: 'auto',
                                            borderRadius: 'var(--radius-1)',
                                            color: 'var(--color-grey-600)',
                                            flexShrink: 0,
                                            '&:hover': {
                                                backgroundColor: 'var(--color-grey-50)',
                                            },
                                        }}
                                    >
                                        <SidebarLeftIcon style={{ width: 20, height: 20 }} />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                    )}
                </Box>
                <Divider sx={{ display: 'none', borderColor: 'var(--color-grey-100)' }} />
                <List sx={{ px: 0, pt: 3, pb: 0 }}>
                    {topItems.map((item) => renderNavItem(item))}
                </List>
                <Divider sx={{ mx: 0, borderColor: 'var(--color-grey-100)' }} />
                <Box className="sidebar-scroll">
                    <List sx={{ px: 0, pt: 2, pb: 0 }}>
                        {middleItems.map((item) => renderNavItem(item))}
                    </List>
                    <Divider sx={{ mx: 0, borderColor: 'var(--color-grey-100)' }} />
                    {/* <Divider sx={{ mx: 3.5, borderColor: 'var(--color-grey-100)' }} />
                    <List sx={{ px: 1, py: 1 }}>
                        {bottomItems.map((item) => renderNavItem(item))}
                    </List> */}
                    {open && (
                        <Box className="sidebar-recent-section">
                            <Typography
                                className="sidebar-recent-title"
                                sx={{
                                    fontFamily: 'var(--font-family-sans)',
                                    fontWeight: 500,
                                    fontSize: '12px',
                                    lineHeight: '16px',
                                    color: 'var(--color-grey-400)',
                                    textTransform: 'none',
                                }}
                            >
                                Recent
                            </Typography>
                            <Box className="sidebar-recent-list">
                                {recentConversations.slice(0, maxRecentCount).map((conversation) => (
                                    (() => {
                                        const isEditingRecent = String(editingRecentId) === String(conversation.id);
                                        const isActiveRecent = isActiveConversation(conversation);
                                        return (
                                            <Box
                                                key={conversation.id}
                                                sx={{
                                                    position: 'relative',
                                                    width: isActiveRecent ? 'calc(100% + 16px)' : '100%',
                                                    marginLeft: isActiveRecent ? '-8px' : 0,
                                                    minHeight: 16,
                                                    '&:hover .recent-entry-button, &:focus-within .recent-entry-button': {
                                                        paddingRight: '36px',
                                                    },
                                                    '&:hover .recent-more-button, &:focus-within .recent-more-button': {
                                                        opacity: 1,
                                                        pointerEvents: 'auto',
                                                    },
                                                }}
                                            >
                                                <Box
                                                    component={isEditingRecent ? 'input' : 'button'}
                                                    type={isEditingRecent ? 'text' : 'button'}
                                                    className="recent-entry-button"
                                                    aria-current={isActiveRecent ? 'page' : undefined}
                                                    value={isEditingRecent ? editingRecentTitle : undefined}
                                                    autoFocus={isEditingRecent}
                                                    onChange={isEditingRecent ? (event) => setEditingRecentTitle(event.target.value) : undefined}
                                                    onBlur={isEditingRecent ? commitInlineRecentRename : undefined}
                                                    onKeyDown={isEditingRecent ? (event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            commitInlineRecentRename();
                                                        }
                                                        if (event.key === 'Escape') {
                                                            event.preventDefault();
                                                            cancelInlineRecentRename();
                                                        }
                                                    } : undefined}
                                                    onClick={() => {
                                                        if (isEditingRecent) return;
                                                        setActiveConversationId(conversation.id);
                                                        setActiveConversationIdState(conversation.id);
                                                        navigate('/chat', { state: { conversationId: conversation.id } });
                                                    }}
                                                    sx={{
                                                        width: '100%',
                                                        border: 'none',
                                                        backgroundColor: isActiveRecent ? 'var(--color-blue-50)' : 'transparent',
                                                        padding: isActiveRecent ? '4px 8px' : 0,
                                                        margin: isActiveRecent ? '-4px 0' : 0,
                                                        borderRadius: isActiveRecent ? '4px' : 0,
                                                        fontFamily: 'var(--font-family-sans)',
                                                        fontSize: '12px',
                                                        fontWeight: isActiveRecent ? 500 : 400,
                                                        lineHeight: '16px',
                                                        color: isActiveRecent ? 'var(--color-blue-500)' : 'var(--color-grey-800)',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        transition: 'background-color 0.2s ease, border-color 0.2s ease, padding-right 0.16s ease',
                                                        '&:hover': {
                                                            backgroundColor: isActiveRecent ? 'var(--color-blue-50)' : 'transparent',
                                                        },
                                                        ...(isEditingRecent && {
                                                            cursor: 'text',
                                                            outline: 'none',
                                                            borderColor: 'var(--color-blue-500)',
                                                            boxShadow: '0 0 0 2px rgba(21, 93, 252, 0.12)',
                                                            '&:hover': {
                                                                backgroundColor: 'var(--color-neutral-white)',
                                                            },
                                                        }),
                                                    }}
                                                >
                                                    {isEditingRecent ? undefined : getConversationTitle(conversation)}
                                                </Box>
                                                <IconButton
                                                    size="small"
                                                    className="recent-more-button"
                                                    onClick={(event) => handleOpenRecentMenu(event, conversation)}
                                                    aria-label="Open conversation menu"
                                                    disabled={isEditingRecent}
                                                    sx={{
                                                        position: 'absolute',
                                                        right: 6,
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        width: 24,
                                                        height: 24,
                                                        borderRadius: 'var(--radius-2)',
                                                        color: 'var(--color-grey-900)',
                                                        opacity: 0,
                                                        pointerEvents: 'none',
                                                        transition: 'opacity 0.16s ease, background-color 0.16s ease',
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(1, 105, 176, 0.1)',
                                                        },
                                                    }}
                                                >
                                                    <MoreHorizIcon sx={{ fontSize: 18 }} />
                                                </IconButton>
                                            </Box>
                                        );
                                    })()
                                ))}
                            </Box>
                        </Box>
                    )}
                </Box>
                <Box sx={{ mt: 'auto', pb: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Divider sx={{ mx: 0, borderColor: 'var(--color-grey-100)' }} />
                    <List sx={{ px: 0, py: 0 }}>
                        {!isAuthenticated ? (
                            renderNavItem({ ...loginItem, noBottomMargin: true })
                        ) : (
                            renderNavItem({
                                label: userDisplayName,
                                icon: storedProfile.avatar ? (
                                    <Box
                                        component="img"
                                        src={storedProfile.avatar}
                                        alt="Account avatar"
                                        sx={{
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                        }}
                                    />
                                ) : (
                                    <PersonIcon sx={{ fontSize: 22 }} />
                                ),
                                onClick: handleOpenUserMenu,
                                iconBoxSx: {
                                    backgroundColor: 'var(--color-grey-100)',
                                    color: 'var(--color-grey-500)',
                                    borderRadius: '50%',
                                },
                                noBottomMargin: true,
                            })
                        )}
                    </List>
                </Box>
        </Box>
    );

    return (
        <>
            {isCompactSidebar && !open && !hideCompactRail && (
                <Box
                    className="sidebar-mobile-rail"
                    sx={{
                        position: 'fixed',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        zIndex: (theme) => theme.zIndex.drawer + 1,
                        width: `${compactRailWidth}px`,
                        minWidth: `${compactRailWidth}px`,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        pt: 1,
                        backgroundColor: 'transparent',
                        borderRight: 'none',
                    }}
                >
                    <Tooltip title="Open sidebar" {...tooltipProps}>
                        <IconButton
                            aria-label="Expand sidebar"
                            onClick={() => {
                                trackGtagEvent('nav_sidebar_expand_click', { source: 'mobile_rail' });
                                setOpen(true);
                            }}
                            size="small"
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 'var(--radius-3)',
                                backgroundColor: isHomeRoute ? 'transparent' : 'var(--color-grey-100)',
                                color: '#646464',
                                '&:hover': {
                                    backgroundColor: isHomeRoute ? 'transparent' : 'var(--color-grey-200)',
                                },
                            }}
                        >
                            <MenuIcon sx={{ fontSize: 22 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            )}

            {isCompactSidebar ? (
                <MuiDrawer
                    variant="temporary"
                    open={open}
                    onClose={() => setOpen(false)}
                    ModalProps={{
                        keepMounted: true,
                    }}
                    BackdropProps={{
                        sx: {
                            backgroundColor: 'rgba(17, 24, 39, 0.18)',
                        },
                    }}
                    PaperProps={{
                        sx: {
                            width: `${drawerWidth}px`,
                            borderTopRightRadius: '16px',
                            borderBottomRightRadius: '16px',
                            boxShadow: '0 10px 28px rgba(22, 69, 99, 0.22)',
                            borderRight: 'none',
                            overflow: 'hidden',
                        },
                    }}
                >
                    {drawerContent}
                </MuiDrawer>
            ) : (
                <PermanentDrawer
                    variant="permanent"
                    open={open}
                >
                    {drawerContent}
                </PermanentDrawer>
            )}
            <Menu
                anchorEl={recentMenuAnchorEl}
                open={isRecentMenuOpen}
                onClose={handleCloseRecentMenu}
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
                        borderRadius: 'var(--radius-2)',
                        boxShadow: '0px 4px 6px -2px rgba(16,24,40,0.03), 0px 12px 16px -4px rgba(16,24,40,0.08)',
                        '& .MuiMenuItem-root': {
                            fontFamily: 'var(--font-family-ui)',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--color-grey-900)',
                            py: 0.75,
                            px: 1.25,
                        },
                    },
                }}
            >
                <MenuItem onClick={handleRenameRecent}>
                    <ListItemIcon sx={{ minWidth: 26, color: 'var(--color-grey-900)' }}>
                        <DriveFileRenameOutlineIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>Rename</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleBookmarkRecent}>
                    <ListItemIcon sx={{ minWidth: 26, color: 'var(--color-grey-900)' }}>
                        {isRecentBookmarked ? (
                            <BookmarkIcon sx={{ fontSize: 18 }} />
                        ) : (
                            <BookmarkBorderIcon sx={{ fontSize: 18 }} />
                        )}
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>
                        {isRecentBookmarked ? 'Remove bookmark' : 'Bookmark'}
                    </ListItemText>
                </MenuItem>
                <Divider sx={{ borderColor: 'var(--color-grey-100)' }} />
                <MenuItem onClick={handleDeleteRecent} sx={{ color: 'var(--color-red-700) !important' }}>
                    <ListItemIcon sx={{ minWidth: 26, color: 'var(--color-red-700)' }}>
                        <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: {
                                color: 'var(--color-red-700)',
                                fontFamily: 'var(--font-family-ui)',
                                fontSize: '13px',
                                fontWeight: 500,
                            },
                        }}
                    >
                        Delete
                    </ListItemText>
                </MenuItem>
            </Menu>
            <Menu
                anchorEl={userMenuAnchorEl}
                open={isUserMenuOpen}
                onClose={handleCloseUserMenu}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                MenuListProps={{
                    sx: {
                        py: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0,
                        color: 'var(--color-grey-800)',
                    },
                }}
                PaperProps={{
                    sx: {
                        minWidth: 240,
                        borderRadius: 'var(--radius-3)',
                        boxShadow: '0px 4px 6px -2px rgba(16,24,40,0.03), 0px 12px 16px -4px rgba(16,24,40,0.08)',
                        '& .MuiMenuItem-root': {
                            color: 'var(--color-grey-800)',
                            fontFamily: 'var(--font-family-ui)',
                            fontWeight: 400,
                            fontSize: '14px',
                        },
                        '& .MuiListItemText-primary': {
                            color: 'var(--color-grey-800)',
                            fontFamily: 'var(--font-family-ui)',
                            fontWeight: 400,
                            fontSize: '14px',
                        },
                        '& .MuiTypography-root': {
                            color: 'var(--color-grey-800)',
                        },
                        '& .MuiListItemIcon-root': {
                            color: 'var(--color-grey-500)',
                        },
                    },
                }}
            >
                <MenuItem
                    sx={{
                        px: 2,
                        pt: 1,
                        pb: 2,
                        cursor: 'default',
                        '&:hover': {
                            backgroundColor: 'transparent',
                        },
                    }}
                >
                    <Typography
                        sx={{
                            fontFamily: 'var(--font-family-ui)',
                            fontWeight: 400,
                            fontSize: '14px',
                            color: 'var(--color-grey-800)',
                        }}
                    >
                        {userDisplayName}
                    </Typography>
                </MenuItem>
                <MenuItem onClick={handleAccountClick} sx={{ px: 2, py: 1 }}>
                    <ListItemIcon sx={{ minWidth: "16px !important", mr: 1 }}>
                        <Box
                            component="img"
                            src={userAccountIcon}
                            alt="Account"
                            sx={{ width: 16, height: 16, objectFit: 'contain' }}
                        />
                    </ListItemIcon>
                    <ListItemText>Account</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleUpgradeWithCodeClick} sx={{ px: 2, py: 1 }}>
                    <ListItemIcon sx={{ minWidth: "16px !important", mr: 1 }}>
                        <Box component="svg" viewBox="0 0 24 24" fill="none" sx={{ width: 16, height: 16 }}>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" stroke="currentColor" strokeWidth="2" />
                        </Box>
                    </ListItemIcon>
                    <ListItemText>Upgrade with Code</ListItemText>
                </MenuItem>
                <Divider sx={{ borderColor: 'var(--color-grey-100)' }} />
                <MenuItem onClick={handleLogoutClick} sx={{ px: 2, py: 1 }}>
                    <ListItemIcon sx={{ minWidth: "16px !important", mr: 1 }}>
                        <Box
                            component="img"
                            src={userLogoutIcon}
                            alt="Log out"
                            sx={{ width: 16, height: 16, objectFit: 'contain' }}
                        />
                    </ListItemIcon>
                    <ListItemText>Log out</ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
}

export default NavBarWhite;
