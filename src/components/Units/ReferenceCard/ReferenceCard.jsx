import React from 'react';

import { IconButton } from '@mui/material';

import formatQuoteIcon from '../../../img/llm/format_quote.svg';

const ReferenceCard = ({ url, handleClick, onCiteClick, isHighlighted = false }) => {

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
                backgroundColor: isHighlighted ? '#FFF9E6' : '#fff',
                width: '100%',
                transition: 'background-color 0.3s ease',
                padding: isHighlighted ? '8px' : '0px',
                fontFamily: 'DM Sans, sans-serif',
            }}
            className="custom-div-url"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ color: '#808080', fontSize: '14px', fontWeight: 400 }}>
                    PubMed ID: {url[1].split('/').filter(Boolean).pop()}
                </div>
                <IconButton
                    size="small"
                    onClick={handleCiteClick}
                    sx={{
                        padding: '4px',
                        color: '#323232',
                        '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        },
                    }}
                    title="Cite this reference"
                >
                    <img
                        src={formatQuoteIcon}
                        alt="Quote"
                        style={{ width: '18px', height: '18px', display: 'block' }}
                    />
                </IconButton>
            </div>

            <a
                href={url[1]}
                onClick={(event) => {
                    event.stopPropagation();
                    handleClick(event, url[1]);
                }}
                style={{
                    color: '#323232',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '16px',
                    display: 'block',
                    marginBottom: '6px',
                    wordBreak: 'break-word',
                }}
            >
                {url[0]}
            </a>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '6px',
            }}>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    fontSize: '14px',
                    fontWeight: 400,
                    fontStyle: 'italic',
                    color: '#808080',
                    flex: 1,
                }}>
                    {renderAuthors()}
                </div>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    fontSize: '14px',
                    fontWeight: 400,
                    color: '#323232',
                    lineHeight: 1.4,
                    flexShrink: 0,
                }}>
                    <span>Citations: {url[2]}</span>
                </div>
            </div>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: '12px',
            }}>
                <div style={{
                    fontSize: '14px',
                    fontWeight: 400,
                    color: '#323232',
                    wordBreak: 'break-word',
                    flex: 1,
                }} title="Journal">
                    {url[4]}
                </div>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    fontSize: '14px',
                    fontWeight: 400,
                    color: '#323232',
                    lineHeight: 1.4,
                    flexShrink: 0,
                }}>
                    <span>{url[3]}</span>
                </div>
            </div>
        </div>


    );
};

export default ReferenceCard;
