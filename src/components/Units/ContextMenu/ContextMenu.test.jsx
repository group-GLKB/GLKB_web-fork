/** The shared item-options menu, against Figma 176:12870. */
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
    it('is a bordered 8px subtle card without outer padding', () => {
        setup();
        const style = styleOf(paper());
        expect(style['border-radius']).toBe('var(--radius-2, 8px)');
        expect(style.border).toBe('1px solid var(--color-border-default)');
        expect(style.padding).toBe('0px');
        expect(style['background-color']).toBe('var(--color-background-subtle)');
    });

    it('casts no shadow', () => {
        setup();
        expect(styleOf(paper())['box-shadow']).toBe('none');
    });

    it('sets no minimum width of its own', () => {
        setup();
        expect(styleOf(paper())['min-width']).not.toBe('176px');
    });

    it('removes MUI list padding', () => {
        setup();
        expect(styleOf(document.querySelector('.MuiList-root')).padding).toBe('0px');
    });
});

describe('a row', () => {
    it('is 38 tall, with 16 by 8 padding, 8 of gap and a 4 radius', () => {
        setup();
        const style = styleOf(items()[0]);
        expect(style.height).toBe('38px');
        expect(style['min-height']).toBe('38px');
        expect(style.padding).toBe('8px 16px');
        expect(style.gap).toBe('8px');
        expect(style['border-radius']).toBe('var(--radius-1, 4px)');
    });

    it('reads as 14/22 body text in Geist', () => {
        setup();
        const label = styleOf(items()[0].querySelector('.MuiTypography-root'));
        expect(label['font-size']).toBe('14px');
        expect(label['line-height']).toBe('22px');
        expect(label['font-weight']).toBe('400');
        expect(label['font-family']).toContain('Geist');
    });

    it('is secondary text by default', () => {
        setup();
        const label = styleOf(items()[0].querySelector('.MuiTypography-root'));
        expect(label.color).toBe('var(--color-text-secondary)');
    });

    it('uses the normal background for the interactive state', () => {
        setup();
        expect(styleOf(items()[0], ':hover')['background-color'])
            .toBe('var(--color-background-normal)');
    });

    it('uses a fixed 16px icon without MUI\'s reserved gutter', () => {
        setup();
        const icon = items()[0].querySelector('.MuiListItemIcon-root');
        expect(Number.parseFloat(window.getComputedStyle(icon).minWidth)).toBe(0);
        expect(styleOf(icon).width).toBe('16px');
        expect(styleOf(icon).height).toBe('16px');
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
