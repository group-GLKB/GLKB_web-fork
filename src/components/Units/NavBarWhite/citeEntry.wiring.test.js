/**
 * GLKB Cite has a fixed place in the app's sidebar: pinned at the bottom, above the account row.
 *
 * Its other ways in (the news strip, the footers) can be closed or sit below the fold, so the
 * reader could not find it from the chat. The pinned area is outside the scrolling list of
 * recent conversations, so the entry is there however long that list grows.
 *
 * NavBarWhite is a few thousand lines behind a router, a theme and four contexts; as in
 * recentLimit.wiring.test.js, where the entry is rendered is asserted in the source.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');

describe('the GLKB Cite entry in the sidebar', () => {
    it('opens the Cite page, under the name the rest of the site uses, with the app icon', () => {
        expect(source).toMatch(/label: 'GLKB Cite for Mac',\s*to: CITE_PAGE_PATH,/);
        expect(source).toContain("import { CITE_PAGE_PATH } from '../../../config/citeApp';");
        expect(source).toContain("import citeAppIcon from '../../../img/cite/app-icon.png';");
    });

    it('is drawn once, in the pinned area at the bottom, not in the scrolling list', () => {
        expect(source.match(/renderNavItem\(citeItem\)/g)).toHaveLength(1);
        const pinned = source.indexOf("<Box sx={{ mt: 'auto'");
        const scroll = source.indexOf('<Box className="sidebar-scroll">');
        const entry = source.indexOf('renderNavItem(citeItem)');
        expect(pinned).toBeGreaterThan(scroll);
        expect(entry).toBeGreaterThan(pinned);
        // ...and above the account row, which is the last thing in the pinned area.
        expect(entry).toBeLessThan(source.indexOf('renderNavItem({ ...loginItem'));
    });
});
