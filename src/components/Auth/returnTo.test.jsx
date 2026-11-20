/**
 * Coming back to the page that asked for a sign-in (returnTo.js): only a path on this site, and
 * /verify-code goes there instead of the chat when it is given one.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import '@testing-library/jest-dom';

import { safeReturnTo } from './returnTo';

const mockAuth = { verified: [] };
jest.mock('./AuthContext', () => ({
    useAuth: () => ({
        verifyCode: (email, code) => {
            mockAuth.verified.push([email, code]);
            return Promise.resolve({ success: true });
        },
        sendCode: () => Promise.resolve({ success: true }),
    }),
}));

// eslint-disable-next-line import/first
import VerifyCodePage from './VerifyCodePage';

function Where() {
    const location = useLocation();
    return <span data-testid="where">{`${location.pathname}${location.search}`}</span>;
}

const renderVerify = (state) => render(
    <MemoryRouter initialEntries={[{ pathname: '/verify-code', state }]}>
        <Routes>
            <Route path="/verify-code" element={<VerifyCodePage />} />
            <Route path="*" element={<Where />} />
        </Routes>
    </MemoryRouter>,
);

const enterCode = () => {
    const boxes = screen.getAllByRole('textbox');
    '654321'.split('').forEach((digit, i) => fireEvent.change(boxes[i], { target: { value: digit } }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
};

beforeEach(() => {
    mockAuth.verified = [];
});

it('accepts a path on this site and nothing else', () => {
    expect(safeReturnTo('/oauth/authorize?request=abc')).toBe('/oauth/authorize?request=abc');
    ['//evil.example/x', '/\\evil.example', 'https://evil.example/', 'oauth/authorize', '', null, undefined, 42].forEach(
        (value) => expect(safeReturnTo(value)).toBe(''),
    );
});

it('goes back to the page that asked, after the code', async () => {
    renderVerify({ email: 'reader@umich.edu', returnTo: '/oauth/authorize?request=abc' });
    enterCode();
    expect(await screen.findByTestId('where')).toHaveTextContent('/oauth/authorize?request=abc');
    expect(mockAuth.verified).toEqual([['reader@umich.edu', '654321']]);
});

it('goes on to the chat as before when no page asked, or the address is not this site', async () => {
    renderVerify({ email: 'reader@umich.edu', returnTo: '//evil.example/steal' });
    enterCode();
    expect(await screen.findByTestId('where')).toHaveTextContent(/^\/chat$/);
});

it('Change goes back to the page that asked', () => {
    renderVerify({ email: 'reader@umich.edu', returnTo: '/oauth/authorize?request=abc' });
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/oauth/authorize?request=abc');
});
