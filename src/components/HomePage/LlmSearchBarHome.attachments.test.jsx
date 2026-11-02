/** Files on the home page's first question: signed-in readers; AI Chat any type, Investigate documents. */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import LlmSearchBar from './LlmSearchBarHome';
import { uploadAttachment } from '../../service/attachments';

const mockAuth = { isAuthenticated: false, loading: false, openLoginModal: jest.fn() };
const mockNavigate = jest.fn();

jest.mock('../Auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../service/serviceTiers', () => {
    const actual = jest.requireActual('../../service/serviceTiers');
    return {
        ...actual,
        fetchTierPricing: () => Promise.resolve(actual.parsePricing(actual.FALLBACK_PRICING)),
        getTierPref: () => '',
        setTierPref: jest.fn(),
    };
});
jest.mock('../../service/attachments', () => {
    const actual = jest.requireActual('../../service/attachments');
    return {
        ...actual,
        uploadAttachment: jest.fn(),
        deleteAttachment: jest.fn(() => Promise.resolve()),
        primeAttachmentUrl: jest.fn(),
        resizeImageIfNeeded: jest.fn((f) => Promise.resolve(f)),
    };
});

beforeAll(() => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
    global.URL.createObjectURL = jest.fn(() => 'blob:preview');
    global.URL.revokeObjectURL = jest.fn();
});

beforeEach(() => {
    window.localStorage.clear();
    mockAuth.openLoginModal = jest.fn();
    mockAuth.isAuthenticated = false;
    mockNavigate.mockClear();
    uploadAttachment.mockReset();
});

const renderBar = () => render(
    <LlmSearchBar
        setOpen={() => {}}
        setExamplesOpen={() => {}}
        onCollapseExampleLists={() => {}}
        autocompleteOptions={[]}
    />,
);

const paperclip = () => screen.getByRole('button', { name: 'Attach PDF, figure or spreadsheet' });
const startChat = () => {
    const button = screen.getByRole('button', { name: 'Start chat' });
    fireEvent.mouseDown(button);
    fireEvent.click(button);
};
const pick = (files) => {
    fireEvent.change(screen.getByTestId('attachment-file-input'), { target: { files } });
};
const pdf = () => new File(['%PDF'], 'paper.pdf', { type: 'application/pdf' });

it('asks a guest to sign in instead of opening the file picker', () => {
    renderBar();
    fireEvent.click(paperclip());
    expect(mockAuth.openLoginModal).toHaveBeenCalledWith("Sign in to attach files — it's free.");
});

it('opens the file picker straight from the +, with no menu in between', () => {
    mockAuth.isAuthenticated = true;
    renderBar();
    const input = screen.getByTestId('attachment-file-input');
    const click = jest.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.click(paperclip());
    expect(click).toHaveBeenCalled();
    expect(document.querySelector('.attach-menu')).toBeNull();
});

const docButton = () => screen.getByRole('button', { name: 'Attach a document (PDF, Word, text)' });
const image = () => new File(['png'], 'fig.png', { type: 'image/png' });
const IMAGES_NOTE = 'Images work in AI Chat — Investigate reads documents (PDF, Word, text).';

it('keeps the + on Investigate for documents (since 2026-11-02), with a picker that offers no images', () => {
    mockAuth.isAuthenticated = true;
    renderBar();
    expect(paperclip()).toBeEnabled();
    fireEvent.click(screen.getByTitle('Investigate off'));
    expect(docButton()).toBeEnabled();
    const accept = screen.getByTestId('attachment-file-input').getAttribute('accept');
    expect(accept).toContain('.pdf');
    expect(accept).toContain('.docx');
    expect(accept).not.toMatch(/\.png|\.jpe?g|image\//);
});

it('sends the documents with an Investigate question', async () => {
    mockAuth.isAuthenticated = true;
    uploadAttachment.mockResolvedValueOnce({
        id: 'p1', kind: 'pdf', mime_type: 'application/pdf', filename: 'paper.pdf', size_bytes: 4, page_count: 3,
    });
    renderBar();
    fireEvent.click(screen.getByTitle('Investigate off'));
    pick([pdf()]);
    await waitFor(() => expect(screen.getByTestId('attachment-chip')).toHaveClass('is-ready'));
    fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'How does this paper fit the literature?' },
    });
    startChat();
    expect(mockNavigate).toHaveBeenCalledWith('/chat/new', expect.objectContaining({
        state: expect.objectContaining({
            initialQuery: 'How does this paper fit the literature?',
            initialSearchOptions: expect.objectContaining({
                investigateEnabled: true,
                attachments: [expect.objectContaining({ id: 'p1', kind: 'pdf' })],
            }),
        }),
    }));
    // The files are the question's now.
    expect(screen.queryByTestId('attachment-chip')).toBeNull();
});

it('turns an image away on Investigate before uploading it, and says why', async () => {
    mockAuth.isAuthenticated = true;
    renderBar();
    fireEvent.click(screen.getByTitle('Investigate off'));
    pick([image()]);
    expect(await screen.findByText(IMAGES_NOTE)).toBeInTheDocument();
    expect(uploadAttachment).not.toHaveBeenCalled();
    expect(screen.queryByTestId('attachment-chip')).toBeNull();
});

const waitingImageAndPdf = async () => {
    uploadAttachment
        .mockResolvedValueOnce({ id: 'i1', kind: 'image', mime_type: 'image/png', filename: 'fig.png', size_bytes: 3 })
        .mockResolvedValueOnce({ id: 'p1', kind: 'pdf', mime_type: 'application/pdf', filename: 'paper.pdf', size_bytes: 4 });
    renderBar();
    // Attached in Chat, which reads both; then the mode switched.
    pick([image(), pdf()]);
    await waitFor(() => {
        const chips = screen.getAllByTestId('attachment-chip');
        expect(chips).toHaveLength(2);
        chips.forEach((chip) => expect(chip).toHaveClass('is-ready'));
    });
    fireEvent.click(screen.getByTitle('Investigate off'));
    fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'What does this paper show?' },
    });
};

it('holds an Investigate question back while an image from Chat waits, and offers Chat', async () => {
    mockAuth.isAuthenticated = true;
    await waitingImageAndPdf();
    expect(screen.getByText(IMAGES_NOTE)).toBeInTheDocument();
    startChat();
    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Use Chat' }));
    expect(screen.queryByText(IMAGES_NOTE)).toBeNull();
    expect(screen.getByTitle('Investigate off')).toBeInTheDocument();
    startChat();
    expect(mockNavigate.mock.calls[0][1].state.initialSearchOptions).toEqual(expect.objectContaining({
        investigateEnabled: false,
        attachments: [expect.objectContaining({ id: 'i1' }), expect.objectContaining({ id: 'p1' })],
    }));
});

it('can remove just the image instead, and send the document to Investigate', async () => {
    mockAuth.isAuthenticated = true;
    await waitingImageAndPdf();
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(screen.getAllByTestId('attachment-chip')).toHaveLength(1);
    expect(screen.getByTestId('attachment-chip')).toHaveTextContent('paper.pdf');
    expect(screen.queryByText(IMAGES_NOTE)).toBeNull();
    startChat();
    expect(mockNavigate.mock.calls[0][1].state.initialSearchOptions).toEqual(expect.objectContaining({
        investigateEnabled: true,
        attachments: [expect.objectContaining({ id: 'p1' })],
    }));
});

it('hands the uploaded files to the chat with the first question, and asks for a summary when it has no words', async () => {
    mockAuth.isAuthenticated = true;
    uploadAttachment.mockResolvedValueOnce({
        id: 'p1', kind: 'pdf', mime_type: 'application/pdf', filename: 'paper.pdf', size_bytes: 4, page_count: 3,
    });
    renderBar();
    pick([pdf()]);
    // The design's chip: the extension as a tag, then the name.
    const chip = await screen.findByTestId('attachment-chip');
    await waitFor(() => expect(chip).toHaveClass('is-ready'));
    expect(chip.querySelector('.attachment-chip-tag')).toHaveTextContent('PDF');
    expect(chip).toHaveTextContent('paper.pdf');
    startChat();
    expect(mockNavigate).toHaveBeenCalledWith('/chat/new', expect.objectContaining({
        state: expect.objectContaining({
            initialQuery: 'Summarize the attached file.',
            initialSearchOptions: expect.objectContaining({
                attachments: [expect.objectContaining({ id: 'p1', kind: 'pdf' })],
            }),
        }),
    }));
});

it('holds the question back while a file is still uploading', async () => {
    mockAuth.isAuthenticated = true;
    uploadAttachment.mockReturnValue(new Promise(() => {}));
    renderBar();
    fireEvent.change(screen.getByPlaceholderText(/Ask a question about the biomedical literature/i), {
        target: { value: 'What does this paper show?' },
    });
    pick([pdf()]);
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalled());
    startChat();
    expect(mockNavigate).not.toHaveBeenCalled();
});

it('attaches a long paste as "Pasted text.txt" for a signed-in reader', async () => {
    mockAuth.isAuthenticated = true;
    uploadAttachment.mockReturnValue(new Promise(() => {}));
    renderBar();
    const box = screen.getByPlaceholderText(/Ask a question about the biomedical literature/i);
    fireEvent.paste(box, { clipboardData: { files: [], items: [], getData: () => 'y'.repeat(4500) } });
    // (The upload itself is mocked; CRA's resetMocks leaves the mocked resize returning nothing,
    // so the chip — named from the pasted file — is what shows the paste became an attachment.)
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalled());
    expect(screen.getByText('Pasted text.txt')).toBeInTheDocument();
    expect(box).toHaveValue('');
});

it("leaves a guest's long paste in the box rather than attaching it", () => {
    renderBar();
    const box = screen.getByPlaceholderText(/Ask a question about the biomedical literature/i);
    fireEvent.paste(box, { clipboardData: { files: [], items: [], getData: () => 'y'.repeat(4500) } });
    expect(uploadAttachment).not.toHaveBeenCalled();
    expect(mockAuth.openLoginModal).not.toHaveBeenCalled();
});

it('uploads a notebook picked with the +', async () => {
    mockAuth.isAuthenticated = true;
    uploadAttachment.mockResolvedValueOnce({
        id: 'n1', kind: 'file', format: 'Notebook', mime_type: 'application/x-ipynb+json', filename: 'run.ipynb', size_bytes: 2048,
    });
    renderBar();
    pick([new File(['{}'], 'run.ipynb', { type: '' })]);
    const chip = await screen.findByTestId('attachment-chip');
    await waitFor(() => expect(chip).toHaveClass('is-ready'));
    expect(chip.querySelector('.attachment-chip-tag')).toHaveTextContent('IPYNB');
    expect(chip).toHaveTextContent('run.ipynb');
});
