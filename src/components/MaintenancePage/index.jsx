import './scoped.css';

import React from 'react';

import { Helmet } from 'react-helmet-async';

import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';

const MAINTENANCE_DAYS = 2;

const MaintenancePage = () => (
    <div className="maintenance-page">
        <Helmet>
            <title>Maintenance | GLKB</title>
            <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <main className="maintenance-main">
            <HandymanOutlinedIcon className="maintenance-icon" />

            <h1 className="maintenance-title">GLKB is under maintenance.</h1>

            <p className="maintenance-subtitle">
                We&apos;ll be back in
                {' '}
                <span className="maintenance-days">{MAINTENANCE_DAYS}</span>
                {' '}
                days, stay tuned!
            </p>

            <a href="mailto:admin@glkb.org" className="maintenance-contact-button">
                Contact us
            </a>
        </main>

        <footer className="maintenance-footer">
            <p>
                © 2025 GLKB - Genomic Literature Knowledge Base | glkb.org
            </p>
            <p>
                Developed and maintained by the
                {' '}
                <a className="maintenance-lab-link" href="https://jieliu6.github.io/" target="_blank" rel="noopener noreferrer">
                    Jie Liu Lab
                </a>
                , Department of Computational Medicine and Bioinformatics, University of Michigan.
            </p>
        </footer>
    </div>
);

export default MaintenancePage;
