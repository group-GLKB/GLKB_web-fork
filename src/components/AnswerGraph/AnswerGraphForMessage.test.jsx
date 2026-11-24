import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AnswerGraphForMessage from './AnswerGraphForMessage';
import { fetchAnswerGraph, fetchAnswerGraphForText, fetchAnswerGraphV2 } from '../../service/answerGraph';
import fixture from './answerGraphV2Fixture.json';

jest.mock('../../service/answerGraph', () => ({
    fetchAnswerGraph: jest.fn(),
    fetchAnswerGraphForText: jest.fn(),
    fetchAnswerGraphV2: jest.fn(),
}));
// The cards themselves draw with cytoscape; what is pinned here is which request is made and
// which card is drawn.
jest.mock('.', () => ({ __esModule: true, default: () => <div data-testid="graph-card" /> }));
jest.mock('./AnswerGraphV2', () => ({
    __esModule: true,
    default: ({ graph, references }) => (
        <div data-testid="answer-graph-v2" data-nodes={graph.nodes.length} data-refs={references?.length || 0} />
    ),
}));

const GRAPH = { nodes: [{ id: 'a' }, { id: 'b' }], edges: [] };
const LIST = ['WITH ["hgnc:1", "hgnc:2"] AS node_ids MATCH (n) RETURN n'];

beforeEach(() => {
    fetchAnswerGraph.mockReset().mockResolvedValue(GRAPH);
    fetchAnswerGraphForText.mockReset().mockResolvedValue(GRAPH);
    fetchAnswerGraphV2.mockReset().mockResolvedValue({ graph: fixture.answer_graph, basic: false });
});

afterEach(() => { jest.useRealTimers(); });

it('draws from the answer\'s list when it has one', async () => {
    const { findByTestId } = render(<AnswerGraphForMessage kgQueryList={LIST} answer="text" />);
    expect(await findByTestId('graph-card')).toBeInTheDocument();
    expect(fetchAnswerGraph).toHaveBeenCalledWith(LIST);
    expect(fetchAnswerGraphForText).not.toHaveBeenCalled();
    expect(fetchAnswerGraphV2).not.toHaveBeenCalled();
});

it('builds one from the text for an answer that came without a list', async () => {
    // jsdom has no IntersectionObserver, so the answer counts as on screen at once
    const { findByTestId } = render(<AnswerGraphForMessage kgQueryList={[]} answer="TP53 and MDM2 ..." />);
    expect(await findByTestId('graph-card')).toBeInTheDocument();
    expect(fetchAnswerGraphForText).toHaveBeenCalledWith('TP53 and MDM2 ...');
    expect(fetchAnswerGraph).not.toHaveBeenCalled();
});

it('draws nothing when there is no graph to draw', async () => {
    fetchAnswerGraphForText.mockResolvedValue(null);
    const { queryByTestId } = render(<AnswerGraphForMessage answer="Hello" />);
    await waitFor(() => expect(fetchAnswerGraphForText).toHaveBeenCalled());
    expect(queryByTestId('graph-card')).toBeNull();
});

/* The answer graph (v2): High, Extra and Max in a saved conversation (the three-repo effort
   contract, 2026-11-05). Every way it can fail ends in the basic graph, exactly as above. */
describe('the answer graph', () => {
    const saved = { kgQueryList: LIST, answer: 'text', effort: 'high', historyId: '42', invocationId: 'inv-7' };

    it('is drawn for a saved High answer, asked for by its invocation id', async () => {
        const { findByTestId, queryByTestId } = render(
            <AnswerGraphForMessage {...saved} references={[{ title: 'x' }]} />,
        );
        const card = await findByTestId('answer-graph-v2');
        expect(card).toHaveAttribute('data-nodes', '6');
        expect(card).toHaveAttribute('data-refs', '1');
        expect(fetchAnswerGraphV2).toHaveBeenCalledWith({ historyId: '42', invocationId: 'inv-7', messageId: null });
        // Never both: the basic graph is not asked for.
        expect(fetchAnswerGraph).not.toHaveBeenCalled();
        expect(queryByTestId('graph-card')).toBeNull();
    });

    it.each([
        ['basic: true (an answer the backend has no answer graph for)', { graph: null, basic: true }],
        ['a null graph', { graph: null, basic: false }],
        ['any failure (dev before the endpoint exists)', { graph: null, basic: true }],
        ['a payload with nothing worth drawing', { graph: { nodes: [{ key: 'a' }], edges: [] }, basic: false }],
    ])('falls back to the basic graph on %s', async (_, result) => {
        fetchAnswerGraphV2.mockResolvedValue(result);
        const { findByTestId, queryByTestId } = render(<AnswerGraphForMessage {...saved} />);
        expect(await findByTestId('graph-card')).toBeInTheDocument();
        expect(fetchAnswerGraph).toHaveBeenCalledWith(LIST);
        expect(queryByTestId('answer-graph-v2')).toBeNull();
        expect(queryByTestId('answer-graph-building')).toBeNull();
    });

    it('draws nothing when it fails for an answer that had no basic graph', async () => {
        fetchAnswerGraphV2.mockResolvedValue({ graph: null, basic: true });
        const { container } = render(<AnswerGraphForMessage {...saved} basic={false} />);
        await waitFor(() => expect(fetchAnswerGraphV2).toHaveBeenCalled());
        await act(async () => {});
        expect(fetchAnswerGraph).not.toHaveBeenCalled();
        expect(container.textContent).toBe('');
    });

    it('is never asked for at Low or Medium, nor for a guest, nor in an unsaved conversation', async () => {
        for (const props of [
            { ...saved, effort: 'medium' },
            { ...saved, effort: 'low' },
            { ...saved, isGuest: true },
            { ...saved, historyId: null },
        ]) {
            const { findByTestId, unmount } = render(<AnswerGraphForMessage {...props} />);
            // eslint-disable-next-line no-await-in-loop
            expect(await findByTestId('graph-card')).toBeInTheDocument();
            unmount();
        }
        expect(fetchAnswerGraphV2).not.toHaveBeenCalled();
    });

    it('asks for an Investigate answer by its row — it has no invocation id', async () => {
        const { findByTestId } = render(
            <AnswerGraphForMessage {...saved} effort="extra" invocationId={null} messageId={88} />,
        );
        expect(await findByTestId('answer-graph-v2')).toBeInTheDocument();
        expect(fetchAnswerGraphV2).toHaveBeenCalledWith({ historyId: '42', invocationId: null, messageId: 88 });
    });

    it('waits for Saved\'s invocation id, then asks', async () => {
        const { rerender, findByTestId } = render(<AnswerGraphForMessage {...saved} invocationId={null} />);
        expect(fetchAnswerGraphV2).not.toHaveBeenCalled();
        expect(fetchAnswerGraph).not.toHaveBeenCalled();
        rerender(<AnswerGraphForMessage {...saved} />);
        expect(await findByTestId('answer-graph-v2')).toBeInTheDocument();
        expect(fetchAnswerGraph).not.toHaveBeenCalled();
    });

    it('draws the basic graph when no invocation id comes', async () => {
        jest.useFakeTimers();
        const { findByTestId } = render(<AnswerGraphForMessage {...saved} invocationId={null} />);
        act(() => { jest.advanceTimersByTime(4000); });
        jest.useRealTimers();
        expect(await findByTestId('graph-card')).toBeInTheDocument();
        expect(fetchAnswerGraphV2).not.toHaveBeenCalled();
    });

    it('says it is building only once the build takes visible time', async () => {
        jest.useFakeTimers();
        let resolve;
        fetchAnswerGraphV2.mockReturnValue(new Promise((r) => { resolve = r; }));
        const { queryByRole } = render(<AnswerGraphForMessage {...saved} />);
        expect(queryByRole('status')).toBeNull();
        act(() => { jest.advanceTimersByTime(1000); });
        expect(queryByRole('status')).toHaveTextContent('Building the knowledge graph…');
        await act(async () => { resolve({ graph: fixture.answer_graph, basic: false }); });
        expect(queryByRole('status')).toBeNull();
    });
});
