/**
 * Files on a chat question (any type since round 2): what may be attached, what a paste
 * attaches, how a refusal is put into words, and what goes over the wire — including the
 * chunked upload for files nginx's 1 MB body limit would refuse.
 */
import axios from '../utils/axiosConfig';
import {
    ATTACHMENTS_ENDPOINT,
    attachmentErrorCode,
    attachmentErrorMessage,
    attachmentIdsOf,
    attachmentMetaText,
    attachmentObjectUrl,
    CHUNK_THRESHOLD_BYTES,
    defaultQuestionFor,
    deleteAttachment,
    kindOf,
    MAX_FILES_PER_MESSAGE,
    MAX_IMAGE_BYTES,
    MAX_FILE_BYTES,
    MAX_IMAGES_PER_MESSAGE,
    isCodeFormat,
    LONG_PASTE_CHARS,
    normalizeAttachment,
    normalizeAttachmentList,
    PASTED_TEXT_NAME,
    pastedAttachments,
    planAdditions,
    resetAttachmentUrlCache,
    resizeImageIfNeeded,
    uploadAttachment,
    validateFile,
} from './attachments';

jest.mock('../utils/axiosConfig', () => ({
    __esModule: true,
    default: { post: jest.fn(), get: jest.fn(), delete: jest.fn(), put: jest.fn() },
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
    axios.put.mockReset();
    resetAttachmentUrlCache();
});

describe('what may be attached', () => {
    it('reads pictures and PDFs by type or (when the browser reports none) extension', () => {
        expect(kindOf(png())).toBe('image');
        expect(kindOf(file('a.jpg', 'image/jpeg'))).toBe('image');
        expect(kindOf(file('a.webp', 'image/webp'))).toBe('image');
        expect(kindOf(file('a.gif', 'image/gif'))).toBe('image');
        expect(kindOf(pdf())).toBe('pdf');
        expect(kindOf(file('scan.PDF', ''))).toBe('pdf');
        expect(kindOf(file('photo.jpeg', ''))).toBe('image');
    });

    it('takes code, notebooks, Office files and text as "file" — the backend reads them', () => {
        ['analysis.py', 'notebook.ipynb', 'notes.docx', 'data.csv', 'README', 'run.sh'].forEach((name) => {
            expect(kindOf(file(name, ''))).toBe('file');
            expect(validateFile(file(name, ''))).toBeNull();
        });
    });

    it('turns away media, archives and executables before uploading', () => {
        expect(validateFile(file('talk.mp4', 'video/mp4'))).toBe("This file type can't be attached.");
        expect(validateFile(file('voice.m4a', 'audio/mp4'))).toBe("This file type can't be attached.");
        ['setup.exe', 'code.zip', 'data.tar', 'x.gz', 'app.dmg', 'lib.so'].forEach((name) => {
            expect(validateFile(file(name, ''))).toBe("This file type can't be attached.");
        });
    });

    it('holds images to 10 MB and every other file to 30 MB', () => {
        expect(validateFile(png(MAX_IMAGE_BYTES))).toBeNull();
        expect(validateFile(png(MAX_IMAGE_BYTES + 1))).toBe('Images can be up to 10 MB.');
        expect(validateFile(pdf(MAX_FILE_BYTES))).toBeNull();
        expect(validateFile(pdf(MAX_FILE_BYTES + 1))).toBe('Files can be up to 30 MB.');
        expect(validateFile(file('big.ipynb', '', MAX_FILE_BYTES + 1))).toBe('Files can be up to 30 MB.');
    });
});

describe('the per-message limits', () => {
    it(`takes at most ${MAX_IMAGES_PER_MESSAGE} images`, () => {
        const existing = [1, 2, 3, 4].map(() => ({ kind: 'image' }));
        const { accepted, notice } = planAdditions(existing, [png(), png(), pdf()]);
        expect(accepted.map((f) => f.name)).toEqual(['fig.png', 'paper.pdf']);
        expect(notice).toBe('Up to 5 images per message.');
    });

    it(`takes at most ${MAX_FILES_PER_MESSAGE} files`, () => {
        const existing = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => ({ kind: 'file' }));
        const { accepted, notice } = planAdditions(existing, [pdf(), pdf()]);
        expect(accepted).toHaveLength(1);
        expect(notice).toBe('Up to 10 files per message.');
    });

    it('shows a refused file without letting it take a place', () => {
        const tooBig = png(MAX_IMAGE_BYTES + 1);
        const existing = [1, 2, 3, 4].map(() => ({ kind: 'image' }));
        const { accepted, notice } = planAdditions(existing, [tooBig, png()]);
        expect(accepted).toEqual([tooBig, expect.objectContaining({ name: 'fig.png' })]);
        expect(notice).toBeNull();
    });
});

describe('pasting', () => {
    const clipboard = ({ files = [], text = '' } = {}) => ({
        files,
        items: [],
        getData: (type) => (type === 'text/plain' ? text : ''),
    });

    it('attaches every file a paste carries, of any type', () => {
        const script = file('analysis.py', 'text/x-python');
        expect(pastedAttachments(clipboard({ files: [script, png()] }))).toEqual([script, expect.any(File)]);
    });

    it('reads files from clipboard items when `files` is empty', () => {
        const image = png();
        const data = { files: [], items: [{ kind: 'string' }, { kind: 'file', getAsFile: () => image }], getData: () => '' };
        expect(pastedAttachments(data)).toEqual([image]);
    });

    it(`turns text longer than ${LONG_PASTE_CHARS} characters into "${PASTED_TEXT_NAME}"`, async () => {
        const long = 'a'.repeat(LONG_PASTE_CHARS + 1);
        const [pasted] = pastedAttachments(clipboard({ text: long }));
        expect(pasted.name).toBe('Pasted text.txt');
        expect(pasted.type).toBe('text/plain');
        expect(pasted.size).toBe(long.length);
    });

    it('lets short text paste into the box, and long text too where nothing can be attached', () => {
        expect(pastedAttachments(clipboard({ text: 'a'.repeat(LONG_PASTE_CHARS) }))).toEqual([]);
        expect(pastedAttachments(clipboard({ text: 'a'.repeat(LONG_PASTE_CHARS + 1) }), { longText: false })).toEqual([]);
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

    it('explains a full disk (507)', () => {
        expect(attachmentErrorMessage(httpError(507, {
            detail: { code: 'STORAGE_FULL', message: 'Uploads are paused: the server is out of space.' },
        }))).toBe('Uploads are paused: the server is out of space.');
        expect(attachmentErrorMessage(httpError(507, '<html></html>'))).toMatch(/no room/);
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

    describe('a file over the 1 MB proxy limit', () => {
        const big = (size) => {
            const bytes = new Uint8Array(size).map((_, i) => i % 251);
            return new File([bytes], 'notebook.ipynb', { type: '' });
        };
        const done = { id: 'big1', kind: 'file', format: 'Notebook', mime_type: 'application/x-ipynb+json', filename: 'notebook.ipynb', size_bytes: 1 };

        it('goes up in chunks: start, each slice in order, complete', async () => {
            const size = CHUNK_THRESHOLD_BYTES * 2 + 100;
            const f = big(size);
            axios.post
                .mockResolvedValueOnce({ data: { upload_id: 'u1', chunk_bytes: CHUNK_THRESHOLD_BYTES, chunk_count: 3 } })
                .mockResolvedValueOnce({ status: 201, data: done });
            axios.put.mockImplementation((url, body, config) => {
                config.onUploadProgress?.({ loaded: body.size });
                return Promise.resolve({ status: 204 });
            });
            const onProgress = jest.fn();
            const result = await uploadAttachment(f, { onProgress });

            expect(axios.post.mock.calls[0][0]).toBe(`${ATTACHMENTS_ENDPOINT}/uploads`);
            expect(axios.post.mock.calls[0][1]).toEqual({ filename: 'notebook.ipynb', size_bytes: size });
            expect(axios.put.mock.calls.map((c) => c[0])).toEqual([0, 1, 2].map((i) => `${ATTACHMENTS_ENDPOINT}/uploads/u1/chunks/${i}`));
            expect(axios.put.mock.calls.map((c) => c[1].size)).toEqual([CHUNK_THRESHOLD_BYTES, CHUNK_THRESHOLD_BYTES, 100]);
            expect(axios.put.mock.calls[0][2].headers).toEqual({ 'Content-Type': 'application/octet-stream' });
            // jsdom's Blob has no arrayBuffer(): read the slice the old way.
            const readBytes = (blob) => new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(new Uint8Array(reader.result));
                reader.readAsArrayBuffer(blob);
            });
            const second = await readBytes(axios.put.mock.calls[1][1]);
            expect(second[0]).toBe(CHUNK_THRESHOLD_BYTES % 251);
            expect(axios.post.mock.calls[1][0]).toBe(`${ATTACHMENTS_ENDPOINT}/uploads/u1/complete`);
            expect(onProgress).toHaveBeenLastCalledWith(1);
            expect(result).toEqual(expect.objectContaining({ id: 'big1', kind: 'file', format: 'Notebook' }));
        });

        it('retries a failed slice up to twice, then gives up', async () => {
            const f = big(CHUNK_THRESHOLD_BYTES + 10);
            axios.post
                .mockResolvedValueOnce({ data: { upload_id: 'u2', chunk_bytes: CHUNK_THRESHOLD_BYTES, chunk_count: 2 } })
                .mockResolvedValueOnce({ status: 201, data: done });
            axios.put
                .mockRejectedValueOnce(new Error('Network Error'))
                .mockRejectedValueOnce({ response: { status: 502 } })
                .mockResolvedValue({ status: 204 });
            await uploadAttachment(f);
            expect(axios.put).toHaveBeenCalledTimes(4); // chunk 0 three times, chunk 1 once

            axios.post.mockReset();
            axios.put.mockReset();
            axios.post.mockResolvedValueOnce({ data: { upload_id: 'u3', chunk_bytes: CHUNK_THRESHOLD_BYTES, chunk_count: 2 } });
            axios.put.mockRejectedValue(new Error('Network Error'));
            await expect(uploadAttachment(f)).rejects.toThrow('Network Error');
            expect(axios.put).toHaveBeenCalledTimes(3);
            expect(axios.post).toHaveBeenCalledTimes(1); // never completed
        });

        it('does not retry an answer (a 4xx), and reads the backend refusal from complete', async () => {
            const f = big(CHUNK_THRESHOLD_BYTES + 10);
            axios.post.mockResolvedValueOnce({ data: { upload_id: 'u4', chunk_bytes: CHUNK_THRESHOLD_BYTES, chunk_count: 2 } });
            const refusal = { response: { status: 413, data: { detail: { code: 'ATTACHMENT_TOO_LARGE', message: 'Too big.' } } } };
            axios.put.mockRejectedValueOnce(refusal);
            await expect(uploadAttachment(f)).rejects.toBe(refusal);
            expect(axios.put).toHaveBeenCalledTimes(1);

            axios.post.mockReset();
            axios.put.mockReset();
            const noText = { response: { status: 422, data: { detail: { code: 'FILE_NO_TEXT', message: 'Nothing to read.' } } } };
            axios.post
                .mockResolvedValueOnce({ data: { upload_id: 'u5', chunk_bytes: CHUNK_THRESHOLD_BYTES, chunk_count: 2 } })
                .mockRejectedValueOnce(noText);
            axios.put.mockResolvedValue({ status: 204 });
            const error = await uploadAttachment(f).catch((e) => e);
            expect(attachmentErrorMessage(error)).toBe('Nothing to read.');
        });

        it('stops sending slices once the upload is aborted', async () => {
            const f = big(CHUNK_THRESHOLD_BYTES * 3);
            const controller = new AbortController();
            axios.post.mockResolvedValueOnce({ data: { upload_id: 'u6', chunk_bytes: CHUNK_THRESHOLD_BYTES, chunk_count: 3 } });
            axios.put.mockImplementation(() => {
                controller.abort();
                return Promise.resolve({ status: 204 });
            });
            const error = await uploadAttachment(f, { signal: controller.signal }).catch((e) => e);
            expect(error.code).toBe('ERR_CANCELED');
            expect(axios.put).toHaveBeenCalledTimes(1);
            expect(axios.post).toHaveBeenCalledTimes(1);
        });

        it('sends a file at the threshold in one request', async () => {
            axios.post.mockResolvedValueOnce({ status: 201, data: done });
            await uploadAttachment(big(CHUNK_THRESHOLD_BYTES));
            expect(axios.post.mock.calls[0][0]).toBe(ATTACHMENTS_ENDPOINT);
            expect(axios.put).not.toHaveBeenCalled();
        });
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

    it('keeps `format` and calls anything but a picture or a PDF a "file"', () => {
        expect(normalizeAttachment({ id: 'f1', kind: 'file', format: 'Python', filename: 'a.py', size_bytes: 4096 }))
            .toEqual(expect.objectContaining({ kind: 'file', format: 'Python' }));
        expect(normalizeAttachment({ id: 'f2', kind: 'spreadsheet', mime_type: 'text/csv' }).kind).toBe('file');
        expect(normalizeAttachment({ id: 'f3', mime_type: 'text/x-python' })).toEqual(
            expect.objectContaining({ kind: 'file', filename: 'file' }),
        );
    });

    it('describes a file by its format, pages and size', () => {
        expect(attachmentMetaText({ format: 'Python', size_bytes: 4096 })).toBe('Python · 4 KB');
        expect(attachmentMetaText({ format: 'PDF', page_count: 4, size_bytes: 2048 })).toBe('PDF · 4 pages · 2 KB');
        expect(attachmentMetaText({ format: 'Word', size_bytes: 2 * 1024 * 1024 })).toBe('Word · 2 MB');
        expect(attachmentMetaText({ filename: 'nb.ipynb', size_bytes: 120 * 1024 })).toBe('Notebook · 120 KB');
        expect(isCodeFormat('Python')).toBe(true);
        expect(isCodeFormat('notebook')).toBe(true);
        expect(isCodeFormat('Word')).toBe(false);
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
