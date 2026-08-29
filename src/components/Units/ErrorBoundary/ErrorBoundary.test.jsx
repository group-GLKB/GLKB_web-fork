/**
 * A render error costs the part that failed, nothing more — and a boundary can heal.
 *
 * Before any boundary existed, one malformed streamed message unmounted the whole app:
 * transcript, sidebar, composer, and the view of every run still being written.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ErrorBoundary from './index';

const Bomb = ({ armed }) => {
    if (armed) throw new Error('boom');
    return <div>healthy content</div>;
};

describe('ErrorBoundary', () => {
    let consoleError;
    beforeEach(() => {
        // React logs caught errors loudly; the tests are about behavior, not the log.
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        consoleError.mockRestore();
    });

    it('renders its children while nothing is wrong', () => {
        render(
            <ErrorBoundary fallback={<div>fallback</div>}>
                <Bomb armed={false} />
            </ErrorBoundary>,
        );
        expect(screen.getByText('healthy content')).toBeInTheDocument();
    });

    it('shows the fallback instead of unmounting everything when a child throws', () => {
        render(
            <div>
                <div>the rest of the page</div>
                <ErrorBoundary fallback={<div>fallback</div>}>
                    <Bomb armed />
                </ErrorBoundary>
            </div>,
        );
        expect(screen.getByText('fallback')).toBeInTheDocument();
        // The point of the boundary: siblings survive.
        expect(screen.getByText('the rest of the page')).toBeInTheDocument();
    });

    it('renders nothing, not a crash, when no fallback is given', () => {
        const { container } = render(
            <ErrorBoundary>
                <Bomb armed />
            </ErrorBoundary>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('retries when resetKey changes — a streaming message heals as more text arrives', () => {
        const { rerender } = render(
            <ErrorBoundary resetKey={1} fallback={<div>fallback</div>}>
                <Bomb armed />
            </ErrorBoundary>,
        );
        expect(screen.getByText('fallback')).toBeInTheDocument();

        rerender(
            <ErrorBoundary resetKey={2} fallback={<div>fallback</div>}>
                <Bomb armed={false} />
            </ErrorBoundary>,
        );
        expect(screen.getByText('healthy content')).toBeInTheDocument();
    });

    it('stays on the fallback while resetKey is unchanged', () => {
        const { rerender } = render(
            <ErrorBoundary resetKey={1} fallback={<div>fallback</div>}>
                <Bomb armed />
            </ErrorBoundary>,
        );
        rerender(
            <ErrorBoundary resetKey={1} fallback={<div>fallback</div>}>
                <Bomb armed={false} />
            </ErrorBoundary>,
        );
        // No churn: without a new key the boundary does not blindly retry a render
        // that just failed.
        expect(screen.getByText('fallback')).toBeInTheDocument();
    });
});
