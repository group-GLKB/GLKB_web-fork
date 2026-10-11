/**
 * The Literature Review page across the life of a review. A review takes 15-25 minutes, so what
 * matters is what a reader finds when they come back to it: the page takes the review's address as
 * soon as the backend has saved the prompt, a review still being written is picked up when it is
 * saved, and a stopped one can be run again without retyping the topic.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import LiteratureReview from './index';
import { getChatHistoryDetailByPublicId } from '../../service/ChatHistory';
import { streamReview } from '../../service/LiteratureReview';
import { fetchCitations } from '../../service/Citation';
import { deleteAttachment, resizeImageIfNeeded, uploadAttachment } from '../../service/attachments';

const mockNavigate = jest.fn();
let mockParams = {};
let mockLocationState = null;
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => ({ state: mockLocationState }),
}));
jest.mock('../../service/attachments', () => {
    const actual = jest.requireActual('../../service/attachments');
    return {
        ...actual,
        uploadAttachment: jest.fn(),
        deleteAttachment: jest.fn(),
        resizeImageIfNeeded: jest.fn(),
    };
});
jest.mock('../Auth/AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: true, loading: false, openLoginModal: jest.fn() }),
}));
jest.mock('../../service/Citation', () => ({ fetchCitations: jest.fn(() => Promise.resolve({})) }));
jest.mock('../../service/ChatHistory', () => ({ getChatHistoryDetailByPublicId: jest.fn() }));
jest.mock('../../service/LiteratureReview', () => ({
    streamReview: jest.fn(),
    cancelReview: jest.fn(() => Promise.resolve({})),
}));

beforeEach(() => {
    mockNavigate.mockClear();
    getChatHistoryDetailByPublicId.mockReset();
    streamReview.mockReset();
    mockParams = {};
    mockLocationState = null;
    // CRA resets every mock's implementation before each test.
    fetchCitations.mockImplementation(() => Promise.resolve({}));
    uploadAttachment.mockImplementation((file) => Promise.resolve({
        id: `att-${file.name}`, kind: 'file', filename: file.name, format: 'Word', size_bytes: 10,
    }));
    deleteAttachment.mockImplementation(() => Promise.resolve());
    resizeImageIfNeeded.mockImplementation((f) => Promise.resolve(f));
});

const startReview = async (topic) => {
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: topic } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start writing/ })); });
};

it('takes the review\'s address from the first frame, not at the end', async () => {
    let finish;
    streamReview.mockImplementation((_req, onFrame) => new Promise((resolve) => {
        onFrame({ step: 'Started', history_id: 7, public_id: 'p1', pipeline: 'literature_review' });
        onFrame({ type: 'progress', phase: 'acquisition', label: 'Searching', percent: 10, detail: { searches: 3 } });
        finish = () => {
            onFrame({ step: 'Complete', response: '# Topic\n\nThe finished review.', usage: { totals: { cost_usd: 0.19 } } });
            onFrame({ step: 'Saved', public_id: 'p1' });
            resolve();
        };
    }));
    render(<LiteratureReview />);
    await startReview('Gut microbiome and depression');

    expect(mockNavigate).toHaveBeenCalledWith('/literature-review/p1', { replace: true });
    expect(screen.getByText('Searching')).toBeInTheDocument();
    await act(async () => finish());
    expect(screen.getByText('The finished review.')).toBeInTheDocument();
    expect(getChatHistoryDetailByPublicId).not.toHaveBeenCalled();   // its own review is not reloaded
});

it('picks up a review that was still being written when it was reopened', async () => {
    jest.useFakeTimers();
    try {
        mockParams = { publicId: 'p2' };
        const question = { role: 'user', content: 'Gut microbiome and depression' };
        getChatHistoryDetailByPublicId
            .mockResolvedValueOnce({ messages: [question] })
            .mockResolvedValueOnce({ messages: [question, { role: 'assistant', content: '# T\n\nThe saved review.' }] });
        render(<LiteratureReview />);
        await waitFor(() => expect(screen.getByText(/still being written/)).toBeInTheDocument());

        await act(async () => { jest.advanceTimersByTime(15000); });
        await waitFor(() => expect(screen.getByText('The saved review.')).toBeInTheDocument());
        expect(getChatHistoryDetailByPublicId).toHaveBeenCalledTimes(2);
    } finally {
        jest.useRealTimers();
    }
});

it('keeps the topic for another try after a stop', async () => {
    streamReview.mockImplementation(async (_req, onFrame) => {
        onFrame({ step: 'Started', history_id: 8, public_id: 'p3', pipeline: 'literature_review' });
        onFrame({ step: 'Error', error: 'stopped', stopped: true });
    });
    const { rerender } = render(<LiteratureReview />);
    await startReview('Osimertinib resistance');
    mockParams = { publicId: 'p3' };               // the address the page navigated to
    rerender(<LiteratureReview />);

    expect(screen.getByText('The review was stopped.')).toBeInTheDocument();
    expect(screen.getAllByText('The review was stopped.')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/literature-review');
    expect(screen.getByLabelText('Topic')).toHaveValue('Osimertinib resistance');
    expect(screen.getByRole('button', { name: /Start writing/ })).toBeVisible();
});

it('offers the finished review as LaTeX, Word and PDF from Export', async () => {
    // The files themselves are covered by utils/reviewToLatex.test.js and utils/reviewExport.test.js;
    // what is pinned here is that the buttons appear only on a finished review, that each hands the
    // browser the right type and filename, and that PDF goes through a print window.
    const createObjectURL = jest.fn(() => 'blob:x');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(window, 'URL', { value: { createObjectURL, revokeObjectURL }, writable: true });
    const clicks = [];
    const realCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = realCreate(tag);
        if (tag === 'a') { el.click = () => clicks.push(el.download); }
        return el;
    });

    let finish;
    streamReview.mockImplementation((_req, onFrame) => new Promise((resolve) => {
        onFrame({ step: 'Started', history_id: 9, public_id: 'p9', pipeline: 'literature_review' });
        finish = () => {
            onFrame({ step: 'Complete', response: '# T\n\nA finding [1].\n\n## References\n\n1. A paper. (2024). PMID 1.\n' });
            onFrame({ step: 'Saved', public_id: 'p9' });
            resolve();
        };
    }));
    render(<LiteratureReview />);
    await startReview('CRISPR base editing');
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();

    await act(async () => finish());
    fireEvent.click(await screen.findByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /LaTeX/ }));
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/x-tex');
    expect(clicks[0]).toMatch(/^crispr-base-editing_\d{4}-\d{2}-\d{2}\.tex$/);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Word/ }));
    expect(createObjectURL.mock.calls[1][0].type).toBe('application/msword');
    // the Word file is named after the review's own title, not the typed topic
    expect(clicks[1]).toMatch(/^t_\d{4}-\d{2}-\d{2}\.doc$/);

    document.createElement.mockRestore();
});

it('prints the review for a PDF, and says so when the pop-up is blocked', async () => {
    const print = jest.fn();
    const write = jest.fn();
    const open = jest.spyOn(window, 'open').mockReturnValue({
        document: { write, close: jest.fn() }, focus: jest.fn(), print,
    });
    jest.useFakeTimers();

    let finish;
    streamReview.mockImplementation((_req, onFrame) => new Promise((resolve) => {
        onFrame({ step: 'Started', history_id: 9, public_id: 'p9', pipeline: 'literature_review' });
        finish = () => {
            onFrame({ step: 'Complete', response: '# T\n\nA finding [1].\n' });
            onFrame({ step: 'Saved', public_id: 'p9' });
            resolve();
        };
    }));
    render(<LiteratureReview />);
    await act(async () => {
        fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'CRISPR' } });
        fireEvent.click(screen.getByRole('button', { name: /Start writing/ }));
    });
    await act(async () => finish());

    fireEvent.click(await screen.findByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^PDF/ }));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('@media print'));
    act(() => { jest.runAllTimers(); });
    expect(print).toHaveBeenCalledTimes(1);

    // a blocked pop-up must say what to do rather than appear to do nothing
    open.mockReturnValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^PDF/ }));
    expect(screen.getByText(/Allow pop-ups/)).toBeInTheDocument();

    jest.useRealTimers();
    open.mockRestore();
});


it('asks for the scope it shows, and re-cites the finished review in the style picked', async () => {
    fetchCitations.mockResolvedValue({
        11: { title: 'Paper eleven', author: [{ family: 'Lee', given: 'Ann' }, { family: 'Park', given: 'Bo' }],
              issued: { 'date-parts': [[2021]] }, 'container-title': 'Cell', PMID: '11' },
    });
    let finish;
    streamReview.mockImplementation((_req, onFrame) => new Promise((resolve) => {
        finish = () => {
            onFrame({ step: 'Complete', response: '# T\n\nA claim [1].\n\n## References\n\n1. Paper eleven (2021). PMID 11.',
                      references: [{ number: 1, pmid: '11', title: 'Paper eleven', year: 2021 }] });
            resolve();
        };
    }));
    render(<LiteratureReview />);
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Gut microbiome and depression' } });
    fireEvent.click(screen.getByRole('button', { name: 'Article types: All types' }));
    fireEvent.click(screen.getByRole('option', { name: /Primary research/ }));
    const now = new Date().getFullYear();
    fireEvent.click(screen.getByRole('button', { name: `Years: Up to ${now}` }));
    fireEvent.click(within(screen.getByRole('group', { name: 'From' })).getByRole('option', { name: String(now - 5) }));
    expect(screen.getByRole('button', { name: `Years: ${now - 5}–${now}` })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start writing/ })); });
    const [req] = streamReview.mock.calls[0];
    expect(req.articleTypes).toBe('primary');
    expect(req.startYear).toBe(now - 5);
    expect(req.cutoffYear).toBeNull();
    expect(req).not.toHaveProperty('model');
    expect(req).toHaveProperty('serviceTier');

    await act(async () => finish());
    await waitFor(() => expect(fetchCitations).toHaveBeenCalledWith(['11']));
    await waitFor(() => expect(screen.getByText(/^Lee A, Park B\. Paper eleven\. Cell\. 2021\./)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'References 1' })).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'Citation style: Vancouver' }));
    fireEvent.click(screen.getByRole('option', { name: /APA 7/ }));
    expect(screen.getByRole('button', { name: 'References 1' })).toHaveTextContent('(Lee & Park, 2021)');
    expect(screen.getByText(/^Lee, A\., & Park, B\. \(2021\)\. Paper eleven\./)).toBeInTheDocument();
});


describe('your papers', () => {
    const carried = [{ id: 'a1', kind: 'pdf', filename: 'smith2021.pdf', format: 'PDF', size_bytes: 2048 }];

    it('sends the papers carried from the home bar, with the search by default', async () => {
        mockLocationState = { initialQuery: 'MET amplification', papers: carried };
        streamReview.mockImplementation(() => Promise.resolve());
        render(<LiteratureReview />);
        expect(screen.getByText('smith2021.pdf')).toBeInTheDocument();
        expect(screen.getByText(/together with your paper,/)).toBeInTheDocument();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start writing/ })); });
        const [req] = streamReview.mock.calls[0];
        expect(req.papers).toEqual(['a1']);
        expect(req.sources).toBe('papers_and_search');
    });

    it('reviews the papers alone when asked, and adds more from the picker', async () => {
        mockLocationState = { initialQuery: 'MET amplification', papers: carried };
        streamReview.mockImplementation(() => Promise.resolve());
        render(<LiteratureReview />);
        fireEvent.change(screen.getByTestId('lr-papers-input'),
                         { target: { files: [new File(['doc'], 'old notes.doc', { type: 'application/msword' })] } });
        await waitFor(() => expect(screen.getByText('old notes.doc')).toBeInTheDocument());
        await waitFor(() => expect(screen.getByRole('button', { name: /2 · Add more/ })).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Sources: Your papers + search' }));
        fireEvent.click(screen.getByRole('option', { name: /Your papers only/ }));
        expect(screen.getByText(/reviews your 2 papers alone/)).toBeInTheDocument();
        expect(screen.getByText(/Takes 2–5 min/)).toBeInTheDocument();
        // the years and types filter the search, which a review of the papers alone does not run
        expect(screen.getByRole('button', { name: /^Years:/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /^Article types:/ })).toBeDisabled();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start writing/ })); });
        const [req] = streamReview.mock.calls[0];
        expect(req.papers).toEqual(['a1', 'att-old notes.doc']);
        expect(req.sources).toBe('papers');
        expect(req.startYear).toBeNull();
    });

    it('sends no papers with Search only, and none at all without papers', async () => {
        streamReview.mockImplementation(() => Promise.resolve());
        render(<LiteratureReview />);
        // offered without papers too; the two that read papers say they need one, and offer the upload
        fireEvent.click(screen.getByRole('button', { name: 'Sources: Search only' }));
        fireEvent.click(screen.getByRole('option', { name: /Your papers \+ search/ }));
        expect(screen.getByRole('status')).toHaveTextContent(/No papers added yet: upload at least one/);
        const picker = jest.spyOn(screen.getByTestId('lr-papers-input'), 'click');
        expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('listbox', { name: 'Sources' }), { key: 'Escape' });
        expect(picker).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Sources: Search only' })).toBeInTheDocument();
        await startReview('Gut microbiome and depression');
        const [req] = streamReview.mock.calls[0];
        expect(req.papers).toEqual([]);
        expect(req.sources).toBe('search');
    });

    it('marks a cited paper of the reader\'s own, and links to PubMed only when it has a PMID', async () => {
        mockParams = { publicId: 'p9' };
        getChatHistoryDetailByPublicId.mockResolvedValueOnce({ messages: [
            { role: 'user', content: 'MET amplification', attachments: carried },
            { role: 'assistant', content: '# T\n\n## One\n\nA claim [1]. Another [2].', references: [
                { number: 1, pmid: null, url: null, title: 'An unpublished draft', year: 2026, source: 'upload',
                  file_name: 'draft.docx' },
                { number: 2, pmid: '33445566', title: 'A paper PubMed knows', year: 2021, source: 'upload',
                  file_name: 'smith2021.pdf' },
            ] },
        ] });
        render(<LiteratureReview />);
        await waitFor(() => expect(screen.getByText('Your paper · draft.docx')).toBeInTheDocument());
        expect(screen.getByText('Your paper · smith2021.pdf')).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: /PMID/ }).map((a) => a.textContent)).toEqual(['PMID 33445566']);
        expect(screen.getByText('One of your papers')).toBeInTheDocument();
    });
});
