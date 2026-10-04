/**
 * Attachments on a chat question (service/attachments.js): the composer's paperclip and its
 * pending chips, and the files shown on a message once it has been sent.
 *
 * Used by both composers (the home search bar and the chat's) and by the conversation, so the
 * styles live beside it rather than in a feature's stylesheet — see TierPicker for why.
 */
import './scoped.css';

import React, { useEffect, useRef, useState } from 'react';

import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { Tooltip } from '@mui/material';

import {
    ATTACHMENT_ACCEPT,
    attachmentObjectUrl,
    formatBytes,
    normalizeAttachmentList,
} from '../../../service/attachments';
import { trackGtagEvent } from '../../../utils/gtag';

export { default as useAttachments } from './useAttachments';

const ATTACH_LABEL = 'Attach images or PDFs';

/** The files on a drop or a paste, images and PDFs alike (the hook sorts out what is allowed). */
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
 * The paperclip. A guest is asked to sign in instead of being shown the file picker; on
 * Investigate it is disabled, with the reason as its tooltip.
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
    const title = disabled && disabledReason ? disabledReason : ATTACH_LABEL;
    return (
        <Tooltip title={title} placement="top" arrow>
            {/* A span, because a tooltip on a disabled button never sees the pointer. */}
            <span className={`attach-button-wrap ${className}`.trim()}>
                <button
                    type="button"
                    className="attach-button"
                    aria-label={ATTACH_LABEL}
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
                        trackGtagEvent('chat_attach_click', { source });
                        inputRef.current?.click();
                    }}
                >
                    <AttachFileIcon className="attach-button-icon" />
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
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
    );
};

const chipMeta = (item) => {
    if (item.status === 'uploading') {
        return `Uploading… ${Math.round((Number(item.progress) || 0) * 100)}%`;
    }
    if (item.status === 'error') return item.error || 'Upload failed.';
    const attachment = item.attachment || {};
    const pages = Number(attachment.page_count);
    const parts = [];
    if (item.kind === 'pdf' && Number.isFinite(pages) && pages > 0) {
        parts.push(`${pages} page${pages === 1 ? '' : 's'}`);
    }
    const size = formatBytes(attachment.size_bytes ?? item.size);
    if (size) parts.push(size);
    return parts.join(' · ');
};

/**
 * The files waiting on a composer, with their upload state. `blockedNote` explains why the
 * question cannot be sent as it stands (a failed upload, Investigate).
 */
export const AttachmentChips = ({ items = [], notice = '', blockedNote = '', onRemove }) => {
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
                                <img className="attachment-chip-thumb" src={item.previewUrl} alt="" />
                            ) : (
                                <span className="attachment-chip-icon" aria-hidden="true">
                                    {item.kind === 'image'
                                        ? <ImageOutlinedIcon fontSize="inherit" />
                                        : <PictureAsPdfOutlinedIcon fontSize="inherit" />}
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
                                        Long PDF — only the first part will be read
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

const ImageTile = ({ attachment }) => {
    const [url, setUrl] = useState(null);
    const [failed, setFailed] = useState(false);
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
        <a
            className="message-attachment is-image"
            href={url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            title={attachment.filename}
            aria-label={`Open ${attachment.filename}`}
            data-testid="message-attachment-image"
        >
            {url
                ? <img src={url} alt={attachment.filename} />
                : <span className="message-attachment-placeholder" aria-hidden="true" />}
        </a>
    );
};

const PdfTile = ({ attachment }) => {
    const [failed, setFailed] = useState(false);
    const pages = Number(attachment.page_count);
    const meta = [
        Number.isFinite(pages) && pages > 0 ? `${pages} page${pages === 1 ? '' : 's'}` : '',
        formatBytes(attachment.size_bytes),
    ].filter(Boolean).join(' · ');
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
            className={`message-attachment is-pdf${failed ? ' is-unavailable' : ''}`}
            title={attachment.filename}
            onClick={open}
            disabled={failed}
        >
            <PictureAsPdfOutlinedIcon className="message-attachment-pdf-icon" fontSize="inherit" />
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
                : <PdfTile key={attachment.id} attachment={attachment} />))}
        </div>
    );
};

export default AttachmentChips;
