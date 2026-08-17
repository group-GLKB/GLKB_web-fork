/**
 * The two articles, from Figma 707:2703 (GLKB) and 732:8445 (Investigate).
 *
 * The prose lives in content/*.md — see markdown.js for the dialect. This file
 * only turns those files into post objects and resolves the image names the
 * markdown refers to, so the index page can read a post's metadata without
 * rendering the article.
 */
import glkb01 from '../../img/blog/glkb-01-two-kinds.png';
import glkb02 from '../../img/blog/glkb-02-funnel.png';
import glkb03 from '../../img/blog/glkb-03-schema.png';
import glkb04 from '../../img/blog/glkb-04-retrieval.png';
import glkb05 from '../../img/blog/glkb-05-rfx6.png';
import glkb06 from '../../img/blog/glkb-06-investigate.png';
import inv01 from '../../img/blog/inv-01-pipeline.png';
import inv02 from '../../img/blog/inv-02-architecture.png';
import inv03 from '../../img/blog/inv-03-retrieval.png';
import inv04 from '../../img/blog/inv-04-funnel.png';
import inv05 from '../../img/blog/inv-05-claim-centric.png';
import inv06 from '../../img/blog/inv-06-verification.png';
import inv07 from '../../img/blog/inv-07-report-anatomy.png';
import inv08 from '../../img/blog/inv-08-positioning.png';
import inv09 from '../../img/blog/inv-09-search-mode.png';

import glkbArticle from './content/glkb-knowledge-graph.md';
import investigateArticle from './content/investigate-auditable-research.md';
import { parseArticle } from './markdown';

/** Markdown names an image by file name; webpack knows it by URL. */
export const IMAGES = {
    'glkb-01-two-kinds.png': glkb01,
    'glkb-02-funnel.png': glkb02,
    'glkb-03-schema.png': glkb03,
    'glkb-04-retrieval.png': glkb04,
    'glkb-05-rfx6.png': glkb05,
    'glkb-06-investigate.png': glkb06,
    'inv-01-pipeline.png': inv01,
    'inv-02-architecture.png': inv02,
    'inv-03-retrieval.png': inv03,
    'inv-04-funnel.png': inv04,
    'inv-05-claim-centric.png': inv05,
    'inv-06-verification.png': inv06,
    'inv-07-report-anatomy.png': inv07,
    'inv-08-positioning.png': inv08,
    'inv-09-search-mode.png': inv09,
};

export const posts = [investigateArticle, glkbArticle].map(parseArticle);

export const getPost = (slug) => posts.find((post) => post.slug === slug) || null;

export default posts;
