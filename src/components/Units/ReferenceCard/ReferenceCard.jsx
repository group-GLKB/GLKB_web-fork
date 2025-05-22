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
            return renderAuthorBubbles([getLastName(authorsList[0])]);
        }
        if (authorsList.length === 2) {
            return renderAuthorBubbles(authorsList.map(getLastName));
        }
        return renderAuthorBubbles([
            getLastName(authorsList[0]),
            '...',
            getLastName(authorsList[authorsList.length - 1])
        ]);
    };
    const renderAuthorBubbles = (list) => (
        list.map((author, idx) => (
            <span
                key={idx}
                style={{
                    backgroundColor: '#F4F4F4',
                    borderRadius: '8px',
                    padding: '2px 6px',
                    fontSize: '12px',
                    color: '#888888',
                    whiteSpace: 'nowrap',
                    border: '1px solid #E6E6E6'
                }}
            >
                {author}
            </span>
        ))
    );
    return (
        <div
            onClick={(event) => handleClick(event, url[1])}
            style={{
                cursor: 'pointer',
                // padding: '6px',
                marginBottom: '10px',
                /*border: '1px solid #ddd',*/
                borderRadius: '10px',
                // boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
                backgroundColor: '#fff',
                transition: 'box-shadow 0.0s ease-in-out',
                width: '100%',
                /*marginLeft: '15px',
                marginRight: '15px'*/
            }}
            className="custom-div-url"
            // onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.45)'}
            // onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.4)'}
        >
            <div className="top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', marginTop: '3px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                    {renderAuthors()}
                </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        marginLeft: '16px',
                        minWidth: '80px',
                        whiteSpace: 'nowrap'
                    }}>
                        <span style={{ color: '#888888', fontWeight: 'bold', fontSize: '15px', lineHeight: '6px' , marginTop:'3px'}} title="Year">
                            {url[3]}
                        </span>
                        <span style={{ color: '#888888', fontSize: '12px',marginTop:'3px' }} title="Cited by">
                            Cited by: {url[2]}
                        </span>
                </div>
            </div>

            <a
                href={url[1]}
                onClick={(event) => {
                    event.stopPropagation();
                        handleClick(event, url[1]);
                    }}
                    style={{
                        color: 'black',
                        textDecoration: 'none',
                    }}
            >
                {url[0]}
            </a>

            <div id="bottomsection" style={{ color: '#888888', display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop:'3px' }}>
                <div title="Journal">
                    {url[4].length > 60 ? url[4].substring(0, 64) + '...' : url[4]}
                </div>
                <div title="PubmedID">
                    PubmedID: {url[1].split('/').filter(Boolean).pop()}
                </div>
            </div>
        </div>

        
    );
};

export default ReferenceCard;
