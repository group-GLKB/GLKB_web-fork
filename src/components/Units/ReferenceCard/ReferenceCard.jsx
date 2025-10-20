import React from 'react';
import { IconButton } from '@mui/material';
import { FormatQuote as FormatQuoteIcon } from '@mui/icons-material';

const ReferenceCard = ({ url, handleClick, onCiteClick }) => {
    
    const handleCiteClick = (event) => {
        event.stopPropagation();
        if (onCiteClick) {
            onCiteClick(url);
        }
    };

    const authors = url[5] || [];

    const getLastName = (fullName) => {
        const parts = fullName.trim().split(' ');
        return parts[parts.length - 1];
    };


    const renderAuthors = () => {
        const authorsList = authors.split(', ').filter(name => name.trim().length > 0);
        if (authorsList.length === 0) return null;
        if (authorsList.length === 1) {
            return renderAuthorBubbles([authorsList[0]]);
        }
        if (authorsList.length === 2) {
            return renderAuthorBubbles(authorsList);
        }
        return renderAuthorBubbles([
            authorsList[0],
            '...',
            authorsList[authorsList.length - 1]
        ]);
    };
    const renderAuthorBubbles = (list) => (
        list.map((author, idx) => (
            <span
                key={idx}
            >
                {author}{idx < list.length - 1 ? ',' : ''}
            </span>
        ))
    );
    return (
        <div
            onClick={(event) => handleClick(event, url[1])}
            style={{
                cursor: 'pointer',
                marginBottom: '2px',
                borderRadius: '10px',
                backgroundColor: '#fff',
                width: '100%',
            }}
            className="custom-div-url"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ color: '#018DFF', fontSize: '14px' }}>
                    PubMed ID: {url[1].split('/').filter(Boolean).pop()}
                </div>
                <div style={{ fontSize: '14px' }}>
                    Citations: {url[2]}
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'start',
                marginBottom: '4px'
            }}>
                <a
                    href={url[1]}
                    onClick={(event) => {
                        event.stopPropagation();
                        handleClick(event, url[1]);
                    }}
                    style={{
                        color: 'black',
                        textDecoration: 'none',
                        fontWeight: '600',
                        fontSize: '14px',
                        paddingRight: '8px',
                        wordBreak: 'break-word'
                    }}
                >
                    {url[0]}
                </a>
                <div style={{
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                    marginLeft: '8px',
                }}>
                    {url[3]}
                </div>
            </div>

            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                fontSize: '14px',
                marginBottom: '4px'
            }}>
                {renderAuthors()}
            </div>

            <div style={{
                fontSize: '14px',
                wordBreak: 'break-word',
                color: 'grey',
            }} title="Journal">
                {url[4]}
            </div>
            
            <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end',
                marginTop: '8px',
            }}>
                <div
                    onClick={handleCiteClick}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Cite this reference"
                >
                    <FormatQuoteIcon sx={{ fontSize: '18px', color: '#4A90E2' }} />
                    <span style={{ fontSize: '14px', color: '#4A90E2', fontWeight: '500' }}>Cite</span>
                </div>
            </div>
        </div>


    );
};

export default ReferenceCard;
