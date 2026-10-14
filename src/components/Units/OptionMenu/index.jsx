/**
 * A dropdown in the app's own style: a label with a chevron, opening a panel of options with the
 * current one checked and a line of explanation under each. It is the model picker's look
 * (TierPicker) made reusable, so the literature review's scope, citation style and export menu
 * read as the same kind of control as the Model row beside them instead of MUI's stock menus.
 *
 *   OptionSelect  a trigger and its panel, for a value picked from a list
 *   OptionPanel   the panel alone, anchored to an element, for a trigger of the caller's own (a
 *                 chip) or contents of its own (the year range)
 *   OptionItem    one row of a panel
 *
 * An option may be `blocked` with a note: it is listed, dimmed, and choosing it shows the note
 * (with an optional action) instead of selecting it — the reader learns why it cannot be had and
 * what to do, where a disabled row would only refuse the click.
 */
import './scoped.css';

import React, { forwardRef, useEffect, useRef, useState } from 'react';

import CheckIcon from '@mui/icons-material/Check';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { ClickAwayListener, Popper } from '@mui/material';

const FALLBACK = {
    'bottom-end': ['top-end'],
    'bottom-start': ['top-start'],
    'top-start': ['bottom-start'],
    'top-end': ['bottom-end'],
};

const focusable = (panel) => Array.from(panel?.querySelectorAll('[role="option"], [role="menuitem"]') || [])
    .filter((el) => !el.disabled);

export const OptionPanel = ({
    anchorEl, open, onClose, label, placement = 'bottom-end', role = 'listbox', className = '', children,
}) => {
    const panelRef = useRef(null);
    useEffect(() => {
        if (!open) return;
        // The checked row takes focus (as a native select does), else the first row.
        const id = setTimeout(() => {
            const panel = panelRef.current;
            const target = panel?.querySelector('[aria-selected="true"]') || focusable(panel)[0];
            target?.focus({ preventScroll: true });
        }, 0);
        return () => clearTimeout(id);
    }, [open]);
    if (!open || !anchorEl) return null;
    const onKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose?.();
            anchorEl?.focus?.();
            return;
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const rows = focusable(panelRef.current);
        if (!rows.length) return;
        event.preventDefault();
        const at = rows.indexOf(document.activeElement);
        const next = event.key === 'ArrowDown' ? Math.min(rows.length - 1, at + 1) : Math.max(0, at - 1);
        rows[at < 0 ? 0 : next].focus();
    };
    return (
        <Popper
            open
            anchorEl={anchorEl}
            placement={placement}
            className="option-menu-layer"
            modifiers={[
                { name: 'offset', options: { offset: [0, 6] } },
                { name: 'flip', options: { fallbackPlacements: FALLBACK[placement] || [] } },
                { name: 'preventOverflow', options: { padding: 8 } },
            ]}
        >
            <ClickAwayListener
                onClickAway={(event) => {
                    // The trigger toggles; a click on it is not "away".
                    if (anchorEl?.contains?.(event.target)) return;
                    onClose?.();
                }}
            >
                <div
                    ref={panelRef}
                    className={`option-menu-panel ${className}`.trim()}
                    role={role}
                    aria-label={label}
                    // React events bubble through the portal: keep them from the composer around
                    // the trigger (the home bar's scope row cancels mousedown to keep its focus).
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={onKeyDown}
                >
                    {children}
                </div>
            </ClickAwayListener>
        </Popper>
    );
};

export const OptionItem = ({
    label, hint, selected = false, blocked = false, disabled = false, role = 'option', onClick, title,
}) => (
    <button
        type="button"
        role={role}
        aria-selected={role === 'option' ? selected : undefined}
        aria-disabled={blocked || undefined}
        disabled={disabled}
        title={title}
        className={`option-menu-item${selected ? ' is-selected' : ''}${blocked ? ' is-blocked' : ''}`}
        onClick={onClick}
    >
        <span className="option-menu-item-text">
            <span className="option-menu-item-label">{label}</span>
            {hint && <span className="option-menu-item-hint">{hint}</span>}
        </span>
        {selected && <CheckIcon className="option-menu-check" />}
    </button>
);

/** The note a blocked option leaves in its panel, with what to do about it. */
export const OptionNote = ({ children, action }) => (
    <div className="option-menu-note" role="status">
        <span>{children}</span>
        {action && (
            <button type="button" className="option-menu-note-action" onClick={action.onClick}>{action.label}</button>
        )}
    </div>
);

export const OptionTrigger = forwardRef(({
    children, open = false, label, disabled = false, title, className = '', onClick,
}, ref) => (
    <button
        ref={ref}
        type="button"
        className={`option-menu-trigger ${className}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        title={title}
        onClick={onClick}
    >
        <span className="option-menu-trigger-label">{children}</span>
        <ChevronRightIcon className={`option-menu-chevron${open ? ' expanded' : ''}`} />
    </button>
));
OptionTrigger.displayName = 'OptionTrigger';

/** A trigger and a panel of the caller's own contents: `children(close)`. */
export const OptionDropdown = ({
    label, panelLabel = label, display, disabled = false, title, className = '', panelClassName = '', placement = 'bottom-end',
    children,
}) => {
    const triggerRef = useRef(null);
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);
    return (
        <>
            <OptionTrigger ref={triggerRef} open={open} label={label} disabled={disabled} title={title}
                           className={className} onClick={() => setOpen((was) => !was)}>
                {display}
            </OptionTrigger>
            <OptionPanel anchorEl={triggerRef.current} open={open} onClose={close} label={panelLabel}
                         placement={placement} className={panelClassName}>
                {children(close)}
            </OptionPanel>
        </>
    );
};

/**
 * A value picked from `options` ([{id, label, hint?, blocked?: {note, action?}}]). `label` names
 * the trigger (with its value, "Sources: Search only"), `panelLabel` the panel ("Sources");
 * `display` is what the trigger shows (the selected label by default); `footer` is extra content
 * under the rows. `onBlocked(option)` hears a blocked row being chosen.
 */
export const OptionSelect = ({
    label, panelLabel = label, value, options, onChange, display, disabled = false, title, className = '', panelClassName = '',
    placement = 'bottom-end', footer = null, onBlocked,
}) => {
    const triggerRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState(null);
    const close = () => { setOpen(false); setNote(null); };
    const current = options.find((o) => o.id === value);
    return (
        <>
            <OptionTrigger
                ref={triggerRef}
                open={open}
                label={label}
                disabled={disabled}
                title={title}
                className={className}
                onClick={() => (open ? close() : setOpen(true))}
            >
                {display ?? current?.label ?? ''}
            </OptionTrigger>
            <OptionPanel anchorEl={triggerRef.current} open={open} onClose={close} label={panelLabel}
                         placement={placement} className={panelClassName}>
                {options.map((o) => (
                    <OptionItem
                        key={String(o.id)}
                        label={o.label}
                        hint={o.hint}
                        selected={o.id === value}
                        blocked={Boolean(o.blocked)}
                        disabled={o.disabled}
                        title={o.title}
                        onClick={() => {
                            if (o.blocked) {
                                setNote(o.blocked);
                                onBlocked?.(o);
                                return;
                            }
                            close();
                            if (o.id !== value) onChange?.(o.id);
                        }}
                    />
                ))}
                {note && (
                    <OptionNote action={note.action && {
                        label: note.action.label,
                        onClick: () => { close(); note.action.onClick(); },
                    }}>
                        {note.note}
                    </OptionNote>
                )}
                {footer && (typeof footer === 'function' ? footer(close) : footer)}
            </OptionPanel>
        </>
    );
};

export default OptionSelect;
