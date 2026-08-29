/**
 * One part failing must not take down what the reader already has.
 *
 * React unmounts the whole tree when a render throws and nothing catches it: one malformed
 * reference in one streamed answer blanked the entire app — transcript, sidebar, composer —
 * and with it the view of every run still being written. The rule this app promises is that
 * an answer never disappears; an uncaught render error was the last way it still could.
 *
 * Two places use this, at two sizes. Each message card gets its own boundary, so a message
 * that cannot be drawn costs exactly that message — the conversation, and the answer still
 * streaming below it, live on. The app root gets one as the backstop, dependency-free,
 * because whatever crashed may be a library this fallback must then not use.
 *
 * `resetKey` lets a boundary retry: when it changes, the error state clears and the children
 * render again. A streaming message keys this by its content length, so a card that failed
 * on a half-arrived fragment heals on its own when the rest of the text lands.
 */
import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error, info) {
        // The console is the reporting channel this project has; the stack is what a bug
        // report needs. Containment, not reporting, is this component's job.
        console.error(
            `[ErrorBoundary] ${this.props.label || 'render failure'}`,
            error,
            info?.componentStack,
        );
    }

    componentDidUpdate(prevProps) {
        if (this.state.failed && prevProps.resetKey !== this.props.resetKey) {
            // A new resetKey is the caller saying "the inputs changed, try again". Setting
            // state in componentDidUpdate is the documented reset pattern for boundaries;
            // the condition above keeps it from looping.
            this.setState({ failed: false });
        }
    }

    render() {
        if (this.state.failed) {
            return this.props.fallback ?? null;
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
