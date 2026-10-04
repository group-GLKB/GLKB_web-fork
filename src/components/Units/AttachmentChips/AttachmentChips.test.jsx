/**
 * The composer's paperclip and pending chips, the hook behind them, and the files on a sent
 * message.
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
        expect(screen.getByText('12 pages · 3 MB')).toBeInTheDocument();
        expect(screen.getByText('Long PDF — only the first part will be read')).toBeInTheDocument();
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

describe('the paperclip', () => {
    it('asks a guest to sign in instead of opening the file picker', () => {
        const onRequireSignIn = jest.fn();
        const onFiles = jest.fn();
        render(<AttachButton isGuest onRequireSignIn={onRequireSignIn} onFiles={onFiles} />);
        const input = screen.getByTestId('attachment-file-input');
        const pick = jest.spyOn(input, 'click');
        fireEvent.click(screen.getByRole('button', { name: 'Attach images or PDFs' }));
        expect(onRequireSignIn).toHaveBeenCalledTimes(1);
        expect(pick).not.toHaveBeenCalled();
    });

    it('opens the picker for a signed-in reader and hands over what was picked', () => {
        const onFiles = jest.fn();
        render(<AttachButton onFiles={onFiles} />);
        const input = screen.getByTestId('attachment-file-input');
        const pick = jest.spyOn(input, 'click');
        fireEvent.click(screen.getByRole('button', { name: 'Attach images or PDFs' }));
        expect(pick).toHaveBeenCalledTimes(1);
        expect(input).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp,application/pdf');
        const picked = file('fig.png', 'image/png');
        fireEvent.change(input, { target: { files: [picked] } });
        expect(onFiles).toHaveBeenCalledWith([picked]);
    });

    it('is disabled, with the reason, where attachments do not work', () => {
        const onRequireSignIn = jest.fn();
        render(<AttachButton disabled disabledReason="Attachments work in AI Chat" isGuest onRequireSignIn={onRequireSignIn} />);
        const button = screen.getByRole('button', { name: 'Attach images or PDFs' });
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
        act(() => { result.current.addFiles([file('a.gif', 'image/gif')]); });
        expect(uploadAttachment).not.toHaveBeenCalled();
        expect(result.current.items[0]).toMatchObject({ status: 'error' });
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
            result.current.addFiles([1, 2, 3, 4, 5].map((n) => file(`f${n}.png`, 'image/png')));
        });
        expect(result.current.items).toHaveLength(4);
        expect(result.current.notice).toBe('Up to 4 images per message.');
    });
});

describe('the files on a sent message', () => {
    it('shows an image from its object URL, opening full size', async () => {
        attachmentObjectUrl.mockResolvedValueOnce('blob:full');
        render(<MessageAttachments attachments={[{ id: 'i1', kind: 'image', filename: 'fig.png' }]} />);
        const img = await screen.findByAltText('fig.png');
        expect(img).toHaveAttribute('src', 'blob:full');
        expect(screen.getByTestId('message-attachment-image')).toHaveAttribute('href', 'blob:full');
        expect(attachmentObjectUrl).toHaveBeenCalledWith('i1');
    });

    it('shows a neutral tile when the image cannot be read', async () => {
        attachmentObjectUrl.mockRejectedValueOnce({ response: { status: 404 } });
        render(<MessageAttachments attachments={[{ id: 'i1', kind: 'image', filename: 'fig.png' }]} />);
        expect(await screen.findByText('Image unavailable')).toBeInTheDocument();
    });

    it('shows a PDF with its name and pages', () => {
        render(<MessageAttachments attachments={[{ id: 'p1', kind: 'pdf', filename: 'paper.pdf', page_count: 1, size_bytes: 2048 }]} />);
        expect(screen.getByRole('button', { name: /paper\.pdf/ })).toHaveTextContent('1 page · 2 KB');
        expect(attachmentObjectUrl).not.toHaveBeenCalled();
    });

    it('draws nothing for a message without attachments', () => {
        const { container } = render(<MessageAttachments attachments={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });
});
