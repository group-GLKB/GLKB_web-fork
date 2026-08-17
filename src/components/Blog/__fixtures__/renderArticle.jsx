/**
 * Shared by the blog's tests: mount one article the way the router does.
 * Lives under __fixtures__ so jest does not mistake it for a test file.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import BlogPost from '../BlogPost';

const renderArticle = (slug) => {
    const { container } = render(
        <HelmetProvider>
            <MemoryRouter initialEntries={[`/blog/${slug}`]}>
                <Routes>
                    <Route path="/blog/:slug" element={<BlogPost />} />
                </Routes>
            </MemoryRouter>
        </HelmetProvider>,
    );
    return container;
};

export default renderArticle;
