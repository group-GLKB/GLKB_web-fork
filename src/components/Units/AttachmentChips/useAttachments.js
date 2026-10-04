/**
 * The files waiting on a composer: picked, being uploaded, uploaded, or refused.
 *
 * Owned by whoever sends the question (the chat page, the home search bar), because that is
 * where the ids have to be read at send time and where the chips are cleared once the question
 * has gone. The composer only shows them and adds to them.
 *
 * A file is uploaded as soon as it is added (service/attachments.js). Removing a chip aborts its
 * upload, or deletes the uploaded file when it was never sent. `clear()` — after a send — only
 * lets go of the chips: the files now belong to the message. Nothing is deleted on unmount: the
 * home bar unmounts on the way to the chat with its files in the question, and a file left
 * behind by a reader who walked away is the backend's to expire.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    attachmentErrorCode,
    attachmentErrorMessage,
    deleteAttachment,
    kindOf,
    planAdditions,
    primeAttachmentUrl,
    resizeImageIfNeeded,
    uploadAttachment,
    validateFile,
} from '../../../service/attachments';

let keySeq = 0;

const useAttachments = ({ onRequireSignIn } = {}) => {
    const [items, setItems] = useState([]);
    const [notice, setNotice] = useState('');
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const controllersRef = useRef(new Map());
    const removedRef = useRef(new Set());
    const previewsRef = useRef(new Map());
    const mountedRef = useRef(true);
    const onRequireSignInRef = useRef(onRequireSignIn);
    onRequireSignInRef.current = onRequireSignIn;

    const patch = useCallback((key, changes) => {
        if (!mountedRef.current) return;
        setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...changes } : item)));
    }, []);

    const revokePreview = useCallback((key) => {
        const url = previewsRef.current.get(key);
        if (!url) return;
        previewsRef.current.delete(key);
        try { URL.revokeObjectURL(url); } catch (error) { /* already gone */ }
    }, []);

    const startUpload = useCallback(async (item) => {
        const controller = new AbortController();
        controllersRef.current.set(item.key, controller);
        const gone = () => controller.signal.aborted || removedRef.current.has(item.key);
        try {
            const prepared = await resizeImageIfNeeded(item.file);
            if (gone()) return;
            const attachment = await uploadAttachment(prepared, {
                signal: controller.signal,
                onProgress: (progress) => patch(item.key, { progress }),
            });
            if (gone() || !mountedRef.current) {
                // Removed while the upload was finishing: it was never going to be sent.
                if (removedRef.current.has(item.key)) deleteAttachment(attachment.id);
                return;
            }
            if (attachment.kind === 'image') primeAttachmentUrl(attachment.id, prepared);
            patch(item.key, { status: 'ready', progress: 1, attachment });
        } catch (error) {
            if (gone()) return;
            if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
            patch(item.key, { status: 'error', error: attachmentErrorMessage(error) });
            if (attachmentErrorCode(error) === 'GUEST_LOGIN_REQUIRED') onRequireSignInRef.current?.();
        } finally {
            if (controllersRef.current.get(item.key) === controller) {
                controllersRef.current.delete(item.key);
            }
        }
    }, [patch]);

    const addFiles = useCallback((files) => {
        const list = Array.from(files || []).filter(Boolean);
        if (!list.length) return;
        const counted = itemsRef.current.filter((item) => item.status !== 'error');
        const { accepted, notice: limitNotice } = planAdditions(counted, list);
        setNotice(limitNotice || '');
        const additions = accepted.map((file) => {
            keySeq += 1;
            const key = `att-${Date.now()}-${keySeq}`;
            const invalid = validateFile(file);
            const kind = kindOf(file) || 'pdf';
            let previewUrl = null;
            if (!invalid && kind === 'image' && typeof URL?.createObjectURL === 'function') {
                try {
                    previewUrl = URL.createObjectURL(file);
                    previewsRef.current.set(key, previewUrl);
                } catch (error) {
                    previewUrl = null;
                }
            }
            return {
                key,
                file,
                kind,
                name: file.name || (kind === 'image' ? 'Pasted image' : 'Document.pdf'),
                size: Number(file.size) || 0,
                previewUrl,
                status: invalid ? 'error' : 'uploading',
                progress: 0,
                error: invalid || '',
                attachment: null,
            };
        });
        if (!additions.length) return;
        setItems((prev) => [...prev, ...additions]);
        additions.filter((item) => item.status === 'uploading').forEach((item) => { startUpload(item); });
    }, [startUpload]);

    const remove = useCallback((key) => {
        const item = itemsRef.current.find((entry) => entry.key === key);
        removedRef.current.add(key);
        controllersRef.current.get(key)?.abort();
        controllersRef.current.delete(key);
        if (item?.status === 'ready' && item.attachment?.id) deleteAttachment(item.attachment.id);
        revokePreview(key);
        setNotice('');
        setItems((prev) => prev.filter((entry) => entry.key !== key));
    }, [revokePreview]);

    /** After a send: the files are the message's now, so nothing is deleted. */
    const clear = useCallback(() => {
        itemsRef.current.forEach((item) => {
            removedRef.current.add(item.key);
            revokePreview(item.key);
        });
        setNotice('');
        setItems([]);
    }, [revokePreview]);

    useEffect(() => {
        mountedRef.current = true;
        const controllers = controllersRef.current;
        const previews = previewsRef.current;
        return () => {
            mountedRef.current = false;
            controllers.forEach((controller) => controller.abort());
            controllers.clear();
            previews.forEach((url) => {
                try { URL.revokeObjectURL(url); } catch (error) { /* already gone */ }
            });
            previews.clear();
        };
    }, []);

    const readyAttachments = useMemo(
        () => items.filter((item) => item.status === 'ready' && item.attachment).map((item) => item.attachment),
        [items],
    );
    const isUploading = items.some((item) => item.status === 'uploading');
    const hasErrors = items.some((item) => item.status === 'error');

    return {
        items,
        notice,
        addFiles,
        remove,
        clear,
        readyAttachments,
        isUploading,
        hasErrors,
        hasItems: items.length > 0,
    };
};

export default useAttachments;
