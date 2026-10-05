import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { getPost } from '../Blog/posts';
import WhatsNew, { DISMISSED_KEY, NEWS } from './WhatsNew';

jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));

beforeEach(() => window.localStorage.clear());

const renderNews = (props = {}) =>
    render(
        <MemoryRouter>
            <WhatsNew {...props} />
        </MemoryRouter>,
    );

test('every article card opens a post that exists', () => {
    const linked = NEWS.filter((item) => item.to);
    expect(linked).toHaveLength(2);
    linked.forEach((item) => {
        const slug = item.to.replace('/blog/', '');
        expect(getPost(slug)).not.toBeNull();
    });
    renderNews();
    expect(screen.getByRole('link', { name: /Research reports you can audit/ }).getAttribute('href'))
        .toBe('/blog/investigate-auditable-research');
    expect(screen.getByRole('link', { name: /33M abstracts/ }).getAttribute('href'))
        .toBe('/blog/glkb-knowledge-graph');
});

test('the attachments card opens the composer attach control', () => {
    const onTryAttach = jest.fn();
    renderNews({ onTryAttach });
    fireEvent.click(screen.getByRole('button', { name: /^New in chat Attach files and images/ }));
    expect(onTryAttach).toHaveBeenCalledTimes(1);
});

test('a dismissed card stays gone after the page is opened again', () => {
    const { unmount } = renderNews();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Research reports you can audit' }));
    expect(screen.queryByText('Research reports you can audit')).toBeNull();
    expect(screen.getByText('Attach files and images')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(DISMISSED_KEY))).toEqual(['investigate']);

    unmount();
    renderNews();
    expect(screen.queryByText('Research reports you can audit')).toBeNull();
    expect(screen.getByText('33M abstracts, one queryable graph')).toBeTruthy();
});

test('dismissing every card removes the whole section, heading included', () => {
    renderNews();
    NEWS.forEach((item) => {
        fireEvent.click(screen.getByRole('button', { name: `Dismiss: ${item.title}` }));
    });
    expect(screen.queryByText("What's new")).toBeNull();
});

test('the × does not trigger the card it sits on', () => {
    const onTryAttach = jest.fn();
    renderNews({ onTryAttach });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Attach files and images' }));
    expect(onTryAttach).not.toHaveBeenCalled();
});

test('unreadable storage shows every card instead of failing', () => {
    window.localStorage.setItem(DISMISSED_KEY, '{not json');
    renderNews();
    NEWS.forEach((item) => expect(screen.getByText(item.title)).toBeTruthy());
});
