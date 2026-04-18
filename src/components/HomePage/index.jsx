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
import { useNavigate } from 'react-router-dom';

import {
  ArrowOutward as ArrowOutwardIcon,
  Close as CloseIcon,
  DescriptionOutlined as DescriptionOutlinedIcon,
  Layers as LayersIcon,
  LightbulbOutlined as LightbulbOutlinedIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import {
  Box,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';

import {
  getMyTier,
  isFreePlanLimitReached,
} from '../../service/Tier';
import { useAuth } from '../Auth/AuthContext';
import exampleSchema from './exampleSchema.json';
import LlmSearchBar from './LlmSearchBarHome';

// const { Search } = Input;
const DEBUG_FORCE_LIMIT_WARNING = false;


const HomePage = () => {
    // const [tags, setTags] = useState([]);
    const [runTour, setRunTour] = useState(false);
    const [searchBarOpen, setSearchBarOpen] = useState(false);
    const [showExamples, setShowExamples] = useState(undefined);
    const [prefillQuery, setPrefillQuery] = useState('');
    const [isQueryLimitReached, setIsQueryLimitReached] = useState(false);
    const { isAuthenticated, loading } = useAuth();
    const navigate = useNavigate();
    const examplePanelRef = useRef(null);
    const iconMap = {
        lightbulb: <LightbulbOutlinedIcon />,
        chart: <TrendingUpIcon />,
        book: <DescriptionOutlinedIcon />,
        knowledge: <LayersIcon />,
    };
    const pills = (exampleSchema.pills || []).map((pill) => ({
        ...pill,
        icon: iconMap[pill.icon] || <LightbulbOutlinedIcon />,
    }));
    const activePill = pills.find((pill) => pill.id === showExamples);
    const isHomeLimitReachedEffective = isQueryLimitReached || DEBUG_FORCE_LIMIT_WARNING;
    const showHomeLimitWarning = isAuthenticated && isHomeLimitReachedEffective;

    // const [focused, setFocused] = useState(false);
    // const theme = useTheme();
    // const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    useEffect(() => {
        if (!showExamples) {
            return;
        }

        const handleClickOutside = (event) => {
            if (examplePanelRef.current && !examplePanelRef.current.contains(event.target)) {
                setShowExamples(undefined);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showExamples]);

    useEffect(() => {
        let active = true;

        const loadTier = async () => {
            if (loading || !isAuthenticated) {
                if (active) setIsQueryLimitReached(false);
                return;
            }

            const result = await getMyTier();
            if (!active || !result.success) return;
            setIsQueryLimitReached(isFreePlanLimitReached(result.data));
        };

        loadTier();
        return () => {
            active = false;
        };
    }, [isAuthenticated, loading]);

    useEffect(() => {
        if (showHomeLimitWarning) {
            setShowExamples(undefined);
        }
    }, [showHomeLimitWarning]);

    const handleAuthGate = (event) => {
        if (loading) return true;
        if (isAuthenticated) {
            return false;
        }
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        navigate('/login');
        return true;
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
                content: 'Welcome to GLKB AI Chat. Ask questions and explore biomedical literature with our agent.',
                placement: 'bottom',
                disableBeacon: true,
            },
        ];

        const llmSteps = [
            {
                target: '.llm-searchbar',
                content: 'Ask any question about biomedical literature. Our AI agent will help find and analyze relevant information for you.',
                placement: 'bottom',
            },
            {
                target: '.homepage-pills',
                content: 'Start with a sample question to see how GLKB works. \nYou can also type your own question anytime.',
                placement: 'bottom',
            }
        ];

        return [
            ...commonSteps,
            ...llmSteps,
        ];
    };

    // Update steps when activeButton changes
    const steps = getTourSteps();

    return (
        <>
            <Helmet>
                <title>Home | GLKB</title>
                <meta name="description" content="Discover insights from 33M+ genomic research articles. GLKB enables AI-powered search across genes, diseases, variants, and chemicals with high accuracy." />
                <meta property="og:title" content="Home Page - Genomic Literature Knowledge Base" />
            </Helmet>
            <div className="HomePageRoot">
                <div className="HomePageContainer">
                    <div className="HomePageInner" style={{
                        backgroundColor: '#FAFCFF',
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
                        <Box className="homepage-hero">
                            <Box className="homepage-hero-inner">
                                <Typography
                                    className="glkb-title"
                                    sx={{
                                        fontFamily: 'Open Sans, sans-serif',
                                        fontWeight: 600,
                                        fontSize: '40px',
                                        lineHeight: 1.1,
                                    }}
                                >
                                    <span style={{ color: '#333333' }}>Ask.</span>{' '}
                                    <span style={{ color: '#155DFC' }}>Analyze</span>
                                    <span style={{ color: '#333333' }}>. Cite.</span>
                                </Typography>
                                <Typography
                                    className="glkb-subtitle"
                                    sx={{
                                        fontFamily: 'DM Sans, sans-serif',
                                        fontWeight: 400,
                                        fontSize: '18px',
                                        color: '#333333',
                                        lineHeight: '26.64px',
                                    }}
                                >
                                    Weeks of research, done in minutes.
                                </Typography>
                            </Box>
                            <Box className="homepage-hero-search">
                                <Box className="search-bar">
                                    <Box className="homepage-search-stack">
                                        {showHomeLimitWarning && (
                                            <Box className="homepage-limit-warning">
                                                <span className="homepage-limit-warning-text">
                                                    You've reached your free plan limit (10 queries). Upgrade for unlimited access.
                                                </span>
                                                <button
                                                    type="button"
                                                    className="homepage-limit-warning-button"
                                                    onClick={() => navigate('/about#pricing')}
                                                >
                                                    Update
                                                </button>
                                            </Box>
                                        )}
                                        <LlmSearchBar
                                            setOpen={setSearchBarOpen}
                                            prefillQuery={prefillQuery}
                                            autocompleteOptions={exampleSchema.autocomplete || []}
                                            isQueryLimitReached={showHomeLimitWarning}
                                        />
                                        {activePill && (
                                            <Paper className="homepage-examples-panel" ref={examplePanelRef}>
                                                <Box className="homepage-examples-header">
                                                    <Typography className="homepage-examples-title">
                                                        {activePill.label}
                                                    </Typography>
                                                    <IconButton
                                                        aria-label="Close examples"
                                                        size="small"
                                                        onClick={() => setShowExamples(undefined)}
                                                        className="homepage-examples-close"
                                                    >
                                                        <CloseIcon sx={{ fontSize: 18 }} />
                                                    </IconButton>
                                                </Box>
                                                <Box className="homepage-examples-list">
                                                    {(activePill.examples || []).map((example) => (
                                                        <button
                                                            key={example}
                                                            type="button"
                                                            className="homepage-examples-item"
                                                            onClick={() => {
                                                                if (handleAuthGate()) {
                                                                    return;
                                                                }
                                                                setPrefillQuery(example);
                                                                setShowExamples(undefined);
                                                            }}
                                                        >
                                                            <span>{example}</span>
                                                            <span className="homepage-examples-arrow">
                                                                <ArrowOutwardIcon fontSize="small" />
                                                            </span>
                                                        </button>
                                                    ))}
                                                </Box>
                                            </Paper>
                                        )}
                                    </Box>
                                </Box>
                                <Box className={`homepage-pills${(searchBarOpen || showExamples) ? ' is-hidden' : ''}${showHomeLimitWarning ? ' has-limit-warning' : ''}`}>
                                    {pills.map((pill) => (
                                        <Box
                                            key={pill.id}
                                            className={`homepage-pill${showExamples === pill.id ? ' is-active' : ''}${showHomeLimitWarning ? ' is-disabled' : ''}`}
                                            onClick={(event) => {
                                                if (showHomeLimitWarning) {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    return;
                                                }
                                                if (handleAuthGate(event)) {
                                                    return;
                                                }
                                                setShowExamples((current) => current === pill.id ? undefined : pill.id);
                                            }}
                                        >
                                            <span className="homepage-pill-icon">{pill.icon}</span>
                                            <span className="homepage-pill-label">{pill.label}</span>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        </Box>

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
                            backgroundColor: '#E7F1FF',
                            color: '#155DFC',
                            border: 'none',
                            fontFamily: 'DM Sans, sans-serif',
                            boxShadow: '0px 1px 2px -1px rgba(0, 0, 0, 0.10), 0px 1px 3px rgba(0, 0, 0, 0.10)',
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
