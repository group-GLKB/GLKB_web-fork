/**
 * The Literature Review pages on a phone (the phone design): the page's own bar (back, the step,
 * one action, four segments), "Set up your review" with length cards and year presets, the share
 * done while it is written, and the finished draft with what the citation audit found.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import LiteratureReview from './index';
import { getChatHistoryDetailByPublicId } from '../../service/ChatHistory';
import { approveOutline, cancelReview, getReviewRun, streamReview } from '../../service/LiteratureReview';
import { fetchCitations } from '../../service/Citation';

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
jest.mock('../../service/Citation', () => ({ fetchCitations: jest.fn(() => Promise.resolve({})) }));
jest.mock('../../service/ChatHistory', () => ({ getChatHistoryDetailByPublicId: jest.fn() }));
jest.mock('../../service/LiteratureReview', () => ({
    streamReview: jest.fn(),
    approveOutline: jest.fn(),
    getReviewRun: jest.fn(() => Promise.resolve(null)),
    cancelReview: jest.fn(() => Promise.resolve({})),
}));

beforeAll(() => {
    window.matchMedia = (query) => ({
        matches: query.includes('max-width'), media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
});

beforeEach(() => {
    mockNavigate.mockClear();
    getChatHistoryDetailByPublicId.mockReset();
    streamReview.mockReset();
    approveOutline.mockReset();
    getReviewRun.mockImplementation(() => Promise.resolve(null));
    cancelReview.mockImplementation(() => Promise.resolve({}));
    fetchCitations.mockImplementation(() => Promise.resolve({}));
    mockParams = {};
});

const segments = () => Array.from(document.querySelectorAll('.lr-msteps li')).map((li) => li.className === 'is-on');

it('sets up a review with the length cards and the year presets', async () => {
    render(<LiteratureReview />);
    expect(screen.getByRole('heading', { name: 'Set up your review' })).toBeInTheDocument();
    expect(document.querySelector('.lr-mtopbar-step')).toHaveTextContent('Scope');
    expect(segments()).toEqual([true, false, false, false]);

    const start = screen.getByRole('button', { name: /Generate outline/ });
    expect(start).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Does p53 loss cause chemoresistance?' } });
    expect(start).toBeEnabled();

    fireEvent.click(screen.getByRole('radio', { name: /~4,000\s*Typical review/ }));
    expect(screen.getByRole('radio', { name: /~4,000/ })).toHaveAttribute('aria-checked', 'true');
    const now = new Date().getFullYear();
    fireEvent.click(screen.getByRole('radio', { name: `${now - 10}–${now}` }));
    expect(screen.getByRole('radio', { name: 'Any year' })).toHaveAttribute('aria-checked', 'false');

    streamReview.mockImplementation(() => new Promise(() => {}));
    await act(async () => { fireEvent.click(start); });
    expect(streamReview).toHaveBeenCalledWith(
        expect.objectContaining({ targetWords: 4000, startYear: now - 10, cutoffYear: null }), expect.any(Function),
    );
});

it('shows the share done and the stages while the review is written', async () => {
    let send;
    streamReview.mockImplementation((args, onFrame) => { send = onFrame; return new Promise(() => {}); });
    render(<LiteratureReview />);
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Does p53 loss cause chemoresistance?' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate outline/ })); });
    act(() => send({ type: 'progress', phase: 'synthesis', label: 'Extracting claims…', percent: 52,
                     detail: { searches: 40, papers_opened: 186 } }));
    expect(screen.getByText('52%')).toBeInTheDocument();
    const stages = Array.from(document.querySelectorAll('.lr-mstage'));
    expect(stages.map((li) => li.className.replace('lr-mstage ', ''))).toEqual(['is-done', 'is-current', 'is-todo', 'is-todo']);
    expect(stages[0]).toHaveTextContent('Searching the literature40 searches · 186 papers');
    expect(screen.queryByRole('region', { name: 'Sections' })).toBeNull();
    act(() => send({ type: 'sections', title: 'p53 and resistance', sections: [
        { id: 's1', kind: 'introduction', title: 'Introduction', state: 'done' },
        { id: 's2', kind: 'body', title: 'Mechanisms of resistance', state: 'writing' },
        { id: 's3', kind: 'outlook', title: 'Outlook', state: 'queued' },
    ] }));
    const rows = Array.from(screen.getByRole('region', { name: 'Sections' }).querySelectorAll('li'))
        .map((li) => li.textContent);
    expect(rows).toEqual(['01IntroductionDone', '02Mechanisms of resistanceWriting', '03OutlookQueued']);
    // before the outline is approved the run is building it, not writing
    expect(screen.getByRole('button', { name: 'Building the outline…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
});

const savedReview = (audit) => ({
    messages: [
        { role: 'user', content: 'p53 and chemoresistance' },
        { role: 'assistant', content: `# p53 and chemoresistance\n\n## Introduction\n\nA claim [1].\n\n${audit}`,
          references: [{ number: 1, pmid: '11', title: 'Paper eleven', year: 2021 }] },
    ],
});

it('opens the draft with Export, and says the citations were verified only when the audit says so', async () => {
    mockParams = { publicId: 'abc' };
    getChatHistoryDetailByPublicId.mockResolvedValue(
        savedReview('<!-- words 4012 / target 4000; cited papers 1; fabricated citations 0 -->'),
    );
    render(<LiteratureReview />);
    expect(await screen.findByText('Citations verified')).toBeInTheDocument();
    expect(document.querySelector('.lr-mtopbar-step')).toHaveTextContent('Draft');
    expect(segments()).toEqual([true, true, true, true]);
    // The "·" between the parts is drawn by CSS.
    expect(Array.from(document.querySelector('.lr-mmeta').children).slice(0, 2).map((n) => n.textContent))
        .toEqual(['≈4,012 words', '1 reference']);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('menuitem', { name: /Copy link/ })).toBeInTheDocument();
});

it('says how many citations need review when the audit found some, and nothing without an audit', async () => {
    mockParams = { publicId: 'abc' };
    getChatHistoryDetailByPublicId.mockResolvedValue(
        savedReview('<!-- words 4012 / target 4000; cited papers 1; fabricated citations 2 -->'),
    );
    const { unmount } = render(<LiteratureReview />);
    expect(await screen.findByText('2 citations need review')).toBeInTheDocument();
    expect(screen.queryByText('Citations verified')).toBeNull();
    unmount();

    getChatHistoryDetailByPublicId.mockResolvedValue(savedReview(''));
    render(<LiteratureReview />);
    await waitFor(() => expect(document.querySelector('.lr-mmeta')).not.toBeNull());
    expect(screen.queryByText('Citations verified')).toBeNull();
    expect(document.querySelector('.lr-mverified')).toBeNull();
});
