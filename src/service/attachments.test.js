/**
 * Images and PDFs on a chat question: what may be attached, how a refusal is put into words,
 * and what goes over the wire.
 */
import axios from '../utils/axiosConfig';
import {
    ATTACHMENTS_ENDPOINT,
    attachmentErrorCode,
    attachmentErrorMessage,
    attachmentIdsOf,
    attachmentObjectUrl,
    defaultQuestionFor,
    deleteAttachment,
    kindOf,
    MAX_FILES_PER_MESSAGE,
    MAX_IMAGE_BYTES,
    MAX_IMAGES_PER_MESSAGE,
    MAX_PDF_BYTES,
    normalizeAttachment,
    normalizeAttachmentList,
    planAdditions,
    resetAttachmentUrlCache,
    resizeImageIfNeeded,
    uploadAttachment,
    validateFile,
} from './attachments';

jest.mock('../utils/axiosConfig', () => ({
    __esModule: true,
    default: { post: jest.fn(), get: jest.fn(), delete: jest.fn() },
}));

const file = (name, type, size = 1000) => {
    const f = new File(['x'], name, { type });
    Object.defineProperty(f, 'size', { value: size });
    return f;
};
const png = (size) => file('fig.png', 'image/png', size);
const pdf = (size) => file('paper.pdf', 'application/pdf', size);

beforeEach(() => {
    axios.post.mockReset();
    axios.get.mockReset();
    axios.delete.mockReset();
    resetAttachmentUrlCache();
});

describe('what may be attached', () => {
    it('takes PNG, JPEG, WebP and PDF, by type or (when the browser reports none) extension', () => {
        expect(kindOf(png())).toBe('image');
        expect(kindOf(file('a.jpg', 'image/jpeg'))).toBe('image');
        expect(kindOf(file('a.webp', 'image/webp'))).toBe('image');
        expect(kindOf(pdf())).toBe('pdf');
        expect(kindOf(file('scan.PDF', ''))).toBe('pdf');
        expect(kindOf(file('photo.jpeg', ''))).toBe('image');
    });

    it('refuses other types with a reason', () => {
        expect(kindOf(file('a.gif', 'image/gif'))).toBeNull();
        expect(validateFile(file('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')))
            .toMatch(/Only PNG, JPEG and WebP images and PDFs/);
    });

    it('holds images to 10 MB and PDFs to 20 MB', () => {
        expect(validateFile(png(MAX_IMAGE_BYTES))).toBeNull();
        expect(validateFile(png(MAX_IMAGE_BYTES + 1))).toBe('Images can be up to 10 MB.');
        expect(validateFile(pdf(MAX_PDF_BYTES))).toBeNull();
        expect(validateFile(pdf(MAX_PDF_BYTES + 1))).toBe('PDFs can be up to 20 MB.');
    });
});

describe('the per-message limits', () => {
    it(`takes at most ${MAX_IMAGES_PER_MESSAGE} images`, () => {
        const existing = [{ kind: 'image' }, { kind: 'image' }, { kind: 'image' }];
        const { accepted, notice } = planAdditions(existing, [png(), png(), pdf()]);
        expect(accepted.map((f) => f.name)).toEqual(['fig.png', 'paper.pdf']);
        expect(notice).toBe('Up to 4 images per message.');
    });

    it(`takes at most ${MAX_FILES_PER_MESSAGE} files`, () => {
        const existing = [{ kind: 'pdf' }, { kind: 'pdf' }, { kind: 'pdf' }, { kind: 'image' }];
        const { accepted, notice } = planAdditions(existing, [pdf(), pdf()]);
        expect(accepted).toHaveLength(1);
        expect(notice).toBe('Up to 5 files per message.');
    });

    it('shows a refused file without letting it take a place', () => {
        const tooBig = png(MAX_IMAGE_BYTES + 1);
        const existing = [{ kind: 'image' }, { kind: 'image' }, { kind: 'image' }];
        const { accepted, notice } = planAdditions(existing, [tooBig, png()]);
        expect(accepted).toEqual([tooBig, expect.objectContaining({ name: 'fig.png' })]);
        expect(notice).toBeNull();
    });
});

describe('error messages', () => {
    const httpError = (status, data) => ({ response: { status, data } });

    it("uses the backend's own message", () => {
        const error = httpError(422, {
            detail: { code: 'PDF_NO_TEXT', message: 'This PDF has no selectable text — it may be a scan.' },
        });
        expect(attachmentErrorMessage(error)).toBe('This PDF has no selectable text — it may be a scan.');
        expect(attachmentErrorCode(error)).toBe('PDF_NO_TEXT');
    });

    it('reads a body that arrived as a string', () => {
        const error = httpError(415, JSON.stringify({
            detail: { code: 'ATTACHMENT_TYPE_UNSUPPORTED', message: 'Only PNG, JPEG, WebP and PDF files.' },
        }));
        expect(attachmentErrorMessage(error)).toBe('Only PNG, JPEG, WebP and PDF files.');
    });

    it("never shows the proxy's HTML page: an nginx 413 is a plain sentence", () => {
        const error = httpError(413, '<html><head><title>413 Request Entity Too Large</title></head></html>');
        expect(attachmentErrorMessage(error)).toBe('This file is too large to upload.');
        expect(attachmentErrorCode(error)).toBeNull();
    });

    it('says when the connection failed', () => {
        expect(attachmentErrorMessage(new Error('Network Error'))).toMatch(/check your connection/);
    });
});

describe('the upload', () => {
    it('posts the file as multipart field `file` and reports progress', async () => {
        axios.post.mockImplementation((url, form, config) => {
            config.onUploadProgress({ loaded: 500, total: 1000 });
            return Promise.resolve({
                status: 201,
                data: {
                    id: 'abc123',
                    kind: 'pdf',
                    mime_type: 'application/pdf',
                    filename: 'paper.pdf',
                    size_bytes: 1000,
                    page_count: 12,
                    char_count: 54321,
                    truncated: true,
                    created_at: '2026-10-04T00:00:00',
                },
            });
        });
        const onProgress = jest.fn();
        const result = await uploadAttachment(pdf(), { onProgress });
        const [url, form] = axios.post.mock.calls[0];
        expect(url).toBe(ATTACHMENTS_ENDPOINT);
        expect(form).toBeInstanceOf(FormData);
        expect(form.get('file').name).toBe('paper.pdf');
        expect(onProgress).toHaveBeenCalledWith(0.5);
        expect(result).toEqual({
            id: 'abc123',
            kind: 'pdf',
            mime_type: 'application/pdf',
            filename: 'paper.pdf',
            size_bytes: 1000,
            page_count: 12,
            char_count: 54321,
            truncated: true,
        });
    });

    it('rejects with the axios error, which reads as the backend message', async () => {
        const error = { response: { status: 403, data: { detail: { code: 'GUEST_LOGIN_REQUIRED', message: 'Sign in to attach files.' } } } };
        axios.post.mockRejectedValueOnce(error);
        await expect(uploadAttachment(png())).rejects.toBe(error);
        expect(attachmentErrorCode(error)).toBe('GUEST_LOGIN_REQUIRED');
    });

    it('deletes quietly', async () => {
        axios.delete.mockRejectedValueOnce(new Error('gone'));
        await expect(deleteAttachment('abc')).resolves.toBeUndefined();
        expect(axios.delete).toHaveBeenCalledWith(`${ATTACHMENTS_ENDPOINT}/abc`);
    });

    it('leaves an image alone when this browser cannot decode it here', async () => {
        const image = png();
        await expect(resizeImageIfNeeded(image)).resolves.toBe(image);
    });
});

describe('shape', () => {
    it('keeps what the app needs from a history row', () => {
        expect(normalizeAttachment({
            id: 'i1', kind: 'image', mime_type: 'image/png', filename: 'fig.png', size_bytes: 10, page_count: null,
        })).toEqual({
            id: 'i1', kind: 'image', mime_type: 'image/png', filename: 'fig.png', size_bytes: 10, page_count: null,
        });
        expect(normalizeAttachmentList([null, { kind: 'pdf' }, { id: 'p1', mime_type: 'application/pdf' }]))
            .toEqual([expect.objectContaining({ id: 'p1', kind: 'pdf', filename: 'document.pdf' })]);
        expect(normalizeAttachmentList(undefined)).toEqual([]);
    });

    it('sends ids, and asks for a summary when there are no words', () => {
        expect(attachmentIdsOf([{ id: 'a' }, { id: 'b' }])).toEqual(['a', 'b']);
        expect(defaultQuestionFor([{ id: 'a' }])).toBe('Summarize the attached file.');
        expect(defaultQuestionFor([{ id: 'a' }, { id: 'b' }])).toBe('Summarize the attached files.');
    });
});

describe('showing a sent attachment', () => {
    beforeAll(() => {
        global.URL.createObjectURL = global.URL.createObjectURL || jest.fn();
        global.URL.revokeObjectURL = global.URL.revokeObjectURL || jest.fn();
    });

    it('downloads the bytes once and reuses the object URL', async () => {
        jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one');
        axios.get.mockResolvedValue({ data: new Blob(['x'], { type: 'image/png' }) });
        await expect(attachmentObjectUrl('i1')).resolves.toBe('blob:one');
        await expect(attachmentObjectUrl('i1')).resolves.toBe('blob:one');
        expect(axios.get).toHaveBeenCalledTimes(1);
        expect(axios.get).toHaveBeenCalledWith(`${ATTACHMENTS_ENDPOINT}/i1/content`, { responseType: 'blob' });
    });

    it('does not cache a failure, so a later look can succeed', async () => {
        jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:two');
        axios.get.mockRejectedValueOnce({ response: { status: 404 } });
        await expect(attachmentObjectUrl('i2')).rejects.toBeTruthy();
        axios.get.mockResolvedValueOnce({ data: new Blob(['x']) });
        await expect(attachmentObjectUrl('i2')).resolves.toBe('blob:two');
    });
});
