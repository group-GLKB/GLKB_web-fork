import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import AboutPage from './index';
import { EXAMPLE_QUESTIONS } from './exampleQuestions';
import { PAGE_SECTIONS } from './LocalNav';
import { BENCHMARK, REVIEW_STEPS } from './ReviewScene';
import { posts } from '../Blog/posts';
import { measureProgress, segment, useIdleAutoScroll } from './motion';
import faqData from './faqData.json';
import { USE_CASES } from './useCases';
import { useAuth } from '../Auth/AuthContext';

jest.mock('../Auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-helmet-async', () => ({ Helmet: () => null }));
jest.mock('@mui/icons-material/ChevronRight', () => () => null);

beforeEach(() => { useAuth.mockReturnValue({ isAuthenticated: false, loading: false, openLoginModal: jest.fn() }); });

describe('scroll progress', () => {
    it('measures a pinned section from its top meeting the viewport top to its bottom meeting the bottom', () => {
        const viewport = 800;
        const height = 3200;
        expect(measureProgress({ top: 400, height }, viewport, 'pin')).toBe(0);
        expect(measureProgress({ top: 0, height }, viewport, 'pin')).toBe(0);
        expect(measureProgress({ top: -1200, height }, viewport, 'pin')).toBe(0.5);
        expect(measureProgress({ top: -2400, height }, viewport, 'pin')).toBe(1);
        expect(measureProgress({ top: -5000, height }, viewport, 'pin')).toBe(1);
    });

    it('measures a passing element from entering at the bottom to leaving at the top', () => {
        expect(measureProgress({ top: 800, height: 400 }, 800, 'pass')).toBe(0);
        expect(measureProgress({ top: 200, height: 400 }, 800, 'pass')).toBe(0.5);
        expect(measureProgress({ top: -400, height: 400 }, 800, 'pass')).toBe(1);
    });

    it('maps a sub-range onto 0..1', () => {
        expect(segment(0.1, 0.2, 0.4)).toBe(0);
        expect(segment(0.3, 0.2, 0.4)).toBeCloseTo(0.5);
        expect(segment(0.9, 0.2, 0.4)).toBe(1);
    });
});

describe('the About page', () => {
    it('states the corpus figures and no longer the old relationship count', () => {
        const { container } = render(<MemoryRouter><AboutPage /></MemoryRouter>);
        const text = container.textContent;
        ['41.2M+', '3.71M+', '14.6M+'].forEach((figure) => expect(text).toContain(figure));
        expect(text).not.toContain('149,168');
    });

    it('offers every use case as a tab and shows its question and references', () => {
        render(<MemoryRouter><AboutPage /></MemoryRouter>);
        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(USE_CASES.length);
        USE_CASES.forEach((item, index) => {
            fireEvent.click(tabs[index]);
            expect(tabs[index].getAttribute('aria-selected')).toBe('true');
            const panel = screen.getByRole('tabpanel');
            expect(panel.textContent).toContain(item.question);
            expect(panel.textContent).toContain(item.label);
            item.references.forEach((reference) => expect(panel.textContent).toContain(reference.title));
        });
    });

    it('opens the full answer of a use case as a free example chat', () => {
        renderAt();
        fireEvent.click(screen.getAllByRole('tab')[1]);
        fireEvent.click(screen.getByRole('link', { name: 'Open the full answer' }));
        expect(landing()).toEqual({
            path: '/chat/new',
            state: {
                initialQuery: USE_CASES[1].question,
                initialSearchOptions: { filters: [], rankingMode: 'default', investigateEnabled: false, example: true },
                initialQueryMethod: 'example',
            },
        });
    });

    it('prerenders every figure and every step with nothing left hidden by script', () => {
        const html = renderToString(<StaticRouter location="/"><AboutPage /></StaticRouter>);
        ['41.2M+', '3.71M+', '14.6M+', 'Ask', 'Retrieve', 'Reason', 'Verify'].forEach((text) => expect(html).toContain(text));
        // Motion is switched on only after mount; the server copy is the still page.
        expect(html).not.toContain('about-page--motion');
    });
});

describe('the in-page navigation', () => {
    it('links to a section that exists for every entry', () => {
        const { container } = render(<MemoryRouter><AboutPage /></MemoryRouter>);
        const nav = screen.getByRole('navigation', { name: 'On this page' });
        PAGE_SECTIONS.forEach(([id, label]) => {
            expect(container.querySelector(`#${id}`)).toBeTruthy();
            expect(nav.querySelector(`.about-localnav-links a[href="#${id}"]`).textContent).toBe(label);
        });
    });

    it('scrolls to a section and folds the contents menu away', () => {
        const scrollIntoView = jest.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        render(<MemoryRouter><AboutPage /></MemoryRouter>);
        const nav = screen.getByRole('navigation', { name: 'On this page' });
        const toggle = nav.querySelector('.about-localnav-toggle');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(toggle);
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        const menu = nav.querySelector('#about-localnav-menu');
        expect(menu.hidden).toBe(false);
        fireEvent.click(menu.querySelector('a[href="#use-cases"]'));
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView.mock.instances[0].id).toBe('use-cases');
        expect(menu.hidden).toBe(true);
        expect(window.location.hash).toBe('#use-cases');
        delete Element.prototype.scrollIntoView;
    });
});

describe('use-case data', () => {
    it.each(USE_CASES.map((item) => [item.id, item]))('%s lists its references, each with its own PMID', (id, item) => {
        expect(item.references.length).toBeGreaterThanOrEqual(3);
        const pmids = item.references.map((reference) => reference.pmid);
        expect(new Set(pmids).size).toBe(pmids.length);
        pmids.forEach((pmid) => expect(pmid).toMatch(/^\d{7,8}$/));
    });

    it.each(USE_CASES.map((item) => [item.id, item]))('%s cites every reference it lists, and nothing else', (id, item) => {
        const text = item.answer.flatMap((block) => block.items || [block.text]).join(' ');
        const cited = [...text.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));
        expect(new Set(cited)).toEqual(new Set(item.references.map((reference, index) => index + 1)));
    });

    it.each(USE_CASES.map((item) => [item.id, item]))('%s asks one of the example questions, so its full answer is stored', (id, item) => {
        expect(EXAMPLE_QUESTIONS.flat()).toContain(item.question);
        expect(item.sourceCount).toBeGreaterThanOrEqual(item.references.length);
    });
});

/* Renders where a link or navigate() landed, with the state it carried. */
const Landing = () => {
    const location = useLocation();
    return <pre data-testid="landing">{JSON.stringify({ path: location.pathname, state: location.state })}</pre>;
};

const renderAt = () => render(
    <MemoryRouter initialEntries={['/']}>
        <Routes>
            <Route path="/" element={<AboutPage />} />
            <Route path="*" element={<Landing />} />
        </Routes>
    </MemoryRouter>,
);

const landing = () => JSON.parse(screen.getByTestId('landing').textContent);

describe('the example questions', () => {
    it('are each a link that opens a new chat asking that question in the default mode', () => {
        renderAt();
        const questions = EXAMPLE_QUESTIONS.flat();
        questions.forEach((question) => {
            expect(screen.getByRole('link', { name: question }).getAttribute('href')).toBe('/chat/new');
        });
        fireEvent.click(screen.getByRole('link', { name: questions[2] }));
        expect(landing()).toEqual({
            path: '/chat/new',
            state: {
                initialQuery: questions[2],
                initialSearchOptions: { filters: [], rankingMode: 'default', investigateEnabled: false, example: true },
                initialQueryMethod: 'example',
            },
        });
    });
});

describe('the literature review section', () => {
    it('names the four steps of the review page and links to them from the contents', () => {
        const { container } = render(<MemoryRouter><AboutPage /></MemoryRouter>);
        const section = container.querySelector('#literature-review');
        expect(section).toBeTruthy();
        REVIEW_STEPS.forEach(([name]) => expect(section.textContent).toContain(name));
        expect(PAGE_SECTIONS.map(([id]) => id)).toContain('literature-review');
    });

    it('asks a guest to sign in first', () => {
        const openLoginModal = jest.fn();
        useAuth.mockReturnValue({ isAuthenticated: false, loading: false, openLoginModal });
        renderAt();
        fireEvent.click(screen.getByRole('button', { name: 'Set up a review' }));
        expect(openLoginModal).toHaveBeenCalledWith(expect.stringContaining('literature review'));
        expect(screen.queryByTestId('landing')).toBeNull();
    });

    it('takes a signed-in reader to the review page', () => {
        useAuth.mockReturnValue({ isAuthenticated: true, loading: false, openLoginModal: jest.fn() });
        renderAt();
        fireEvent.click(screen.getByRole('button', { name: 'Set up a review' }));
        expect(landing().path).toBe('/literature-review');
    });
});

describe('the literature review steps and benchmark', () => {
    it('lets the reader pick a step', () => {
        const { container } = render(<MemoryRouter><AboutPage /></MemoryRouter>);
        const section = container.querySelector('#literature-review');
        const scope = screen.getByRole('button', { name: /^Scope/ });
        fireEvent.click(scope);
        expect(scope.getAttribute('aria-pressed')).toBe('true');
        expect(section.getAttribute('data-stage')).toBe('0');
        fireEvent.click(screen.getByRole('button', { name: /^Writing/ }));
        expect(section.getAttribute('data-stage')).toBe('2');
    });

    it('shows every benchmark score from the paper, highest first', () => {
        const { container } = render(<MemoryRouter><AboutPage /></MemoryRouter>);
        const rows = [...container.querySelectorAll('.about-bench-row')];
        expect(rows.map((row) => row.querySelector('.about-bench-track b').textContent)).toEqual(BENCHMARK.map((row) => row.score.toFixed(3)));
        const scores = BENCHMARK.map((row) => row.score);
        expect([...scores].sort((a, b) => b - a)).toEqual(scores);
        ['Claude Science', 'Elicit Systematic Review', 'Claude Code', 'OpenAI tool loop'].forEach((name) => {
            expect(BENCHMARK.some((row) => row.name === name)).toBe(true);
        });
    });
});

describe('the blog', () => {
    it('sits right after the literature review and is linked from the hero', () => {
        const { container } = render(<MemoryRouter><AboutPage /></MemoryRouter>);
        const ids = [...container.querySelectorAll('section[id]')].map((section) => section.id);
        expect(ids.indexOf('from-the-lab')).toBe(ids.indexOf('literature-review') + 1);
        const news = container.querySelector('.about-hero-news');
        expect(news.getAttribute('href')).toBe(`/blog/${posts[0].slug}`);
        posts.forEach((post) => expect(container.querySelector(`#from-the-lab a[href="/blog/${post.slug}"]`).textContent).toContain(post.title));
    });
});

describe('the FAQ', () => {
    it('opens one answer at a time, the first one to start with, without reflowing the columns', () => {
        const { container } = render(<MemoryRouter><AboutPage /></MemoryRouter>);
        const columns = container.querySelectorAll('.about-faq-column');
        expect(columns).toHaveLength(2);
        const before = [...columns].map((column) => column.textContent);
        const first = screen.getByRole('button', { name: faqData[0].question });
        expect(first.getAttribute('aria-expanded')).toBe('true');
        const last = screen.getByRole('button', { name: faqData[faqData.length - 1].question });
        fireEvent.click(last);
        expect(last.getAttribute('aria-expanded')).toBe('true');
        expect(first.getAttribute('aria-expanded')).toBe('false');
        // Every answer stays in the page (for search engines); only the open one is shown.
        expect(screen.getByRole('region', { name: faqData[faqData.length - 1].question }).textContent).toBe(faqData[faqData.length - 1].answer);
        expect([...container.querySelectorAll('.about-faq-column')].map((column) => column.textContent)).toEqual(before);
        fireEvent.click(last);
        expect(last.getAttribute('aria-expanded')).toBe('false');
    });
});

describe('the idle auto-scroll', () => {
    function Scene({ until }) {
        const ref = React.useRef(null);
        useIdleAutoScroll(ref, { until, idleMs: 1000 });
        return <section ref={ref} />;
    }

    const setup = (top) => {
        jest.useFakeTimers();
        window.innerHeight = 800;
        const scroller = document.scrollingElement || document.documentElement;
        scroller.scrollTop = 1000;
        let frames = [];
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length; });
        jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { frames = []; });
        jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top, bottom: top + 2400, height: 2400 });
        const flush = (now) => { const run = frames; frames = []; run.forEach((cb) => cb(now)); };
        return { scroller, flush };
    };

    afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

    it('carries a reader who stopped inside the scene to `until`, and no further', () => {
        const { scroller, flush } = setup(-400);   // progress 0.25 of a 1600px span
        render(<Scene until={0.75} />);
        jest.advanceTimersByTime(1000);
        const start = performance.now();
        flush(start);
        flush(start + 100000);
        // to progress 0.75: 1600 * 0.75 = 1200 below the scene's top, which is 400 above the viewport's
        expect(scroller.scrollTop).toBe(1000 + 800);
    });

    it('stops the moment the reader scrolls', () => {
        const { scroller, flush } = setup(-400);
        render(<Scene until={0.75} />);
        jest.advanceTimersByTime(1000);
        fireEvent.wheel(window);
        flush(performance.now() + 100000);
        expect(scroller.scrollTop).toBe(1000);
    });

    it('leaves a scene the reader has not reached, or has already finished', () => {
        const { scroller, flush } = setup(600);    // still mostly below the fold
        render(<Scene until={0.75} />);
        jest.advanceTimersByTime(1000);
        flush(performance.now() + 100000);
        expect(scroller.scrollTop).toBe(1000);
    });
});
