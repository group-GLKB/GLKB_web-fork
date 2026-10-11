/**
 * A Literature Review's own papers on the home bar: added with the composer's "+" (which says
 * "Add your papers" in this mode), uploaded at once, and handed to the review page with the
 * topic. Sources is offered from the start; its two paper options say they need a paper first and
 * offer the upload. Pictures are not papers; a review still needs its topic in words.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import LlmSearchBar from './LlmSearchBarHome';
import { deleteAttachment, resizeImageIfNeeded, uploadAttachment } from '../../service/attachments';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../service/LiteratureReview', () => ({}));
jest.mock('../Auth/AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: true, loading: false, openLoginModal: jest.fn() }),
}));
jest.mock('../../config/features', () => ({ INVESTIGATE_ENABLED: true, LITERATURE_REVIEW_ENABLED: true }));
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
    mockNavigate.mockClear();
    // CRA resets every mock's implementation before each test.
    resizeImageIfNeeded.mockImplementation((f) => Promise.resolve(f));
    deleteAttachment.mockImplementation(() => Promise.resolve());
    uploadAttachment.mockReset();
    uploadAttachment.mockImplementation((file) => Promise.resolve({
        id: `att-${file.name}`, kind: file.name.endsWith('.pdf') ? 'pdf' : 'file', filename: file.name,
        format: file.name.endsWith('.tex') ? 'LaTeX' : 'PDF', size_bytes: 10,
    }));
});

const renderBar = () => render(
    <LlmSearchBar setOpen={() => {}} setExamplesOpen={() => {}} onCollapseExampleLists={() => {}} autocompleteOptions={[]} />,
);
const reviewTab = () => screen.getByRole('tab', { name: /Literature Review/, hidden: true });
// The "+" and its file picker (the composer's own attach button).
const addPapers = (files) => fireEvent.change(screen.getByTestId('attachment-file-input'), { target: { files } });
const start = () => {
    const button = screen.getByRole('button', { name: /start chat/i, hidden: true });
    fireEvent.mouseDown(button);
    fireEvent.click(button);
};

it('hands the papers to the review page with the topic', async () => {
    renderBar();
    fireEvent.click(reviewTab());
    // The "+" adds papers here, documents only
    expect(screen.getByRole('button', { name: 'Add your papers', hidden: true })).toBeInTheDocument();
    expect(screen.getByTestId('attachment-file-input').getAttribute('accept')).toMatch(/\.pdf.*\.tex/);
    expect(screen.getByRole('button', { name: 'Sources: Search only', hidden: true })).toBeInTheDocument();
    addPapers([new File(['%PDF'], 'smith2021.pdf', { type: 'application/pdf' }),
               new File(['\\title{x}'], 'draft.tex', { type: 'text/x-tex' })]);
    // With papers, Sources turns to papers + search
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sources: Papers + search', hidden: true })).toBeInTheDocument());
    expect(screen.getByText('smith2021.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sources: Papers + search', hidden: true }));
    fireEvent.click(screen.getByRole('option', { name: /Your papers only/, hidden: true }));
    expect(screen.getByRole('button', { name: 'Sources: Only your papers', hidden: true })).toBeInTheDocument();

    // the papers are not a question: with no topic, nothing starts
    start();
    expect(mockNavigate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'MET-driven osimertinib resistance' } });
    start();
    const [path, { state }] = mockNavigate.mock.calls[0];
    expect(path).toBe('/literature-review');
    expect(state.initialQuery).toBe('MET-driven osimertinib resistance');
    expect(state.papers.map((a) => a.id)).toEqual(['att-smith2021.pdf', 'att-draft.tex']);
    expect(state.scope.sources).toBe('papers');
});

it('says a paper source needs papers, and keeps the choice made through its upload', async () => {
    renderBar();
    fireEvent.click(reviewTab());
    fireEvent.click(screen.getByRole('button', { name: 'Sources: Search only', hidden: true }));
    fireEvent.click(screen.getByRole('option', { name: /Your papers only/, hidden: true }));
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent(/No papers added yet/);
    const picker = screen.getByTestId('review-papers-input');
    const opened = jest.spyOn(picker, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Upload', hidden: true }));
    expect(opened).toHaveBeenCalled();
    // until the papers arrive it is still a search
    expect(screen.getByRole('button', { name: 'Sources: Search only', hidden: true })).toBeInTheDocument();
    fireEvent.change(picker, { target: { files: [new File(['%PDF'], 'smith2021.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sources: Only your papers', hidden: true })).toBeInTheDocument());
});

it('turns a picture away: it is not a paper', async () => {
    renderBar();
    fireEvent.click(reviewTab());
    addPapers([new File(['png'], 'figure.png', { type: 'image/png' })]);
    expect(await screen.findByText(/Pictures can't be used as papers/)).toBeInTheDocument();
    expect(uploadAttachment).not.toHaveBeenCalled();
});
