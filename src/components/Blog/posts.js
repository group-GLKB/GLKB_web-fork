/**
 * The two articles, from Figma 707:2703 (GLKB) and 732:8445 (Investigate).
 *
 * The prose lives in content/*.md — see markdown.js for the dialect. This file
 * only turns those files into post objects and resolves the image names the
 * markdown refers to, so the index page can read a post's metadata without
 * rendering the article.
 */
import glkb01 from '../../img/blog/glkb-01-layers.svg';
import glkb02 from '../../img/blog/glkb-02-funnel.svg';
import glkb03 from '../../img/blog/glkb-03-schema.svg';
import glkb04 from '../../img/blog/glkb-04-retrieval.svg';
import glkb05 from '../../img/blog/glkb-05-rfx6.svg';
import glkb06 from '../../img/blog/glkb-06-investigate.svg';
import fig01 from '../../img/blog/fig-01-pipeline.svg';
import fig02 from '../../img/blog/fig-02-architecture.svg';
import fig03 from '../../img/blog/fig-03-retrieval.svg';
import fig04 from '../../img/blog/fig-04-funnel.svg';
import fig05 from '../../img/blog/fig-05-claim-centric.svg';
import fig06 from '../../img/blog/fig-06-verification.svg';
import fig07 from '../../img/blog/fig-07-report-anatomy.svg';
import fig08 from '../../img/blog/fig-08-positioning.svg';
import fig09 from '../../img/blog/fig-09-search-mode.svg';

import glkbArticle from './content/glkb-knowledge-graph.md';
import investigateArticle from './content/investigate-auditable-research.md';
import { parseArticle } from './markdown';

/** Markdown names an image by file name; webpack knows it by URL. */
export const IMAGES = {
    'glkb-01-layers.svg': glkb01,
    'glkb-02-funnel.svg': glkb02,
    'glkb-03-schema.svg': glkb03,
    'glkb-04-retrieval.svg': glkb04,
    'glkb-05-rfx6.svg': glkb05,
    'glkb-06-investigate.svg': glkb06,
    'fig-01-pipeline.svg': fig01,
    'fig-02-architecture.svg': fig02,
    'fig-03-retrieval.svg': fig03,
    'fig-04-funnel.svg': fig04,
    'fig-05-claim-centric.svg': fig05,
    'fig-06-verification.svg': fig06,
    'fig-07-report-anatomy.svg': fig07,
    'fig-08-positioning.svg': fig08,
    'fig-09-search-mode.svg': fig09,
};

export const posts = [investigateArticle, glkbArticle].map(parseArticle);

export const getPost = (slug) => posts.find((post) => post.slug === slug) || null;

export default posts;
