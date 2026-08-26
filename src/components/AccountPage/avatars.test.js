/**
 * The backend stores only the index of the preset the user picked, so this
 * list's order is data, not presentation: renumbering it changes the picture
 * of everyone who already chose. These checks are here to make that loud.
 */
import { AVATARS, avatarById } from './avatars';

describe('preset profile pictures', () => {
    it('is exactly the sixteen the contract allows, numbered 1..16 in order', () => {
        expect(AVATARS.map((avatar) => avatar.id)).toEqual(
            Array.from({ length: 16 }, (_, index) => index + 1),
        );
    });

    it('gives every preset its own artwork', () => {
        const glyphs = new Set(AVATARS.map((avatar) => avatar.glyph));
        expect(glyphs.size).toBe(16);
    });

    it('fills every tile from the node palette', () => {
        AVATARS.forEach((avatar) => {
            expect(avatar.fill).toMatch(/^var\(--color-node-[a-z-]+-fill\)$/);
        });
    });

    it('looks presets up by id, and answers null for none', () => {
        expect(avatarById(7).id).toBe(7);
        expect(avatarById(null)).toBeNull();
        expect(avatarById(17)).toBeNull();
    });
});
