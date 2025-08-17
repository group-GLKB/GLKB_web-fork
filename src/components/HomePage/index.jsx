import 'antd/dist/reset.css';
import './scoped.css';

import React, {
    useEffect,
    useRef,
    useState,
} from 'react';

import { Button as AntButton } from 'antd';
import Joyride, {
    ACTIONS,
    EVENTS,
    STATUS,
} from 'react-joyride';
import {
    useLocation,
    useNavigate,
} from 'react-router-dom';

import ApiIcon from '@mui/icons-material/Api';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import PeopleIcon from '@mui/icons-material/People';
import {
    Autocomplete,
    Box,
    CircularProgress,
    Container,
    Grid,
    Paper,
    Popper,
    TextField,
    Typography,
} from '@mui/material';

import { trackEvent } from '../Units/analytics';
import NavBarWhite from '../Units/NavBarWhite';
import SearchBarKnowledge from '../Units/SearchBarKnowledge';
import SearchButton from '../Units/SearchButton/SearchButton';
import SubNavBar from '../Units/SubNavBar';

// const { Search } = Input;

const LLMExampleQueries = [
    "What is the role of BRCA1 in breast cancer?",
    "How many articles about Alzheimer's disease were published in 2020?",
    "What pathways does TP53 participate in?",
];

const HomePage = () => {
    const location = useLocation();
    const { state } = location || {};
    let navigate = useNavigate();
    // const [tags, setTags] = useState([]);
    const [runTour, setRunTour] = useState(false);
    const [activeButton, setActiveButton] = useState(state?.activeButton || "triplet");  // Changed default to 'triplet'
    const [llmQuery, setLlmQuery] = useState('');
    // const [focused, setFocused] = useState(false);
    // const theme = useTheme();
    // const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    // Add refs for the search components
    const searchBarKnowledgeRef = useRef(null);
    // const searchBarNeighborhoodRef = useRef(null);
    const [stats, setStats] = useState(null);

    const CustomPopper = (props) => (
        <Popper
            {...props}
            placement="bottom-start"
            modifiers={[
                {
                    name: 'flip',
                    enabled: false, // prevent flipping to top
                },
            ]}
        />
    );

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('https://glkb.dcmb.med.umich.edu/api/frontend/statistics');
                const data = await response.json();
                Object.keys(data).forEach(key => {
                    data[key] = data[key] ? new Intl.NumberFormat('en', {
                        notation: 'compact',
                        compactDisplay: 'short',
                    }).format(data[key]) : "N/A";
                });
                setStats(data);
            } catch (error) {
                console.error('Error fetching statistics:', error);
            }
        };
        fetchStats();
    }, []);

    useEffect(() => {
        // Update activeButton if state changes
        if (state?.activeButton) {
            setActiveButton(state.activeButton);
        }
    }, [state?.activeButton]);

    const navigateToLLMAgent = (query = '') => {
        // Track event
        trackEvent('Navigation', 'Navigate to LLM Agent', query ? 'With Query' : 'Direct Navigation');
        if (query) {
            navigate('/llm-agent', { state: { initialQuery: query } });
        } else {
            navigate('/llm-agent');
        }
    };

    // const handleSearch = async (v) => {
    //     // Track searches
    //     trackEvent('Search', 'Search Performed', activeButton);

    //     navigate('/result', {
    //         state: {
    //             search_data: v,
    //             searchType: activeButton
    //         }
    //     });
    // }

    // const handleExampleQuery = (index) => {
    //     // Track example query clicks
    //     trackEvent('Search', 'Example Query Click', `Example ${index + 1}`);

    //     if (activeButton === 'triplet') {
    //         if (exampleQueries && exampleQueries.length > index) {
    //             const exampleQuery = exampleQueries[index];
    //             // Fill the search bar instead of navigating
    //             if (searchBarKnowledgeRef.current) {
    //                 searchBarKnowledgeRef.current.fillWithExample(exampleQuery);
    //             }
    //         }
    //     } else {
    //         if (neighborhoodExamples && neighborhoodExamples.length > index) {
    //             const exampleQuery = neighborhoodExamples[index];
    //             // Fill the search bar instead of navigating
    //             if (searchBarNeighborhoodRef.current) {
    //                 searchBarNeighborhoodRef.current.fillWithExample(exampleQuery);
    //             }
    //         }
    //     }
    // }

    const handleJoyrideCallback = (data) => {
        const { status, type, action } = data;
        const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRunTour(false);
        }

        // Automatically advance to the next step when the tour starts
        if (type === EVENTS.STEP_AFTER && action === ACTIONS.START) {
            setRunTour(true);
        }
    };

    const getTourSteps = () => {
        const commonSteps = [
            {
                target: '.glkb-title',
                content: 'Welcome to GLKB! Let\'s explore how to use the search and visualize the biomedical knowledge from 33 million+ Pubmed articles and nine well-curated databases.',
                placement: 'bottom',
                disableBeacon: true,
            },
            {
                target: '.sub-navigation-bar',
                content: 'Choose between two search modes: "Graphical Search" to explore relationships between multiple terms, or "LLM Agent" to automatically search for relevant information with natural language.',
                placement: 'bottom',
            }
        ];

        const tripletSteps = [
            // {
            //     target: '.search-autocomplete-box',
            //     content: 'Start typing here to see autocomplete suggestions for your search terms.',
            //     placement: 'bottom',
            // },
            // {
            //     target: '.add-biomedical-term-button',
            //     content: 'After selecting a term, click here to add it to your search query.',
            //     placement: 'bottom',
            // },
            // {
            //     target: '.log-box',
            //     content: 'Your added terms will appear here. You can add up to five terms in one search. Remove terms by clicking the "X" button.',
            //     placement: 'bottom',
            // }
            {
                target: '.search-autocomplete-box',
                content: 'Start typing here to see autocomplete suggestions for your search terms. Click the term to add it to your search query.',
                placement: 'bottom',
            },
            {
                target: '.search-autocomplete-box',
                content: 'You can add up to five terms in one search.',
                placement: 'top',
            }
        ];

        const neighborSteps = [
            {
                target: '.search-autocomplete-box',
                content: 'Start typing to find a biomedical term you want to explore.',
                placement: 'bottom',
            },
            {
                target: '.term-type-dropdown',
                content: 'Select which types of terms you want to find (e.g., Genes, Diseases, Drugs).',
                placement: 'bottom',
            },
            {
                target: '.results-limit-dropdown',
                content: 'Choose how many related terms you want to see in the results.',
                placement: 'bottom',
            },
            {
                target: '.relationship-type-dropdown',
                content: 'Choose how you want to find related terms: through literature-based relationships or curated databases.',
                placement: 'bottom',
            }
        ];

        const llmSteps = [
            {
                target: '.llm-searchbar',
                content: 'Ask any question about biomedical literature. Our AI agent will help find and analyze relevant information for you.',
                placement: 'bottom',
            },
            {
                target: '.search-button-big',
                content: 'Click here to initiate the search with your selected terms.',
                placement: 'bottom',
            }
        ];

        const finalSteps = [
            {
                target: '.search-button-big',
                content: activeButton === 'triplet'
                    ? 'Click here to visualize the relationships between your selected terms.'
                    : 'Click here to find related terms based on your settings.',
                placement: 'bottom',
            }
        ];

        return [
            ...commonSteps,
            ...(activeButton === 'triplet' ? tripletSteps :
                activeButton === 'neighbor' ? neighborSteps :
                    llmSteps),
            ...(activeButton !== 'llm' ? finalSteps : [])
        ];
    };

    // Update steps when activeButton changes
    const steps = getTourSteps();

    return (
        <div style={{ maxHeight: '100vh', overflowY: 'hidden' }}>
            <NavBarWhite
                showLogo={true} activeButton={activeButton}
            />
            <div className="HomePageContainer">
                <div className="HomePageInner">
                    <Joyride
                        steps={steps}
                        run={runTour}
                        continuous={true}
                        showSkipButton={true}
                        showProgress={true}
                        callback={handleJoyrideCallback}
                        styles={{
                            options: {
                                primaryColor: '#007bff',
                                zIndex: 10000
                            },
                            tooltip: {
                                textAlign: 'left',
                                content: {
                                    textAlign: 'left'
                                }
                            },
                            tooltipContent: {
                                textAlign: 'left'
                            }
                        }}
                        locale={{
                            last: 'Close', // Change the text of the final button to "Close"
                            next: 'Next',
                            back: 'Back',
                            skip: 'Skip',
                        }}
                        disableOverlayClose={true}
                        disableBeacon={true}
                        disableCloseOnEsc={true}
                        disableScrolling={true}
                        spotlightClicks={true}
                        spotlightPadding={0}
                        scrollToFirstStep={true}
                    />
                    <Box className="homepage-top" sx={{
                        width: "100%",
                        paddingTop: '13vh',
                        backgroundColor: '#079BD4',
                        justifyContent: 'center',
                        alignItems: 'center',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <Typography sx={{
                            fontFamily: 'Open Sans',
                            fontWeight: 700,
                            fontSize: '48px',
                            leadingTrim: 'NONE',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                            textAlign: 'center',
                            paddingBottom: '16px',
                            color: 'white',
                        }} className='glkb-title'>
                            Genomic Literature Knowledge Base
                        </Typography>
                        <Typography sx={{
                            fontFamily: 'Georgia',
                            fontWeight: 400,
                            fontSize: '20px',
                            color: 'white',
                            textAlign: 'center',
                            paddingBottom: '30px',
                            maxWidth: '500px',
                        }}>
                            Discover insights from genomic research with AI-powered search and analysis
                        </Typography>
                        <Box sx={{ paddingBottom: '40px' }}>
                            <SubNavBar activeButton={activeButton} />
                        </Box>
                        <Box sx={{ width: "90%", maxWidth: "1240px", paddingBottom: 'calc(min(9vh, 80px))' }}>
                            {activeButton === 'triplet' ? (
                                <SearchBarKnowledge
                                    ref={searchBarKnowledgeRef}
                                    chipData={[]}
                                    onSearch={(data) => {
                                        console.log('Triplet Search Data:', {
                                            search_data: data,
                                            searchType: 'triplet',
                                        });
                                        navigate('/result', {
                                            state: {
                                                search_data: data,
                                                searchType: 'triplet',
                                            }
                                        });
                                    }}
                                />
                            ) : (
                                <Box className="llm-searchbar" sx={{
                                    width: '100%',
                                    display: 'flex',
                                    gap: 2,
                                    margin: '0 auto',
                                    backgroundColor: 'white',
                                    borderRadius: '30px',
                                }}>
                                    <Autocomplete
                                        freeSolo
                                        fullWidth
                                        options={LLMExampleQueries}
                                        filterOptions={(options) => (llmQuery?.trim() === '' ? options : [])}
                                        onChange={(event, newValue) => {
                                            setLlmQuery(newValue || '');
                                        }}
                                        onInputChange={(event, newInputValue) => {
                                            setLlmQuery(newInputValue || '');
                                        }}
                                        openOnFocus
                                        groupBy={() => 'Example Queries'}
                                        getOptionLabel={(option) => option}
                                        // onFocus={() => setFocused(true)}
                                        // onBlur={() => setFocused(false)}
                                        inputValue={llmQuery}
                                        PopperComponent={CustomPopper}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                size="small"
                                                placeholder="Ask a question about the biomedical literature..."
                                                sx={{
                                                    height: '60px', // Increase the height of the input box
                                                    width: '100%',
                                                    '& .MuiInputBase-root': {
                                                        borderRadius: '30px',
                                                        height: '60px', // Adjust the height of the input field
                                                        alignItems: 'center', // Center the text vertically
                                                        paddingRight: '10px', // Remove right padding
                                                        '& fieldset': {
                                                            border: 'none',
                                                        },
                                                    },
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'grey', // Optional: Customize border color
                                                    },
                                                }}
                                                fullWidth
                                                InputProps={{
                                                    ...params.InputProps,
                                                    startAdornment: (
                                                        <>
                                                            <ChatBubbleOutlineIcon sx={{ color: '#a1a1a1', marginLeft: '20px', fontSize: '20px' }} />
                                                            {params.InputProps.startAdornment}
                                                        </>
                                                    ),
                                                    endAdornment: (
                                                        <Box display="flex" alignItems="center" sx={{
                                                            position: 'absolute',
                                                            right: 0,
                                                        }}>
                                                            {/* Clear Icon */}
                                                            {llmQuery !== "" && <CloseIcon
                                                                onClick={() => {
                                                                    setLlmQuery(''); // Clear the input field
                                                                }}
                                                                sx={{
                                                                    color: 'grey.500',
                                                                    cursor: 'pointer',
                                                                    fontSize: '20px', // Adjust size as needed
                                                                    marginRight: '8px', // Add spacing from the SendIcon
                                                                }}
                                                            />}
                                                            {/* Search Icon */}
                                                            <SearchButton
                                                                onClick={() => { navigateToLLMAgent(llmQuery.trim()); }}
                                                                disabled={!llmQuery.trim()}
                                                            />
                                                        </Box>
                                                    ),
                                                }}

                                            />
                                        )}
                                        PaperComponent={({ children }) => (
                                            <Paper
                                                sx={{
                                                    borderRadius: '16px',
                                                    border: "1.5px solid #E6F0FC",
                                                    boxShadow: 'none',
                                                    marginTop: '5px',
                                                    marginBottom: '5px',
                                                    overflow: 'hidden',
                                                    "& .MuiAutocomplete-option.Mui-focused": {
                                                        backgroundColor: '#F3F5FF !important',
                                                    },
                                                    "& .MuiAutocomplete-option.Mui-focused span.highlight-arrow": {
                                                        color: 'black !important',
                                                    }
                                                }}
                                            >
                                                {children}
                                            </Paper>
                                        )}
                                        renderOption={(props, option) => (
                                            <Box
                                                component="li"
                                                {...props}
                                                sx={{
                                                    minHeight: '36px !important',
                                                    margin: '0px 10px',
                                                    borderRadius: '8px',
                                                    '& .MuiAutocomplete-option.Mui-focused': {
                                                        backgroundColor: '#F3F5FF !important',
                                                    },
                                                }}
                                            >
                                                {option}
                                                <span className={"highlight-arrow"} style={{ color: 'white', marginLeft: 'auto' }}><ArrowOutwardIcon fontSize="small" /></span>
                                            </Box>
                                        )}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && llmQuery !== "") {
                                                e.preventDefault();
                                                navigateToLLMAgent(llmQuery.trim());
                                            }
                                        }}
                                    />

                                </Box>
                            )}
                        </Box>
                    </Box>
                    <Grid container spacing={2} className="content HomePageMain" justifyContent="center" alignItems="center" sx={{
                        marginTop: 'calc(min(4vh, 45px))'
                    }}>
                        <Container className="info-card-section" sx={{ gap: '40px', display: 'flex', flexDirection: 'row' }} >
                            {stats ? ([
                                [PeopleIcon, stats.num_active_users_d30 || "N/A", "Active users in the past month"],
                                [ApiIcon, stats.num_api_calling || "N/A", "Total external API calls since released"],
                                [LibraryBooksIcon, stats.num_articles || "N/A", "Articles covered in GLKB database"],
                            ].map(([icon, value, description], index) => (
                                <Grid item xs={4} key={index}>
                                    <Box sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        width: '100%',
                                        minHeight: '100%',
                                        height: '188px',
                                        padding: '27px 12px',
                                        borderRadius: '12px',
                                        backgroundColor: '#FFFFFF',
                                        borderBottom: '5px solid #0169B0'
                                    }}>
                                        {React.createElement(icon, {
                                            sx: {
                                                fontSize: '64px',
                                                color: '#0169B0'
                                            }
                                        })}
                                        <Box
                                            sx={{
                                                textAlign: 'left',
                                                display: 'flex',
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'flex-start',
                                                width: '100%',
                                                whiteSpace: 'normal',
                                            }}>
                                            <div style={{
                                                fontFamily: 'Open Sans',
                                                fontWeight: '400',
                                                fontSize: '40px',
                                                color: '#0169B0',
                                                padding: '0px 10px',
                                                minWidth: '120px',
                                                textAlign: 'center',
                                                transform: 'translateY(-2px)',
                                            }}>
                                                {value}
                                            </div>
                                            <div style={{
                                                fontFamily: 'Open Sans',
                                                fontWeight: '400',
                                                fontSize: '14px',
                                                color: '#646B96',
                                                maxWidth: '150px'
                                            }}>
                                                {description}
                                            </div>
                                        </Box>
                                    </Box>
                                </Grid>
                            ))) : (
                                <Box sx={{
                                    display: 'flex',
                                    alignContent: 'center',
                                    alignItems: 'center',
                                    height: '188px',
                                    padding: '27px 12px',
                                }}>
                                    <CircularProgress />
                                </Box>
                            )}
                        </Container>
                    </Grid>

                    <div className="footer">
                        <div style={{ width: '100%', margin: '0 auto', padding: '0 0px' }}>
                            <p style={{ textAlign: 'center', color: 'rgba(0, 0, 0, 0.8)', fontSize: '14px', margin: 0 }}>
                                © 2024 Liu Lab, Department of Computational Medicine and Bioinformatics, University of Michigan
                            </p>
                        </div>
                    </div>
                </div>
                <AntButton
                    onClick={() => setRunTour(true)}
                    // style={{ marginTop: '20px' }}
                    style={{
                        position: 'fixed',
                        bottom: '50px',
                        right: '20px',
                        width: '56px',
                        height: '56px',
                        fontSize: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#0169B0',
                        color: 'white',
                        border: 'none',
                    }}
                >
                    ?
                </AntButton>
            </div>
        </div>
    )
}

export default HomePage
