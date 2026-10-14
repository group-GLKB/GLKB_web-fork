import React from 'react';

/** The small "Beta" pill beside a feature's name (Literature Review, while it is in testing). */
export default function BetaBadge({ className, style }) {
    return (
        <span
            className={`beta-badge${className ? ` ${className}` : ''}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 999,
                background: 'var(--color-brand-muted)',
                color: 'var(--color-brand-primary)',
                fontFamily: 'Geist, sans-serif',
                fontWeight: 600,
                fontSize: 10,
                lineHeight: '14px',
                letterSpacing: '0.02em',
                verticalAlign: 'middle',
                flex: 'none',
                ...style,
            }}
        >
            Beta
        </span>
    );
}
