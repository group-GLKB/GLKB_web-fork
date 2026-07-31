/**
 * Search Options is locked while Investigate is on.
 *
 * Deep Research runs its own hybrid retrieval and drops `filters` / `ranking_mode` entirely
 * (`service/harness_runner.py` logs a warning and discards them). Leaving the control live was
 * promising an article-type filter that never ran, so it is greyed out and unopenable.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import LlmSearchBarHome from './LlmSearchBarHome';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));

// MUI's useMediaQuery needs matchMedia; default to the desktop layout.
beforeAll(() => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
});

// `setOpen` is called from an effect on mount, so it is required even though the autocomplete
// popup is irrelevant here.
const setup = () => render(<LlmSearchBarHome setOpen={() => {}} autocompleteOptions={[]} />);

// The desktop trigger is the one carrying the label; the mobile Box is display:none here.
const optionsTrigger = () => screen.getAllByText(/Search Options|Reviews only|High impact/)
    .map((n) => n.closest('[aria-disabled]'))
    .filter(Boolean)[0];
// `hidden: true` because an open drawer is a modal: MUI marks the rest of the page aria-hidden.
const investigateButton = () => screen.getByRole('button', { name: /investigate/i, hidden: true });
// The drawers use `keepMounted`, so their content is in the DOM whether open or closed —
// presence of "Article Type" proves nothing. MUI marks a closed modal with `MuiModal-hidden`.
const drawerIsOpen = () => Array.from(document.querySelectorAll('.MuiDrawer-root'))
    .some((n) => !n.classList.contains('MuiModal-hidden'));

describe('with Investigate off', () => {
    it('opens the drawer, showing Article Type and Sort by', () => {
        setup();
        expect(drawerIsOpen()).toBe(false);
        fireEvent.click(optionsTrigger());
        expect(drawerIsOpen()).toBe(true);
        expect(screen.getAllByText('Sort by').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Reviews only').length).toBeGreaterThan(0);
    });

    it('leaves the trigger enabled', () => {
        setup();
        expect(optionsTrigger()).toHaveAttribute('aria-disabled', 'false');
    });
});

describe('with Investigate on', () => {
    it('marks the trigger disabled and explains why', () => {
        setup();
        fireEvent.click(investigateButton());
        const trigger = optionsTrigger();
        expect(trigger).toHaveAttribute('aria-disabled', 'true');
        expect(trigger).toHaveAttribute('title', expect.stringMatching(/don.t apply to Investigate/i));
    });

    it('does not open the drawer when clicked', () => {
        setup();
        fireEvent.click(investigateButton());
        fireEvent.click(optionsTrigger());
        expect(drawerIsOpen()).toBe(false);
    });

    it('closes the drawer if it was already open', async () => {
        // Not reachable by pointer today — the open drawer is a modal, so Investigate is behind the
        // backdrop. The guard exists so the panel cannot be left showing an inert drawer if the
        // toggle ever moves outside it.
        setup();
        fireEvent.click(optionsTrigger());
        expect(drawerIsOpen()).toBe(true);
        fireEvent.click(investigateButton());
        // MUI only flags the modal hidden once its exit transition finishes.
        await waitFor(() => expect(drawerIsOpen()).toBe(false));
    });

    it('stops advertising a selection that is not in effect', () => {
        // A greyed "Reviews only" would still read as "reviews only is applied".
        setup();
        fireEvent.click(optionsTrigger());
        fireEvent.click(within(screen.getAllByText('Reviews only')[0]).getByText?.('Reviews only')
            || screen.getAllByText('Reviews only')[0]);
        fireEvent.click(screen.getAllByText('Done')[0]);
        expect(screen.getAllByText(/Reviews only/).length).toBeGreaterThan(0);   // shown while unlocked

        fireEvent.click(investigateButton());
        expect(optionsTrigger()).toHaveTextContent('Search Options');
        expect(optionsTrigger()).not.toHaveTextContent('Reviews only');
    });

    it('unlocks again when Investigate is switched back off', () => {
        setup();
        fireEvent.click(investigateButton());
        expect(optionsTrigger()).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(investigateButton());
        expect(optionsTrigger()).toHaveAttribute('aria-disabled', 'false');
        fireEvent.click(optionsTrigger());
        expect(drawerIsOpen()).toBe(true);
    });
});
