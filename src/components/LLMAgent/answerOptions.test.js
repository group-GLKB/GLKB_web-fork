import { answerOptionsForTurn } from './answerOptions';
import { answerOptionsOf, frameToUpdate } from '../../service/LLMAgent';
import { replayTrace } from './traceReplay';

describe("AI Chat's answer options (figures, graph)", () => {
    it('reads only the two known options, and only when true', () => {
        expect(answerOptionsOf({ figures: true, graph: 'yes', other: true })).toEqual({ figures: true });
        expect(answerOptionsOf(null)).toEqual({});
        expect(frameToUpdate({ step: 'Complete', response: 'a', answer_options: { graph: true } }).answerOptions)
            .toEqual({ graph: true });
        expect(frameToUpdate({ step: 'Complete', response: 'a' }).answerOptions).toEqual({});
    });

    it("a new conversation takes the composer's choice; a follow-up takes the conversation's", () => {
        expect(answerOptionsForTurn({ filters: [], figures: true }, [], false)).toEqual({ figures: true });
        const history = [
            { role: 'user', content: 'q1' },
            { role: 'assistant', content: 'a1', answerOptions: { graph: true } },
            { role: 'user', content: 'q2' },
        ];
        expect(answerOptionsForTurn({ investigateEnabled: false, serviceTier: 'standard' }, history, false))
            .toEqual({ graph: true });
        expect(answerOptionsForTurn(null, [], false)).toEqual({});
    });

    it('Investigate is sent neither', () => {
        expect(answerOptionsForTurn({ figures: true, graph: true }, [], true)).toEqual({});
    });

    it('a reopened answer gets back what its turn asked for', () => {
        const trace = {
            v: 1, mode: 'chat', complete: true, duration_ms: 1000,
            frames: [
                { step: 'Processing', content: 'Searching' },
                { step: 'Complete', answer_options: { graph: true }, kg_query_list: ['WITH [] AS node_ids RETURN 1'] },
            ],
        };
        const out = replayTrace(trace);
        expect(out.answerOptions).toEqual({ graph: true });
        expect(out.kgQueryList).toEqual(['WITH [] AS node_ids RETURN 1']);
        expect(replayTrace({ ...trace, frames: [trace.frames[0], { step: 'Complete' }] }).answerOptions)
            .toBeUndefined();
    });
});
