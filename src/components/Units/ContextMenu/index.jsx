/**
 * The item options menu, from Figma 176:8771 — the popover behind the ⋮ button on a History
 * conversation (176:12766) and a Library reference (176:8622).
 *
 * It existed five times over before this, once per place that needed it, and had drifted in all
 * the ways copies drift: three different row heights, two different icon gutters, a divider
 * above Delete that the design does not draw, and a 176px minimum width on a menu whose widest
 * label is "Remove bookmark". Everything here comes from the frame:
 *
 *   paper   surface, 1px border/default, radius/2, padding space/1, and no shadow — the design
 *           separates the menu from the page with the border alone
 *   width   whatever the labels need; the frame sets none
 *   row     20 tall, space/1 of padding, space/1 gap, radius/1, background/subtle when hovered
 *   icon    12
 *   label   caption — 10/12 regular — in text/secondary
 *   danger  status/error text, on the icon as well as the label
 *
 * Composition rather than an items array: the menus differ in what they offer and when, and a
 * list of props describing a row is a worse way to say that than a row.
 */
import React from 'react';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';

/** Figma 176:8771. */
const PAPER_SX = {
    borderRadius: 'var(--radius-2, 8px)',
    border: '1px solid var(--color-border-default)',
    backgroundColor: 'var(--color-background-surface)',
    padding: '4px',
    // The frame draws no shadow. A border at this size reads as a menu on its own, and a
    // shadow under a 20px row looks like a mistake rather than elevation.
    boxShadow: 'none',
};

const LIST_SX = {
    // The paper's 4px is the padding; MUI's own would double it.
    padding: 0,
};

const LABEL_SX = {
    fontFamily: 'Geist, sans-serif',
    fontSize: '10px',
    lineHeight: '12px',
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
                minHeight: 20,
                height: 20,
                padding: '0 4px',
                gap: '4px',
                borderRadius: 'var(--radius-1, 4px)',
                color,
                '&:hover': { backgroundColor: 'var(--color-background-subtle)' },
                ...(rest.sx || {}),
            }}
        >
            {icon ? (
                // minWidth 0 because the gap is the gutter — MUI's default 56px gutter is what
                // made these rows so much wider than the frame's.
                <ListItemIcon sx={{ minWidth: 0, color, '& .MuiSvgIcon-root': { fontSize: 12 } }}>
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
