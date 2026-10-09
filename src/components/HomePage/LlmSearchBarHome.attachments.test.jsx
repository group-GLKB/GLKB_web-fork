/** Files on the home page's first question: signed-in readers, AI Chat only. */
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

const paperclip = () => screen.getByRole('button', { name: 'Add files or photos' });
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

it('turns the + button off on Investigate', () => {
    mockAuth.isAuthenticated = true;
    renderBar();
    expect(paperclip()).toBeEnabled();
    fireEvent.click(screen.getByTitle('Investigate off'));
    expect(paperclip()).toBeDisabled();
});

it('hands the uploaded files to the chat with the first question, and asks for a summary when it has no words', async () => {
    mockAuth.isAuthenticated = true;
    uploadAttachment.mockResolvedValueOnce({
        id: 'p1', kind: 'pdf', mime_type: 'application/pdf', filename: 'paper.pdf', size_bytes: 4, page_count: 3,
    });
    renderBar();
    pick([pdf()]);
    expect(await screen.findByText('PDF · 3 pages · 4 B')).toBeInTheDocument();
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

it('uploads a notebook picked from the + menu', async () => {
    mockAuth.isAuthenticated = true;
    uploadAttachment.mockResolvedValueOnce({
        id: 'n1', kind: 'file', format: 'Notebook', mime_type: 'application/x-ipynb+json', filename: 'run.ipynb', size_bytes: 2048,
    });
    renderBar();
    pick([new File(['{}'], 'run.ipynb', { type: '' })]);
    expect(await screen.findByText('Notebook · 2 KB')).toBeInTheDocument();
});
