/**
 * The shape of an attachment as the app keeps it — from an upload response, a history row, a
 * queued follow-up or navigation state. Dependency-free on purpose: history parsing
 * (utils/chatHistory.js) needs it without pulling in the API client. The API side is
 * service/attachments.js, which re-exports these.
 */
const PDF_MIME_TYPE = 'application/pdf';

/** The fields the app keeps for an attachment, from an upload response or a history row. */
export const normalizeAttachment = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id) : '';
    if (!id) return null;
    const mimeType = String(raw.mime_type || raw.mimeType || '');
    const kind = raw.kind === 'image' || raw.kind === 'pdf'
        ? raw.kind
        : (mimeType === PDF_MIME_TYPE ? 'pdf' : (mimeType.startsWith('image/') ? 'image' : 'pdf'));
    const num = (value) => (value === null || value === undefined || value === ''
        || !Number.isFinite(Number(value)) ? null : Number(value));
    return {
        id,
        kind,
        mime_type: mimeType,
        filename: String(raw.filename || raw.name || (kind === 'image' ? 'image' : 'document.pdf')),
        size_bytes: num(raw.size_bytes ?? raw.sizeBytes),
        page_count: num(raw.page_count ?? raw.pageCount),
        ...(raw.char_count !== undefined ? { char_count: num(raw.char_count) } : {}),
        ...(raw.truncated ? { truncated: true } : {}),
    };
};

/** A clean list from whatever a message, a queue entry or a history row carried. */
export const normalizeAttachmentList = (list) => (
    Array.isArray(list) ? list.map(normalizeAttachment).filter(Boolean) : []
);

/** The ids the chat stream is sent. */
export const attachmentIdsOf = (list) => normalizeAttachmentList(list).map((item) => item.id);

/** The question sent when the box is empty but files are attached. */
export const defaultQuestionFor = (list) => (
    (Array.isArray(list) ? list.length : 0) > 1
        ? 'Summarize the attached files.'
        : 'Summarize the attached file.'
);
