import './scoped.css';

import React, {
  useCallback,
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
  Close as CloseIcon,
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

import { ContextMenu, ContextMenuItem } from '../ContextMenu';
import ConversationRunStatus from '../ConversationRunStatus';
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
import { getRunningConversationIds, subscribeToActiveRun } from '../../../service/activeRun';
import {
  fetchConversations,
  getActiveConversationId,
  getConversations,
  removeConversation,
  setActiveConversationId,
  updateConversationTitle,
  chatPathForConversation,
} from '../../../utils/chatHistory';
import {
  fetchConversationBookmarks,
  getConversationBookmarks,
  toggleConversationBookmark,
} from '../../../utils/conversationBookmarks';
import { trackGtagEvent } from '../../../utils/gtag';
import { useAuth } from '../../Auth/AuthContext';

const drawerWidth = 240;
const mobileDrawerWidth = 280;
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
    borderRight: '1px solid var(--color-border-default)',
    backgroundColor: 'var(--color-background-surface)',
});

const closedMixin = (theme) => ({
    width: collapsedWidth,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    overflowX: 'hidden',
    borderRight: '1px solid var(--color-border-default)',
    backgroundColor: 'var(--color-background-surface)',
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

const HINT_TOOLTIP_PROPS = {
    placement: 'right',
    componentsProps: {
        tooltip: {
            sx: {
                backgroundColor: 'var(--color-brand-soft)',
                color: 'var(--color-grey-900)',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                padding: '4px 12px',
                borderRadius: '8px',
                boxShadow: 'none',
            },
        },
    },
};

/**
 * A hint that goes away when you click the thing it is describing.
 *
 * Every one of these labels a button that changes the sidebar, and MUI's own
 * open state does not survive that. It only attaches onMouseLeave while the
 * hover listener is enabled (Tooltip.js), so a trigger that blanks its title
 * or disables hovering on click keeps its internal state set to open: the
 * pointer's departure is never heard. The tooltip stays hidden while the title
 * is empty, then reappears — with the pointer nowhere near it — the moment the
 * title comes back. Owning the state here and clearing it on click closes that
 * hole, and covers the case where the pointer never moves because the panel
 * opened underneath it.
 */
const HintTooltip = ({ children, title, ...props }) => {
    const [open, setOpen] = useState(false);

    return (
        <Tooltip
            {...HINT_TOOLTIP_PROPS}
            {...props}
            title={title}
            open={open && Boolean(title)}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
        >
            {React.cloneElement(children, {
                onClick: (event) => {
                    setOpen(false);
                    children.props.onClick?.(event);
                },
            })}
        </Tooltip>
    );
};

function NavBarWhite({ showLogo = true, hideCompactRail = false }) {
    const { isAuthenticated, user, logout, openLoginModal } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    // Must match AppLayout's phone breakpoint. Using 532px here left a
    // 533–767px interval with both the mobile header and permanent PC sidebar.
    const isCompactSidebar = useMediaQuery('(max-width:767px)');
    const previousPathRef = useRef(location.pathname);
    const [open, setOpen] = useState(() => {
        if (typeof window === 'undefined') {
            return true;
        }
        if (location.pathname.startsWith('/chat') && !isSmallScreen) {
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
    /* Every conversation that is working, not just the newest one: a reader can leave an answer
       to write itself and ask something else, so more than one row can be in flight at a time
       and each of them needs its own dot. */
    const [runningConversationIds, setRunningConversationIds] = useState(
        () => getRunningConversationIds(),
    );
    const isConversationRunning = useCallback(
        (id) => id != null && runningConversationIds.has(String(id)),
        [runningConversationIds],
    );

    useEffect(() => subscribeToActiveRun(
        () => setRunningConversationIds(getRunningConversationIds()),
    ), []);

    useEffect(() => {
        if (isConversationRunning(recentMenuConversation?.id)) {
            setRecentMenuAnchorEl(null);
            setRecentMenuConversation(null);
        }
    }, [isConversationRunning, recentMenuConversation]);

    useEffect(() => {
        if (isSmallScreen) {
            setOpen(false);
            return;
        }

        if (location.pathname.startsWith('/chat')) {
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
                icon: <AddIcon style={{ width: 20, height: 20 }} />,
                exact: true,
            },
        ]
    ), []);

    const middleItems = useMemo(() => (
        [
            { label: 'Explore', to: '/search', icon: <CategorySearchIcon style={{ width: 20, height: 20 }} /> },
            { label: 'API', to: '/api-page', icon: <CodeBlocksIcon style={{ width: 20, height: 20 }} /> },
            { label: 'Library', to: '/library', icon: <BookIcon className="sidebar-book-icon" style={{ width: 20, height: 20 }} /> },
            { label: 'History', to: '/history', icon: <HistoryIcon className="sidebar-history-icon" style={{ width: 20, height: 20 }} /> },
        ].filter((item) => !(DEBUG_HIDE_EXPLORE && item.label === 'Explore'))
    ), []);

    const displayedMiddleItems = isCompactSidebar
        ? ['Library', 'History', 'API']
            .map((label) => middleItems.find((item) => item.label === label))
            .filter(Boolean)
        : middleItems;

    const bottomItems = useMemo(() => (
        [
            { label: 'About', to: '/about', icon: <InfoOutlinedIcon sx={{ fontSize: 22 }} /> },
        ]
    ), []);

    const loginItem = useMemo(() => (
        {
            label: 'Log in',
            // Opens the sign-in overlay instead of navigating to a page.
            onClick: () => openLoginModal(),
            icon: <PersonIcon sx={{ fontSize: 20 }} />,
            iconBoxSx: {
                backgroundColor: 'var(--color-background-muted)',
                color: 'var(--color-text-tertiary)',
                borderRadius: '256px',
            },
        }
    ), [openLoginModal]);

    const userDisplayName = storedProfile.name || user?.username || user?.email || 'Account';
    const normalizedUserTier = `${user?.tier || 'free'}`.trim().toLowerCase();
    const userPlanLabel = `${normalizedUserTier.charAt(0).toUpperCase()}${normalizedUserTier.slice(1)} plan`;
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
        if (isConversationRunning(conversation?.id)) return;
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
        if (isConversationRunning(recentMenuConversation.id)) {
            handleCloseRecentMenu();
            return;
        }
        trackGtagEvent('recent_delete_click', { source: 'sidebar_recent_menu' });
        const idToDelete = String(recentMenuConversation.id);
        const deletingActiveConversation = String(activeConversationId) === idToDelete;
        try {
            await removeConversation(idToDelete);
            if (deletingActiveConversation && location.pathname.startsWith('/chat')) {
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
        if (!location.pathname.startsWith('/chat')) return false;
        return String(conversation.id) === String(activeConversationId || '');
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
                    minHeight: item.secondaryLabel ? 44 : 36,
                    mb: item.noBottomMargin ? 0 : 2,
                    py: 0,
                    borderRadius: 1,
                    justifyContent: 'flex-start',
                    px: 0,
                    color: 'var(--color-text-secondary)',
                    '&.Mui-selected': {
                        backgroundColor: 'transparent',
                        color: 'var(--color-text-secondary)',
                        '& .sidebar-nav-icon': {
                            backgroundColor: 'var(--color-brand-muted)',
                            color: 'var(--color-brand-primary)',
                        },
                        '&:hover': {
                            backgroundColor: 'transparent',
                        },
                    },
                    '&:hover': {
                        backgroundColor: 'var(--color-background-subtle)',
                    },
                }}
            >
                <ListItemIcon
                    sx={{
                        minWidth: 0,
                        mr: item.secondaryLabel ? 2 : 1.5,
                        justifyContent: 'center',
                        color: 'inherit',
                    }}
                >
                    <Box
                        className="sidebar-nav-icon"
                        sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '4px',
                            backgroundColor: 'transparent',
                            color: 'var(--color-text-tertiary)',
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
                    secondary={item.secondaryLabel}
                    primaryTypographyProps={{
                        fontFamily: 'Geist, sans-serif',
                        fontWeight: item.secondaryLabel ? 600 : 500,
                        fontSize: item.secondaryLabel ? '14px' : '16px',
                        lineHeight: item.secondaryLabel ? '22px' : '20px',
                        color: item.secondaryLabel
                            ? 'var(--color-text-tertiary)'
                            : 'var(--color-text-secondary)',
                    }}
                    secondaryTypographyProps={{
                        fontFamily: 'Geist, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '22px',
                        color: 'var(--color-text-tertiary)',
                    }}
                    sx={{
                        my: 0,
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
            <HintTooltip key={item.label} title={item.label}>
                {button}
            </HintTooltip>
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
                            <HintTooltip
                                title={open ? '' : 'Open sidebar'}
                                disableHoverListener={open}
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
                                        width: isCompactSidebar ? 24 : 36,
                                        height: isCompactSidebar ? 24 : 36,
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
                                                height: isCompactSidebar ? 24 : 36,
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
                                                color: 'var(--color-brand-primary)',
                                            }}
                                        />
                                    </Box>
                                </IconButton>
                            </HintTooltip>
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
                                    marginLeft: isCompactSidebar ? '2px' : '12px',
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
                                        height: isCompactSidebar ? 24 : 36,
                                        width: 'auto',
                                        transform: 'translateY(1px)',
                                        objectFit: 'contain'
                                    }}
                                />
                            </Box>
                            {open && (
                                <HintTooltip title="Collapse sidebar">
                                    <IconButton
                                        aria-label="Collapse sidebar"
                                        onClick={() => {
                                            trackGtagEvent('nav_sidebar_collapse_click', { source: 'sidebar_header' });
                                            setOpen(false);
                                        }}
                                        size="small"
                                        sx={{
                                            width: isCompactSidebar ? 24 : 36,
                                            height: isCompactSidebar ? 24 : 36,
                                            ml: 'auto',
                                            borderRadius: '4px',
                                            color: 'var(--color-grey-600)',
                                            flexShrink: 0,
                                            '&:hover': {
                                                backgroundColor: 'var(--color-background-subtle)',
                                            },
                                        }}
                                    >
                                        {isCompactSidebar
                                            ? <CloseIcon sx={{ width: 20, height: 20 }} />
                                            : <SidebarLeftIcon style={{ width: 20, height: 20 }} />}
                                    </IconButton>
                                </HintTooltip>
                            )}
                        </Box>
                    )}
                </Box>
                <Divider sx={{ display: 'none', borderColor: 'var(--color-border-default)' }} />
                <List sx={{ px: 0, pt: isCompactSidebar ? 2 : 3, pb: 0 }}>
                    {topItems.map((item) => renderNavItem(item))}
                </List>
                <Divider sx={{ mx: 0, borderColor: 'var(--color-border-default)' }} />
                <Box className="sidebar-scroll">
                    <List sx={{ px: 0, pt: 2, pb: 0 }}>
                        {displayedMiddleItems.map((item) => renderNavItem(item))}
                    </List>
                    <Divider sx={{ mx: 0, borderColor: 'var(--color-border-default)' }} />
                    {/* <Divider sx={{ mx: 3.5, borderColor: 'var(--color-border-default)' }} />
                    <List sx={{ px: 1, py: 1 }}>
                        {bottomItems.map((item) => renderNavItem(item))}
                    </List> */}
                    {open && (
                        <Box className="sidebar-recent-section">
                            <Typography
                                className="sidebar-recent-title"
                                sx={{
                                    fontFamily: 'Geist, sans-serif',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    lineHeight: '20px',
                                    color: 'var(--color-text-tertiary)',
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
                                        const isLoadingRecent = isConversationRunning(conversation.id);
                                        return (
                                            <Box
                                                key={conversation.id}
                                                sx={{
                                                    position: 'relative',
                                                    width: 'calc(100% + 16px)',
                                                    marginLeft: '-8px',
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
                                                        navigate(
                                                            chatPathForConversation(conversation),
                                                            { state: { conversationId: conversation.id } },
                                                        );
                                                    }}
                                                    sx={{
                                                        width: '100%',
                                                        border: 'none',
                                                        backgroundColor: isActiveRecent ? 'var(--color-brand-soft)' : 'transparent',
                                                        padding: '4px 8px',
                                                        paddingRight: isLoadingRecent || isCompactSidebar ? '36px' : '8px',
                                                        margin: '-4px 0',
                                                        borderRadius: '4px',
                                                        fontFamily: 'Geist, sans-serif',
                                                        fontSize: '12px',
                                                        fontWeight: 400,
                                                        lineHeight: '20px',
                                                        color: isActiveRecent ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        transition: 'background-color 0.2s ease, border-color 0.2s ease, padding-right 0.16s ease',
                                                        '&:hover': {
                                                            backgroundColor: isActiveRecent ? 'var(--color-brand-soft)' : 'transparent',
                                                        },
                                                        ...(isEditingRecent && {
                                                            cursor: 'text',
                                                            outline: 'none',
                                                            borderColor: 'var(--color-brand-primary)',
                                                            boxShadow: '0 0 0 2px rgba(21, 93, 252, 0.12)',
                                                            '&:hover': {
                                                                backgroundColor: 'var(--color-background-surface)',
                                                            },
                                                        }),
                                                    }}
                                                >
                                                    {isEditingRecent ? undefined : getConversationTitle(conversation)}
                                                </Box>
                                                {isLoadingRecent ? (
                                                    <Box
                                                        sx={{
                                                            position: 'absolute',
                                                            right: 6,
                                                            top: '50%',
                                                            transform: 'translateY(-50%)',
                                                        }}
                                                    >
                                                        <ConversationRunStatus />
                                                    </Box>
                                                ) : <IconButton
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
                                                        borderRadius: '8px',
                                                        color: 'var(--color-grey-900)',
                                                        opacity: isCompactSidebar ? 1 : 0,
                                                        pointerEvents: isCompactSidebar ? 'auto' : 'none',
                                                        transition: 'opacity 0.16s ease, background-color 0.16s ease',
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(1, 105, 176, 0.1)',
                                                        },
                                                    }}
                                                >
                                                    <MoreHorizIcon sx={{ fontSize: 12 }} />
                                                </IconButton>}
                                            </Box>
                                        );
                                    })()
                                ))}
                            </Box>
                        </Box>
                    )}
                </Box>
                <Box sx={{ mt: 'auto', pb: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Divider sx={{ mx: 0, borderColor: 'var(--color-border-default)' }} />
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
                                    <PersonIcon sx={{ fontSize: 20 }} />
                                ),
                                secondaryLabel: userPlanLabel,
                                onClick: handleOpenUserMenu,
                                iconBoxSx: {
                                    backgroundColor: 'var(--color-background-muted)',
                                    color: 'var(--color-text-tertiary)',
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
                    <HintTooltip title="Open sidebar">
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
                                borderRadius: '12px',
                                backgroundColor: isHomeRoute ? 'transparent' : 'var(--color-background-muted)',
                                color: 'var(--color-grey-600)',
                                '&:hover': {
                                    backgroundColor: isHomeRoute ? 'transparent' : 'var(--color-background-normal)',
                                },
                            }}
                        >
                            <MenuIcon sx={{ fontSize: 22 }} />
                        </IconButton>
                    </HintTooltip>
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
                            backgroundColor: 'rgba(0, 0, 0, 0.32)',
                        },
                    }}
                    PaperProps={{
                        sx: {
                            width: `${mobileDrawerWidth}px`,
                            borderRadius: 0,
                            boxShadow: 'none',
                            borderRight: '1px solid var(--color-border-default)',
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
            <ContextMenu
                anchorEl={recentMenuAnchorEl}
                open={isRecentMenuOpen}
                onClose={handleCloseRecentMenu}
            >
                <ContextMenuItem icon={<DriveFileRenameOutlineIcon />} onClick={handleRenameRecent}>
                    Rename
                </ContextMenuItem>
                <ContextMenuItem
                    icon={isRecentBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                    onClick={handleBookmarkRecent}
                >
                    {isRecentBookmarked ? 'Remove bookmark' : 'Bookmark'}
                </ContextMenuItem>
                <ContextMenuItem icon={<DeleteOutlineIcon />} danger onClick={handleDeleteRecent}>
                    Delete
                </ContextMenuItem>
            </ContextMenu>
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
                        color: 'var(--color-text-secondary)',
                    },
                }}
                PaperProps={{
                    sx: {
                        minWidth: 240,
                        borderRadius: '12px',
                        boxShadow: '0px 4px 6px -2px rgba(16,24,40,0.03), 0px 12px 16px -4px rgba(16,24,40,0.08)',
                        '& .MuiMenuItem-root': {
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 400,
                            fontSize: '14px',
                        },
                        '& .MuiListItemText-primary': {
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 400,
                            fontSize: '14px',
                        },
                        '& .MuiTypography-root': {
                            color: 'var(--color-text-secondary)',
                        },
                        '& .MuiListItemIcon-root': {
                            color: 'var(--color-text-tertiary)',
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
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 400,
                            fontSize: '14px',
                            color: 'var(--color-text-secondary)',
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
                <Divider sx={{ borderColor: 'var(--color-border-default)' }} />
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
