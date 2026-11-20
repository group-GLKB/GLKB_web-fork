/**
 * The GLKB Cite page: the download is a plain file link the router cannot swallow, the page says
 * who it is for (a Mac, and only a Mac), and it sends the reader to the guide for every step.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';

import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';

import { CITE_APP, CITE_DOWNLOAD_URL, CITE_GUIDE_PATH, CITE_PAGE_PATH } from '../../config/citeApp';
import { getPost } from '../Blog/posts';
import CitePage, { detectPlatform } from './index';

jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));

const MAC = { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 };
const WINDOWS = { platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0 };
const IPAD = { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 };

const setNavigator = (value) => {
    ['platform', 'userAgent', 'maxTouchPoints'].forEach((key) => {
        Object.defineProperty(window.navigator, key, { value: value[key], configurable: true });
    });
};

const renderPage = () => render(
    <HelmetProvider><MemoryRouter initialEntries={[CITE_PAGE_PATH]}><CitePage /></MemoryRouter></HelmetProvider>,
);

afterEach(() => setNavigator(MAC));

describe('the download', () => {
    it('is a static file link with the download attribute, at the top and at the foot of the page', () => {
        setNavigator(MAC);
        renderPage();
        const links = screen.getAllByRole('link', { name: 'Download for Mac' });
        expect(links).toHaveLength(2);
        links.forEach((link) => {
            expect(link).toHaveAttribute('href', `/downloads/${CITE_APP.file}`);
            expect(link).toHaveAttribute('download', CITE_APP.file);
        });
        expect(CITE_DOWNLOAD_URL).toBe(`/downloads/${CITE_APP.file}`);
    });

    it('points at a disk image that is in public/, named for its version', () => {
        // A dot in the last path segment is what keeps the hosting's app fallback off it.
        expect(CITE_APP.file).toBe(`GLKB-Cite-${CITE_APP.version}.dmg`);
        const file = path.join(__dirname, '../../../public/downloads', CITE_APP.file);
        expect(fs.existsSync(file)).toBe(true);
        expect(fs.statSync(file).size).toBeGreaterThan(1024 * 1024);
    });

    it('states the version, the size and the macOS it needs', () => {
        renderPage();
        expect(screen.getByText(new RegExp(`Version ${CITE_APP.version.replace(/\./g, '\\.')} · ${CITE_APP.sizeLabel} · ${CITE_APP.minMacOS} or newer`))).toBeInTheDocument();
    });
});

describe('who it is for', () => {
    it('reads a Mac, another computer and an iPad apart', () => {
        expect(detectPlatform(MAC)).toBe('mac');
        expect(detectPlatform(WINDOWS)).toBe('other');
        expect(detectPlatform(IPAD)).toBe('other');
        expect(detectPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe('other');
        expect(detectPlatform({})).toBeNull();
        expect(detectPlatform(null)).toBeNull();
    });

    it('tells a reader who is not on a Mac, and still offers the file', () => {
        setNavigator(WINDOWS);
        renderPage();
        expect(screen.getByRole('note')).toHaveTextContent('You do not seem to be on a Mac.');
        expect(screen.getAllByRole('link', { name: 'Download for Mac' })).toHaveLength(2);
    });

    it('says nothing of the kind on a Mac, and always says there is no Windows version', () => {
        setNavigator(MAC);
        renderPage();
        expect(screen.queryByRole('note')).toBeNull();
        expect(screen.getByText('There is no version for Windows, Linux, iPhone, iPad or Android yet.')).toBeInTheDocument();
    });
});

describe('the page itself', () => {
    it('is marked as the current page in the site nav, where every marketing page links to it', () => {
        const { container } = renderPage();
        const navLink = container.querySelector('.site-nav a[href="/cite"]');
        expect(navLink).toHaveAttribute('aria-current', 'page');
        expect(navLink).toHaveClass('is-active');
    });

    it('has one h1, a heading for every section, and described pictures', () => {
        const { container } = renderPage();
        expect(container.querySelectorAll('h1')).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('GLKB Cite: the papers behind any sentence you select');
        ['Is it for you?', 'Ready in about five minutes', 'What you get back', 'Common questions', 'Get GLKB Cite']
            .forEach((name) => expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument());
        container.querySelectorAll('section').forEach((section) => {
            expect(document.getElementById(section.getAttribute('aria-labelledby'))).not.toBeNull();
        });
        const figures = [...container.querySelectorAll('.cite-figure img')];
        expect(figures).toHaveLength(2);
        figures.forEach((img) => expect(img.getAttribute('alt')).toMatch(/^A drawing of /));
    });

    it('never sends the reader to a Terminal', () => {
        const { container } = renderPage();
        expect(container.textContent).not.toMatch(/terminal|xattr|quarantine|command line/i);
    });

    it('lists the four steps in order', () => {
        renderPage();
        const steps = within(document.querySelector('ol.cite-steps'))
            .getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
        expect(steps).toEqual(['Download the app', 'Drag it to Applications', 'Get your GLKB key', 'Finish the short setup']);
    });

    it('links to the guide, and only to sections the guide has', () => {
        const { container } = renderPage();
        const guide = getPost('glkb-cite');
        expect(guide).not.toBeNull();
        const source = guide.segments.map((segment) => segment.content || '').join('\n');
        const links = [...container.querySelectorAll(`a[href^="${CITE_GUIDE_PATH}"]`)].map((link) => link.getAttribute('href'));
        expect(links).toContain(CITE_GUIDE_PATH);
        const anchors = links.filter((href) => href.includes('#')).map((href) => href.split('#')[1]);
        expect(anchors.length).toBeGreaterThanOrEqual(8);
        anchors.forEach((anchor) => expect(source).toContain(`{#${anchor}}`));
    });

    it('answers its questions in native disclosures, closed until asked', () => {
        const { container } = renderPage();
        const questions = [...container.querySelectorAll('.cite-questions details')];
        expect(questions.length).toBeGreaterThanOrEqual(6);
        questions.forEach((item) => {
            expect(item.open).toBe(false);
            expect(item.querySelector('summary').textContent.length).toBeGreaterThan(10);
        });
        expect(screen.getByText('It says “GLKB rejected this API key”.')).toBeInTheDocument();
    });
});
