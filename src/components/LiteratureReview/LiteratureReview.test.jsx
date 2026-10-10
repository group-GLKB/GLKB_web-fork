/**
 * The Literature Review page across the life of a review. A review takes 15-25 minutes, so what
 * matters is what a reader finds when they come back to it: the page takes the review's address as
 * soon as the backend has saved the prompt, a review still being written is picked up when it is
 * saved, and a stopped one can be run again without retyping the topic.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import LiteratureReview from './index';
import { getChatHistoryDetailByPublicId } from '../../service/ChatHistory';
import { streamReview } from '../../service/LiteratureReview';

const mockNavigate = jest.fn();
let mockParams = {};
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => ({ state: null }),
}));
jest.mock('../Auth/AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: true, loading: false, openLoginModal: jest.fn() }),
}));
jest.mock('../../service/ChatHistory', () => ({ getChatHistoryDetailByPublicId: jest.fn() }));
jest.mock('../../service/LiteratureReview', () => ({
    fetchReviewModels: () => Promise.resolve({ models: [{ id: 'gpt-6-luna', label: 'GPT-6 Luna' }], default_model: 'gpt-6-luna' }),
    streamReview: jest.fn(),
    cancelReview: jest.fn(() => Promise.resolve({})),
}));

beforeEach(() => {
    mockNavigate.mockClear();
    getChatHistoryDetailByPublicId.mockReset();
    streamReview.mockReset();
    mockParams = {};
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
    fireEvent.click(screen.getByRole('menuitem', { name: 'PDF' }));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('@media print'));
    act(() => { jest.runAllTimers(); });
    expect(print).toHaveBeenCalledTimes(1);

    // a blocked pop-up must say what to do rather than appear to do nothing
    open.mockReturnValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'PDF' }));
    expect(screen.getByText(/Allow pop-ups/)).toBeInTheDocument();

    jest.useRealTimers();
    open.mockRestore();
});
