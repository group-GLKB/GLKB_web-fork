/**
 * Which pipeline a follow-up from the chat page's composer goes to.
 *
 * Investigate is the conversation's mode, fixed when it starts on the home composer's tabs: every
 * follow-up in an Investigate conversation is deep research, every other one is the chat agent.
 * (From 2026-10-27 to 2026-11-01 it was a per-question "effort" picked in the composer instead;
 * the product owner restored the mode.)
 *
 * The decision is a few props and one options bag inside a component of several thousand lines
 * with a live stream behind it, so it is asserted in the source, as queueOwnership.wiring.test.js
 * does; what the bar does with the props is covered behaviourally in ChatSearchBar.test.jsx, and
 * how the conversation's mode is resolved in conversationMode.test.js.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');
const callSite = (() => {
    const start = source.indexOf('<ChatSearchBar');
    const end = source.indexOf('/>', source.indexOf('onStop={handleStopStreaming}', start));
    return source.slice(start, end);
})();

describe("the chat page's composer", () => {
    it("takes the conversation's mode, resolved for the conversation on screen", () => {
        expect(source).toContain(
            'const chatInvestigateEnabled = getConversationInvestigateMode(activeConversationId, chatHistory);',
        );
        expect(callSite).toContain('investigateEnabled={chatInvestigateEnabled}');
        expect(callSite).toContain('pipelineIsDeepResearch={chatInvestigateEnabled}');
    });

    it("sends each follow-up to the conversation's pipeline", () => {
        expect(callSite).toContain('const deep = chatInvestigateEnabled;');
        expect(callSite).toMatch(/submitOrQueue\(event, \{\s*investigateEnabled: deep,\s*serviceTier,/);
    });

    it('sends the Options choices to Chat only: deep research takes no filters and does both tools', () => {
        expect(callSite).toContain('const flags = answerFlags(composerOptions, deep);');
        expect(callSite).toMatch(/\.\.\.\(deep \? \{\} : \{\s*\.\.\.searchFilters\(composerOptions\),/);
    });

    it('has no effort: nothing picks it, and nothing could send it', () => {
        expect(source).not.toMatch(/effortLevels|EffortPicker|composerEffort/);
        expect(callSite).not.toMatch(/effort/i);
    });
});
