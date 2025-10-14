import React from 'react';

import { Helmet } from 'react-helmet-async';

import NavBarWhite from '../Units/NavBarWhite';

const AboutPage = () => {
    return (
        <>
            <Helmet>
                <title>About - Genomic Literature Knowledge Base</title>
                <meta name="description" content="Discover insights from 33M+ genomic research articles. GLKB enables AI-powered search across genes, diseases, variants, and chemicals with high accuracy." />
                <meta property="og:title" content="About - Genomic Literature Knowledge Base | AI-Powered Genomics Search" />
            </Helmet>
            <div className="AboutPageContainer">
                <NavBarWhite />
                <div className="content" style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
                    <h1 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: '600', textAlign: 'center', marginBottom: '20px' }}>About GLKB</h1>
                    <div className="glkb-introduction">
                        <p>
                            The Genomic Literature Knowledge Base (GLKB) is a comprehensive and powerful resource that integrates over 263 million biomedical terms and more than 14.6 million biomedical relationships.
                            This collection is curated from 33 million PubMed abstracts and nine well-established biomedical repositories, offering an unparalleled wealth of knowledge for researchers and practitioners in the field.
                        </p>
                        <p style={{ textAlign: 'center', marginTop: '20px' }}>
                            <a href="https://www.biorxiv.org/content/10.1101/2024.09.22.614323v1.abstract" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 'bold' }}>
                                Learn more about GLKB in our original article &gt;&gt;
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AboutPage;