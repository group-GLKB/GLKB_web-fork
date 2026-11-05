import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import AboutPage from './index';
import { EXAMPLE_QUESTIONS } from './exampleQuestions';
import { PAGE_SECTIONS } from './LocalNav';
import { REVIEW_STEPS } from './ReviewScene';
import { measureProgress, segment } from './motion';
import { USE_CASES } from './useCases';
import { useAuth } from '../Auth/AuthContext';

jest.mock('../Auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-helmet-async', () => ({ Helmet: () => null }));
jest.mock('@mui/icons-material/Add', () => () => null);
jest.mock('@mui/icons-material/Remove', () => () => null);
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
        expect(tabs.map((tab) => tab.textContent)).toEqual(USE_CASES.map((item) => item.label));
        USE_CASES.forEach((item, index) => {
            fireEvent.click(tabs[index]);
            expect(tabs[index].getAttribute('aria-selected')).toBe('true');
            expect(screen.getByText(`Q: ${item.question}`)).toBeTruthy();
            item.references.forEach((reference) => {
                expect(screen.getAllByText(reference.title).length).toBeGreaterThan(0);
            });
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
        // Citation markers follow a non-breaking space, as the agent writes them.
        const cited = [...text.matchAll(/ (\d)(?=[.;,]|$|\s)/g)].map((match) => Number(match[1]));
        expect(new Set(cited)).toEqual(new Set(item.references.map((reference, index) => index + 1)));
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
