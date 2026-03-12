import './scoped.css';

import React, {
  useEffect,
  useState,
} from 'react';

import {
  Box,
  Typography,
} from '@mui/material';

import { ReactComponent as BookIcon } from '../../img/navbar/book_4.svg';
import { getBookmarks } from '../../utils/bookmarks';
import CiteDialog from '../Units/CiteDialog';
import NavBarWhite from '../Units/NavBarWhite';
import ReferenceCard from '../Units/ReferenceCard/ReferenceCard';

const Library = () => {
    const [bookmarks, setBookmarks] = useState([]);
    const [citeDialogOpen, setCiteDialogOpen] = useState(false);
    const [selectedCitation, setSelectedCitation] = useState(null);

    useEffect(() => {
        setBookmarks(getBookmarks());
    }, []);

    const handleClick = (event, link) => {
        event.preventDefault();
        window.open(link, '_blank');
    };

    const handleCiteClick = (citation) => {
        setSelectedCitation(citation);
        setCiteDialogOpen(true);
    };

    const handleCloseCiteDialog = () => {
        setCiteDialogOpen(false);
        setSelectedCitation(null);
    };

    return (
        <div className="library-page">
            <NavBarWhite />
            <CiteDialog
                open={citeDialogOpen}
                onClose={handleCloseCiteDialog}
                citation={selectedCitation}
            />
            <Box className="library-body">
                <Box className="library-content">
                    <Box className="library-header">
                        <Box className="library-title-row">
                            <BookIcon className="library-book-icon" style={{ width: 36, height: 36, color: '#164563' }} />
                            <Typography sx={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontWeight: 600,
                                fontSize: '32px',
                                color: '#164563',
                            }}>
                                Library
                            </Typography>
                        </Box>
                        <Typography sx={{
                            marginTop: '8px',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 500,
                            fontSize: '14px',
                            color: '#646464',
                        }}>
                            Collect papers, explore connections, and organize your research journey.
                        </Typography>
                    </Box>
                    <Box className="library-list">
                        {bookmarks.length > 0 ? (
                            bookmarks.map((entry) => (
                                <div key={entry.id}>
                                    <ReferenceCard
                                        url={[
                                            entry.title,
                                            entry.url,
                                            entry.citation_count,
                                            entry.year,
                                            entry.journal,
                                            entry.authors,
                                        ]}
                                        handleClick={handleClick}
                                        onCiteClick={handleCiteClick}
                                        transparentBackground
                                    />
                                </div>
                            ))
                        ) : (
                            <Typography sx={{
                                fontFamily: 'DM Sans, sans-serif',
                                fontSize: '14px',
                                color: '#646464',
                            }}>
                                No bookmarks yet. Save references to see them here.
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
        </div>
    );
};

export default Library;
