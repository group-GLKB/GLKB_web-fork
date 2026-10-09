/**
 * Attachments on a chat question (service/attachments.js): the composer's "+" button and its
 * pending chips, and the files shown on a message once it has been sent.
 *
 * Used by both composers (the home search bar and the chat's) and by the conversation, so the
 * styles live beside it rather than in a feature's stylesheet — see TierPicker for why.
 */
import './scoped.css';

import React, { useEffect, useRef, useState } from 'react';

import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import {
    ClickAwayListener,
    Modal,
    Popper,
    Tooltip,
} from '@mui/material';

import {
    attachmentMetaText,
    attachmentObjectUrl,
    formatLabelForName,
    isCodeFormat,
    normalizeAttachmentList,
} from '../../../service/attachments';
import { trackGtagEvent } from '../../../utils/gtag';

export { default as useAttachments } from './useAttachments';

const ATTACH_LABEL = 'Add files or photos';

/** The icon for a file that is not a picture: code, PDF, or a plain document. */
export const FileKindIcon = ({ kind, format, filename, className = '' }) => {
    if (kind === 'image') return <ImageOutlinedIcon className={className} fontSize="inherit" />;
    if (kind === 'pdf') return <PictureAsPdfOutlinedIcon className={className} fontSize="inherit" />;
    if (isCodeFormat(format || formatLabelForName(filename))) {
        return <CodeIcon className={className} fontSize="inherit" />;
    }
    return <DescriptionOutlinedIcon className={className} fontSize="inherit" />;
};

/** The files on a drop or a paste, of any type (the hook sorts out what is allowed). */
export const filesFromTransfer = (transfer) => {
    if (!transfer) return [];
    const fromFiles = Array.from(transfer.files || []);
    if (fromFiles.length) return fromFiles;
    return Array.from(transfer.items || [])
        .filter((item) => item?.kind === 'file')
        .map((item) => item.getAsFile?.())
        .filter(Boolean);
};

/** Whether a drag carries files (and not, say, selected text). */
export const dragHasFiles = (event) => {
    const types = event?.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
};

/**
 * The "+" button at the start of the composer, as in ChatGPT: a plain "+", which turns a
 * grey circle while its panel is open, and a panel the width of the composer that opens under
 * it (above it when there is no room, as at the foot of a conversation) with one entry, "Add
 * photos and files". Any file type — the backend reads each as a picture or as text. Pasting
 * needs no entry: Ctrl/⌘+V in the message box attaches what is on the clipboard.
 *
 * A guest is asked to sign in instead; on Investigate it is disabled, with the reason as its
 * tooltip. The panel anchors to the nearest `[data-attach-anchor]` (the composer's box), or
 * to the button itself when there is none.
 */
export const AttachButton = ({
    onFiles,
    isGuest = false,
    onRequireSignIn,
    disabled = false,
    disabledReason = '',
    source = 'chat',
    className = '',
}) => {
    const inputRef = useRef(null);
    const buttonRef = useRef(null);
    const [anchor, setAnchor] = useState(null);
    const menuOpen = Boolean(anchor) && !disabled;
    const title = disabled && disabledReason ? disabledReason : ATTACH_LABEL;
    const close = () => setAnchor(null);
    const pickFiles = () => {
        close();
        trackGtagEvent('chat_attach_click', { source, via: 'menu' });
        inputRef.current?.click();
    };
    return (
        <>
            <Tooltip title={menuOpen ? '' : title} placement="top" arrow>
                {/* A span, because a tooltip on a disabled button never sees the pointer. */}
                <span className={`attach-button-wrap ${className}`.trim()}>
                    <button
                        ref={buttonRef}
                        type="button"
                        className={`attach-button${menuOpen ? ' is-open' : ''}`}
                        aria-label={ATTACH_LABEL}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        disabled={disabled}
                        onMouseDown={(event) => {
                            // Keeps focus (and, on the home page, the example list) where it was.
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (disabled) return;
                            if (isGuest) {
                                trackGtagEvent('chat_attach_sign_in_prompt', { source });
                                onRequireSignIn?.();
                                return;
                            }
                            if (menuOpen) {
                                close();
                                return;
                            }
                            const button = buttonRef.current;
                            setAnchor(button?.closest('[data-attach-anchor]') || button);
                        }}
                    >
                        <AddIcon className="attach-button-icon" />
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        hidden
                        data-testid="attachment-file-input"
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                            const files = Array.from(event.target.files || []);
                            // Cleared so picking the same file again still fires a change.
                            event.target.value = '';
                            if (files.length) onFiles?.(files);
                        }}
                    />
                </span>
            </Tooltip>
            {menuOpen && (
                <Popper
                    open
                    anchorEl={anchor}
                    placement="bottom-start"
                    className="attach-menu-layer"
                    modifiers={[
                        { name: 'offset', options: { offset: [0, 8] } },
                        { name: 'flip', options: { fallbackPlacements: ['top-start'] } },
                    ]}
                    style={{ width: anchor?.getBoundingClientRect?.().width || undefined }}
                >
                    <ClickAwayListener
                        onClickAway={(event) => {
                            // The + itself toggles; a click on it is not "away".
                            if (buttonRef.current?.contains(event.target)) return;
                            close();
                        }}
                    >
                        <div
                            className="attach-menu"
                            role="menu"
                            aria-label="Add"
                            // React events bubble through the portal: keep them away from the
                            // composer (the home page's Autocomplete would take focus).
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') close();
                            }}
                        >
                            <div className="attach-menu-heading">Add</div>
                            <button
                                type="button"
                                role="menuitem"
                                className="attach-menu-item"
                                onClick={pickFiles}
                            >
                                <AttachFileIcon className="attach-menu-item-icon" />
                                <span className="attach-menu-item-label">Add photos and files</span>
                                <span className="attach-menu-item-hint">Upload from computer</span>
                            </button>
                        </div>
                    </ClickAwayListener>
                </Popper>
            )}
        </>
    );
};

const chipMeta = (item) => {
    if (item.status === 'uploading') {
        return `Uploading… ${Math.round((Number(item.progress) || 0) * 100)}%`;
    }
    if (item.status === 'error') return item.error || 'Upload failed.';
    return attachmentMetaText(item.attachment, { fallbackName: item.name, fallbackSize: item.size });
};

/**
 * The files waiting on a composer, with their upload state. `blockedNote` explains why the
 * question cannot be sent as it stands (a failed upload, Investigate).
 */
export const AttachmentChips = ({ items = [], notice = '', blockedNote = '', onRemove }) => {
    // The waiting image shown large (its local preview), until closed.
    const [preview, setPreview] = useState(null);
    if (!items.length && !notice && !blockedNote) return null;
    return (
        <div
            className="attachment-chips"
            // Inside the home page's Autocomplete, a click anywhere would focus the field and
            // drop the example list open over the chips.
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
        >
            {items.length > 0 && (
                <ul className="attachment-chip-list" aria-label="Attached files">
                    {items.map((item) => (
                        <li
                            key={item.key}
                            className={`attachment-chip is-${item.status} is-${item.kind}`}
                            data-testid="attachment-chip"
                        >
                            {item.kind === 'image' && item.previewUrl ? (
                                <button
                                    type="button"
                                    className="attachment-chip-thumb-button"
                                    aria-label={`Preview ${item.name}`}
                                    onClick={() => setPreview({ src: item.previewUrl, name: item.name })}
                                >
                                    <img className="attachment-chip-thumb" src={item.previewUrl} alt="" />
                                </button>
                            ) : (
                                <span className="attachment-chip-icon" aria-hidden="true">
                                    <FileKindIcon
                                        kind={item.kind}
                                        format={item.attachment?.format}
                                        filename={item.name}
                                    />
                                </span>
                            )}
                            <span className="attachment-chip-text">
                                <span className="attachment-chip-name" title={item.name}>{item.name}</span>
                                <span
                                    className="attachment-chip-meta"
                                    role={item.status === 'error' ? 'alert' : undefined}
                                >
                                    {chipMeta(item)}
                                </span>
                                {item.status === 'ready' && item.attachment?.truncated && (
                                    <span className="attachment-chip-warning">
                                        Long file — only the first part will be read
                                    </span>
                                )}
                            </span>
                            {item.status === 'uploading' && (
                                <span
                                    className="attachment-chip-progress"
                                    role="progressbar"
                                    aria-label={`Uploading ${item.name}`}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.round((Number(item.progress) || 0) * 100)}
                                >
                                    <span style={{ width: `${Math.round((Number(item.progress) || 0) * 100)}%` }} />
                                </span>
                            )}
                            <button
                                type="button"
                                className="attachment-chip-remove"
                                aria-label={`Remove ${item.name}`}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onRemove?.(item.key);
                                }}
                            >
                                <CloseIcon fontSize="inherit" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {(blockedNote || notice) && (
                <div className="attachment-chips-note" role="status">
                    {blockedNote || notice}
                </div>
            )}
            <ImageLightbox
                src={preview?.src}
                name={preview?.name}
                open={Boolean(preview)}
                onClose={() => setPreview(null)}
            />
        </div>
    );
};

/**
 * Why a composer holding these attachments cannot send yet, or '' when it can. Uploads in
 * flight only disable the button (their chips show progress); this is for what the reader has
 * to act on.
 */
export const attachmentBlockedNote = (controller, { investigate = false } = {}) => {
    if (!controller?.hasItems) return '';
    if (investigate) return 'Attachments work in AI Chat. Remove them, or ask in a new AI Chat.';
    if (controller.hasErrors) return 'Remove the files that could not be attached to send your question.';
    return '';
};

/**
 * An image shown large over the page, as Claude and ChatGPT do — not in a new tab, where the
 * browser's own viewer has no way back but closing the tab. Closes on the ×, on Esc, and on a
 * click anywhere outside the picture.
 */
export const ImageLightbox = ({ src, name, open, onClose }) => (
    <Modal
        open={Boolean(open && src)}
        onClose={onClose}
        slotProps={{ backdrop: { className: 'image-lightbox-backdrop' } }}
    >
        <div
            className="image-lightbox"
            role="dialog"
            aria-label={name || 'Image'}
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            <button type="button" className="image-lightbox-close" aria-label="Close" onClick={onClose}>
                <CloseIcon fontSize="inherit" />
            </button>
            <img className="image-lightbox-img" src={src || undefined} alt={name || ''} />
            {name ? <div className="image-lightbox-name">{name}</div> : null}
        </div>
    </Modal>
);

const ImageTile = ({ attachment }) => {
    const [url, setUrl] = useState(null);
    const [failed, setFailed] = useState(false);
    const [enlarged, setEnlarged] = useState(false);
    useEffect(() => {
        let cancelled = false;
        setFailed(false);
        attachmentObjectUrl(attachment.id)
            .then((next) => { if (!cancelled) setUrl(next); })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, [attachment.id]);
    if (failed) {
        return (
            <span className="message-attachment is-image is-unavailable" title={attachment.filename}>
                <ImageOutlinedIcon fontSize="inherit" />
                <span className="message-attachment-caption">Image unavailable</span>
            </span>
        );
    }
    return (
        <>
            <button
                type="button"
                className="message-attachment is-image"
                title={attachment.filename}
                aria-label={`Open ${attachment.filename}`}
                data-testid="message-attachment-image"
                disabled={!url}
                onClick={() => setEnlarged(true)}
            >
                {url
                    ? <img src={url} alt={attachment.filename} />
                    : <span className="message-attachment-placeholder" aria-hidden="true" />}
            </button>
            <ImageLightbox
                src={url}
                name={attachment.filename}
                open={enlarged}
                onClose={() => setEnlarged(false)}
            />
        </>
    );
};

/** A sent file that is not a picture (PDF, code, a notebook, a document): opens in a new tab. */
const FileTile = ({ attachment }) => {
    const [failed, setFailed] = useState(false);
    const meta = attachmentMetaText(attachment);
    const open = () => {
        // Opened now, filled when the bytes arrive: a window opened after an await is a popup
        // the browser blocks.
        let win = null;
        try { win = window.open('', '_blank'); } catch (error) { win = null; }
        attachmentObjectUrl(attachment.id)
            .then((url) => {
                if (win) win.location.href = url;
                else window.open(url, '_blank');
            })
            .catch(() => {
                try { win?.close(); } catch (error) { /* already closed */ }
                setFailed(true);
            });
    };
    return (
        <button
            type="button"
            className={`message-attachment is-${attachment.kind === 'pdf' ? 'pdf' : 'file'}${failed ? ' is-unavailable' : ''}`}
            title={attachment.filename}
            onClick={open}
            disabled={failed}
        >
            <FileKindIcon
                kind={attachment.kind}
                format={attachment.format}
                filename={attachment.filename}
                className="message-attachment-pdf-icon"
            />
            <span className="message-attachment-text">
                <span className="message-attachment-name">{attachment.filename}</span>
                <span className="message-attachment-meta">{failed ? 'File unavailable' : meta}</span>
            </span>
        </button>
    );
};

/** The files a sent question carried, on its bubble. */
export const MessageAttachments = ({ attachments }) => {
    const list = normalizeAttachmentList(attachments);
    if (!list.length) return null;
    return (
        <div className="message-attachments" data-testid="message-attachments">
            {list.map((attachment) => (attachment.kind === 'image'
                ? <ImageTile key={attachment.id} attachment={attachment} />
                : <FileTile key={attachment.id} attachment={attachment} />))}
        </div>
    );
};

export default AttachmentChips;
