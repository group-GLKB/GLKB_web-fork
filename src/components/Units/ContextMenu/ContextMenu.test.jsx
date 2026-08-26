/**
 * The item options menu, against Figma 176:8771.
 *
 * These numbers are small and there are a lot of them, which is exactly how five copies of this
 * menu came to disagree about all of them. The point of the test is less that 20 is right than
 * that there is now one place where it is written down.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';

import { ContextMenu, ContextMenuItem } from './index';

const setup = () => render(
    <ContextMenu anchorEl={document.body} open onClose={() => {}}>
        <ContextMenuItem icon={<DriveFileRenameOutlineIcon />}>Rename</ContextMenuItem>
        <ContextMenuItem icon={<DeleteOutlineIcon />} danger>Delete</ContextMenuItem>
    </ContextMenu>,
);

const paper = () => document.querySelector('.MuiMenu-paper');
const items = () => [...document.querySelectorAll('.MuiMenuItem-root')];

/**
 * `sx` compiles to emotion classes rather than inline styles, so the values live in an injected
 * stylesheet. This reads the declarations back off the rules that target an element's own
 * generated class — which is also the only way to see a value written as a var(), since jsdom
 * has no token definitions to resolve one against.
 */
const styleOf = (element, pseudo = '') => {
    const own = [...element.classList].filter((name) => name.startsWith('css-'));
    const declarations = {};
    [...document.styleSheets].forEach((sheet) => {
        let rules = [];
        try { rules = [...(sheet.cssRules || [])]; } catch (error) { return; }
        rules.forEach((rule) => {
            const selector = rule.selectorText || '';
            if (!own.some((name) => selector.includes(name))) return;
            const wantsPseudo = selector.includes(':hover') || selector.includes('.Mui-selected');
            if (pseudo ? !selector.includes(pseudo) : wantsPseudo) return;
            // jsdom's CSSStyleDeclaration is neither iterable nor indexable here, so the
            // declarations are read out of the rule's own text.
            const body = (rule.cssText || '').replace(/^[^{]*\{|\}$/g, '');
            body.split(';').forEach((declaration) => {
                const at = declaration.indexOf(':');
                if (at < 0) return;
                declarations[declaration.slice(0, at).trim()] = declaration.slice(at + 1).trim();
            });
        });
    });
    return declarations;
};

describe('the popover', () => {
    it('is a bordered 8px card with 4 of padding', () => {
        setup();
        const style = styleOf(paper());
        expect(style['border-radius']).toBe('var(--radius-2, 8px)');
        expect(style.border).toBe('1px solid var(--color-border-default)');
        expect(style.padding).toBe('4px');
        expect(style['background-color']).toBe('var(--color-background-surface)');
    });

    /** The frame draws none. A shadow under a 20px row reads as a mistake, not elevation. */
    it('casts no shadow', () => {
        setup();
        expect(styleOf(paper())['box-shadow']).toBe('none');
    });

    /**
     * It shrinks to its labels. The copies this replaces forced a 176px floor on a menu whose
     * widest label is "Remove bookmark"; what remains is MUI's own 16px, which constrains
     * nothing.
     */
    it('sets no minimum width of its own', () => {
        setup();
        expect(styleOf(paper())['min-width']).not.toBe('176px');
    });

    it('lets the paper own the padding, not the list', () => {
        setup();
        expect(styleOf(document.querySelector('.MuiList-root')).padding).toBe('0px');
    });
});

describe('a row', () => {
    it('is 20 tall, with 4 of padding, 4 of gap and a 4 radius', () => {
        setup();
        const style = styleOf(items()[0]);
        expect(style.height).toBe('20px');
        expect(style['min-height']).toBe('20px');
        expect(style.padding).toBe('0 4px');
        expect(style.gap).toBe('4px');
        expect(style['border-radius']).toBe('var(--radius-1, 4px)');
    });

    it('reads as caption text in Geist', () => {
        setup();
        const label = styleOf(items()[0].querySelector('.MuiTypography-root'));
        expect(label['font-size']).toBe('10px');
        expect(label['line-height']).toBe('12px');
        expect(label['font-weight']).toBe('400');
        expect(label['font-family']).toContain('Geist');
    });

    it('is secondary text by default', () => {
        setup();
        const label = styleOf(items()[0].querySelector('.MuiTypography-root'));
        expect(label.color).toBe('var(--color-text-secondary)');
    });

    /**
     * The gutter is the 4px gap. MUI's default ListItemIcon reserves 56px, which is most of why
     * the old copies were so much wider than the frame.
     */
    it('gives the icon no gutter of its own', () => {
        setup();
        expect(styleOf(items()[0].querySelector('.MuiListItemIcon-root'))['min-width']).toBe('0');
    });
});

describe('a destructive row', () => {
    it('colours its label and its icon alike', () => {
        setup();
        const del = items()[1];
        expect(styleOf(del.querySelector('.MuiTypography-root')).color)
            .toBe('var(--color-status-error-text)');
        expect(styleOf(del.querySelector('.MuiListItemIcon-root')).color)
            .toBe('var(--color-status-error-text)');
    });

    it('is still just a row — no divider is drawn above it', () => {
        setup();
        expect(document.querySelectorAll('.MuiDivider-root')).toHaveLength(0);
    });
});

describe('what it renders', () => {
    it('shows each child as a row', () => {
        setup();
        expect(screen.getByText('Rename')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
        expect(items()).toHaveLength(2);
    });

    it('takes a row with no icon', () => {
        render(
            <ContextMenu anchorEl={document.body} open onClose={() => {}}>
                <ContextMenuItem>Bare</ContextMenuItem>
            </ContextMenu>,
        );
        expect(screen.getByText('Bare')).toBeInTheDocument();
        expect(document.querySelectorAll('.MuiListItemIcon-root')).toHaveLength(0);
    });
});
