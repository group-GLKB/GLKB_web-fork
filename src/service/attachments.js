/**
 * Files attached to a chat question: images, PDFs, code, notebooks, Office files, text
 * (2026-10-04; any type since round 2).
 *
 * A file is uploaded the moment it is picked — `POST /api/v1/attachments` — and the question
 * then carries only the ids it got back (`attachments: [id]` on the chat stream). The backend
 * checks each file's real type, extracts a PDF's text, and keeps the file with its owner; a
 * reload shows the attachments again from the conversation's history.
 *
 * Any type goes to the backend, which reads it as a picture or as text (see below).
 * Signed-in readers only, and AI Chat only: Investigate does not read attachments, and a guest's
 * question has no owner to keep a file for. Both composers enforce that before anything is
 * uploaded; the backend refuses it anyway.
 *
 * Everything that talks to the API, checks a file, or turns an error into words lives here, so
 * the home composer and the chat composer behave the same.
 */
// The configured instance: it carries `baseURL` (the reorg-api prefix) and the JWT.
import axios from '../utils/axiosConfig';
import { formatBytes, normalizeAttachment } from '../utils/attachmentList';

// The shape helpers have no dependencies (history parsing imports them without axios).
export {
    attachmentIdsOf,
    attachmentMetaText,
    defaultQuestionFor,
    formatBytes,
    formatLabelForName,
    isCodeFormat,
    normalizeAttachment,
    normalizeAttachmentList,
} from '../utils/attachmentList';

export const ATTACHMENTS_ENDPOINT = '/api/v1/attachments';

/* Images go to the model as pictures; every other file is turned into text by the backend
   (glkb-backend `attachment_service`, MarkItDown for Office files and notebooks) — the way
   Claude, ChatGPT and Open WebUI / LibreChat ("upload as text") handle documents and code. So
   the client sends any type and lets the backend decide; it only turns away what can never be
   read as text or as a picture (media, archives, executables). */
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const PDF_MIME_TYPE = 'application/pdf';

// The backend's limits, checked here too so a file that cannot be sent is never uploaded.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_IMAGES_PER_MESSAGE = 5;
export const MAX_FILES_PER_MESSAGE = 10;
/* The model reads an image at most 2048 px on its long side, so anything larger is resized here
   before it is uploaded: a phone photo shrinks from several MB to a few hundred KB and the model
   sees exactly the same picture. */
export const MAX_IMAGE_EDGE = 2048;
/* nginx in front of /reorg-api accepts request bodies up to 1 MB. A file larger than this goes
   up in chunks of this size (`/attachments/uploads`), each a request of its own. */
export const CHUNK_THRESHOLD_BYTES = 768 * 1024;
const CHUNK_RETRIES = 2;
/* A paste longer than this becomes an attachment ("Pasted text.txt") instead of filling the
   message box — as Claude does with long pastes. */
export const LONG_PASTE_CHARS = 4000;
export const PASTED_TEXT_NAME = 'Pasted text.txt';

export const GUEST_ATTACH_REASON = "Sign in to attach files — it's free.";
export const INVESTIGATE_ATTACH_NOTE = 'Attachments work in AI Chat';
export const UNSUPPORTED_TYPE_MESSAGE = "This file type can't be attached.";

const EXTENSION_MIME = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: PDF_MIME_TYPE,
};

// Never text, never a picture the model reads: refused before anything is uploaded.
const BLOCKED_EXTENSIONS = new Set([
    'exe', 'dll', 'so', 'dylib', 'bin', 'iso', 'dmg', 'zip', 'tar', 'gz', '7z', 'rar', 'jar', 'apk',
]);

export const extensionOf = (name) => {
    const text = String(name || '');
    const dot = text.lastIndexOf('.');
    return dot > 0 && dot < text.length - 1 ? text.slice(dot + 1).toLowerCase() : '';
};

/** The file's MIME type, from the browser or (when it reports none) the extension. */
export const mimeTypeOf = (file) => {
    const reported = String(file?.type || '').trim().toLowerCase();
    if (reported) return reported === 'image/jpg' ? 'image/jpeg' : reported;
    return EXTENSION_MIME[extensionOf(file?.name)] || '';
};

/** 'image' | 'pdf' | 'file' — every file is something; whether it can be read is the backend's call. */
export const kindOf = (file) => {
    const mime = mimeTypeOf(file);
    if (IMAGE_MIME_TYPES.includes(mime)) return 'image';
    if (mime === PDF_MIME_TYPE) return 'pdf';
    return 'file';
};


/** Why this one file cannot be attached, or null when it can. */
export const validateFile = (file) => {
    const mime = mimeTypeOf(file);
    if (mime.startsWith('video/') || mime.startsWith('audio/') || BLOCKED_EXTENSIONS.has(extensionOf(file?.name))) {
        return UNSUPPORTED_TYPE_MESSAGE;
    }
    const size = Number(file?.size) || 0;
    if (kindOf(file) === 'image') {
        return size > MAX_IMAGE_BYTES ? `Images can be up to ${formatBytes(MAX_IMAGE_BYTES)}.` : null;
    }
    return size > MAX_FILE_BYTES ? `Files can be up to ${formatBytes(MAX_FILE_BYTES)}.` : null;
};

/**
 * Which of `files` fit beside the attachments already on the message (`existing`, each with a
 * `kind`; leave out the ones that failed). Files past the per-message limits are left out and
 * `notice` says why. A file that fails `validateFile` is still accepted, so it can be shown with
 * its reason — but it takes none of the message's places.
 */
export const planAdditions = (existing, files) => {
    const list = Array.from(files || []);
    let total = (existing || []).length;
    let images = (existing || []).filter((item) => item?.kind === 'image').length;
    const accepted = [];
    let notice = null;
    list.forEach((file) => {
        if (validateFile(file)) {
            accepted.push(file);
            return;
        }
        const kind = kindOf(file);
        if (total >= MAX_FILES_PER_MESSAGE) {
            notice = `Up to ${MAX_FILES_PER_MESSAGE} files per message.`;
            return;
        }
        if (kind === 'image' && images >= MAX_IMAGES_PER_MESSAGE) {
            notice = `Up to ${MAX_IMAGES_PER_MESSAGE} images per message.`;
            return;
        }
        accepted.push(file);
        total += 1;
        if (kind === 'image') images += 1;
    });
    return { accepted, notice };
};

/** A long pasted text as the file it is attached as. */
export const pastedTextFile = (text) => {
    const body = String(text || '');
    try {
        return new File([body], PASTED_TEXT_NAME, { type: 'text/plain', lastModified: Date.now() });
    } catch (error) {
        const blob = new Blob([body], { type: 'text/plain' });
        blob.name = PASTED_TEXT_NAME;
        return blob;
    }
};

/**
 * What a paste should attach: every file it carries (any type), or — when it carries none and
 * `longText` is allowed — its text as "Pasted text.txt" once it is longer than LONG_PASTE_CHARS.
 * An empty list means "let the paste through".
 */
export const pastedAttachments = (clipboardData, { longText = true } = {}) => {
    if (!clipboardData) return [];
    const fromFiles = Array.from(clipboardData.files || []);
    const files = fromFiles.length
        ? fromFiles
        : Array.from(clipboardData.items || [])
            .filter((item) => item?.kind === 'file')
            .map((item) => item.getAsFile?.())
            .filter(Boolean);
    if (files.length) return files;
    if (!longText) return [];
    let text = '';
    try { text = clipboardData.getData?.('text/plain') || clipboardData.getData?.('text') || ''; } catch (error) { text = ''; }
    return text.length > LONG_PASTE_CHARS ? [pastedTextFile(text)] : [];
};

const canvasToBlob = (canvas, type, quality) => new Promise((resolve) => {
    try {
        canvas.toBlob((blob) => resolve(blob || null), type, quality);
    } catch (error) {
        resolve(null);
    }
});

/**
 * The file itself when its long side is within MAX_IMAGE_EDGE (or it is not an image, or this
 * browser cannot decode it here), otherwise a resized copy: PNG stays PNG (figures with text stay
 * sharp), JPEG and WebP become JPEG at quality 0.9. Never throws — a resize that fails uploads
 * the original, and the backend's size limit still applies.
 */
export const resizeImageIfNeeded = async (file) => {
    // A GIF goes up as it is: a canvas would keep only its first frame.
    if (kindOf(file) !== 'image' || mimeTypeOf(file) === 'image/gif') return file;
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
    let bitmap = null;
    try {
        bitmap = await createImageBitmap(file);
        const longest = Math.max(bitmap.width, bitmap.height);
        if (!longest || longest <= MAX_IMAGE_EDGE) return file;
        const scale = MAX_IMAGE_EDGE / longest;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) return file;
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const keepPng = mimeTypeOf(file) === 'image/png';
        const type = keepPng ? 'image/png' : 'image/jpeg';
        const blob = await canvasToBlob(canvas, type, keepPng ? undefined : 0.9);
        if (!blob || blob.size >= (Number(file.size) || Infinity)) return file;
        const base = String(file.name || 'image').replace(/\.[^.]+$/, '');
        const name = keepPng ? `${base}.png` : `${base}.jpg`;
        try {
            return new File([blob], name, { type, lastModified: Date.now() });
        } catch (error) {
            blob.name = name;
            return blob;
        }
    } catch (error) {
        return file;
    } finally {
        try { bitmap?.close?.(); } catch (error) { /* already released */ }
    }
};

const detailOf = (error) => {
    const data = error?.response?.data;
    if (typeof data === 'string') {
        try {
            return JSON.parse(data)?.detail ?? null;
        } catch (parseError) {
            return null; // an HTML page from the proxy, not ours to show
        }
    }
    return data?.detail ?? null;
};

/** The words for an upload that did not work: the backend's own message when it sent one. */
export const attachmentErrorMessage = (error) => {
    if (typeof error?.attachmentMessage === 'string') return error.attachmentMessage;
    const detail = detailOf(error);
    if (detail && typeof detail === 'object' && typeof detail.message === 'string' && detail.message.trim()) {
        return detail.message.trim();
    }
    if (typeof detail === 'string' && detail.trim() && !detail.trim().startsWith('<')) {
        return detail.trim();
    }
    const status = Number(error?.response?.status);
    if (status === 413) return 'This file is too large to upload.';
    if (status === 415) return UNSUPPORTED_TYPE_MESSAGE;
    if (status === 507) return 'There is no room to store this file right now. Please try again later.';
    if (status === 401 || status === 403) return 'Sign in to attach files.';
    if (!error?.response) return 'Upload failed — check your connection and try again.';
    return 'Upload failed. Please try again.';
};

/** The code the backend refused an upload with (`detail.code`), or null. */
export const attachmentErrorCode = (error) => {
    const detail = detailOf(error);
    return detail && typeof detail === 'object' && typeof detail.code === 'string' ? detail.code : null;
};

const asAttachment = (data) => {
    const attachment = normalizeAttachment(data);
    if (!attachment) {
        const error = new Error('Upload returned no attachment');
        error.attachmentMessage = 'Upload failed. Please try again.';
        throw error;
    }
    return attachment;
};

const canceled = (error, signal) => Boolean(
    signal?.aborted || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError',
);

// Worth another try: the network, a timeout, the server's own trouble. A 4xx is an answer.
const retryable = (error) => {
    const status = Number(error?.response?.status);
    if (!error?.response) return true;
    return status >= 500 || status === 408 || status === 429;
};

const abortedError = () => {
    const error = new Error('canceled');
    error.name = 'CanceledError';
    error.code = 'ERR_CANCELED';
    return error;
};

/**
 * Upload in chunks (`/attachments/uploads`), for a file over CHUNK_THRESHOLD_BYTES: nginx in
 * front of the API takes at most 1 MB per request. Start the upload, send each slice in order
 * (a failed slice is retried up to CHUNK_RETRIES times), then complete it — which answers like
 * the single-shot upload.
 */
export const uploadInChunks = async (file, { onProgress, signal, name } = {}) => {
    const total = Number(file?.size) || 0;
    const init = await axios.post(`${ATTACHMENTS_ENDPOINT}/uploads`, {
        filename: name || file?.name || 'file',
        size_bytes: total,
    }, { signal });
    const uploadId = init?.data?.upload_id;
    const chunkBytes = Number(init?.data?.chunk_bytes) || CHUNK_THRESHOLD_BYTES;
    const chunkCount = Number(init?.data?.chunk_count) || Math.max(1, Math.ceil(total / chunkBytes));
    if (!uploadId) {
        const error = new Error('Upload could not start');
        error.attachmentMessage = 'Upload failed. Please try again.';
        throw error;
    }
    const base = `${ATTACHMENTS_ENDPOINT}/uploads/${encodeURIComponent(uploadId)}`;
    let sent = 0;
    for (let index = 0; index < chunkCount; index += 1) {
        if (signal?.aborted) throw abortedError();
        const slice = file.slice(index * chunkBytes, Math.min(total, (index + 1) * chunkBytes));
        const size = Number(slice?.size) || 0;
        const sentBefore = sent; // a constant for the progress callback below
        for (let attempt = 0; ; attempt += 1) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await axios.put(`${base}/chunks/${index}`, slice, {
                    signal,
                    headers: { 'Content-Type': 'application/octet-stream' },
                    onUploadProgress: (event) => {
                        if (!onProgress || !total) return;
                        const loaded = Math.min(size, Number(event?.loaded) || 0);
                        onProgress(Math.min(1, (sentBefore + loaded) / total));
                    },
                });
                break;
            } catch (error) {
                if (canceled(error, signal) || attempt >= CHUNK_RETRIES || !retryable(error)) throw error;
            }
        }
        sent += size;
        if (onProgress && total) onProgress(Math.min(1, sent / total));
    }
    const done = await axios.post(`${base}/complete`, null, { signal });
    return asAttachment(done?.data);
};

/**
 * Upload one file. Resolves to the normalized attachment; rejects with the axios error (read it
 * with `attachmentErrorMessage`). `onProgress` gets 0..1. Small files go up in one request,
 * larger ones in chunks (`uploadInChunks`).
 */
export const uploadAttachment = async (file, { onProgress, signal } = {}) => {
    const name = file?.name || (kindOf(file) === 'image' ? 'image' : 'file');
    if ((Number(file?.size) || 0) > CHUNK_THRESHOLD_BYTES) {
        return uploadInChunks(file, { onProgress, signal, name });
    }
    const form = new FormData();
    form.append('file', file, name);
    const response = await axios.post(ATTACHMENTS_ENDPOINT, form, {
        signal,
        onUploadProgress: (event) => {
            if (!onProgress) return;
            const total = Number(event?.total) || Number(file?.size) || 0;
            if (total > 0) onProgress(Math.min(1, Number(event.loaded || 0) / total));
        },
    });
    return asAttachment(response?.data);
};

/** Delete an uploaded file that was never sent. Fire-and-forget: a failure changes nothing. */
export const deleteAttachment = (id) => {
    if (!id) return Promise.resolve();
    return axios.delete(`${ATTACHMENTS_ENDPOINT}/${encodeURIComponent(id)}`).catch(() => {});
};

/* Object URLs for attachments shown in the conversation, by id. `<img src>` cannot carry the JWT,
   so the bytes are fetched once and kept for the page's life — re-renders and re-opened
   conversations reuse them. Bounded, oldest first out (and revoked). */
const OBJECT_URL_LIMIT = 60;
const objectUrls = new Map(); // id -> Promise<string>

const remember = (id, promise) => {
    objectUrls.delete(id);
    objectUrls.set(id, promise);
    while (objectUrls.size > OBJECT_URL_LIMIT) {
        const [oldestId, oldest] = objectUrls.entries().next().value;
        objectUrls.delete(oldestId);
        Promise.resolve(oldest).then((url) => {
            try { URL.revokeObjectURL(url); } catch (error) { /* nothing to free */ }
        }).catch(() => {});
    }
    return promise;
};

/** Seed the cache from a file this tab just uploaded, so the sent message needs no download. */
export const primeAttachmentUrl = (id, blob) => {
    if (!id || !blob || typeof URL?.createObjectURL !== 'function') return;
    if (objectUrls.has(String(id))) return;
    try {
        remember(String(id), Promise.resolve(URL.createObjectURL(blob)));
    } catch (error) {
        /* no object URLs here: the bubble downloads it instead */
    }
};

/** An object URL for the attachment's bytes. Rejects (and is not cached) when it cannot be read. */
export const attachmentObjectUrl = (id) => {
    const key = String(id || '');
    if (!key) return Promise.reject(new Error('no attachment id'));
    const cached = objectUrls.get(key);
    if (cached) return cached;
    const promise = axios.get(`${ATTACHMENTS_ENDPOINT}/${encodeURIComponent(key)}/content`, {
        responseType: 'blob',
    }).then((response) => URL.createObjectURL(response.data));
    remember(key, promise);
    promise.catch(() => {
        if (objectUrls.get(key) === promise) objectUrls.delete(key);
    });
    return promise;
};

/** Test hook: forget every cached URL. */
export const resetAttachmentUrlCache = () => {
    objectUrls.clear();
};
