import 'antd/dist/reset.css';
import './scoped.css';

import React, {
  useEffect,
  useLayoutEffect,
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
} from '@mui/icons-material';
import {
  Box,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';

import { ReactComponent as PillEntityInsightsIcon } from '../../img/llm/pill_entity_insights.svg';
import { ReactComponent as PillLiteratureDiscoveryIcon } from '../../img/llm/pill_literature_discovery.svg';
import { ReactComponent as PillMechanismsIcon } from '../../img/llm/pill_mechanisms.svg';
import { ReactComponent as PillResearchTrendIcon } from '../../img/llm/pill_research_trend.svg';
import {
  getGuestTier,
  getMyTier,
  isFreePlanLimitReached,
} from '../../service/Tier';
import { trackGtagEvent } from '../../utils/gtag';
import { useAuth } from '../Auth/AuthContext';
import exampleSchema from './exampleSchema.json';
import LlmSearchBar from './LlmSearchBarHome';

// const { Search } = Input;
const DEBUG_FORCE_LIMIT_WARNING = false;

const isPhoneUa = () => /Android|iPhone|iPod|Windows Phone|Mobile/i.test(window.navigator.userAgent || '');
const isPhoneViewport = () => window.matchMedia('(max-width: 767px)').matches;


const HomePage = () => {
    // const [tags, setTags] = useState([]);
    const [runTour, setRunTour] = useState(false);
    const [searchBarOpen, setSearchBarOpen] = useState(false);
    const [isAutocompleteExamplesOpen, setIsAutocompleteExamplesOpen] = useState(false);
    const [showExamples, setShowExamples] = useState(undefined);
    const [prefillQuery, setPrefillQuery] = useState('');
    const [isQueryLimitReached, setIsQueryLimitReached] = useState(false);
    const [queryLimitTotal, setQueryLimitTotal] = useState(10);
    const [isPhoneDevice, setIsPhoneDevice] = useState(false);
    const { isAuthenticated, loading } = useAuth();
    const navigate = useNavigate();
    const examplePanelRef = useRef(null);
    const heroRef = useRef(null);
    const heroInnerRef = useRef(null);
    const [heroTopOffset, setHeroTopOffset] = useState(null);
    const iconMap = {
        lightbulb: <PillEntityInsightsIcon />,
        chart: <PillResearchTrendIcon />,
        book: <PillMechanismsIcon />,
        knowledge: <PillLiteratureDiscoveryIcon />,
    };
    const iconColorMap = {
        lightbulb: '#FBBF7A',
        chart: '#08B046',
        book: '#BD7AFB',
        knowledge: '#4B88FD',
    };
    const pills = (exampleSchema.pills || []).map((pill) => ({
        ...pill,
        icon: iconMap[pill.icon] || <PillEntityInsightsIcon />,
        iconColor: iconColorMap[pill.icon] || '#222A38',
    }));
    const activePill = pills.find((pill) => pill.id === showExamples);
    const isHomeLimitReachedEffective = isQueryLimitReached || DEBUG_FORCE_LIMIT_WARNING;
    const showHomeLimitWarning = isHomeLimitReachedEffective;
    const displayedQueryLimit = Number.isFinite(Number(queryLimitTotal)) && Number(queryLimitTotal) > 0
        ? Number(queryLimitTotal)
        : 10;

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
        const evaluateIsPhone = () => {
            setIsPhoneDevice(isPhoneUa() && isPhoneViewport());
        };

        evaluateIsPhone();
        window.addEventListener('resize', evaluateIsPhone);
        return () => {
            window.removeEventListener('resize', evaluateIsPhone);
        };
    }, []);

    useLayoutEffect(() => {
        if (!heroRef.current || !heroInnerRef.current) return;
        const heroRect = heroRef.current.getBoundingClientRect();
        const innerRect = heroInnerRef.current.getBoundingClientRect();
        setHeroTopOffset(innerRect.top - heroRect.top);
    }, []);

    useEffect(() => {
        let active = true;

        const loadTier = async () => {
            if (loading) {
                if (active) {
                    setIsQueryLimitReached(false);
                    setQueryLimitTotal(10);
                }
                return;
            }

            const result = isAuthenticated ? await getMyTier() : await getGuestTier();
            if (!active || !result.success) return;
            setIsQueryLimitReached(isFreePlanLimitReached(result.data));
            setQueryLimitTotal(Number(result.data?.quota_limit) || 10);
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
                <meta name="description" content="GLKB is an AI-powered research engine that synthesizes biomedical literature into structured, evidence-backed answers grounded in real publications, not just predictions." />
                <meta name="title" content="GLKB - Genomic Literature Knowledge Base" />
                <meta property="og:title" content="GLKB - Genomic Literature Knowledge Base" />
                <meta property="og:site_name" content="GLKB - Genomic Literature Knowledge Base" />
                <meta name="twitter:title" content="GLKB - Genomic Literature Knowledge Base" />
                <meta property="og:description" content="GLKB is an AI-powered research engine that synthesizes biomedical literature into structured, evidence-backed answers grounded in real publications, not just predictions." />
            </Helmet>
            <div className={`HomePageRoot${isPhoneDevice ? ' is-phone-device' : ''}`}>
                <div className="HomePageContainer">
                    <div className="HomePageInner" style={{
                        backgroundColor: '#FFFFFF',
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
                                    primaryColor: '#155DFC',
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
                                    fontFamily: 'Geist, sans-serif',
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
                        <Box
                            className="homepage-hero"
                            ref={heroRef}
                            style={heroTopOffset !== null ? { justifyContent: 'flex-start', paddingTop: `${heroTopOffset}px` } : undefined}
                        >
                            <Box className="homepage-hero-inner" ref={heroInnerRef}>
                                <Typography
                                    className="glkb-title"
                                    sx={{
                                        fontFamily: 'Geist, sans-serif',
                                        fontWeight: 800,
                                        fontSize: isPhoneDevice ? '30px' : '40px',
                                        lineHeight: 1.1,
                                    }}
                                >
                                    <span style={{ color: '#141B26' }}>Ask.</span>{' '}
                                    <span style={{ color: '#155DFC' }}>Analyze</span>
                                    <span style={{ color: '#141B26' }}>. Cite.</span>
                                </Typography>
                                <Typography
                                    className="glkb-subtitle"
                                    sx={{
                                        fontFamily: 'Geist, sans-serif',
                                        fontWeight: 400,
                                        fontSize: '18px',
                                        color: '#5E6E87',
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
                                                    You've reached your query limit ({displayedQueryLimit} queries). Upgrade for unlimited access.
                                                </span>
                                                <button
                                                    type="button"
                                                    className="homepage-limit-warning-button"
                                                    disabled
                                                >
                                                    Update
                                                </button>
                                            </Box>
                                        )}
                                        <LlmSearchBar
                                            setOpen={setSearchBarOpen}
                                            setExamplesOpen={setIsAutocompleteExamplesOpen}
                                            onCollapseExampleLists={() => {
                                                setShowExamples(undefined);
                                                setIsAutocompleteExamplesOpen(false);
                                            }}
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
                                                        onClick={() => {
                                                            trackGtagEvent('home_examples_close_click', {
                                                                section: activePill?.id || '',
                                                            });
                                                            setShowExamples(undefined);
                                                        }}
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
                                                                trackGtagEvent('home_example_item_click', {
                                                                    section: activePill?.id || '',
                                                                    label: activePill?.label || '',
                                                                });
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
                                <Box className={`homepage-pills${(showExamples || isAutocompleteExamplesOpen) ? ' is-hidden' : ''}${showHomeLimitWarning ? ' has-limit-warning' : ''}`}>
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
                                                trackGtagEvent('home_example_group_click', {
                                                    section: pill.id,
                                                    label: pill.label,
                                                });
                                                setShowExamples((current) => current === pill.id ? undefined : pill.id);
                                            }}
                                        >
                                            <span className="homepage-pill-icon" style={{ color: pill.iconColor }}>{pill.icon}</span>
                                            <span className="homepage-pill-label">{pill.label}</span>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        </Box>

                        <div className="footer">
                            <div style={{ width: '100%', margin: '0 auto', padding: '0 0px' }}>
                                <p style={{ fontFamily: 'Geist, sans-serif', textAlign: 'center', color: '#A8B3C8', fontSize: '14px', margin: 0 }}>
                                    © 2026 GLKB – Genomic Literature Knowledge Base | glkb.org
                                </p>
                                <p style={{ fontFamily: 'Geist, sans-serif', textAlign: 'center', color: '#A8B3C8', fontSize: '14px', margin: 0 }}>
                                    Developed and maintained by the <a className="homepage-lab-link" href="https://jieliu6.github.io/" target="_blank" rel="noopener noreferrer">Jie Liu Lab</a>, Department of Computational Medicine and Bioinformatics, University of Michigan.
                                </p>
                            </div>
                        </div>
                    </div>
                    <AntButton
                        onClick={() => {
                            trackGtagEvent('home_tour_open_click', { source: 'floating_help_button' });
                            setRunTour(true);
                        }}
                        // style={{ marginTop: '20px' }}
                        style={{
                            position: 'fixed',
                            bottom: isPhoneDevice ? '100px' : '24px',
                            right: '20px',
                            width: '56px',
                            height: '56px',
                            fontSize: '24px',
                            borderRadius: '50%',
                            backgroundColor: '#E7F1FF',
                            color: '#155DFC',
                            border: 'none',
                            fontFamily: 'Geist, sans-serif',
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
