import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';
import NewsStrip, { NEWS_VERSION, newsItems } from './NewsStrip';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));

beforeEach(() => {
    window.localStorage.clear();
    mockNavigate.mockReset();
    jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

it('shows one item at a time and moves on by itself', () => {
    render(<NewsStrip />);
    const [first, second] = newsItems();
    expect(screen.getByText(first.text)).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(6000); });
    expect(screen.getByText(second.text)).toBeInTheDocument();
});

it('opens a post, or hands a "Try it" back to the page', () => {
    const onTry = jest.fn();
    render(<NewsStrip onTry={onTry} />);
    fireEvent.click(screen.getByRole('button', { name: /Read more/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/blog/glkb-knowledge-graph');
    fireEvent.click(screen.getByRole('button', { name: 'News 2 of ' + newsItems().length }));
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }));
    expect(onTry).toHaveBeenCalledWith(expect.objectContaining({ id: 'attachments' }));
});

it('stays closed once closed, until the news changes', () => {
    const { unmount } = render(<NewsStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Close news' }));
    expect(screen.queryByRole('region', { name: 'News' })).toBeNull();
    expect(window.localStorage.getItem('glkb-news-dismissed')).toBe(NEWS_VERSION);
    unmount();
    render(<NewsStrip />);
    expect(screen.queryByRole('region', { name: 'News' })).toBeNull();
});
