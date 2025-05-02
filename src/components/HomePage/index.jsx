import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import 'antd/dist/reset.css';
import { TweenOneGroup } from "rc-tween-one";
import { Input, Col, Row, Spin, Tag, Menu, Button as AntButton, Space, Divider } from 'antd';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import './scoped.css'
import { GithubOutlined, QuestionCircleOutlined, RadiusBottomleftOutlined } from '@ant-design/icons';
import GLKBLogoImg from '../../img/glkb_logo.png'
import UMLogo from '../../img/um_logo.jpg'
import MedSchoolLogo from '../../img/MedSchoolLogo.png'
import { DingtalkCircleFilled } from '@ant-design/icons';
import NavBar from '../NavBar';
import NavBarWhite from '../Units/NavBarWhite';
import SearchBarKnowledge from "../Units/SearchBarKnowledge";
import SearchBarNeighborhood from "../Units/SearchBarNeighborhood";
import logo from "../../img/logo.svg";
import umLogo from "../../img/MedSchoolLogo.png";
import exampleQueries from '../../components/Units/SearchBarKnowledge/example_query.json';
import { Grid, Button, Box, TextField } from '@mui/material'; // Import MUI components
import neighborhoodExamples from '../../components/Units/SearchBarNeighborhood/example_query.json';  // Add this import
import { trackEvent } from '../Units/analytics';
import CloseIcon from '@mui/icons-material/Close'; // Import the Clear (cross) icon
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'; 
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

const { Search } = Input;

const HomePage = () => {
    let navigate = useNavigate();
    const [tags, setTags] = useState([]);
    const [runTour, setRunTour] = useState(false);
    const [activeButton, setActiveButton] = useState('triplet');  // Changed default to 'triplet'
    const [llmQuery, setLlmQuery] = useState('');
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    // Add refs for the search components
    const searchBarKnowledgeRef = useRef(null);
    const searchBarNeighborhoodRef = useRef(null);

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
                target: '.example-query-tour',
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
                target: '.example-query-tour',
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
        <div className="HomePageContainer">
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
            <NavBarWhite showLogo={true} />
            <Grid container spacing={2} className="content" justifyContent="center"  alignItems="center">
                <Grid item xs={12}  container justifyContent="center" 
                    alignItems="center">
                    <img
                        src={logo}
                        alt="Logo"
                        style={{
                            width: '40%', // Make the logo responsive
                            maxWidth: '400px', // Set a max width for the logo
                            marginTop: '40px',
                            marginBottom: '40px',
                            display: 'block',
                        }}
                    />
                </Grid>
                
                <Grid item xs={12} container className="search-chat-part" justifyContent="center" alignItems="center">
                <Grid 
                    display="flex" 
                    justifyContent="flex-start"
                    gap={0} 
                    className="search-mode-buttons" // Add this class
                    xs={8}
                    container
                    sx={{ 
                        width: '100%', 
                        maxWidth: '833px', // Set the box width to 883px
                        margin: '0px', // Center the box horizontally on the page
                        marginBottom: '-15px', 
                        paddingLeft:isSmallScreen ? '0px':'24px',
                        paddingRight:isSmallScreen ? '0px':'24px',
                    }}
                >
                    <Button 
                        variant={activeButton === 'triplet' ? 'contained' : 'outlined'}
                        sx={{ 
                            width: '20%',
                            height: '60px',
                            border: '3px solid #FFFFFF',
                            background: activeButton === 'triplet' ? 'linear-gradient(to top, #4A65F4, #758BFF)' : 'white',
                            color: activeButton === 'triplet' ? 'white' : '#1E416D', // Text color based on active state
                            fontSize: 'clamp(14px, 2vw, 20px)', // Set font size
                            paddingRight: '32px',
                            fontWeight: 'bold', 
                            borderTopLeftRadius: '20px', 
                            clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0% 100%)',
                            boxShadow: activeButton === 'triplet' ? 'none' : 'initial', // 激活时无阴影
                            '&:hover': { backgroundColor: '#C4CCFE' }
                        }}
                    >
                        Search
                    </Button>
                    <Button 
                        variant={activeButton === 'llm' ? 'contained' : 'outlined'}
                        sx={{ 
                            background: activeButton === 'llm' ? 'linear-gradient(to left, #4A65F4, #758BFF)' : 'white',
                            color: activeButton === 'llm' ? 'white' : '#1E416D', // Text color based on active state
                            fontSize: 'clamp(14px, 2vw, 20px)', // Set font size
                            fontWeight: 'bold', 
                            width: '20%',
                            height: '60px',
                            border: '3px solid #FFFFFF',
                            borderBottomRightRadius: '20px', // 确保底部有圆角
                            clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0% 100%)', // Leaning left edge
                            marginLeft: '-5%', 
                            boxShadow: activeButton === 'triplet' ? 'none' : 'initial', // 激活时无阴影
                            '&:hover': { backgroundColor: '#C4CCFE' }
                        }}
                        onClick={() => setActiveButton('llm')}
                    >
                        {/* Search with LLM Agent */}
                        Chat
                    </Button>
                </Grid>
                <Grid container xs={8} className="search-section">
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
                        <Box sx={{ 
                            width: '100%',mt : 2,mb:2,
                            display: 'flex', 
                            gap: 2, 
                            paddingLeft: isSmallScreen?'0px':'24px',
                            paddingRight: isSmallScreen?'0px':'24px',
                        }}>
                
                            <TextField
                                type="text"
                                value={llmQuery}
                                onChange={(e) => setLlmQuery(e.target.value)}
                                placeholder="Ask a question about the biomedical literature..."
                                sx={{
                                    backgroundColor: 'white',
                                    height: '60px', // Increase the height of the input box
                                    width: '100%',
                                    '& .MuiInputBase-root': {
                                        height: '80px', // Adjust the height of the input field
                                        alignItems: 'center', // Center the text vertically
                                        paddingRight: '10px', // Remove right padding
                                    },
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: 'grey', // Optional: Customize border color
                                    },
                                }}
                                fullWidth
                                InputProps={{
                                    endAdornment: (
                                        <Box display="flex" alignItems="center">
                                            {/* Clear Icon */}
                                            <CloseIcon
                                                onClick={() => {
                                                    setLlmQuery(''); // Clear the input field
                                                }}
                                                sx={{
                                                    color: 'grey.500',
                                                    cursor: 'pointer',
                                                    fontSize: '20px', // Adjust size as needed
                                                    marginRight: '8px', // Add spacing from the SendIcon
                                                }}
                                            />
                                            {/* Search Icon */}
                                            <SendOutlinedIcon
                                                onClick={() => {
                                                    if (llmQuery.trim()) {
                                                        navigateToLLMAgent(llmQuery.trim()); // Trigger the search function
                                                    }
                                                }} // Trigger the search function
                                                sx={{
                                                    color: '#45628880',
                                                    cursor: 'pointer',
                                                    fontSize: '35px', // Adjust size as needed
                                                }}
                                            />
                                        </Box>
                                    ),
                                }}
                            />
                        </Box>
                    )}
                    <Grid container spacing={2} className="example-query-group" style={{  padding: '24px',paddingTop:'48px' }} >
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
                    </Grid>
                </Grid>
                <AntButton 
                    onClick={() => setRunTour(true)}
                    // style={{ marginTop: '20px' }}
                    icon={<QuestionCircleOutlined />}
                    style={{position: 'fixed', bottom: '20px',right: '20px'}}
                >
                    Take a Guided Tour to GLKB
                </AntButton>
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
    )
}

export default HomePage
