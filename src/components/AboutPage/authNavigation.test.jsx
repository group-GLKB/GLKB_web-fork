import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
        </Routes>
    </MemoryRouter>
);
beforeEach(() => { openLoginModal.mockClear(); auth(false); });

it('opens the demo video from both hero and footer without leaving About or requiring login', () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    try {
        render(<App />);
        const buttons = screen.getAllByRole('button', { name: 'View Demo' });
        expect(buttons).toHaveLength(2);
        buttons.forEach(button => {
            expect(button.disabled).toBe(false);
            fireEvent.click(button);
        });
        expect(open).toHaveBeenCalledTimes(2);
        expect(open).toHaveBeenNthCalledWith(1, 'https://www.youtube.com/watch?v=63b3-MuTUCA', '_blank', 'noopener,noreferrer');
        expect(open).toHaveBeenNthCalledWith(2, 'https://www.youtube.com/watch?v=63b3-MuTUCA', '_blank', 'noopener,noreferrer');
        expect(screen.getByTestId('location').textContent).toBe('/');
        expect(openLoginModal).not.toHaveBeenCalled();
    } finally { open.mockRestore(); }
});

it('opens sign-in for a guest and stays on About until authentication succeeds', () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));
    expect(openLoginModal).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location').textContent).toBe('/');
    // An unsuccessful or cancelled attempt leaves auth unchanged.
    view.rerender(<App />);
    expect(screen.getByTestId('location').textContent).toBe('/');
    auth(true);
    view.rerender(<App />);
    expect(screen.getByTestId('location').textContent).toBe('/chat');
});

it('sends an already signed-in reader to chat on Get Started without opening login', () => {
    auth(true);
    render(<App />);
    expect(screen.getByTestId('location').textContent).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));
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
