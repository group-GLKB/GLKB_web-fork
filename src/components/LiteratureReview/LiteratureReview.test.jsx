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
import { approveOutline, cancelReview, getReviewRun, streamReview } from '../../service/LiteratureReview';
import { fetchCitations } from '../../service/Citation';
import { applyStreamCredits, fetchUsage } from '../../service/credits';
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
jest.mock('../../service/credits', () => ({ applyStreamCredits: jest.fn(), fetchUsage: jest.fn() }));
// Outline approval is off until it is scheduled (config/features.js); its own tests turn it on.
let mockOutlineApproval = false;
jest.mock('../../config/features', () => ({
    ...jest.requireActual('../../config/features'),
    get LR_OUTLINE_APPROVAL_ENABLED() { return mockOutlineApproval; },
}));
jest.mock('../../service/LiteratureReview', () => ({
    streamReview: jest.fn(),
    approveOutline: jest.fn(),
    getReviewRun: jest.fn(() => Promise.resolve(null)),
    cancelReview: jest.fn(() => Promise.resolve({})),
    reviewRefusal: jest.requireActual('../../service/LiteratureReview').reviewRefusal,
}));

beforeEach(() => {
    // The model and citation style a reader picks are remembered; each test starts with none.
    localStorage.clear();
    mockNavigate.mockClear();
    getChatHistoryDetailByPublicId.mockReset();
    streamReview.mockReset();
    mockOutlineApproval = false;
    applyStreamCredits.mockImplementation(() => true);
    approveOutline.mockReset();
    getReviewRun.mockImplementation(() => Promise.resolve(null));
    cancelReview.mockImplementation(() => Promise.resolve({}));
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

    try {
        await act(async () => finish());
        // The design's dialog: what is exported, the format as cards, the style, and one download.
        fireEvent.click(await screen.findByRole('button', { name: 'Export' }));
        const dialog = screen.getByRole('dialog', { name: 'Export review' });
        expect(dialog).toHaveTextContent('1 reference · Vancouver');
        expect(within(dialog).getByRole('radio', { name: /LaTeX/ })).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Download .tex' }));
        expect(createObjectURL.mock.calls[0][0].type).toBe('application/x-tex');
        expect(clicks[0]).toMatch(/^crispr-base-editing_\d{4}-\d{2}-\d{2}\.tex$/);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

        fireEvent.click(screen.getByRole('button', { name: 'Export' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: /Word/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Download .doc' }));
        expect(createObjectURL.mock.calls[1][0].type).toBe('application/msword');
        // the Word file is named after the review's own title, not the typed topic
        expect(clicks[1]).toMatch(/^t_\d{4}-\d{2}-\d{2}\.doc$/);
    } finally {
        document.createElement.mockRestore();
    }
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

    const exportPdf = () => {
        fireEvent.click(screen.getByRole('button', { name: 'Export' }));
        const dialog = screen.getByRole('dialog', { name: 'Export review' });
        fireEvent.click(within(dialog).getByRole('radio', { name: /PDF/ }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Download .pdf' }));
        act(() => { jest.advanceTimersByTime(1000); });   // the dialog's closing transition
    };
    await screen.findByRole('button', { name: 'Export' });
    exportPdf();
    expect(write).toHaveBeenCalledWith(expect.stringContaining('@media print'));
    expect(print).toHaveBeenCalledTimes(1);

    // a blocked pop-up must say what to do rather than appear to do nothing
    open.mockReturnValue(null);
    exportPdf();
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
    fireEvent.click(screen.getByRole('radio', { name: 'Primary research' }));
    expect(screen.getByRole('radio', { name: 'Primary research' })).toHaveAttribute('aria-checked', 'true');
    const now = new Date().getFullYear();
    fireEvent.click(screen.getByRole('radio', { name: `${now - 5}–${now} · Last 5 years` }));
    expect(screen.getByRole('radio', { name: 'Any year' })).toHaveAttribute('aria-checked', 'false');
    // the custom range is still there, beside the presets
    fireEvent.click(screen.getByRole('button', { name: `Years: ${now - 5}–${now}` }));
    expect(within(screen.getByRole('group', { name: 'From' })).getByRole('option', { name: String(now - 5) }))
        .toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Years' }), { key: 'Escape' });
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


describe('the scope, as the design lays it out', () => {
    it('picks the length from the cards, or any length, and shows it beside the start', async () => {
        streamReview.mockImplementation(() => new Promise(() => {}));
        render(<LiteratureReview />);
        expect(screen.getByRole('heading', { name: 'Set up your review' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /^6,000\s*Standard · ~100 refs$/ })).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(screen.getByRole('radio', { name: /^10,000\s*Comprehensive/ }));
        expect(document.querySelector('.lr-dbig-n')).toHaveTextContent('10,000');
        fireEvent.click(screen.getByRole('button', { name: 'Custom length' }));
        fireEvent.change(screen.getByLabelText('Custom length in words'), { target: { value: '4500' } });
        fireEvent.click(screen.getByRole('button', { name: 'Set' }));
        expect(screen.getByRole('button', { name: 'Custom length: 4,500 words' })).toBeInTheDocument();
        await startReview('Gut microbiome and depression');
        expect(streamReview.mock.calls[0][0].targetWords).toBe(4500);
    });

    it('turns the mail off, and picks the model from its cards', async () => {
        streamReview.mockImplementation(() => new Promise(() => {}));
        render(<LiteratureReview />);
        const mail = screen.getByRole('switch', { name: 'Email me when ready' });
        expect(mail).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(mail);
        expect(mail).toHaveAttribute('aria-checked', 'false');
        // the pricing request fails here, so the fallback prices are shown
        const luna = await screen.findByRole('radio', { name: /^GPT-6 Luna/ });
        fireEvent.click(luna);
        expect(luna).toHaveAttribute('aria-checked', 'true');
        await startReview('Gut microbiome and depression');
        expect(streamReview.mock.calls[0][0]).toMatchObject({ notify: false, serviceTier: 'standard' });
    });
});

describe('your papers', () => {
    const carried = [{ id: 'a1', kind: 'pdf', filename: 'smith2021.pdf', format: 'PDF', size_bytes: 2048 }];

    it('sends the papers carried from the home bar, with the search by default', async () => {
        mockLocationState = { initialQuery: 'MET amplification', papers: carried };
        streamReview.mockImplementation(() => Promise.resolve());
        render(<LiteratureReview />);
        expect(screen.getByText('smith2021.pdf')).toBeInTheDocument();
        expect(screen.getByText(/together with your paper\./)).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Your papers + search' })).toHaveAttribute('aria-checked', 'true');
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
        await waitFor(() => expect(document.querySelectorAll('.lr-dfile.is-ready')).toHaveLength(2));
        fireEvent.click(screen.getByRole('radio', { name: 'Your papers only' }));
        expect(screen.getByText(/reviews your 2 papers alone/)).toBeInTheDocument();
        expect(screen.getByText(/Takes 2–5 min/)).toBeInTheDocument();
        // the years and types filter the search, which a review of the papers alone does not run
        expect(screen.getByRole('radio', { name: 'Any year' })).toBeDisabled();
        expect(screen.getByRole('button', { name: /^Years:/ })).toBeDisabled();
        expect(screen.getByRole('radio', { name: 'Primary research' })).toBeDisabled();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start writing/ })); });
        const [req] = streamReview.mock.calls[0];
        expect(req.papers).toEqual(['a1', 'att-old notes.doc']);
        expect(req.sources).toBe('papers');
        expect(req.startYear).toBeNull();
    });

    it('sends no papers with Search only, and none at all without papers', async () => {
        streamReview.mockImplementation(() => Promise.resolve());
        render(<LiteratureReview />);
        // offered without papers too: the two that read papers ask for them (the file picker opens), and
        // say they need one; until there is one the review searches
        expect(screen.getByRole('radio', { name: 'Search only' })).toHaveAttribute('aria-checked', 'true');
        const picker = jest.spyOn(screen.getByTestId('lr-papers-input'), 'click');
        fireEvent.click(screen.getByRole('radio', { name: 'Your papers + search' }));
        expect(picker).toHaveBeenCalled();
        expect(screen.getByRole('status')).toHaveTextContent(/No papers added yet: upload at least one/);
        expect(screen.getByRole('radio', { name: 'Search only' })).toHaveAttribute('aria-checked', 'true');
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

it('without outline approval, a review runs straight through and nothing looks for an outline', async () => {
    streamReview.mockImplementation(() => new Promise(() => {}));
    render(<LiteratureReview />);
    await startReview('Kinase inhibitor resistance');
    expect(streamReview.mock.calls[0][0].outlineApproval).toBe(false);
});

it('without outline approval, reopening an unanswered review does not ask for its outline', async () => {
    mockParams = { publicId: 'p1' };
    getChatHistoryDetailByPublicId.mockResolvedValueOnce({ messages: [{ role: 'user', content: 'Kinase inhibitor resistance' }] });
    render(<LiteratureReview />);
    expect(await screen.findByText(/This review is still being written/)).toBeInTheDocument();
    expect(getReviewRun).not.toHaveBeenCalled();
});

describe('the outline, approved before anything is written', () => {
    beforeEach(() => { mockOutlineApproval = true; });
    const startReview = async (topic) => {
        fireEvent.change(screen.getByLabelText('Topic'), { target: { value: topic } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate outline/ })); });
    };

    const OUTLINE = {
        title: 'Kinase inhibitor resistance', thesis: 'Resistance has three routes.', words: 4000,
        target_words: 4000,
        scope: { target_words: 4000, start_year: 2016, cutoff_year: 2026, article_types: 'research',
                 sources: 'search', model: 'gpt-6.1-terra' },
        sections: [
            { id: 's1', kind: 'introduction', title: 'Introduction', message: 'Why resistance matters', words: 600,
              papers: 25, subsections: [] },
            { id: 's2', kind: 'body', title: 'Target mutations', message: 'Gatekeepers first', words: 1000,
              papers: 40, subsections: [{ id: '2.1', title: 'Gatekeepers' }, { id: '2.2', title: 'Compound mutations' }] },
            { id: 's3', kind: 'body', title: 'Bypass signalling', message: 'MET and HER2 rescue', words: 1000,
              papers: 40, subsections: [] },
            { id: 's4', kind: 'body', title: 'Lineage plasticity', message: '', words: 1000, papers: 12, subsections: [] },
            { id: 's5', kind: 'outlook', title: 'Outlook', message: '', words: 400, papers: 30, subsections: [] },
        ],
    };
    const stopsAtOutline = () => streamReview.mockImplementation(async (req, onFrame) => {
        onFrame({ step: 'Started', history_id: 1, public_id: 'p1', pipeline: 'literature_review' });
        onFrame({ step: 'Outline', run_id: 'lr_1', outline: OUTLINE });
    });
    const writes = () => approveOutline.mockImplementation(async (req, onFrame) => {
        onFrame({ step: 'Started', history_id: 1, public_id: 'p1', pipeline: 'literature_review' });
        onFrame({ step: 'Complete', response: '# Kinase inhibitor resistance\n\n## Introduction\n\nA claim [1].',
                  references: [{ number: 1, pmid: '11', title: 'Paper eleven', year: 2021 }] });
    });
    const approveButton = () => screen.getByRole('button', { name: /Approve & start writing/ });
    const scopeRow = (label) => Array.from(document.querySelectorAll('.lr-outline-side dt'))
        .find((dt) => dt.textContent === label).parentElement.textContent;
    const status = () => document.querySelector('.lr-ometer-status').textContent;

    it('stops at the outline, and writes it as the reader edited it', async () => {
        stopsAtOutline();
        writes();
        render(<LiteratureReview />);
        await startReview('Kinase inhibitor resistance');
        expect(streamReview.mock.calls[0][0].outlineApproval).toBe(true);
        expect(screen.getByText(/Step 2 · Approve the outline/)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Working title' })).toHaveValue('Kinase inhibitor resistance');
        expect(screen.getByText('Resistance has three routes.')).toBeInTheDocument();
        // what each section covers: its subsections, else its message; and about how many papers it will cite
        // at its length (1 per 50 planned words of the body, 95 of the introduction and outlook), never more than it has
        expect(screen.getByText('Gatekeepers · Compound mutations')).toBeInTheDocument();
        expect(screen.getByText('MET and HER2 rescue')).toBeInTheDocument();
        expect(Array.from(document.querySelectorAll('.lr-osec .lr-osec-meta.lr-mono')).map((n) => n.textContent))
            .toEqual(['~6 papers', '~20 papers', '~20 papers', '~12 papers', '~4 papers']);

        fireEvent.change(screen.getByLabelText('Section title: Bypass signalling'), { target: { value: 'How bypass rescues' } });
        fireEvent.click(screen.getByRole('button', { name: 'Leave out: Target mutations' }));
        // a section left out leaves the list; the numbers close up
        expect(screen.queryByLabelText('Section title: Target mutations')).toBeNull();
        expect(Array.from(document.querySelectorAll('.lr-osec-num')).map((n) => n.textContent)).toEqual(['01', '02', '03', '04']);
        fireEvent.click(screen.getByRole('button', { name: 'Move up: Lineage plasticity' }));
        expect(screen.getByRole('button', { name: 'Move up: Lineage plasticity' })).toBeDisabled();
        // the introduction and the outlook cannot be left out or moved, but can be resized
        expect(screen.queryByRole('button', { name: /Leave out: (Introduction|Outlook)/ })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Longer: Lineage plasticity' }));
        fireEvent.click(screen.getByRole('button', { name: 'Longer: Lineage plasticity' }));
        fireEvent.click(screen.getByRole('button', { name: 'Shorter: Introduction' }));
        expect(screen.getByText('~1,200 words')).toBeInTheDocument();
        expect(status()).toBe('900 words under the targetFit to 4,000');
        // 5 + 12 + 20 + 4 cited, less what the sections share
        expect(scopeRow('References')).toBe('References~40');

        await act(async () => { fireEvent.click(approveButton()); });
        expect(approveOutline.mock.calls[0][0]).toEqual(expect.objectContaining({
            runId: 'lr_1', title: 'Kinase inhibitor resistance',
            sections: [{ id: 's1', title: 'Introduction', words: 500 }, { id: 's4', title: 'Lineage plasticity', words: 1200 },
                       { id: 's3', title: 'How bypass rescues', words: 1000 }, { id: 's5', title: 'Outlook', words: 400 }],
        }));
        expect(await screen.findByRole('heading', { name: 'Kinase inhibitor resistance' })).toBeInTheDocument();
        expect(screen.queryByText(/Step 2 · Approve the outline/)).toBeNull();
    });

    it('shows the scope the outline was planned with, and the planned length against the target', async () => {
        stopsAtOutline();
        render(<LiteratureReview />);
        await startReview('Kinase inhibitor resistance');
        expect(scopeRow('Target length')).toBe('Target length4,000 words');
        expect(scopeRow('Years')).toBe('Years2016–2026');
        expect(scopeRow('Article types')).toBe('Article typesResearch & reviews');
        expect(scopeRow('Model')).toBe('ModelGPT-6.1 Terra');
        expect(scopeRow('References')).toBe('References~60');
        expect(status()).toBe('On target');
        expect(document.querySelector('.lr-ometer-head').textContent).toBe('Planned length4,000 / 4,000');

        // a section left out leaves the review short; Fit spreads the target over what is kept
        fireEvent.click(screen.getByRole('button', { name: 'Leave out: Target mutations' }));
        expect(status()).toBe('1,000 words under the targetFit to 4,000');
        fireEvent.click(screen.getByRole('button', { name: 'Fit to 4,000' }));
        expect(status()).toBe('On target');
        const lengths = Array.from(document.querySelectorAll('.lr-osec:not(.is-removed) .lr-osec-words .lr-mono'))
            .map((n) => n.textContent);
        expect(lengths).toEqual(['~800 words', '~1,300 words', '~1,350 words', '~550 words']);
    });

    it('keeps a section within its bounds', async () => {
        stopsAtOutline();
        render(<LiteratureReview />);
        await startReview('Kinase inhibitor resistance');
        const longer = screen.getByRole('button', { name: 'Longer: Bypass signalling' });
        for (let i = 0; i < 5; i += 1) fireEvent.click(longer);
        expect(longer).toBeDisabled();
        expect(screen.getByText('~1,500 words')).toBeInTheDocument();
        const shorter = screen.getByRole('button', { name: 'Shorter: Outlook' });
        fireEvent.click(shorter);
        fireEvent.click(shorter);
        expect(shorter).toBeDisabled();
        expect(status()).toBe('300 words over the targetFit to 4,000');
    });

    it('will not write a review with no body left', async () => {
        stopsAtOutline();
        render(<LiteratureReview />);
        await startReview('Kinase inhibitor resistance');
        ['Target mutations', 'Bypass signalling', 'Lineage plasticity'].forEach((name) => {
            fireEvent.click(screen.getByRole('button', { name: `Leave out: ${name}` }));
        });
        expect(approveButton()).toBeDisabled();
        // "+ Add section" puts one back
        fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
        fireEvent.click(screen.getByRole('option', { name: /Bypass signalling/ }));
        expect(approveButton()).toBeEnabled();
        expect(screen.getByLabelText('Section title: Bypass signalling')).toBeInTheDocument();
    });

    it('keeps the outline waiting when the service refuses the approval', async () => {
        stopsAtOutline();
        approveOutline.mockImplementation(async (req, onFrame) => {
            onFrame({ step: 'Started', history_id: 1, public_id: 'p1' });
            onFrame({ step: 'Error', error: 'keep at least one section of the body', status: 400 });
        });
        render(<LiteratureReview />);
        await startReview('Kinase inhibitor resistance');
        await act(async () => { fireEvent.click(approveButton()); });
        expect(screen.getByText(/Step 2 · Approve the outline/)).toBeInTheDocument();
        expect(screen.getByText('keep at least one section of the body')).toBeInTheDocument();
    });

    it('finds the outline again when the review is reopened', async () => {
        mockParams = { publicId: 'p1' };
        getChatHistoryDetailByPublicId.mockResolvedValueOnce({ messages: [
            { role: 'user', content: 'Kinase inhibitor resistance' },
        ] });
        getReviewRun.mockImplementation(() => Promise.resolve({ run_id: 'lr_9', status: 'outline', outline: OUTLINE }));
        writes();
        render(<LiteratureReview />);
        expect(await screen.findByRole('button', { name: /Approve & start writing/ })).toBeInTheDocument();
        expect(getReviewRun).toHaveBeenCalledWith('p1');
        expect(screen.getByRole('textbox', { name: 'Working title' })).toHaveValue('Kinase inhibitor resistance');
        await act(async () => { fireEvent.click(approveButton()); });
        expect(approveOutline.mock.calls[0][0].runId).toBe('lr_9');
    });

    it('a review being written after its approval is still being written', async () => {
        mockParams = { publicId: 'p1' };
        getChatHistoryDetailByPublicId.mockResolvedValueOnce({ messages: [
            { role: 'user', content: 'Kinase inhibitor resistance' },
        ] });
        getReviewRun.mockImplementation(() => Promise.resolve({ run_id: 'lr_9', status: 'writing', outline: null }));
        render(<LiteratureReview />);
        expect(await screen.findByText(/This review is still being written/)).toBeInTheDocument();
    });

    it('changing the scope discards the outline, once confirmed, and opens the scope it was planned with', async () => {
        stopsAtOutline();
        render(<LiteratureReview />);
        await startReview('Kinase inhibitor resistance');
        fireEvent.click(screen.getByRole('button', { name: '← Change scope' }));
        expect(screen.getByText(/Starting again is charged as a new review/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Keep the outline' }));
        expect(cancelReview).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '← Change scope' }));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Discard it' })); });
        expect(cancelReview).toHaveBeenCalledWith('lr_1');
        expect(screen.getByLabelText('Topic')).toHaveValue('Kinase inhibitor resistance');
        expect(screen.getByRole('button', { name: /Generate outline/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Custom length: 4,000 words' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Years: 2016–2026' })).toBeInTheDocument();
        expect(document.querySelector('.lr-dbig-n')).toHaveTextContent('4,000');
    });
});

describe('credits', () => {
    it('labels what the review costs at the model picked', async () => {
        render(<LiteratureReview />);
        // the pricing request fails here, so the picker's fallback prices are shown: the default,
        // GPT-6.1 Terra, 20
        const row = await screen.findByText('Cost');
        expect(row.parentElement).toHaveTextContent('Cost20 credits');
    });

    it('says why a review the reader cannot afford was refused, and what they can afford', async () => {
        streamReview.mockImplementation(() => Promise.reject({ response: { status: 429, data: JSON.stringify({ detail: {
            code: 'INSUFFICIENT_CREDITS', required: 50, remaining: 30,
            message: 'Not enough credits. This review requires 50 credits. You currently have 30 credits remaining.',
            cheaper_option: { pipeline: 'literature_review', service_tier: 'standard', credits: 10 },
        } }) } }));
        render(<LiteratureReview />);
        await startReview('Kinase inhibitor resistance');
        expect(await screen.findByText(/This review requires 50 credits\. You currently have 30 credits remaining\. Switch to GPT-6 Luna Literature Review to continue with 10 credits\./))
            .toBeInTheDocument();
    });

    it('folds the balance the saved review reports into the reader\'s credits', async () => {
        streamReview.mockImplementation(async (req, onFrame) => {
            onFrame({ step: 'Started', history_id: 1, public_id: 'p1' });
            onFrame({ step: 'Complete', response: '# T\n\nA claim [1].', references: [] });
            onFrame({ step: 'Saved', public_id: 'p1', credits: { charged: 10, remaining: 90 } });
        });
        render(<LiteratureReview />);
        await startReview('Kinase inhibitor resistance');
        expect(applyStreamCredits).toHaveBeenCalledWith({ charged: 10, remaining: 90 });
        expect(fetchUsage).not.toHaveBeenCalled();
    });
});
