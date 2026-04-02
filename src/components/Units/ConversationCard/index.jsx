import './scoped.css';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  DeleteOutline as DeleteOutlineIcon,
  DriveFileRenameOutline as DriveFileRenameOutlineIcon,
  FolderOutlined as FolderOutlinedIcon,
  MoreHoriz as MoreHorizIcon,
} from '@mui/icons-material';
import {
  Box,
  Checkbox,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';

const getDefaultTitle = (conversation) => (
    conversation?.leadingTitle || conversation?.title || 'Untitled conversation'
);

const getDefaultSubtitle = (conversation) => {
    const count = typeof conversation?.messageCount === 'number'
        ? conversation.messageCount
        : 0;
    return `${count} ${count === 1 ? 'message' : 'messages'}`;
};

const ConversationCard = ({
    conversation,
    title,
    titleContent,
    subtitle,
    timestamp,
    footerContent,
    selectMode = false,
    isSelected = false,
    showCheckboxOnHover = false,
    onToggleSelect,
    onOpen,
    onRename,
    onBookmark,
    onDelete,
    onManageFolders,
    isBookmarked = false,
    bookmarkLabel,
    folderLabel = 'Add to folder',
    menuDisabled = false,
}) => {
    const resolvedTitle = useMemo(
        () => (title !== undefined ? title : getDefaultTitle(conversation)),
        [conversation, title]
    );
    const resolvedSubtitle = useMemo(
        () => (subtitle !== undefined ? subtitle : getDefaultSubtitle(conversation)),
        [conversation, subtitle]
    );
    const resolvedTitleLabel = typeof resolvedTitle === 'string'
        ? resolvedTitle
        : getDefaultTitle(conversation);
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingTitle, setEditingTitle] = useState(resolvedTitle);
    const hasMenu = Boolean(onRename || onBookmark || onDelete || onManageFolders);
    const isMenuOpen = Boolean(menuAnchorEl);
    const resolvedBookmarkLabel = bookmarkLabel != null
        ? bookmarkLabel
        : (isBookmarked ? 'Remove bookmark' : 'Bookmark');
    const BookmarkMenuIcon = isBookmarked ? BookmarkIcon : BookmarkBorderIcon;

    useEffect(() => {
        if (!isEditing) {
            setEditingTitle(resolvedTitle);
        }
    }, [isEditing, resolvedTitle]);

    const handleOpenMenu = (event) => {
        event.stopPropagation();
        if (!hasMenu || menuDisabled || isEditing) return;
        setMenuAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        if (menuAnchorEl?.blur) {
            menuAnchorEl.blur();
        }
        setMenuAnchorEl(null);
    };

    const handleStartRename = () => {
        if (!onRename) return;
        handleCloseMenu();
        window.setTimeout(() => {
            setIsEditing(true);
            setEditingTitle(resolvedTitle);
        }, 0);
    };

    const commitInlineRename = async () => {
        if (!onRename) {
            setIsEditing(false);
            return;
        }
        const trimmedTitle = editingTitle.trim();
        if (trimmedTitle && trimmedTitle !== resolvedTitle) {
            try {
                await onRename(conversation, trimmedTitle);
            } catch (error) {
                // Ignore failures and keep existing title.
            }
        }
        setIsEditing(false);
    };

    const cancelInlineRename = () => {
        setIsEditing(false);
        setEditingTitle(resolvedTitle);
    };

    const handleBookmark = async () => {
        if (!onBookmark) return;
        try {
            await onBookmark(conversation);
        } catch (error) {
            // Ignore bookmark failures.
        }
        handleCloseMenu();
    };

    const handleDelete = async () => {
        if (!onDelete) return;
        try {
            await onDelete(conversation);
        } catch (error) {
            // Ignore delete failures.
        }
        handleCloseMenu();
    };

    const handleCardClick = () => {
        if (isEditing) return;
        if (selectMode) {
            if (onToggleSelect) {
                onToggleSelect(conversation?.id);
            }
            return;
        }
        if (onOpen) {
            onOpen(conversation);
        }
    };

    const shouldRenderCheckbox = selectMode || showCheckboxOnHover;

    return (
        <Box className={`history-item-row${selectMode ? ' history-item-row-select-mode' : ''}`}>
            {shouldRenderCheckbox && (
                <Checkbox
                    className="history-row-checkbox"
                    checked={isSelected}
                    onClick={(event) => {
                        event.stopPropagation();
                    }}
                    onChange={() => {
                        if (onToggleSelect) {
                            onToggleSelect(conversation?.id, true);
                        }
                    }}
                    inputProps={{ 'aria-label': `Select ${resolvedTitleLabel}` }}
                    sx={{
                        color: '#D9D9D9',
                        padding: '4px',
                        '&.Mui-checked': { color: '#155DFC' },
                    }}
                />
            )}
            <div
                role="button"
                tabIndex={0}
                className="history-item"
                onClick={handleCardClick}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleCardClick();
                    }
                }}
            >
                <Box className="history-item-content">
                    <Box className="history-item-title-row">
                        {isEditing ? (
                            <input
                                className="history-title-input"
                                type="text"
                                value={editingTitle}
                                autoFocus
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => setEditingTitle(event.target.value)}
                                onBlur={commitInlineRename}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        commitInlineRename();
                                    }
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        cancelInlineRename();
                                    }
                                }}
                                aria-label="Edit conversation title"
                            />
                        ) : (
                            titleContent ? (
                                titleContent
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
                                    {resolvedTitle}
                                </Typography>
                            )
                        )}
                        {hasMenu && (
                            <IconButton
                                size="small"
                                className="history-item-more"
                                onClick={handleOpenMenu}
                                aria-label="Open conversation menu"
                                disabled={menuDisabled || isEditing}
                                sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '8px',
                                    color: '#164563',
                                }}
                            >
                                <MoreHorizIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        )}
                    </Box>
                    <Typography sx={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        color: '#646464',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                    }}>
                        {resolvedSubtitle}
                    </Typography>
                    {footerContent !== undefined && footerContent !== null ? (
                        footerContent
                    ) : (timestamp !== undefined && timestamp !== null && (
                        <Typography sx={{
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 500,
                            fontSize: '12px',
                            color: '#808080',
                        }}>
                            {timestamp}
                        </Typography>
                    ))}
                </Box>
            </div>
            {hasMenu && (
                <Menu
                    anchorEl={menuAnchorEl}
                    open={isMenuOpen}
                    onClose={handleCloseMenu}
                    disableRestoreFocus
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
                    {onRename && (
                        <MenuItem onClick={handleStartRename}>
                            <ListItemIcon sx={{ minWidth: 26, color: '#164563' }}>
                                <DriveFileRenameOutlineIcon sx={{ fontSize: 18 }} />
                            </ListItemIcon>
                            <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>
                                Rename
                            </ListItemText>
                        </MenuItem>
                    )}
                    {onBookmark && (
                        <MenuItem onClick={handleBookmark}>
                            <ListItemIcon sx={{ minWidth: 26, color: '#164563' }}>
                                <BookmarkMenuIcon sx={{ fontSize: 18 }} />
                            </ListItemIcon>
                            <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>
                                {resolvedBookmarkLabel}
                            </ListItemText>
                        </MenuItem>
                    )}
                    {onManageFolders && (
                        <MenuItem onClick={() => {
                            handleCloseMenu();
                            onManageFolders(conversation);
                        }}>
                            <ListItemIcon sx={{ minWidth: 26, color: '#164563' }}>
                                <FolderOutlinedIcon sx={{ fontSize: 18 }} />
                            </ListItemIcon>
                            <ListItemText primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }}>
                                {folderLabel}
                            </ListItemText>
                        </MenuItem>
                    )}
                    {onDelete && (
                        <>
                            {(onRename || onBookmark || onManageFolders) && <Divider />}
                            <MenuItem onClick={handleDelete} sx={{ color: '#B42318 !important' }}>
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
                        </>
                    )}
                </Menu>
            )}
        </Box>
    );
};

export default ConversationCard;
