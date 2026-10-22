import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { canonicalUrlFor } from '../../../config/publicSeo';

export default function PublicPageSeo({ title, description, article = false, image = '/GLKB_logo_icon.png' }) {
    const { pathname } = useLocation();
    const url = canonicalUrlFor(pathname);
    const schema = {
        '@context': 'https://schema.org', '@type': article ? 'BlogPosting' : 'WebPage',
        '@id': url, url, name: title, description,
        ...(article ? { headline: title.replace(/ \| GLKB$/, '') } : {}),
        isPartOf: { '@type': 'WebSite', '@id': 'https://glkb.org/#website', url: 'https://glkb.org/', name: 'GLKB' },
    };
    return <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content={article ? 'article' : 'website'} />
        <meta property="og:image" content={image.startsWith('/') ? `https://glkb.org${image}` : image} />
        <script type="application/ld+json">{JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
    </Helmet>;
}
