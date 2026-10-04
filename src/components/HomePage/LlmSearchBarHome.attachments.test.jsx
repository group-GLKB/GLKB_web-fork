/** Images and PDFs on the home page's first question: signed-in readers, AI Chat only. */
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

const paperclip = () => screen.getByRole('button', { name: 'Attach images or PDFs' });
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
    expect(mockAuth.openLoginModal).toHaveBeenCalledWith("Sign in to attach images and PDFs — it's free.");
});

it('turns the paperclip off on Investigate', () => {
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
    expect(await screen.findByText('3 pages · 4 B')).toBeInTheDocument();
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
