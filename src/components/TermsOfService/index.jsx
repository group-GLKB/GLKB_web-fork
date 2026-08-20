import React from 'react';

import LegalPage from '../LegalPage';
import { LAST_UPDATED, TERMS, TERMS_SUBTITLE, TERMS_TITLE } from './terms';

const TermsOfService = () => (
    <LegalPage
        title={TERMS_TITLE}
        subtitle={TERMS_SUBTITLE}
        updated={LAST_UPDATED}
        blocks={TERMS}
        description="The terms under which the University of Michigan makes GLKB available."
    />
);

export default TermsOfService;
