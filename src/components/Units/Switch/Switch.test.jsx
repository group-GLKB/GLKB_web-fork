/**
 * The toggle, against Figma 244:5052 (off) and 244:5056 (on).
 *
 * As with the context menu, the value of writing these down is less that 28x16 is right than
 * that there is one place it is written: the two in Settings were MUI's `size="small"`, which
 * is a different shape from both the default and the design.
 */
import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Switch } from './index';

/** `sx` compiles to emotion classes, so the values live in an injected stylesheet. */
const rulesFor = (element) => {
    const own = [...element.classList].filter((name) => name.startsWith('css-'));
    const found = [];
    [...document.styleSheets].forEach((sheet) => {
        let rules = [];
        try { rules = [...(sheet.cssRules || [])]; } catch (error) { return; }
        rules.forEach((rule) => {
            if (rule.selectorText && own.some((name) => rule.selectorText.includes(name))) {
                found.push({ selector: rule.selectorText, css: rule.cssText || '' });
            }
        });
    });
    return found;
};

const declaring = (element, needle) => rulesFor(element)
    .filter(({ css }) => css.includes(needle));

const root = () => document.querySelector('.MuiSwitch-root');

describe('the track', () => {
    it('is 28 by 16 with a radius/2 corner', () => {
        render(<Switch />);
        const css = rulesFor(root()).map((r) => r.css).join(' ');
        expect(css).toContain('width: 28px');
        expect(css).toContain('height: 16px');
        expect(declaring(root(), 'var(--radius-2, 8px)').length).toBeGreaterThan(0);
    });

    it('is background/normal when off and brand/primary when on', () => {
        render(<Switch />);
        expect(declaring(root(), 'var(--color-background-normal)').length).toBeGreaterThan(0);
        const checked = declaring(root(), 'var(--color-brand-primary)');
        expect(checked.some(({ selector }) => selector.includes('Mui-checked'))).toBe(true);
    });

    /** MUI dims an unchecked track to 0.38; the design's colour is the colour. */
    it('is drawn at full opacity', () => {
        render(<Switch />);
        expect(rulesFor(root()).map((r) => r.css).join(' ')).toContain('opacity: 1');
    });
});

describe('the thumb', () => {
    it('is 12 square, in background/surface, and flat', () => {
        render(<Switch />);
        const css = rulesFor(root()).map((r) => r.css).join(' ');
        expect(css).toContain('width: 12px');
        expect(css).toContain('height: 12px');
        expect(declaring(root(), 'var(--color-background-surface)').length).toBeGreaterThan(0);
        expect(css).toContain('box-shadow: none');
    });

    /**
     * 28 wide, less the 12 of thumb and the 2 of padding on each side, is 12 of travel. Getting
     * this wrong does not look broken — the thumb simply stops short of, or past, the end.
     */
    it('travels the 12 between its two paddings', () => {
        render(<Switch />);
        const moved = declaring(root(), 'translateX(12px)');
        expect(moved.some(({ selector }) => selector.includes('Mui-checked'))).toBe(true);
        expect(rulesFor(root()).map((r) => r.css).join(' ')).toContain('padding: 2px');
    });
});

describe('behaviour', () => {
    it('reports its state through a real checkbox', () => {
        render(<Switch checked readOnly inputProps={{ 'aria-label': 'Email' }} />);
        const input = document.querySelector('input[type="checkbox"]');
        expect(input).toBeChecked();
        expect(input).toHaveAttribute('aria-label', 'Email');
    });

    it('has no ripple — it would be larger than the control', () => {
        render(<Switch />);
        expect(document.querySelector('.MuiTouchRipple-root')).toBeNull();
    });

    it('lets a caller add to the style without losing the design', () => {
        render(<Switch sx={{ marginLeft: '4px' }} />);
        const css = rulesFor(root()).map((r) => r.css).join(' ');
        expect(css).toContain('margin-left: 4px');
        expect(css).toContain('width: 28px');
    });
});
