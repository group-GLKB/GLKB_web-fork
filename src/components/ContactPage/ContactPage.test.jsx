import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import ContactPage from '.';
import { buildContactMailto, CONTACT_EMAIL, openContactDraft } from './contactEmail';

jest.mock('./contactEmail', () => ({ ...jest.requireActual('./contactEmail'), openContactDraft: jest.fn() }));

const showPage = () => render(<HelmetProvider><MemoryRouter initialEntries={['/contact']}><ContactPage /></MemoryRouter></HelmetProvider>);

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue(undefined) } });
});

afterEach(() => jest.restoreAllMocks());

it('links the shared footer to the contact page and exposes direct email links', () => {
    showPage();
    expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'Open email app' })).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
    expect(screen.getByLabelText('Name')).toBeRequired();
    expect(screen.getByLabelText('Institution (optional)')).not.toBeRequired();
});

it('opens an encoded email draft with the entered topic and message, without clearing the form', () => {
    showPage();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Casey & Lee  ' } });
    fireEvent.change(screen.getByLabelText('Institution (optional)'), { target: { value: 'U-M' } });
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Account & billing' } });
    const message = 'Hello GLKB,\nI have a question about A+B & #references.';
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: message } });
    expect(screen.getByText(`${message.length} characters`)).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('form', { name: 'Contact the GLKB team' }));
    const draft = new URL(openContactDraft.mock.calls[0][0]);
    expect(draft.pathname).toBe(CONTACT_EMAIL);
    expect(draft.searchParams.get('subject')).toBe('[GLKB] Account & billing');
    expect(draft.searchParams.get('body')).toBe(`Name: Casey & Lee\r\nInstitution: U-M\r\nTopic: Account & billing\r\n\r\n${message}`);
    expect(screen.getByLabelText('Message')).toHaveValue(message);
});

it('keeps the institution optional and safely encodes non-English text', () => {
    const draft = new URL(buildContactMailto({ name: '王', institution: ' ', topic: 'API access', message: '问题 & details?' }));
    expect(draft.searchParams.get('body')).toBe('Name: 王\r\nTopic: API access\r\n\r\n问题 & details?');
});

it('does not open a draft containing only whitespace', () => {
    showPage();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Contact the GLKB team' }));
    expect(openContactDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter your name and a message.');
});

it('copies the real address and reports clipboard failures without claiming success', async () => {
    showPage();
    fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));
    await screen.findByRole('button', { name: 'Copied!' });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(CONTACT_EMAIL);
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Copied!' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not copy.'));
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument();
});
