/**
 * The Quick chip in the chat composer.
 *
 * Offered only when the agent's catalogue lists the level for chat; withdrawn on an Investigate
 * conversation, where deep research would refuse it; and, while on, it locks the model picker
 * onto the model the level fixes — the reader can see what Quick will run on, and the request
 * sends no model of its own.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChatSearchBar from './ChatSearchBar';

jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../service/models', () => ({
    ...jest.requireActual('../../service/models'),
    fetchModelCatalog: () => Promise.resolve({
        models: [
            { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', short_label: '5.6 Terra', description: 'Balanced.', pipelines: ['chat', 'deep_research'] },
            { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', short_label: '5.6 Luna', description: 'Fastest.', pipelines: ['chat'] },
        ],
        defaultModel: 'gpt-5.6-terra',
        defaultsByPipeline: { chat: 'gpt-5.6-terra', deep_research: 'gpt-5.6-terra' },
        efforts: [],
        defaultEffort: 'standard',
    }),
}));

const EFFORTS = [
    { id: 'quick', label: 'Quick', short_label: 'Quick', description: 'Seconds.', pipelines: ['chat'], model: 'gpt-5.6-luna', max_tool_rounds: 2 },
    { id: 'standard', label: 'Standard', short_label: 'Standard', description: 'Half a minute.', pipelines: ['chat', 'deep_research'], model: null, max_tool_rounds: null },
];

beforeAll(() => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
});

const setup = (props = {}) => {
    const onEffortChange = jest.fn();
    render(
        <ChatSearchBar
            userInput=""
            setUserInput={() => {}}
            isLoading={false}
            onSubmit={() => {}}
            onStop={() => {}}
            model="gpt-5.6-terra"
            onModelChange={() => {}}
            onModelResolveDefault={() => {}}
            efforts={EFFORTS}
            onEffortChange={onEffortChange}
            {...props}
        />,
    );
    return { onEffortChange };
};

const quickChip = () => screen.queryByRole('button', { name: /^quick (on|off)$/i });
const modelChip = () => screen.getByRole('button', { name: /^Model:/ });

it('offers Quick when the catalogue lists it for chat', () => {
    setup();
    expect(quickChip()).toBeInTheDocument();
    expect(quickChip()).toHaveAttribute('aria-pressed', 'false');
});

it('is not offered when the agent lists no levels', () => {
    // An agent older than this build sends no `efforts`; a chip whose field it would ignore
    // is a promise the product cannot keep.
    setup({ efforts: [] });
    expect(quickChip()).not.toBeInTheDocument();
});

it('is withdrawn on an Investigate conversation, where deep research refuses it', () => {
    setup({ pipelineIsDeepResearch: true });
    expect(quickChip()).not.toBeInTheDocument();
});

it('reports the level on a click, and clears it on the next', () => {
    const { onEffortChange } = setup();
    fireEvent.click(quickChip());
    expect(onEffortChange).toHaveBeenLastCalledWith('quick');

    // Re-render with the level on, as the parent would after storing it.
    const { onEffortChange: second } = setup({ effort: 'quick' });
    fireEvent.click(screen.getAllByRole('button', { name: /^quick on$/i })[0]);
    expect(second).toHaveBeenLastCalledWith('');
});

it("locks the model picker onto the level's model while Quick is on", async () => {
    setup({ effort: 'quick' });
    await waitFor(() => expect(modelChip()).toHaveAccessibleName('Model: GPT-5.6 Luna'));
    expect(modelChip()).toBeDisabled();
});

it("gives the picker back, with the reader's own model, when Quick is off", async () => {
    setup({ effort: '' });
    await waitFor(() => expect(modelChip()).toHaveAccessibleName('Model: GPT-5.6 Terra'));
    expect(modelChip()).not.toBeDisabled();
});
