import './scoped.css';

import React, {
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    Link,
    useLocation,
} from 'react-router-dom';

import {
    ChatBubbleOutline as ChatBubbleOutlineIcon,
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
import {
    ReactComponent as CategorySearchIcon,
} from '../../../img/navbar/category_search.svg';
import {
    ReactComponent as CodeBlocksIcon,
} from '../../../img/navbar/code_blocks.svg';
import {
    ReactComponent as SidebarLeftIcon,
} from '../../../img/navbar/sidebar.left.svg';

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
    const location = useLocation();
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [open, setOpen] = useState(!isSmallScreen);

    useEffect(() => {
        if (isSmallScreen) {
            setOpen(false);
        }
    }, [isSmallScreen]);

    useEffect(() => {
        const body = document.body;
        body.setAttribute('data-has-sidebar', 'true');
        body.style.setProperty('--sidebar-width', open ? `${drawerWidth}px` : `${collapsedWidth}px`);

        return () => {
            body.removeAttribute('data-has-sidebar');
            body.style.removeProperty('--sidebar-width');
        };
    }, [open]);

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
            { label: 'Chat', to: '/chat', icon: <ChatBubbleOutlineIcon sx={{ fontSize: 22 }} /> },
            { label: 'Explore', to: '/search', icon: <CategorySearchIcon style={{ width: 22, height: 22 }} /> },
            { label: 'API', href: 'https://glkb.dcmb.med.umich.edu/docs', icon: <CodeBlocksIcon style={{ width: 22, height: 22 }} /> },
        ]
    ), []);

    const bottomItems = useMemo(() => (
        [
            { label: 'About', to: '/about', icon: <InfoOutlinedIcon sx={{ fontSize: 22 }} /> },
            { label: 'Contact', href: 'https://jieliu6.github.io/', icon: <ContactPageIcon sx={{ fontSize: 22 }} /> },
        ]
    ), []);

    const loginItem = useMemo(() => (
        { label: 'Login', to: '/login', icon: <PersonIcon sx={{ fontSize: 22 }} /> }
    ), []);

    const isSelected = (item) => {
        if (!item.to) {
            return false;
        }

        if (item.exact) {
            return location.pathname === item.to;
        }

        return location.pathname.startsWith(item.to);
    };

    const renderNavItem = (item) => {
        const linkProps = item.to
            ? { component: Link, to: item.to }
            : { component: 'a', href: item.href, target: '_blank', rel: 'noopener noreferrer' };

        const icon = item.icon;

        const button = (
            <ListItemButton
                selected={isSelected(item)}
                aria-label={item.label}
                {...linkProps}
                sx={{
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
            <Tooltip key={item.label} title={item.label} placement="right">
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
                        py: 2,
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
                <Box sx={{ mt: 'auto', pb: 2 }}>
                    <List sx={{ px: 1, py: 1 }}>
                        {renderNavItem(loginItem)}
                    </List>
                </Box>
            </Box>
        </Drawer>
    );
}

export default NavBarWhite;
