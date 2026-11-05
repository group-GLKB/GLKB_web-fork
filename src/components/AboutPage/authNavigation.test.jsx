import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AboutPage from './index';
import { useAuth } from '../Auth/AuthContext';

jest.mock('../Auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-helmet-async', () => ({ Helmet: () => null }));
jest.mock('@mui/icons-material/Add', () => () => null);
jest.mock('@mui/icons-material/Remove', () => () => null);
jest.mock('@mui/icons-material/ChevronRight', () => () => null);

const openLoginModal = jest.fn();
const auth = (isAuthenticated, loading = false) => {
    useAuth.mockReturnValue({ isAuthenticated, loading, openLoginModal });
};
const Location = () => <output data-testid="location">{useLocation().pathname}</output>;
const App = () => (
    <MemoryRouter initialEntries={['/']}>
        <Location />
        <Routes>
            <Route path="/" element={<AboutPage />} />
            <Route path="/chat" element={<p>Chat home</p>} />
            <Route path="/literature-review" element={<p>Review scope</p>} />
        </Routes>
    </MemoryRouter>
);
beforeEach(() => { openLoginModal.mockClear(); auth(false); });

it('plays the demo video on the page from both hero and footer, without leaving About or requiring login', () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    try {
        render(<App />);
        const buttons = screen.getAllByRole('button', { name: 'View Demo' });
        expect(buttons).toHaveLength(2);
        buttons.forEach(button => {
            expect(button.disabled).toBe(false);
            fireEvent.click(button);
            const dialog = screen.getByRole('dialog', { name: 'GLKB demo video' });
            expect(within(dialog).getByTitle('GLKB demo video').getAttribute('src'))
                .toBe('https://www.youtube-nocookie.com/embed/63b3-MuTUCA?autoplay=1&rel=0&playsinline=1');
            fireEvent.click(within(dialog).getByRole('button', { name: 'Close video' }));
            expect(screen.queryByRole('dialog')).toBeNull();
        });
        expect(open).not.toHaveBeenCalled();
        expect(screen.getByTestId('location').textContent).toBe('/');
        expect(openLoginModal).not.toHaveBeenCalled();
    } finally { open.mockRestore(); }
});

it('closes the demo on Escape', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'View Demo' })[0]);
    expect(screen.getByRole('dialog', { name: 'GLKB demo video' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
});

it('sends a guest to chat on the navigation Try GLKB button without opening login', () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Site' })).getByRole('button', { name: 'Try GLKB' }));
    expect(openLoginModal).not.toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent).toBe('/chat');
});

it('still redirects when a guest completes sign-in while on About', () => {
    const view = render(<App />);
    expect(screen.getByTestId('location').textContent).toBe('/');
    // An unsuccessful or cancelled attempt leaves auth unchanged.
    view.rerender(<App />);
    expect(screen.getByTestId('location').textContent).toBe('/');
    auth(true);
    view.rerender(<App />);
    expect(screen.getByTestId('location').textContent).toBe('/chat');
});

it('sends an already signed-in reader to chat on the navigation Try GLKB button without opening login', () => {
    auth(true);
    render(<App />);
    expect(screen.getByTestId('location').textContent).toBe('/');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Site' })).getByRole('button', { name: 'Try GLKB' }));
    expect(screen.getByTestId('location').textContent).toBe('/chat');
    expect(openLoginModal).not.toHaveBeenCalled();
});

it('does not mistake restoring an existing session for completing a new sign-in', () => {
    auth(false, true);
    const view = render(<App />);
    auth(true);
    view.rerender(<App />);
    expect(screen.getByTestId('location').textContent).toBe('/');
});

it('redirects a guest signing in after initial session loading finishes', () => {
    auth(false, true);
    const view = render(<App />);
    auth(false);
    view.rerender(<App />);
    auth(true);
    view.rerender(<App />);
    expect(screen.getByTestId('location').textContent).toBe('/chat');
});

it('takes a guest who signs in to start a review on to the review page, not the chat', () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Set up a review' }));
    expect(openLoginModal).toHaveBeenCalledTimes(1);
    auth(true);
    view.rerender(<App />);
    expect(screen.getByTestId('location').textContent).toBe('/literature-review');
});

it('no longer links to the API docs from the footer', () => {
    render(<App />);
    expect(screen.queryByRole('link', { name: 'API Docs' })).toBeNull();
});
