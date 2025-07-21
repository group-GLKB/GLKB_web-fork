import React from 'react';

const ReferenceCard = ({ url, handleClick }) => {

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
            {/* Section 1: PubMed ID and Citations */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ color: '#018DFF', fontSize: '14px' }}>
                    PubMed ID: {url[1].split('/').filter(Boolean).pop()}
                </div>
                <div style={{ fontSize: '14px' }}>
                    Citations: {url[2]}
                </div>
            </div>

            {/* Section 2: Title and Year */}
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

            {/* Section 3: Authors */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                fontSize: '14px',
                marginBottom: '4px'
            }}>
                {renderAuthors()}
            </div>

            {/* Section 4: Journal Name */}
            <div style={{
                fontSize: '14px',
                wordBreak: 'break-word',
                color: 'grey',
            }} title="Journal">
                {url[4]}
            </div>
        </div>


    );
};

export default ReferenceCard;
