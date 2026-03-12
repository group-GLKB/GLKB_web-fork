import './scoped.css';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  ContactPage as ContactPageIcon,
  InfoOutlined as InfoOutlinedIcon,
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
import {
  ReactComponent as SidebarLeftIcon,
} from '../../../img/navbar/sidebar.left.svg';
import userAccountIcon from '../../../img/user/ic_outline-account-circle.svg';
import userSettingsIcon from '../../../img/user/lsicon_setting-outline.svg';
import userLogoutIcon from '../../../img/user/mynaui_logout.svg';
import {
  getActiveConversationId,
  getConversations,
  setActiveConversationId,
} from '../../../utils/chatHistory';
import { useAuth } from '../../Auth/AuthContext';

const drawerWidth = 240;
const collapsedWidth = 88;

const openedMixin = (theme) => ({
    width: drawerWidth,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: 'hidden',
    borderRight: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
});

const closedMixin = (theme) => ({
    width: collapsedWidth,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    overflowX: 'hidden',
    borderRight: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
});

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
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

function NavBarWhite({ showLogo = true }) {
    const { isAuthenticated, user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [open, setOpen] = useState(() => {
        if (typeof window === 'undefined') {
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
    const [maxRecentCount, setMaxRecentCount] = useState(2);

    useEffect(() => {
        if (isSmallScreen) {
            setOpen(false);
            return;
        }

        const storedOpen = window.localStorage.getItem('sidebar-open');
        if (storedOpen !== null) {
            setOpen(storedOpen === 'true');
        }
    }, [isSmallScreen]);

    useEffect(() => {
        if (typeof window === 'undefined' || isSmallScreen) {
            return;
        }

        window.localStorage.setItem('sidebar-open', String(open));
    }, [open, isSmallScreen]);

    useEffect(() => {
        const body = document.body;
        body.setAttribute('data-has-sidebar', 'true');
        body.style.setProperty('--sidebar-width', open ? `${drawerWidth}px` : `${collapsedWidth}px`);

        return () => {
            body.removeAttribute('data-has-sidebar');
            body.style.removeProperty('--sidebar-width');
        };
    }, [open]);

    useEffect(() => {
        const updateRecent = (event) => {
            const next = event?.detail || getConversations();
            setRecentConversations(next);
            setActiveConversationIdState(getActiveConversationId());
        };

        updateRecent();
        window.addEventListener('glkb-conversations-updated', updateRecent);
        return () => window.removeEventListener('glkb-conversations-updated', updateRecent);
    }, []);

    useEffect(() => {
        const updateCount = () => {
            const available = window.innerHeight - 560;
            const estimated = Math.floor(available / 56);
            setMaxRecentCount(Math.max(1, Math.min(6, estimated)));
        };

        updateCount();
        window.addEventListener('resize', updateCount);
        return () => window.removeEventListener('resize', updateCount);
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
            { label: 'API', href: 'https://glkb.dcmb.med.umich.edu/docs', icon: <CodeBlocksIcon style={{ width: 22, height: 22 }} /> },
            { label: 'Library', to: '/library', icon: <BookIcon className="sidebar-book-icon" style={{ width: 22, height: 22 }} /> },
            { label: 'History', to: '/history', icon: <HistoryIcon className="sidebar-history-icon" style={{ width: 22, height: 22 }} /> },
        ]
    ), []);

    const bottomItems = useMemo(() => (
        [
            { label: 'About', to: '/about', icon: <InfoOutlinedIcon sx={{ fontSize: 22 }} /> },
            { label: 'Contact', href: 'https://jieliu6.github.io/', icon: <ContactPageIcon sx={{ fontSize: 22 }} /> },
        ]
    ), []);

    const loginItem = useMemo(() => (
        {
            label: 'Login',
            to: '/login',
            icon: <PersonIcon sx={{ fontSize: 22 }} />,
            iconBoxSx: {
                backgroundColor: '#e9f1fe',
                color: '#164563',
            },
        }
    ), []);

    const userDisplayName = user?.username || user?.email || 'Account';
    const isUserMenuOpen = Boolean(userMenuAnchorEl);

    const handleOpenUserMenu = (event) => {
        setUserMenuAnchorEl(event.currentTarget);
    };

    const handleCloseUserMenu = () => {
        setUserMenuAnchorEl(null);
    };

    const handleAccountClick = () => {
        handleCloseUserMenu();
        console.log('Account clicked');
    };

    const handleSettingsClick = () => {
        handleCloseUserMenu();
        console.log('Settings clicked');
    };

    const handleLogoutClick = async () => {
        handleCloseUserMenu();
        await logout();
        window.location.href = '/';
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

    const getConversationTitle = (conversation) => {
        const firstUser = conversation?.messages?.find((msg) => msg.role === 'user');
        return firstUser?.content || 'Untitled conversation';
    };

    const isActiveConversation = (conversation) => {
        if (!conversation?.id) return false;
        if (location.pathname !== '/chat') return false;
        if (conversation.id !== activeConversationId) return false;
        return Array.isArray(conversation.messages) && conversation.messages.length > 0;
    };

    const tooltipProps = {
        placement: 'right',
        componentsProps: {
            tooltip: {
                sx: {
                    backgroundColor: '#E7F1FF',
                    color: '#164563',
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

    const renderNavItem = (item) => {
        const linkProps = item.onClick
            ? { component: 'button', onClick: item.onClick, type: 'button' }
            : item.to
                ? { component: Link, to: item.to }
                : { component: 'a', href: item.href, target: '_blank', rel: 'noopener noreferrer' };

        const icon = item.icon;

        const button = (
            <ListItemButton
                selected={isSelected(item)}
                aria-label={item.label}
                {...linkProps}
                sx={{
                    width: '100%',
                    minHeight: 48,
                    mb: 0.5,
                    borderRadius: 1.5,
                    justifyContent: 'flex-start',
                    px: 1.5,
                    color: '#164563',
                    '&.Mui-selected': {
                        backgroundColor: 'transparent',
                        color: '#164563',
                        '& .sidebar-nav-icon': {
                            backgroundColor: '#2c5cf3',
                            color: '#ffffff',
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
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            backgroundColor: '#e9f1fe',
                            color: '#2c5cf3',
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
                        fontFamily: 'DM Sans, sans-serif',
                        fontWeight: 600,
                        fontSize: '16px',
                        color: '#164563',
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

    return (
        <Drawer variant="permanent" open={open}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        px: 1.5,
                        py: 1,
                    }}
                >
                    {showLogo && (
                        <Box
                            sx={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                pl: 1,
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
                                    onClick={open ? undefined : () => setOpen(true)}
                                    size="small"
                                    className="sidebar-logo-link"
                                    sx={{
                                        p: 0,
                                        width: 48,
                                        height: 48,
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
                                            width: 48,
                                            height: 48,
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
                                                color: '#2c5cf3',
                                            }}
                                        />
                                    </Box>
                                </IconButton>
                            </Tooltip>
                            <Typography
                                className="sidebar-logo-text"
                                sx={{
                                    fontFamily: 'DM Sans, sans-serif',
                                    fontWeight: 600,
                                    fontSize: '32px',
                                    transform: 'scaleX(0.8)',
                                    letterSpacing: '3px',
                                    color: '#2c67a9',
                                    opacity: open ? 1 : 0,
                                    width: open ? 'auto' : 0,
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    transition: 'opacity 0.2s ease, width 0.2s ease',
                                }}
                            >
                                GLKB
                            </Typography>
                            <Box
                                sx={{
                                    opacity: open ? 1 : 0,
                                    width: open ? 'auto' : 0,
                                    overflow: 'hidden',
                                    marginLeft: 'auto',
                                    transition: 'opacity 0.2s ease, width 0.2s ease',
                                }}
                            >
                                <Tooltip title="Collapse sidebar" {...tooltipProps}>
                                    <IconButton
                                        aria-label="Collapse sidebar"
                                        onClick={() => setOpen((prev) => !prev)}
                                        size="small"
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: '50%',
                                            '&:hover': {
                                                backgroundColor: 'rgba(1, 105, 176, 0.04)',
                                            },
                                        }}
                                    >
                                        <SidebarLeftIcon style={{ width: 22, height: 22 }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    )}
                </Box>
                <Divider sx={{ display: 'none' }} />
                <List sx={{ px: 1, py: 1 }}>
                    {topItems.map((item) => renderNavItem(item))}
                </List>
                <Divider sx={{ mx: 3.5 }} />
                <List sx={{ px: 1, py: 1 }}>
                    {middleItems.map((item) => renderNavItem(item))}
                </List>
                <Divider sx={{ mx: 3.5 }} />
                <List sx={{ px: 1, py: 1 }}>
                    {bottomItems.map((item) => renderNavItem(item))}
                </List>
                {open && (
                    <Box className="sidebar-recent-section">
                        <Typography className="sidebar-recent-title">
                            Recent
                        </Typography>
                        <Box className="sidebar-recent-list">
                            {recentConversations.slice(0, maxRecentCount).map((conversation) => (
                                <button
                                    key={conversation.id}
                                    type="button"
                                    className={`sidebar-recent-item${isActiveConversation(conversation) ? ' active' : ''}`}
                                    onClick={() => {
                                        setActiveConversationId(conversation.id);
                                        setActiveConversationIdState(conversation.id);
                                        navigate('/chat', { state: { conversationId: conversation.id } });
                                    }}
                                >
                                    {getConversationTitle(conversation)}
                                </button>
                            ))}
                        </Box>
                    </Box>
                )}
                <Box sx={{ mt: 'auto', pb: 2 }}>
                    <List sx={{ px: 1, py: 1 }}>
                        {!isAuthenticated ? (
                            renderNavItem(loginItem)
                        ) : (
                            renderNavItem({
                                label: userDisplayName,
                                icon: <PersonIcon sx={{ fontSize: 22 }} />,
                                onClick: handleOpenUserMenu,
                                iconBoxSx: {
                                    backgroundColor: '#2c5cf3',
                                    color: '#ffffff',
                                },
                            })
                        )}
                    </List>
                </Box>
            </Box>
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
                        gap: 1,
                    },
                }}
                PaperProps={{
                    sx: {
                        minWidth: 240,
                        borderRadius: 2,
                        boxShadow: '0px 4px 6px -2px rgba(16,24,40,0.03), 0px 12px 16px -4px rgba(16,24,40,0.08)',
                        '& .MuiMenuItem-root': {
                            color: '#444444',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 400,
                            fontSize: '14px',
                        },
                        '& .MuiListItemText-primary': {
                            color: '#444444',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 400,
                            fontSize: '14px',
                        },
                    },
                }}
            >
                <MenuItem
                    sx={{
                        px: 2,
                        py: 1,
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
                            color: '#444444',
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
                <MenuItem onClick={handleSettingsClick} sx={{ px: 2, py: 1 }}>
                    <ListItemIcon sx={{ minWidth: "16px !important", mr: 1 }}>
                        <Box
                            component="img"
                            src={userSettingsIcon}
                            alt="Settings"
                            sx={{ width: 16, height: 16, objectFit: 'contain' }}
                        />
                    </ListItemIcon>
                    <ListItemText>Settings</ListItemText>
                </MenuItem>
                <Divider />
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
        </Drawer>
    );
}

export default NavBarWhite;
