import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import PersistentAgentSurface from './PersistentAgentSurface';

let mockAgentMounts = 0;
let mockAgentUnmounts = 0;

jest.mock('../LLMAgent', () => {
    const ReactLocal = require('react');
    return function MockLLMAgent({ isRouteActive }) {
        ReactLocal.useEffect(() => {
            mockAgentMounts += 1;
            return () => { mockAgentUnmounts += 1; };
        }, []);
        return ReactLocal.createElement(
            'div',
            { 'data-testid': 'persistent-agent', 'data-active': String(isRouteActive) },
            'Agent',
        );
    };
});

beforeEach(() => {
    sessionStorage.clear();
    mockAgentMounts = 0;
    mockAgentUnmounts = 0;
});

describe('PersistentAgentSurface', () => {
    it('activates lazily, then preserves the Agent after leaving chat', () => {
        const { rerender } = render(
            <PersistentAgentSurface active={false}>
                <p>Home page</p>
            </PersistentAgentSurface>,
        );

        expect(screen.queryByTestId('persistent-agent')).not.toBeInTheDocument();
        expect(screen.getByText('Home page')).toBeInTheDocument();
        expect(mockAgentMounts).toBe(0);

        rerender(
            <PersistentAgentSurface active>
                <p>Home page</p>
            </PersistentAgentSurface>,
        );

        expect(screen.getByTestId('persistent-agent')).toHaveAttribute('data-active', 'true');
        expect(mockAgentMounts).toBe(1);

        rerender(
            <PersistentAgentSurface active={false}>
                <p>Home page</p>
            </PersistentAgentSurface>,
        );

        expect(screen.getByTestId('persistent-agent')).toHaveAttribute('data-active', 'false');
        expect(mockAgentMounts).toBe(1);
        expect(mockAgentUnmounts).toBe(0);
    });

    it('keeps one Agent instance mounted while route content replaces its view', () => {
        const { rerender } = render(
            <PersistentAgentSurface active>
                <p>Library page</p>
            </PersistentAgentSurface>,
        );

        expect(screen.getByTestId('persistent-agent')).toHaveAttribute('data-active', 'true');
        expect(screen.queryByText('Library page')).not.toBeInTheDocument();
        expect(mockAgentMounts).toBe(1);

        rerender(
            <PersistentAgentSurface active={false}>
                <p>Library page</p>
            </PersistentAgentSurface>,
        );

        expect(screen.getByText('Library page')).toBeInTheDocument();
        expect(screen.getByTestId('persistent-agent')).toHaveAttribute('data-active', 'false');
        expect(mockAgentMounts).toBe(1);
        expect(mockAgentUnmounts).toBe(0);

        rerender(
            <PersistentAgentSurface active>
                <p>Library page</p>
            </PersistentAgentSurface>,
        );

        expect(screen.getByTestId('persistent-agent')).toHaveAttribute('data-active', 'true');
        expect(mockAgentMounts).toBe(1);
        expect(mockAgentUnmounts).toBe(0);
    });

    it('mounts hidden on another route when a previous run needs reconnecting', () => {
        sessionStorage.setItem('llmWasProcessing', 'true');

        render(
            <PersistentAgentSurface active={false}>
                <p>History page</p>
            </PersistentAgentSurface>,
        );

        expect(screen.getByText('History page')).toBeInTheDocument();
        expect(screen.getByTestId('persistent-agent')).toHaveAttribute('data-active', 'false');
        expect(mockAgentMounts).toBe(1);
    });
});
