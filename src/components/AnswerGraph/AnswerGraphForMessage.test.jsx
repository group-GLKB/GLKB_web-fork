import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AnswerGraphForMessage from './AnswerGraphForMessage';
import { fetchAnswerGraph, fetchAnswerGraphForText } from '../../service/answerGraph';

jest.mock('../../service/answerGraph', () => ({ fetchAnswerGraph: jest.fn(), fetchAnswerGraphForText: jest.fn() }));
// The card itself draws with cytoscape; what is pinned here is which request is made.
jest.mock('.', () => ({ __esModule: true, default: () => <div data-testid="graph-card" /> }));

const GRAPH = { nodes: [{ id: 'a' }, { id: 'b' }], edges: [] };
const LIST = ['WITH ["hgnc:1", "hgnc:2"] AS node_ids MATCH (n) RETURN n'];

beforeEach(() => {
    fetchAnswerGraph.mockReset().mockResolvedValue(GRAPH);
    fetchAnswerGraphForText.mockReset().mockResolvedValue(GRAPH);
});

it('draws from the answer\'s list when it has one', async () => {
    const { findByTestId } = render(<AnswerGraphForMessage kgQueryList={LIST} answer="text" />);
    expect(await findByTestId('graph-card')).toBeInTheDocument();
    expect(fetchAnswerGraph).toHaveBeenCalledWith(LIST);
    expect(fetchAnswerGraphForText).not.toHaveBeenCalled();
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
