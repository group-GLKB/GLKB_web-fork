/** Shared item-options menu from Figma 176:12870. */
import React from 'react';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { ReactComponent as ContextMenuBookmarkIcon } from '../../../img/context_menu/bookmark.svg';
import { ReactComponent as ContextMenuDeleteIcon } from '../../../img/context_menu/delete.svg';
import { ReactComponent as ContextMenuRenameIcon } from '../../../img/context_menu/rename.svg';

export {
    ContextMenuBookmarkIcon,
    ContextMenuDeleteIcon,
    ContextMenuRenameIcon,
};

const PAPER_SX = {
    borderRadius: 'var(--radius-2, 8px)',
    border: '1px solid var(--color-border-default)',
    backgroundColor: 'var(--color-background-subtle)',
    padding: 0,
    boxShadow: 'none',
};

const LIST_SX = {
    padding: 0,
};

const LABEL_SX = {
    fontFamily: 'Geist, sans-serif',
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: 400,
};

export const ContextMenu = ({ anchorEl, open, onClose, children, ...rest }) => (
    <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{ sx: LIST_SX }}
        slotProps={{ paper: { sx: PAPER_SX } }}
        {...rest}
    >
        {children}
    </Menu>
);

export const ContextMenuItem = ({ icon, children, danger = false, ...rest }) => {
    const color = danger ? 'var(--color-status-error-text)' : 'var(--color-text-secondary)';
    return (
        <MenuItem
            {...rest}
            sx={{
                minHeight: 38,
                height: 38,
                padding: '8px 16px',
                gap: '8px',
                borderRadius: 'var(--radius-1, 4px)',
                color,
                '&:hover, &.Mui-focusVisible, &.Mui-selected, &.Mui-selected:hover': {
                    backgroundColor: 'var(--color-background-normal)',
                },
                ...(rest.sx || {}),
            }}
        >
            {icon ? (
                <ListItemIcon
                    style={{ minWidth: 0 }}
                    sx={{
                        width: 16,
                        height: 16,
                        flex: '0 0 16px',
                        color,
                        '& svg': { width: 16, height: 16, fontSize: 16 },
                    }}
                >
                    {icon}
                </ListItemIcon>
            ) : null}
            <ListItemText primaryTypographyProps={{ sx: { ...LABEL_SX, color } }}>
                {children}
            </ListItemText>
        </MenuItem>
    );
};

export default ContextMenu;
