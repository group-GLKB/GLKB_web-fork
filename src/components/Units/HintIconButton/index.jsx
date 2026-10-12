import React, { forwardRef } from 'react';
import { IconButton, Tooltip } from '@mui/material';

// Match the sidebar's hint surface; replace native browser title bubbles.
const HintIconButton = forwardRef(({ title, ...props }, ref) => {
    const button = <IconButton ref={ref} aria-label={props['aria-label'] || title} {...props} />;
    if (!title) return button;
    return <Tooltip title={title} placement="top" componentsProps={{ tooltip: { sx: {
        backgroundColor: 'var(--color-brand-soft)', color: 'var(--color-grey-900)',
        fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: '14px',
        padding: '4px 12px', borderRadius: '8px', boxShadow: 'none',
    } } }}>
        <span style={{ display: 'inline-flex' }}>{button}</span>
    </Tooltip>;
});
export default HintIconButton;
