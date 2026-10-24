import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '../src/components/Auth/AuthContext';
import AboutPage from '../src/components/AboutPage';
import ContactPage from '../src/components/ContactPage';
import BlogPost from '../src/components/Blog/BlogPost';
import ApiDocs from '../src/components/ApiDocs';
import Privacy from '../src/components/PrivacyPolicy';
import Terms from '../src/components/TermsOfService';
import { posts } from '../src/components/Blog/posts';
import { DOCS_CATEGORIES, flattenDocsPages } from '../src/components/ApiDocs/docsConfig';
import { SHOW_API_DOCS } from '../src/config/features';
import { BLOG_SLUGS, DOC_SLUGS, canonicalUrlFor } from '../src/config/publicSeo';

const docs = flattenDocsPages(DOCS_CATEGORIES);
export const publicPages = [
    { path: '/', title: 'GLKB: Genomic Literature Knowledge Base', description: 'GLKB synthesizes biomedical literature into structured, evidence-backed answers. Every claim links directly to its source paper.' },
    { path: '/contact' },
    ...posts.map(post => ({ path: `/blog/${post.slug}`, title: `${post.title} | GLKB`, description: post.lede, article: true })),
    ...(SHOW_API_DOCS ? docs.map(page => ({ path: page.slug === 'overview' ? '/api-docs' : `/api-docs/${page.slug}`, title: `${page.title} | API Docs | GLKB`, description: page.description || `${page.title}: GLKB biomedical literature API documentation and examples.`, markdown: page.markdown || '' })) : []),
    { path: '/privacy', title: 'Privacy Policy | GLKB', description: 'GLKB privacy policy: information collection, use, and your choices.' },
    { path: '/terms', title: 'Terms of Service | GLKB', description: 'Terms and conditions for accessing GLKB.' },
];
// Fail the build if a new article or document is forgotten in the client SEO whitelist.
if (posts.some(post => !BLOG_SLUGS.includes(post.slug)) || docs.some(page => !DOC_SLUGS.includes(page.slug))) {
    throw new Error('Public route list has drifted. Update config/publicSeo.js.');
}
export function renderPublic(page) {
    const context = {};
    const body = renderToString(
        <HelmetProvider context={context}><StaticRouter location={page.path}><AuthProvider>
            <Routes>
                <Route path="/" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="/api-docs/:slug" element={<ApiDocs initialMarkdown={page.markdown} />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
            </Routes>
        </AuthProvider></StaticRouter></HelmetProvider>,
    );
    const { helmet } = context;
    return { body, canonical: canonicalUrlFor(page.path), head: helmet.title.toString() + helmet.meta.toString() + helmet.script.toString() };
}
