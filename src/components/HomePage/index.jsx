import 'antd/dist/reset.css';
import './scoped.css';

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import { Button as AntButton } from 'antd';
import { Helmet } from 'react-helmet-async';
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
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import OutboundIcon from '@mui/icons-material/Outbound';
import {
  Box,
  CircularProgress,
  Container,
  Grid,
  Typography,
} from '@mui/material';

import NavBarWhite from '../Units/NavBarWhite';
import SearchBarKnowledge from '../Units/SearchBarKnowledge';
import SubNavBar from '../Units/SubNavBar';
import { trackEvent } from '../Units/analytics';
import LlmSearchBar from './LlmSearchBar';

// const { Search } = Input;


const HomePage = () => {
    const location = useLocation();
    const { state } = location || {};
    let navigate = useNavigate();
    // const [tags, setTags] = useState([]);
    const [runTour, setRunTour] = useState(false);
    const [activeButton, setActiveButton] = useState(state?.activeButton || "llm");

    // const [focused, setFocused] = useState(false);
    // const theme = useTheme();
    // const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    // Add refs for the search components
    const searchBarKnowledgeRef = useRef(null);
    // const searchBarNeighborhoodRef = useRef(null);
    const [stats, setStats] = useState(null);
    const [searchBarOpen, setSearchBarOpen] = useState(false);

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

        // const neighborSteps = [
        //     {
        //         target: '.search-autocomplete-box',
        //         content: 'Start typing to find a biomedical term you want to explore.',
        //         placement: 'bottom',
        //     },
        //     {
        //         target: '.term-type-dropdown',
        //         content: 'Select which types of terms you want to find (e.g., Genes, Diseases, Drugs).',
        //         placement: 'bottom',
        //     },
        //     {
        //         target: '.results-limit-dropdown',
        //         content: 'Choose how many related terms you want to see in the results.',
        //         placement: 'bottom',
        //     },
        //     {
        //         target: '.relationship-type-dropdown',
        //         content: 'Choose how you want to find related terms: through literature-based relationships or curated databases.',
        //         placement: 'bottom',
        //     }
        // ];

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
            ...(activeButton === 'triplet' ? [...tripletSteps, ...finalSteps] :
                llmSteps),
        ];
    };

    // Update steps when activeButton changes
    const steps = getTourSteps();

    return (
        <>
            <Helmet>
                <title>GLKB | AI-Powered Genomics Search</title>
                <meta name="description" content="Discover insights from 33M+ genomic research articles. GLKB enables AI-powered search across genes, diseases, variants, and chemicals with high accuracy." />
                <meta property="og:title" content="Home Page - Genomic Literature Knowledge Base" />
            </Helmet>
            <div style={{ maxHeight: '100vh', overflowY: 'hidden' }}>
                <NavBarWhite
                    showLogo={true} activeButton={activeButton}
                />
                <div className="HomePageContainer">
                    <div className="HomePageInner" style={{
                        backgroundColor: searchBarOpen ? '#e2ecf0' : '#F1FBFF',
                        transition: 'background-color 0.3s ease',
                    }}>
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
                                    textAlign: 'left',
                                    fontFamily: 'Open Sans, sans-serif',
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
                                fontWeight: 600,
                                fontSize: '16px',
                                textAlign: 'center',
                                paddingBottom: '12px',
                                color: '#FFF9C4',
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                padding: '8px 24px',
                                borderRadius: '8px',
                                marginBottom: '16px',
                            }}>
                                ⚠️ This site is currently under maintenance. Some features may be temporarily unavailable.
                            </Typography>
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
                                fontFamily: 'Open Sans',
                                fontWeight: 400,
                                fontSize: '20px',
                                color: 'white',
                                textAlign: 'center',
                                paddingBottom: '30px',
                                maxWidth: '600px',
                            }}>
                                Discover insights from genomic research with <Box component="span" sx={{ whiteSpace: 'nowrap' }}>AI-powered</Box> search and analysis
                            </Typography>
                            <Box sx={{ paddingBottom: '40px' }}>
                                <SubNavBar activeButton={activeButton} />
                            </Box>
                            <Box className={"search-bar"} sx={{ width: "-webkit-fill-available", paddingBottom: 'calc(min(9vh, 80px))' }}>
                                {activeButton === 'triplet' ? (
                                    <SearchBarKnowledge
                                        ref={searchBarKnowledgeRef}
                                        chipData={[]}
                                        setOpen={setSearchBarOpen}
                                        onSearch={(data) => {
                                            // console.log('Triplet Search Data:', {
                                            //     search_data: data,
                                            //     searchType: 'triplet',
                                            // });
                                            navigate('/search', {
                                                state: {
                                                    search_data: data,
                                                    searchType: 'triplet',
                                                }
                                            });
                                        }}
                                    />
                                ) : (
                                    <LlmSearchBar
                                        setOpen={setSearchBarOpen}
                                    />
                                )}
                            </Box>
                        </Box>
                        <Grid container spacing={2} className="content HomePageMain" justifyContent="center" alignItems="center" sx={{
                            marginTop: 'calc(min(4vh, 45px))'
                        }}>
                            <Container className="info-card-section" sx={{ gap: '40px', display: 'flex', flexDirection: 'row' }} >
                                {stats ? ([
                                    [OutboundIcon, "36%", "more accurate on PubMedQA with GLKB (62.3% → 98.1%)"],
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
                                            backgroundColor: 'transparent',
                                            border: '1px solid #0169B04D',
                                            // borderBottom: '5px solid #0169B0'
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
                                <p style={{ fontFamily: 'Open Sans, sans-serif', textAlign: 'center', color: 'rgba(0, 0, 0, 0.8)', fontSize: '14px', margin: 0 }}>
                                    © 2025 GLKB – Genomic Literature Knowledge Base | glkb.org
                                </p>
                                <p style={{ fontFamily: 'Open Sans, sans-serif', textAlign: 'center', color: 'rgba(0, 0, 0, 0.8)', fontSize: '14px', margin: 0 }}>
                                    Developed and maintained by the Jie Liu Lab, Department of Computational Medicine and Bioinformatics, University of Michigan.
                                </p>
                            </div>
                        </div>
                    </div>
                    <AntButton
                        onClick={() => {
                            trackEvent('Tutorial', 'tutorial_click', 'Help Icon Clicked');
                            setRunTour(true);
                        }}
                        // style={{ marginTop: '20px' }}
                        style={{
                            position: 'fixed',
                            bottom: '50px',
                            right: '20px',
                            width: '56px',
                            height: '56px',
                            fontSize: '24px',
                            borderRadius: '50%',
                            backgroundColor: '#079BD4',
                            color: 'white',
                            border: 'none',
                            fontFamily: 'Open Sans, sans-serif',
                        }}
                    >
                        ?
                    </AntButton>
                </div>
            </div>
        </>
    )
}

export default HomePage
