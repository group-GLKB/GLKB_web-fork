import 'antd/dist/reset.css';
import './scoped.css';

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Button as AntButton,
  Input,
} from 'antd';
import Joyride, {
  ACTIONS,
  EVENTS,
  STATUS,
} from 'react-joyride';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
  Autocomplete,
  Box,
  Container,
  Grid,
  Paper,
  Popper,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import exampleQueries
  from '../../components/Units/SearchBarKnowledge/example_query.json';
import neighborhoodExamples
  from '../../components/Units/SearchBarNeighborhood/example_query.json';
import { trackEvent } from '../Units/analytics';
import NavBarWhite from '../Units/NavBarWhite';
import SearchBarKnowledge from '../Units/SearchBarKnowledge';
import SearchButton from '../Units/SearchButton/SearchButton';
import SubNavBar from '../Units/SubNavBar';

const { Search } = Input;

const LLMExampleQueries = [
    "What is the role of BRCA1 in breast cancer?",
    "How many articles about Alzheimer's disease were published in 2020?",
    "What pathways does TP53 participate in?",
];

const HomePage = () => {
    const location = useLocation();
    const { state } = location || {};
    let navigate = useNavigate();
    const [tags, setTags] = useState([]);
    const [runTour, setRunTour] = useState(false);
    const [activeButton, setActiveButton] = useState(state?.activeButton || "triplet");  // Changed default to 'triplet'
    const [llmQuery, setLlmQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    // Add refs for the search components
    const searchBarKnowledgeRef = useRef(null);
    const searchBarNeighborhoodRef = useRef(null);
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

    const handleSearch = async (v) => {
        // Track searches
        trackEvent('Search', 'Search Performed', activeButton);

        navigate('/result', {
            state: {
                search_data: v,
                searchType: activeButton
            }
        });
    }

    const handleExampleQuery = (index) => {
        // Track example query clicks
        trackEvent('Search', 'Example Query Click', `Example ${index + 1}`);

        if (activeButton === 'triplet') {
            if (exampleQueries && exampleQueries.length > index) {
                const exampleQuery = exampleQueries[index];
                // Fill the search bar instead of navigating
                if (searchBarKnowledgeRef.current) {
                    searchBarKnowledgeRef.current.fillWithExample(exampleQuery);
                }
            }
        } else {
            if (neighborhoodExamples && neighborhoodExamples.length > index) {
                const exampleQuery = neighborhoodExamples[index];
                // Fill the search bar instead of navigating
                if (searchBarNeighborhoodRef.current) {
                    searchBarNeighborhoodRef.current.fillWithExample(exampleQuery);
                }
            }
        }
    }

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
                target: '.content img',
                content: 'Welcome to GLKB! Let\'s explore how to use the search and visualize the biomedical knowledge from 33 million+ Pubmed articles and nine well-curated databases.',
                placement: 'bottom',
                disableBeacon: true,
            },
            {
                target: '.search-mode-buttons',
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
                target: '.close-button',
                content: 'Remove terms by clicking this "X" button.',
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
                target: '.example-query-group',
                content: 'Try these example queries to see how the LLM Agent can help you explore biomedical knowledge.',
                placement: 'top',
            }
        ];

        const finalSteps = [
            {
                target: '.search-button',
                content: activeButton === 'triplet'
                    ? 'Click here to visualize the relationships between your selected terms.'
                    : 'Click here to find related terms based on your settings.',
                placement: 'bottom',
            },
            {
                target: '.example-query-group',
                content: 'Not sure where to start? Try one of these example queries to see how it works.',
                placement: 'top',
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
                    <Grid container spacing={2} className="content HomePageMain" justifyContent="center" alignItems="center">
                        <Grid item xs={12} container className="search-chat-part" justifyContent="center" alignItems="center"
                            sx={{
                                "& .MuiGrid-container": {
                                    maxWidth: '100%',
                                    flexBasis: '100%',
                                },
                            }}>
                            <Grid container justifyContent="center"
                                alignItems="center">
                                <Typography sx={{
                                    fontFamily: 'Roboto',
                                    fontWeight: 600,
                                    fontStyle: 'SemiBold',
                                    fontSize: '48px',
                                    leadingTrim: 'NONE',
                                    lineHeight: '100%',
                                    letterSpacing: '0%',
                                    textAlign: 'center',
                                    paddingTop: '9%',
                                    paddingBottom: '16px',
                                    background: 'linear-gradient(90deg, #672CD3 0%, #415FE3 50%, #682BD2 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}>
                                    Genomic Literature Knowledge Base
                                </Typography>
                                <Typography sx={{
                                    fontFamily: 'Inter',
                                    fontWeight: 400,
                                    fontSize: '16px',
                                    color: '#646C8B',
                                    textAlign: 'center',
                                    paddingBottom: '84px',
                                    maxWidth: '500px',
                                }}>
                                    Discover insights from genomic research with AI-powered search and analysis
                                </Typography>
                            </Grid>
                            <Grid
                                display="flex"
                                justifyContent="flex-start"
                                gap={0}
                                className="search-mode-buttons" // Add this class
                                container
                                sx={{
                                    width: '100%',
                                    maxWidth: '960px', // Set the box width to 960px
                                    margin: '0px', // Center the box horizontally on the page
                                    marginBottom: '24px',
                                    paddingLeft: isSmallScreen ? '0px' : '24px',
                                    paddingRight: isSmallScreen ? '0px' : '24px',
                                }}
                            >
                                <SubNavBar activeButton={activeButton} />
                            </Grid>
                            <Grid container className="search-section">
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
                                        sx={{
                                            width: '100%', // Set exact width
                                            margin: '0 auto', // Center horizontally
                                        }}
                                    />
                                ) : (
                                    <Box className="llm-searchbar" sx={{
                                        width: '100%',
                                        display: 'flex',
                                        gap: 2,
                                        marginLeft: isSmallScreen ? '0px' : '24px',
                                        marginRight: isSmallScreen ? '0px' : '24px',
                                        backgroundColor: 'white',
                                        borderRadius: '30px',
                                        boxShadow: '8px 6px 33px 0px #D8E6F8',
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
                                            onFocus={() => setFocused(true)}
                                            onBlur={() => setFocused(false)}
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
                                                                <SearchIcon sx={{ marginLeft: '20px', fontSize: '20px' }} />
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
                                {/* <Grid container spacing={2} className="example-query-group" style={{ padding: '24px', paddingTop: '48px' }} >
                            {activeButton === 'triplet' ? (
                                <>
                                    <Grid item xs={4} >
                                        <button
                                            onClick={() => handleExampleQuery(0)}
                                            className="example-query-button"
                                            sx={{
                                                backgroundColor: '#F4F6FE',
                                                '&:hover': {
                                                    backgroundColor: '#C4CCFE', // Hover color
                                                },
                                            }}
                                        >
                                            <Box>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                    Identify Gene-Disease Associations
                                                </div>
                                                <div style={{ fontSize: '12px', marginTop: '8px', color: '#6c757d' }}>
                                                    Explore relationships between Type 2 Diabetes and its associated genes.
                                                </div>
                                            </Box>
                                        </button>
                                    </Grid>
                                    <Grid item xs={4} >
                                        <button
                                            onClick={() => handleExampleQuery(1)}
                                            className="example-query-button"
                                        >
                                            <Box>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                    Identify Mechanisms of Variant Affecting Traits
                                                </div>
                                                <div style={{ fontSize: '12px', marginTop: '8px', color: '#6c757d' }}>
                                                    Explore relationships between rs3761624 and RSV infectious disease.
                                                </div>
                                            </Box>
                                        </button>
                                    </Grid>
                                    <Grid item xs={4} >
                                        <button
                                            onClick={() => handleExampleQuery(2)}
                                            className="example-query-button"
                                        >
                                            <Box>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                    Identify drug effects on diseases
                                                </div>
                                                <div style={{ fontSize: '12px', marginTop: '8px', color: '#6c757d' }}>
                                                    Explore relationships between clopidogrel and different diseases
                                                </div>
                                            </Box>
                                        </button>
                                    </Grid>
                                </>
                            ) : (
                                <>
                                    <Grid item xs={4} >
                                        <button
                                            onClick={() => navigateToLLMAgent("Who are you?")}
                                            className="example-query-button custom-ant-btn"

                                        >
                                            <Box>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                    Example Query 1:
                                                </div>
                                                <div style={{ fontSize: '12px', marginTop: '8px', color: '#6c757d' }}>
                                                    Who are you?                                        </div>
                                            </Box>
                                        </button>
                                    </Grid>
                                    <Grid item xs={4} >
                                        <button
                                            onClick={() => navigateToLLMAgent("What is the role of BRCA1 in breast cancer?")}
                                            className="example-query-button"
                                        >
                                            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                Example Query 2:
                                            </div>
                                            <div style={{ fontSize: '12px', marginTop: '8px', color: '#6c757d' }}>
                                                What is the role of BRCA1 in breast cancer?
                                            </div>
                                        </button>
                                    </Grid>
                                    <Grid item xs={4} >
                                        <button
                                            onClick={() => navigateToLLMAgent("How many articles about Alzheimer's disease were published in 2020?")}
                                            className="example-query-button"
                                        >
                                            <Box sx={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                    Example Query 3:
                                                </div>
                                                <div style={{ fontSize: '12px', marginTop: '8px', color: '#6c757d' }}>
                                                    How many articles about Alzheimer's disease are published in 2020?
                                                </div>
                                            </Box>
                                        </button>
                                    </Grid>
                                </>
                            )}
                        </Grid> */}
                                <Container className="info-card-section" sx={{ padding: '24px', paddingTop: '28px', gap: '30px', display: 'flex', flexDirection: 'row' }} >
                                    {(stats ? [
                                        [stats.num_active_users_d30 || "N/A", "Active users in the past month"],
                                        [stats.num_api_calling || "N/A", "Total external API calls since released"],
                                        [stats.num_articles || "N/A", "Articles covered in GLKB database"],
                                    ] : []).map(([value, description], index) => (
                                        <Grid item xs={4} key={index}>
                                            <Box
                                                sx={{
                                                    textAlign: 'left',
                                                    display: 'flex',
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'flex-start',
                                                    width: '100%',
                                                    minHeight: '100%',
                                                    height: '100px',
                                                    marginBottom: '10px',
                                                    whiteSpace: 'normal',
                                                    padding: '16px',
                                                    borderRadius: '12px',
                                                    backgroundColor: '#FFFFFF',
                                                    boxShadow: '8px 6px 33px 0px #D8E6F8',
                                                }}>
                                                <div style={{
                                                    fontFamily: 'Roboto Mono',
                                                    fontWeight: '500',
                                                    fontSize: '40px',
                                                    color: '#4B67FE',
                                                    padding: '0px 10px',
                                                    minWidth: '120px',
                                                    textAlign: 'center',
                                                    transform: 'translateY(-2px)',
                                                }}>
                                                    {value}
                                                </div>
                                                <div style={{ fontSize: '14px', color: '#646B96', maxWidth: '150px' }}>
                                                    {description}
                                                </div>
                                            </Box>
                                        </Grid>
                                    ))}
                                </Container>
                            </Grid>

                        </Grid>
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
                        backgroundColor: '#D3D5FF',
                        boxShadow: '8px 6px 33px 0px #D8E6F8',
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
