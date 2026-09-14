/**
 * The Quick control is hidden in the chat composer. Existing effort/model behavior
 * remains unchanged; model selection and normal submission stay available.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
    { id: 'quick', label: 'Quick', short_label: 'Quick', description: 'Seconds.', pipelines: ['chat'], default_model: 'gpt-5.6-luna', max_tool_rounds: 2 },
    { id: 'standard', label: 'Standard', short_label: 'Standard', description: 'Half a minute.', pipelines: ['chat', 'deep_research'], default_model: null, max_tool_rounds: null },
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

it('hides Quick even when the catalogue lists it for chat', () => {
    setup();
    expect(quickChip()).not.toBeInTheDocument();
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

it('also hides Quick when an existing preference is enabled', () => {
    const { onEffortChange } = setup({ effort: 'quick' });
    expect(quickChip()).not.toBeInTheDocument();
    expect(onEffortChange).not.toHaveBeenCalled();
});

it("shows the level's default model while Quick is on, and leaves it selectable", async () => {
    // `model: ''` is a reader who has chosen nothing — the only case a default applies to.
    setup({ effort: 'quick', model: '' });
    await waitFor(() => expect(modelChip()).toHaveAccessibleName('Model: GPT-5.6 Luna'));
    // Operable: "Quick with the best model" is a request the agent honours, so the reader
    // must be able to make it.
    expect(modelChip()).not.toBeDisabled();
});

it("keeps a model the reader chose, rather than overriding it with the level's default", async () => {
    setup({ effort: 'quick', model: 'gpt-5.6-terra' });
    await waitFor(() => expect(modelChip()).toHaveAccessibleName('Model: GPT-5.6 Terra'));
});

it('falls back to the pipeline default when no level is on', async () => {
    setup({ effort: '', model: '' });
    await waitFor(() => expect(modelChip()).toHaveAccessibleName('Model: GPT-5.6 Terra'));
    expect(modelChip()).not.toBeDisabled();
});
