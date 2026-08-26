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
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import {
  Box,
  Checkbox,
  IconButton,
  Typography,
} from '@mui/material';

import { ContextMenu, ContextMenuItem } from '../ContextMenu';

const getDefaultTitle = (conversation) => (
    conversation?.leadingTitle || conversation?.title || 'Untitled conversation'
);

const ConversationCard = ({
    conversation,
    title,
    titleContent,
    leadingIcon,
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
    alwaysShowMenuButton = false,
    bookmarkLabel,
    folderLabel = 'Add to folder',
    menuDisabled = false,
}) => {
    const resolvedTitle = useMemo(
        () => (title !== undefined ? title : getDefaultTitle(conversation)),
        [conversation, title]
    );
    const resolvedSubtitle = subtitle;
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
                        color: 'var(--color-grey-200)',
                        padding: '4px',
                        '&.Mui-checked': { color: 'var(--color-brand-primary)' },
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
                {leadingIcon ? (
                    <span className="history-item-icon" aria-hidden="true">{leadingIcon}</span>
                ) : null}
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
                                <Typography className="history-title">
                                    {resolvedTitle}
                                </Typography>
                            )
                        )}
                        {hasMenu && (
                            <IconButton
                                size="small"
                                className={`history-item-more${alwaysShowMenuButton ? ' is-always-visible' : ''}`}
                                onClick={handleOpenMenu}
                                aria-label="Open conversation menu"
                                disabled={menuDisabled || isEditing}
                                sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '4px',
                                    color: 'var(--color-text-tertiary)',
                                }}
                            >
                                <MoreVertIcon sx={{ fontSize: 12 }} />
                            </IconButton>
                        )}
                    </Box>
                    {resolvedSubtitle ? (
                        <Typography className="history-subtitle">
                            {resolvedSubtitle}
                        </Typography>
                    ) : null}
                    {footerContent !== undefined && footerContent !== null ? (
                        footerContent
                    ) : (timestamp !== undefined && timestamp !== null && (
                        <Typography className="history-timestamp">
                            {timestamp}
                        </Typography>
                    ))}
                </Box>
            </div>
            {hasMenu && (
                <ContextMenu
                    anchorEl={menuAnchorEl}
                    open={isMenuOpen}
                    onClose={handleCloseMenu}
                    disableRestoreFocus
                >
                    {onRename && (
                        <ContextMenuItem
                            icon={<DriveFileRenameOutlineIcon />}
                            onClick={handleStartRename}
                        >
                            Rename
                        </ContextMenuItem>
                    )}
                    {onBookmark && (
                        <ContextMenuItem icon={<BookmarkMenuIcon />} onClick={handleBookmark}>
                            {resolvedBookmarkLabel}
                        </ContextMenuItem>
                    )}
                    {onManageFolders && (
                        <ContextMenuItem
                            icon={<FolderOutlinedIcon />}
                            onClick={() => {
                                handleCloseMenu();
                                onManageFolders(conversation);
                            }}
                        >
                            {folderLabel}
                        </ContextMenuItem>
                    )}
                    {onDelete && (
                        <ContextMenuItem icon={<DeleteOutlineIcon />} danger onClick={handleDelete}>
                            Delete
                        </ContextMenuItem>
                    )}
                </ContextMenu>
            )}
        </Box>
    );
};

export default ConversationCard;
