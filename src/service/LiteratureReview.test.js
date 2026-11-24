/**
 * What a review asks the backend for: the scope it was given, and nothing it was not — an unset
 * start year, the default end year and 'all' article types are the service's own defaults.
 */
import axios from '../utils/axiosConfig';
import { runParagraphAction, streamReview } from './LiteratureReview';

jest.mock('../utils/axiosConfig', () => ({ __esModule: true, default: { post: jest.fn() } }));

beforeEach(() => {
    axios.post.mockReset();
    axios.post.mockImplementation(() => Promise.resolve({}));
});

const body = () => axios.post.mock.calls[0][1];

it('sends the years as a range, each end only when set', async () => {
    await streamReview({ question: 'CAR-T in solid tumors', startYear: 2016, cutoffYear: 2024 }, () => {});
    expect(axios.post.mock.calls[0][0]).toBe('/api/v1/literature-review/stream');
    expect(body()).toMatchObject({ question: 'CAR-T in solid tumors', start_year: 2016, cutoff_year: 2024 });

    axios.post.mockClear();
    await streamReview({ question: 'CAR-T in solid tumors', startYear: null, cutoffYear: null }, () => {});
    expect(body()).not.toHaveProperty('start_year');
    expect(body()).not.toHaveProperty('cutoff_year');
});

it('sends the papers with how they are used, and neither without papers', async () => {
    await streamReview({ question: 'q', papers: ['a1'], sources: 'papers' }, () => {});
    expect(body()).toMatchObject({ papers: ['a1'], sources: 'papers' });

    axios.post.mockClear();
    await streamReview({ question: 'q', papers: [], sources: 'search', articleTypes: 'all' }, () => {});
    expect(body()).not.toHaveProperty('papers');
    expect(body()).not.toHaveProperty('sources');
    expect(body()).not.toHaveProperty('article_types');
});

it('sends a paragraph action the text the reader selected, and nothing extra without a selection', async () => {
    axios.post.mockImplementation(() => Promise.resolve({ data: { action: 'rewrite' } }));
    await runParagraphAction('p1', { action: 'rewrite', paragraph: 'A claim [1]. Another [2].', question: 'plainer',
                                     selection: { text: 'Another [2]', start: 13 } });
    expect(axios.post.mock.calls[0][0]).toBe('/api/v1/literature-review/history/p1/paragraph');
    expect(body()).toEqual({ action: 'rewrite', paragraph: 'A claim [1]. Another [2].', question: 'plainer',
                             selection: 'Another [2]', selection_start: 13 });

    axios.post.mockClear();
    await runParagraphAction('p1', { action: 'ask', paragraph: 'A claim [1].', question: 'Why?', selection: null });
    expect(body()).toEqual({ action: 'ask', paragraph: 'A claim [1].', question: 'Why?' });
});
