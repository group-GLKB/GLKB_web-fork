/**
 * GLKB Cite, the Mac menu-bar app: the one place that names the build offered for download.
 *
 * The disk image is a plain file under public/downloads/, so it is served as itself and the
 * router never sees it. To ship a new build: add the new .dmg there, delete the old one, and
 * change VERSION, FILE and SIZE_LABEL here. The page (components/CitePage), the About section
 * and the article link all read from this file.
 *
 * 0.2.0 (build 12) is signed "Developer ID Application: University of Michigan" and notarized
 * by Apple, so it opens with an ordinary double-click.
 */
export const CITE_APP = {
    name: 'GLKB Cite',
    version: '0.2.0',
    file: 'GLKB-Cite-0.2.0.dmg',
    sizeLabel: '2.8 MB',
    minMacOS: 'macOS 13 Ventura',
    released: 'November 2026',
};

export const CITE_PAGE_PATH = '/cite';
export const CITE_GUIDE_PATH = '/blog/glkb-cite';
export const CITE_DOWNLOAD_URL = `${process.env.PUBLIC_URL || ''}/downloads/${CITE_APP.file}`;
