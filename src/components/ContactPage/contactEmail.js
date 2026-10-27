export const CONTACT_EMAIL = 'admin@glkb.org';
export const CONTACT_TOPICS = [
    'General question',
    'Report a problem',
    'Account & billing',
    'API access',
    'Research collaboration',
    'Personal data request',
];

/** Compose a draft only. The reader sends it from their own email application. */
export const buildContactMailto = ({ name = '', institution = '', topic = CONTACT_TOPICS[0], message = '' }) => {
    const selectedTopic = CONTACT_TOPICS.includes(topic) ? topic : CONTACT_TOPICS[0];
    const body = [
        `Name: ${name.trim()}`,
        ...(institution.trim() ? [`Institution: ${institution.trim()}`] : []),
        `Topic: ${selectedTopic}`,
        '',
        message.trim(),
    ].join('\r\n');
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[GLKB] ${selectedTopic}`)}&body=${encodeURIComponent(body)}`;
};

export const openContactDraft = (href) => window.location.assign(href);
