/**
 * The composer's "+" button and its menu, the pending chips, the hook behind them, and the
 * files on a sent message.
 */
import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
    AttachButton,
    AttachmentChips,
    attachmentBlockedNote,
    MessageAttachments,
} from './index';
import useAttachments from './useAttachments';
import {
    attachmentObjectUrl,
    deleteAttachment,
    uploadAttachment,
} from '../../../service/attachments';

jest.mock('../../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../../service/attachments', () => {
    const actual = jest.requireActual('../../../service/attachments');
    return {
        ...actual,
        uploadAttachment: jest.fn(),
        deleteAttachment: jest.fn(() => Promise.resolve()),
        attachmentObjectUrl: jest.fn(),
        primeAttachmentUrl: jest.fn(),
        // jsdom cannot decode images; the resize is the identity here.
        resizeImageIfNeeded: jest.fn((f) => Promise.resolve(f)),
    };
});

beforeAll(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:preview');
    global.URL.revokeObjectURL = jest.fn();
});

beforeEach(() => {
    uploadAttachment.mockReset();
    deleteAttachment.mockClear();
    attachmentObjectUrl.mockReset();
});

const file = (name, type, size = 1000) => {
    const f = new File(['x'], name, { type });
    Object.defineProperty(f, 'size', { value: size });
    return f;
};

describe('the chips', () => {
    const items = [
        { key: 'a', kind: 'image', name: 'fig.png', size: 2048, previewUrl: 'blob:p', status: 'uploading', progress: 0.42 },
        { key: 'b', kind: 'pdf', name: 'scan.pdf', size: 10, status: 'error', error: 'This PDF has no selectable text — it may be a scan.' },
        {
            key: 'c',
            kind: 'pdf',
            name: 'paper.pdf',
            size: 3 * 1024 * 1024,
            status: 'ready',
            attachment: { id: 'p1', page_count: 12, size_bytes: 3 * 1024 * 1024, truncated: true },
        },
    ];

    it('shows progress, the reason a file failed, and a ready PDF with its pages', () => {
        render(<AttachmentChips items={items} onRemove={() => {}} />);
        expect(screen.getByRole('progressbar', { name: 'Uploading fig.png' })).toHaveAttribute('aria-valuenow', '42');
        expect(screen.getByText('Uploading… 42%')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('This PDF has no selectable text');
        expect(screen.getByText('PDF · 12 pages · 3 MB')).toBeInTheDocument();
        expect(screen.getByText('Long file — only the first part will be read')).toBeInTheDocument();
    });

    it('labels a file by its format, with a code icon for code and a document icon otherwise', () => {
        const files = [
            { key: 'py', kind: 'file', name: 'analysis.py', size: 4096, status: 'ready', attachment: { id: 'f1', kind: 'file', format: 'Python', size_bytes: 4096 } },
            { key: 'nb', kind: 'file', name: 'run.ipynb', size: 1, status: 'ready', attachment: { id: 'f2', kind: 'file', format: 'Notebook', size_bytes: 120 * 1024 } },
            { key: 'doc', kind: 'file', name: 'notes.docx', size: 1, status: 'ready', attachment: { id: 'f3', kind: 'file', format: 'Word', size_bytes: 2 * 1024 * 1024 } },
        ];
        const { container } = render(<AttachmentChips items={files} onRemove={() => {}} />);
        expect(screen.getByText('Python · 4 KB')).toBeInTheDocument();
        expect(screen.getByText('Notebook · 120 KB')).toBeInTheDocument();
        expect(screen.getByText('Word · 2 MB')).toBeInTheDocument();
        const icons = Array.from(container.querySelectorAll('.attachment-chip-icon svg'))
            .map((svg) => svg.getAttribute('data-testid'));
        expect(icons).toEqual(['CodeIcon', 'CodeIcon', 'DescriptionOutlinedIcon']);
    });

    it('removes the chip that was asked for', () => {
        const onRemove = jest.fn();
        render(<AttachmentChips items={items} onRemove={onRemove} />);
        fireEvent.click(screen.getByRole('button', { name: 'Remove scan.pdf' }));
        expect(onRemove).toHaveBeenCalledWith('b');
    });

    it('says why the question cannot be sent', () => {
        render(<AttachmentChips items={items} blockedNote="Attachments work in AI Chat." onRemove={() => {}} />);
        expect(screen.getByRole('status')).toHaveTextContent('Attachments work in AI Chat.');
    });

    it('blocks a failed upload, and anything on Investigate', () => {
        expect(attachmentBlockedNote({ hasItems: true, hasErrors: true })).toMatch(/Remove the files/);
        expect(attachmentBlockedNote({ hasItems: true, hasErrors: false }, { investigate: true }))
            .toMatch(/Attachments work in AI Chat/);
        expect(attachmentBlockedNote({ hasItems: false, hasErrors: false }, { investigate: true })).toBe('');
        expect(attachmentBlockedNote({ hasItems: true, hasErrors: false })).toBe('');
    });
});

describe('the + button', () => {
    const plus = () => screen.getByRole('button', { name: 'Add files or photos' });
    const originalClipboard = navigator.clipboard;
    afterEach(() => {
        Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
    });

    it('asks a guest to sign in instead of opening the menu', () => {
        const onRequireSignIn = jest.fn();
        render(<AttachButton isGuest onRequireSignIn={onRequireSignIn} onFiles={jest.fn()} />);
        fireEvent.click(plus());
        expect(onRequireSignIn).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('opens a menu whose first item opens the picker, for any file type', () => {
        const onFiles = jest.fn();
        render(<AttachButton onFiles={onFiles} />);
        const input = screen.getByTestId('attachment-file-input');
        const pick = jest.spyOn(input, 'click');
        fireEvent.click(plus());
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('menuitem', { name: /Add photos and files/ }));
        expect(pick).toHaveBeenCalledTimes(1);
        expect(input).not.toHaveAttribute('accept');
        const picked = [file('analysis.py', 'text/x-python'), file('run.ipynb', '')];
        fireEvent.change(input, { target: { files: picked } });
        expect(onFiles).toHaveBeenCalledWith(picked);
    });

    it('offers only "Add photos and files" — pasting needs no entry', () => {
        render(<AttachButton onFiles={jest.fn()} />);
        fireEvent.click(plus());
        expect(screen.getAllByRole('menuitem')).toHaveLength(1);
        expect(screen.getByRole('menu')).toHaveTextContent('Add');
        expect(screen.getByRole('menuitem')).toHaveTextContent('Upload from computer');
        expect(screen.queryByText(/clipboard/i)).not.toBeInTheDocument();
    });

    it('is a plain +: not turned into a cross, grey only while open', () => {
        render(<AttachButton onFiles={jest.fn()} />);
        const button = plus();
        expect(button).not.toHaveClass('is-open');
        fireEvent.click(button);
        expect(button).toHaveClass('is-open');
        expect(button).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(button);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('is disabled, with the reason, where attachments do not work', () => {
        const onRequireSignIn = jest.fn();
        render(<AttachButton disabled disabledReason="Attachments work in AI Chat" isGuest onRequireSignIn={onRequireSignIn} />);
        const button = plus();
        expect(button).toBeDisabled();
        expect(button.parentElement).toHaveAttribute('aria-label', 'Attachments work in AI Chat');
    });
});

describe('the files waiting on a composer', () => {
    const ready = (id, kind = 'image') => ({
        id, kind, mime_type: kind === 'pdf' ? 'application/pdf' : 'image/png', filename: `${id}`, size_bytes: 10, page_count: null,
    });

    it('uploads a file as soon as it is added, and offers it once uploaded', async () => {
        uploadAttachment.mockResolvedValueOnce(ready('i1'));
        const { result } = renderHook(() => useAttachments());
        act(() => { result.current.addFiles([file('fig.png', 'image/png')]); });
        expect(result.current.items[0].status).toBe('uploading');
        expect(result.current.isUploading).toBe(true);
        await waitFor(() => expect(result.current.items[0].status).toBe('ready'));
        expect(result.current.readyAttachments).toEqual([ready('i1')]);
        expect(result.current.isUploading).toBe(false);
    });

    it("keeps a refused file on screen with the backend's reason", async () => {
        uploadAttachment.mockRejectedValueOnce({
            response: { status: 422, data: { detail: { code: 'PDF_NO_TEXT', message: 'No selectable text.' } } },
        });
        const { result } = renderHook(() => useAttachments());
        act(() => { result.current.addFiles([file('scan.pdf', 'application/pdf')]); });
        await waitFor(() => expect(result.current.items[0].status).toBe('error'));
        expect(result.current.items[0].error).toBe('No selectable text.');
        expect(result.current.hasErrors).toBe(true);
        expect(result.current.readyAttachments).toEqual([]);
    });

    it('never uploads a file it can tell is not allowed', () => {
        const { result } = renderHook(() => useAttachments());
        act(() => { result.current.addFiles([file('talk.mp4', 'video/mp4'), file('code.zip', '')]); });
        expect(uploadAttachment).not.toHaveBeenCalled();
        expect(result.current.items.map((item) => item.error)).toEqual([
            "This file type can't be attached.", "This file type can't be attached.",
        ]);
    });

    it('uploads code, notebooks and documents as files', async () => {
        uploadAttachment.mockResolvedValue({ id: 'f1', kind: 'file', format: 'Python', filename: 'a.py', size_bytes: 1 });
        const { result } = renderHook(() => useAttachments());
        act(() => { result.current.addFiles([file('a.py', 'text/x-python'), file('b.ipynb', '')]); });
        expect(result.current.items.map((item) => item.kind)).toEqual(['file', 'file']);
        await waitFor(() => expect(result.current.readyAttachments).toHaveLength(2));
        expect(uploadAttachment).toHaveBeenCalledTimes(2);
    });

    it('shows a notice it is handed (the paste hint)', () => {
        const { result } = renderHook(() => useAttachments());
        act(() => { result.current.showNotice('Press Ctrl+V'); });
        expect(result.current.notice).toBe('Press Ctrl+V');
    });

    it('aborts an upload in flight when its chip is removed', async () => {
        let seenSignal = null;
        uploadAttachment.mockImplementationOnce((f, { signal }) => {
            seenSignal = signal;
            return new Promise(() => {});
        });
        const { result } = renderHook(() => useAttachments());
        act(() => { result.current.addFiles([file('big.ipynb', '', 5 * 1024 * 1024)]); });
        await waitFor(() => expect(seenSignal).not.toBeNull());
        act(() => { result.current.remove(result.current.items[0].key); });
        expect(seenSignal.aborted).toBe(true);
        expect(deleteAttachment).not.toHaveBeenCalled();
    });

    it('asks a guest to sign in when the backend refuses the upload as theirs', async () => {
        uploadAttachment.mockRejectedValueOnce({
            response: { status: 403, data: { detail: { code: 'GUEST_LOGIN_REQUIRED', message: 'Sign in to attach files.' } } },
        });
        const onRequireSignIn = jest.fn();
        const { result } = renderHook(() => useAttachments({ onRequireSignIn }));
        act(() => { result.current.addFiles([file('fig.png', 'image/png')]); });
        await waitFor(() => expect(onRequireSignIn).toHaveBeenCalled());
    });

    it('deletes an uploaded file that is removed before it is sent', async () => {
        uploadAttachment.mockResolvedValueOnce(ready('i1'));
        const { result } = renderHook(() => useAttachments());
        act(() => { result.current.addFiles([file('fig.png', 'image/png')]); });
        await waitFor(() => expect(result.current.items[0].status).toBe('ready'));
        act(() => { result.current.remove(result.current.items[0].key); });
        expect(deleteAttachment).toHaveBeenCalledWith('i1');
        expect(result.current.items).toEqual([]);
    });

    it('lets go of the chips after a send without deleting the files, which are the message\'s now', async () => {
        uploadAttachment.mockResolvedValueOnce(ready('i1'));
        const { result } = renderHook(() => useAttachments());
        act(() => { result.current.addFiles([file('fig.png', 'image/png')]); });
        await waitFor(() => expect(result.current.items[0].status).toBe('ready'));
        act(() => { result.current.clear(); });
        expect(result.current.items).toEqual([]);
        expect(deleteAttachment).not.toHaveBeenCalled();
    });

    it('says when a message is full', () => {
        uploadAttachment.mockReturnValue(new Promise(() => {}));
        const { result } = renderHook(() => useAttachments());
        act(() => {
            result.current.addFiles([1, 2, 3, 4, 5, 6].map((n) => file(`f${n}.png`, 'image/png')));
        });
        expect(result.current.items).toHaveLength(5);
        expect(result.current.notice).toBe('Up to 5 images per message.');
        act(() => {
            result.current.addFiles([1, 2, 3, 4, 5, 6].map((n) => file(`s${n}.py`, 'text/x-python')));
        });
        expect(result.current.items).toHaveLength(10);
        expect(result.current.notice).toBe('Up to 10 files per message.');
    });
});

describe('the files on a sent message', () => {
    it('shows an image from its object URL, and opens it large over the page — not a new tab', async () => {
        attachmentObjectUrl.mockResolvedValueOnce('blob:full');
        render(<MessageAttachments attachments={[{ id: 'i1', kind: 'image', filename: 'fig.png' }]} />);
        const img = await screen.findByAltText('fig.png');
        expect(img).toHaveAttribute('src', 'blob:full');
        expect(attachmentObjectUrl).toHaveBeenCalledWith('i1');
        const tile = screen.getByTestId('message-attachment-image');
        expect(tile).not.toHaveAttribute('href');
        fireEvent.click(tile);
        const dialog = screen.getByRole('dialog', { name: 'fig.png' });
        expect(dialog.querySelector('.image-lightbox-img')).toHaveAttribute('src', 'blob:full');
    });

    it('closes the large image with the ×, with Esc, and with a click outside it', async () => {
        attachmentObjectUrl.mockResolvedValue('blob:full');
        render(<MessageAttachments attachments={[{ id: 'i1', kind: 'image', filename: 'fig.png' }]} />);
        await screen.findByAltText('fig.png');
        const tile = screen.getByTestId('message-attachment-image');

        fireEvent.click(tile);
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        fireEvent.click(tile);
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        fireEvent.click(tile);
        fireEvent.click(screen.getByRole('dialog'));  // the dark area around the picture
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('opens a waiting image large from its chip, and closes it', async () => {
        render(<AttachmentChips items={[{
            key: 'k1', kind: 'image', name: 'shot.png', status: 'ready', previewUrl: 'blob:local',
        }]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Preview shot.png' }));
        expect(screen.getByRole('dialog', { name: 'shot.png' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('shows a neutral tile when the image cannot be read', async () => {
        attachmentObjectUrl.mockRejectedValueOnce({ response: { status: 404 } });
        render(<MessageAttachments attachments={[{ id: 'i1', kind: 'image', filename: 'fig.png' }]} />);
        expect(await screen.findByText('Image unavailable')).toBeInTheDocument();
    });

    it('shows a PDF with its name and pages', () => {
        render(<MessageAttachments attachments={[{ id: 'p1', kind: 'pdf', filename: 'paper.pdf', page_count: 1, size_bytes: 2048 }]} />);
        expect(screen.getByRole('button', { name: /paper\.pdf/ })).toHaveTextContent('PDF · 1 page · 2 KB');
        expect(attachmentObjectUrl).not.toHaveBeenCalled();
    });

    it('shows a code file with its format, and opens it on click', async () => {
        attachmentObjectUrl.mockResolvedValueOnce('blob:code');
        const opened = { location: { href: '' }, close: jest.fn() };
        jest.spyOn(window, 'open').mockReturnValue(opened);
        const { container } = render(<MessageAttachments attachments={[{ id: 'f1', kind: 'file', format: 'Python', filename: 'analysis.py', size_bytes: 4096 }]} />);
        const tile = screen.getByRole('button', { name: /analysis\.py/ });
        expect(tile).toHaveTextContent('Python · 4 KB');
        expect(tile).toHaveClass('is-file');
        expect(container.querySelector('[data-testid="CodeIcon"]')).not.toBeNull();
        fireEvent.click(tile);
        await waitFor(() => expect(opened.location.href).toBe('blob:code'));
        window.open.mockRestore();
    });

    it('draws nothing for a message without attachments', () => {
        const { container } = render(<MessageAttachments attachments={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });
});
