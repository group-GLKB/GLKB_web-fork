/**
 * Captures a real rendered History row — markup *and* the emotion rules MUI
 * generates for it — so e2e/scripts/measure-library-history-settings.mjs can
 * measure the shape the component actually produces.
 *
 * The emotion half is the point. MUI writes `.MuiButtonBase-root { position:
 * relative }` into <head> at runtime, after the project stylesheet, and at equal
 * specificity that beats `.history-row-checkbox { position: absolute }`. A
 * hand-written `<span class="history-row-checkbox">` in the harness has no such
 * competitor, so it measured as absolutely positioned while the real checkbox
 * dropped into flow and stacked above the row.
 *
 * Refresh with UPDATE_FIXTURES=1.
 */
import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';

import { ReactComponent as ChatIcon } from '../../../img/llm/chat_message.svg';
import ConversationCard from './index';

const FIXTURE = path.join(__dirname, '../../../../e2e/fixtures/history-row.html');

const conversation = {
    id: 'c1',
    leadingTitle: 'Interferons are key cytokines acting on pancreatic islets in type 1 diabetes.',
    messageCount: 5,
    updatedAt: Date.now(),
};

// Every emotion rule injected into <head>, in insertion order — which is the
// order the browser resolves them in, after the project stylesheet.
const collectEmotionCss = () => Array.from(document.querySelectorAll('style[data-emotion]'))
    .map((tag) => (tag.sheet
        ? Array.from(tag.sheet.cssRules).map((rule) => rule.cssText).join('\n')
        : tag.textContent))
    .filter(Boolean)
    .join('\n');

describe('ConversationCard geometry fixture', () => {
    it('matches the committed fixture the measurement script reads', () => {
        const { container } = render(
            <>
                <ConversationCard
                    conversation={conversation}
                    title={conversation.leadingTitle}
                    leadingIcon={<ChatIcon />}
                    selectMode
                    isSelected={false}
                    onToggleSelect={() => {}}
                    onOpen={() => {}}
                    footerContent={(
                        <div className="history-card-meta">
                            <span>Just now</span>
                            <span className="history-card-meta-sep">·</span>
                            <span>5 Messages</span>
                        </div>
                    )}
                />
            </>,
        );

        const dump = `<style id="emotion">\n${collectEmotionCss()}\n</style>\n${container.innerHTML}`;

        if (process.env.UPDATE_FIXTURES) {
            fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
            fs.writeFileSync(FIXTURE, dump);
        }
        // Line endings are git's business, not the markup's — .gitattributes keeps
        // this file LF, and normalising here means a checkout that ignores it still
        // reports real changes rather than every line at once.
        const fixture = fs.readFileSync(FIXTURE, 'utf8').replace(/\r\n/g, '\n');
        if (dump !== fixture) {
            throw new Error(
                'The rendered History row changed, so measure-library-history-settings.mjs is '
                + `measuring a stale shape. Refresh ${FIXTURE} by re-running this test with `
                + 'UPDATE_FIXTURES=1, then re-run the measurement.',
            );
        }
        expect(dump).toBe(fixture);
    });

    // There is deliberately no cascade assertion here: CRA stubs CSS imports under
    // jest, so scoped.css never loads and jsdom only ever sees the emotion rules.
    // The cascade is asserted in e2e/scripts/measure-library-history-settings.mjs,
    // which loads this fixture over the real stylesheet in the browser's order.
});
