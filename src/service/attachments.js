/**
 * Images and PDFs attached to a chat question (2026-10-04).
 *
 * A file is uploaded the moment it is picked — `POST /api/v1/attachments` — and the question
 * then carries only the ids it got back (`attachments: [id]` on the chat stream). The backend
 * checks each file's real type, extracts a PDF's text, and keeps the file with its owner; a
 * reload shows the attachments again from the conversation's history.
 *
 * Signed-in readers only, and AI Chat only: Investigate does not read attachments, and a guest's
 * question has no owner to keep a file for. Both composers enforce that before anything is
 * uploaded; the backend refuses it anyway.
 *
 * Everything that talks to the API, checks a file, or turns an error into words lives here, so
 * the home composer and the chat composer behave the same.
 */
// The configured instance: it carries `baseURL` (the reorg-api prefix) and the JWT.
import axios from '../utils/axiosConfig';
import { normalizeAttachment } from '../utils/attachmentList';

// The shape helpers have no dependencies (history parsing imports them without axios).
export {
    attachmentIdsOf,
    defaultQuestionFor,
    normalizeAttachment,
    normalizeAttachmentList,
} from '../utils/attachmentList';

export const ATTACHMENTS_ENDPOINT = '/api/v1/attachments';

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const PDF_MIME_TYPE = 'application/pdf';
/** The `accept` attribute of the file picker. */
export const ATTACHMENT_ACCEPT = [...IMAGE_MIME_TYPES, PDF_MIME_TYPE].join(',');

// The backend's limits, checked here too so a file that cannot be sent is never uploaded.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGES_PER_MESSAGE = 4;
export const MAX_FILES_PER_MESSAGE = 5;
/* The model reads an image at most 2048 px on its long side, so anything larger is resized here
   before it is uploaded: a phone photo shrinks from several MB to a few hundred KB and the model
   sees exactly the same picture. */
export const MAX_IMAGE_EDGE = 2048;

export const GUEST_ATTACH_REASON = "Sign in to attach images and PDFs — it's free.";
export const INVESTIGATE_ATTACH_NOTE = 'Attachments work in AI Chat';

const EXTENSION_MIME = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    pdf: PDF_MIME_TYPE,
};

/** The file's MIME type, from the browser or (when it reports none) the extension. */
export const mimeTypeOf = (file) => {
    const reported = String(file?.type || '').trim().toLowerCase();
    if (reported) return reported === 'image/jpg' ? 'image/jpeg' : reported;
    const name = String(file?.name || '');
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    return EXTENSION_MIME[ext] || '';
};

/** 'image' | 'pdf' | null for a type that cannot be attached. */
export const kindOf = (file) => {
    const mime = mimeTypeOf(file);
    if (IMAGE_MIME_TYPES.includes(mime)) return 'image';
    if (mime === PDF_MIME_TYPE) return 'pdf';
    return null;
};

export const formatBytes = (bytes) => {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
};

/** Why this one file cannot be attached, or null when it can. */
export const validateFile = (file) => {
    const kind = kindOf(file);
    if (!kind) return 'Only PNG, JPEG and WebP images and PDFs can be attached.';
    const size = Number(file?.size) || 0;
    if (kind === 'image' && size > MAX_IMAGE_BYTES) {
        return `Images can be up to ${formatBytes(MAX_IMAGE_BYTES)}.`;
    }
    if (kind === 'pdf' && size > MAX_PDF_BYTES) {
        return `PDFs can be up to ${formatBytes(MAX_PDF_BYTES)}.`;
    }
    return null;
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
    if (kindOf(file) !== 'image') return file;
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
    if (status === 415) return 'This file type cannot be attached.';
    if (status === 401 || status === 403) return 'Sign in to attach files.';
    if (!error?.response) return 'Upload failed — check your connection and try again.';
    return 'Upload failed. Please try again.';
};

/** The code the backend refused an upload with (`detail.code`), or null. */
export const attachmentErrorCode = (error) => {
    const detail = detailOf(error);
    return detail && typeof detail === 'object' && typeof detail.code === 'string' ? detail.code : null;
};

/**
 * Upload one file. Resolves to the normalized attachment; rejects with the axios error (read it
 * with `attachmentErrorMessage`). `onProgress` gets 0..1.
 */
export const uploadAttachment = async (file, { onProgress, signal } = {}) => {
    const form = new FormData();
    const name = file?.name || (kindOf(file) === 'pdf' ? 'document.pdf' : 'image');
    form.append('file', file, name);
    const response = await axios.post(ATTACHMENTS_ENDPOINT, form, {
        signal,
        onUploadProgress: (event) => {
            if (!onProgress) return;
            const total = Number(event?.total) || Number(file?.size) || 0;
            if (total > 0) onProgress(Math.min(1, Number(event.loaded || 0) / total));
        },
    });
    const attachment = normalizeAttachment(response?.data);
    if (!attachment) {
        const error = new Error('Upload returned no attachment');
        error.attachmentMessage = 'Upload failed. Please try again.';
        throw error;
    }
    return attachment;
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
