/**
 * A finished answer should stop looking like one still being written.
 *
 * The agent ships the answer text on its own `Answer` frame, as early as it can. What runs
 * after that is reference reranking, full-text link resolution (an NCBI call, rate limited to
 * 2 req/s) and the knowledge-graph query build — none of which changes a character of the
 * answer. During that window the card kept animating a working label over text that was
 * already final, which reads as a run that has stalled rather than one tidying up.
 *
 * `answerReady` says only that. It is deliberately NOT `isLoading` or `isProcessing`: the run
 * is still a run, so the composer stays as it was and nothing new can start. This pins the
 * rule the header applies, which is the whole of the behaviour.
 */

// The rule as MessageCard applies it, kept here because the component cannot be mounted
// without the whole app behind it.
const thinkingIsOver = (isLoading, answerReady) => !isLoading || answerReady;

const headerText = ({ isLoading, answerReady, animated, durationLabel }) => (
    !thinkingIsOver(isLoading, answerReady)
        ? animated
        : (durationLabel ? `Thought for ${durationLabel}` : 'Thought summary')
);

describe('the thought header while the last frames arrive', () => {
    it('animates while the model is still writing', () => {
        expect(headerText({
            isLoading: true, answerReady: false, animated: 'Searching...',
        })).toBe('Searching...');
    });

    it('stops animating the moment the answer text is final', () => {
        expect(headerText({
            isLoading: true, answerReady: true, animated: 'Finalizing references...',
        })).toBe('Thought summary');
    });

    it('shows the measured duration once the run reports one', () => {
        expect(headerText({
            isLoading: false, answerReady: false, animated: '', durationLabel: '24s',
        })).toBe('Thought for 24s');
    });

    it('a settled card is unaffected by the flag either way', () => {
        for (const answerReady of [true, false]) {
            expect(headerText({
                isLoading: false, answerReady, animated: 'x', durationLabel: '9s',
            })).toBe('Thought for 9s');
        }
    });

    it('never animates once the answer is ready, whatever the label says', () => {
        expect(headerText({
            isLoading: true, answerReady: true, animated: 'Thinking...',
        })).not.toContain('...');
    });
});
