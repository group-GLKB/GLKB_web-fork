/**
 * How the chat page joins the side chat (SideChatPanel.jsx, service/sideChat.js).
 *
 * The panel, the request and the Ask in side chat button are covered behaviourally in
 * SideChatPanel.test.jsx, sideChat.test.js and SelectionReply.test.jsx. The glue sits inside a
 * component of several thousand lines with a live stream behind it, so it is asserted in the
 * source, as the other wiring tests do.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');
const features = readFileSync(join(__dirname, '../../config/features.js'), 'utf-8');
const between = (start, end) => {
    const from = source.indexOf(start);
    expect(from).toBeGreaterThan(-1);
    return source.slice(from, source.indexOf(end, from));
};

describe('the side chat on the chat page', () => {
    it('is held off glkb.org, and offered only when the backend says it is on', () => {
        expect(features).toContain('export const SIDE_CHAT_ENABLED = !isProductionSite();');
        const gate = between('const sideChatAvailable = SIDE_CHAT_ENABLED', ';');
        expect(gate).toContain('sideChatPricing?.sideChat?.enabled');
        expect(gate).toContain('(!isGuest || Boolean(sideChatPricing?.sideChat?.guest))');
        expect(gate).toContain('chatHistory.length > 0');
    });

    it('has a Side chat button at the top right of the conversation, beside References', () => {
        const header = between('<Box className="llm-header-actions">', '</Box>\n                                                    </Box>');
        expect(header).toContain('{sideChatAvailable && (');
        expect(header).toContain("onClick={() => toggleSideChat('button')}");
        expect(header).toContain('aria-pressed={sideChatShown}');
        expect(header).toContain('aria-keyshortcuts="Meta+; Control+;"');
        expect(header.indexOf('llm-header-side-chat')).toBeLessThan(header.indexOf('llm-header-references-toggle'));
        // References bring the right pane back from the side chat.
        expect(header).toContain('(useMobileReferencesDrawer || isReferencesCollapsed || sideChatShown)');
        expect(header).toMatch(/closeSideChat\(\);\s*expandReferences\(\);/);
    });

    it('opens and closes with ⌘; / Ctrl+; while the chat is on screen', () => {
        const shortcut = between('// ⌘; / Ctrl+; opens and closes it', '}, [isRouteActive, toggleSideChat]);');
        expect(shortcut).toContain("window.addEventListener('keydown', onKeyDown);");
        expect(shortcut).toContain('if (!isSideChatShortcut(event) || !sideChatAvailableRef.current) return;');
        expect(shortcut).toContain('event.preventDefault();');
        expect(shortcut).toContain("window.removeEventListener('keydown', onKeyDown);");
    });

    it('offers Ask in side chat over a selection, and opens the panel with the passage quoted', () => {
        const mount = between('<SelectionReply', '/>');
        expect(mount).toContain('onAskSideChat={sideChatAvailable ? handleAskSideChat : undefined}');
        const handler = between('const handleAskSideChat = useCallback(', '}, [openSideChat]);');
        expect(handler).toContain('setSideChatSeed({ quote, at: Date.now() });');
        expect(handler).toContain("openSideChat('selection');");
    });

    it('sits beside the thread on a desktop, in the right pane, and in a bottom sheet on a phone', () => {
        expect(source).toContain('flex: useMobileReferencesDrawer || isReferencesCollapsed || sideChatShown');
        expect(source).toMatch(/\{!useMobileReferencesDrawer && sideChatShown && \(\s*<div className="side-chat-column-wrap">\s*<SideChatPanel \{\.\.\.sideChatPanelProps\} variant="column" \/>/);
        expect(source).toContain('{!useMobileReferencesDrawer && !isReferencesCollapsed && !sideChatShown && (');
        const sheet = between('open={sideChatShown}', '</Drawer>');
        expect(sheet).toContain('onClose={closeSideChat}');
        expect(sheet).toContain('<SideChatPanel {...sideChatPanelProps} variant="sheet" />');
    });

    it('reads the conversation when a question is sent, a running turn and its progress included', () => {
        const context = between('sideChatContextRef.current = () => sideChatContext({', '});\n');
        expect(context).toContain('messages: chatHistory');
        expect(context).toContain('historyId: activeConversationIdRef.current || activeConversationId');
        expect(context).toContain('running: sideChatRunning');
        expect(context).toContain('groups: streamingGroups');
        expect(source).toContain('const sideChatRunning = Boolean(isViewingRunningConversation && isProcessing);');
        // The same model as the conversation: the composer's tier.
        expect(source).toContain("const sideChatTier = effectiveTier(serviceTier, { isGuest }) || sideChatPricing?.defaultTier || '';");
    });

    it('is thrown away when the reader leaves the conversation', () => {
        const reset = between('const sideChatConversationRef = useRef(activeConversationId);', '}, [activeConversationId, closeSideChat]);');
        expect(reset).toContain("if (previous != null && String(previous) !== String(activeConversationId ?? '')) {");
        expect(reset).toContain('closeSideChat();');
    });

    it('leaves the composer, the effort picker and the answer graph as they were', () => {
        const composer = between('<ChatSearchBar', 'onStop={handleStopStreaming}');
        expect(composer).not.toContain('sideChat');
        expect(between('<MessageCard', '/>')).not.toContain('sideChat');
    });
});
