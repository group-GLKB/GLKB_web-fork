import React from 'react';

import LegalPage from '../LegalPage';
import { LAST_UPDATED, POLICY } from './policy';

const PrivacyPolicy = () => (
    <LegalPage
        title="Privacy Policy"
        updated={LAST_UPDATED}
        blocks={POLICY}
        description="How GLKB collects, uses and shares personal information."
    />
);

export default PrivacyPolicy;
