import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import 'antd/dist/reset.css';
import { TweenOneGroup } from "rc-tween-one";
import {Input, Col, Row, Spin, Tag, Menu, Button as AntButton, Space, Divider} from 'antd';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import './scoped.css'
import { GithubOutlined, QuestionCircleOutlined } from '@ant-design/icons';
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
import { Button, Box } from '@mui/material'; // Import MUI components
import neighborhoodExamples from '../../components/Units/SearchBarNeighborhood/example_query.json';  // Add this import
import { trackEvent } from '../Units/analytics';

const { Search } = Input;

const HomePage = () => {
    let navigate = useNavigate();
    const [tags, setTags] = useState([]);
    const [runTour, setRunTour] = useState(false);
    const [activeButton, setActiveButton] = useState('triplet');  // Changed default to 'triplet'
    const [llmQuery, setLlmQuery] = useState('');

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
            {
                target: '.search-autocomplete-box',
                content: 'Start typing here to see autocomplete suggestions for your search terms.',
                placement: 'bottom',
            },
            {
                target: '.add-biomedical-term-button',
                content: 'After selecting a term, click here to add it to your search query.',
                placement: 'bottom',
            },
            {
                target: '.log-box',
                content: 'Your added terms will appear here. You can add up to five terms in one search. Remove terms by clicking the "X" button.',
                placement: 'bottom',
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
                target: 'input[type="text"]',
                content: 'Ask any question about biomedical literature. Our AI agent will help find and analyze relevant information for you.',
                placement: 'bottom',
            },
            {
                target: '.example-queries',
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
                target: '.example-queries',
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
            <div className="content">
                <img src={logo} alt="Logo" />
                <Box 
                    display="flex" 
                    justifyContent="center" 
                    gap={0} 
                    mt={0} 
                    mb={0}
                    className="search-mode-buttons"  // Add this class
                >
                    <Button 
                        variant={activeButton === 'triplet' ? 'contained' : 'outlined'}
                        sx={{ 
                            backgroundColor: activeButton === 'triplet' ? '#F0F0F0' : 'transparent',
                            color: 'black', 
                            borderTopLeftRadius: '8px', // 设置顶部左边圆角
                            borderTopRightRadius: '8px', // 设置顶部右边圆角
                            borderBottomLeftRadius: '0', // 确保底部没有圆角
                            borderBottomRightRadius: '0', // 确保底部没有圆角
                            boxShadow: activeButton === 'triplet' ? 'none' : 'initial', // 激活时无阴影
                            '&:hover': { backgroundColor: '#F3C846' }
                        }}
                        onClick={() => setActiveButton('triplet')}
                    >
                        {/* Search biomedical terms */}
                        Search
                    </Button>
                    {/* <Button 
                        variant={activeButton === 'neighbor' ? 'contained' : 'outlined'}
                        sx={{ 
                            backgroundColor: activeButton === 'neighbor' ? '#F7EFAE' : 'transparent',
                            color: 'black', 
                            '&:hover': { backgroundColor: '#F3C846' }
                        }}
                        onClick={() => setActiveButton('neighbor')}
                    >
                        Explore Related Terms
                    </Button> */}
                    <Button 
                        variant={activeButton === 'llm' ? 'contained' : 'outlined'}
                        sx={{ 
                            backgroundColor: activeButton === 'llm' ? '#F0F0F0' : 'transparent',
                            color: 'black', 
                            borderTopLeftRadius: '8px', // 设置顶部左边圆角
                            borderTopRightRadius: '8px', // 设置顶部右边圆角
                            borderBottomLeftRadius: '0', // 确保底部没有圆角
                            borderBottomRightRadius: '0', // 确保底部没有圆角
                            boxShadow: activeButton === 'triplet' ? 'none' : 'initial', // 激活时无阴影
                            '&:hover': { backgroundColor: '#F3C846' }
                        }}
                        onClick={() => setActiveButton('llm')}
                    >
                        {/* Search with LLM Agent */}
                        Chat
                    </Button>
                </Box>
                <div className="search-section" style={{ width: '80%', maxWidth: '1000px'}}>
                    {activeButton === 'triplet' ? (
                        <SearchBarKnowledge 
                            ref={searchBarKnowledgeRef}
                            chipData={[]} 
                            onSearch={(data) => {
                                console.log('Triplet Search Data:', {
                                    search_data: data,
                                    searchType: 'triplet'
                                });
                                navigate('/result', { 
                                    state: { 
                                        search_data: data,
                                        searchType: 'triplet'
                                    } 
                                });
                            }}
                        />
                    ) : activeButton === 'neighbor' ? (
                        <SearchBarNeighborhood 
                            ref={searchBarNeighborhoodRef}
                            onSearch={(data) => {
                                console.log('Neighbor Search Data:', {
                                    search_data: data,
                                    searchType: 'neighbor'
                                });
                                navigate('/result', { 
                                    state: { 
                                        search_data: data,
                                        searchType: 'neighbor'
                                    } 
                                });
                            }}
                        />
                    ) : (
                        <div style={{ width: '100%', maxWidth: '800px', margin: '10px auto' }}>
                            <div style={{ 
                                display: 'flex', 
                                borderRadius: '8px',
                                backgroundColor: '#F0F0F0',
                                padding: '1rem',
                            }}>
                                <form 
                                    style={{ 
                                        display: 'flex', 
                                        width: '100%',
                                        gap: '1rem'
                                    }}
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (llmQuery.trim()) {
                                            navigateToLLMAgent(llmQuery.trim());
                                        }
                                    }}
                                >
                                    <input
                                        type="text"
                                        value={llmQuery}
                                        onChange={(e) => setLlmQuery(e.target.value)}
                                        placeholder="Ask a question about the biomedical literature..."
                                        style={{ 
                                            flexGrow: 1,
                                            padding: '0.8rem',
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '4px',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            backgroundColor: 'white'
                                        }}
                                    />
                                    <AntButton 
                                        type="primary" 
                                        htmlType="submit"
                                        disabled={!llmQuery.trim()}
                                        style={{
                                            backgroundColor: '#99c7b1',
                                            color: 'black',
                                            border: 'none',
                                            padding: '0.8rem 1.5rem',
                                            height: '42px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            whiteSpace: 'nowrap',
                                            fontSize: '1rem',
                                            transition: 'all 0.2s ease',
                                            borderRadius: '4px'
                                        }}
                                    >
                                        Send
                                    </AntButton>
                                    <AntButton
                                        onClick={() => setLlmQuery('')}
                                        style={{
                                            padding: '0.8rem 1.5rem',
                                            backgroundColor: '#f5f5f5',
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '1rem',
                                            transition: 'all 0.2s ease',
                                            height: '42px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        Clear
                                    </AntButton>
                                </form>
                            </div>
                            <div style={{ marginTop: '-5px', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
                                I can help you explore biomedical literature. Here are some examples:
                            </div>
                        </div>
                    )}
                    <div className="example-queries" style={{ 
                        display: 'flex', 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        gap: '10px',
                        width: '100%',
                        marginTop: activeButton === 'triplet' ? '20px' : '20px', 
                           
                    }}>
                        {activeButton === 'triplet' ? (
                            <>
                                <AntButton 
                                    onClick={() => handleExampleQuery(0)}
                                    className="example-query-button"
                                    style={{ 
                                        flex: 1, 
                                        margin: '0 5px', 
                                        height: '80px',  
                                        whiteSpace: 'normal', 
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        // backgroundColor: activeButton === 'triplet' ? '#99c7b1' : 'white',
                                        border: 'none',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Example: Identify gene-disease associations (Explore relationships between Type 2 Diabetes and its associated genes)
                                </AntButton>
                                <AntButton 
                                    onClick={() => handleExampleQuery(1)}
                                    className="example-query-button"
                                    style={{ 
                                        flex: 1, 
                                        margin: '0 5px', 
                                        height: '80px',  
                                        whiteSpace: 'normal', 
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        // backgroundColor: activeButton === 'triplet' ? '#99c7b1' : 'white',
                                        border: 'none',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Example: Identify mechanisms of variant affecting tratis (Explore relationships between rs3761624 and RSV infectious disease)
                                </AntButton>
                                <AntButton 
                                    onClick={() => handleExampleQuery(2)}
                                    className="example-query-button"
                                    style={{ 
                                        flex: 1, 
                                        margin: '0 5px', 
                                        height: '80px',  
                                        whiteSpace: 'normal', 
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        // backgroundColor: activeButton === 'triplet' ? '#99c7b1' : 'white',
                                        border: 'none',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Example: Identify drug effects on diseases (Explore relationships between clopidogrel and different diseases)
                                </AntButton>
                            </>
                        ) : activeButton === 'neighbor' ? (
                            <>
                                <AntButton 
                                    onClick={() => handleExampleQuery(0)}
                                    className="example-query-button"
                                    style={{ 
                                        flex: 1, 
                                        margin: '0 5px', 
                                        height: '80px',  
                                        whiteSpace: 'normal', 
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        // backgroundColor: activeButton === 'neighbor' ? '#99c7b1' : 'white',
                                        border: 'none',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Example Query 1: Find sequence variants related to TP53 based on literature
                                </AntButton>
                                <AntButton 
                                    onClick={() => handleExampleQuery(1)}
                                    className="example-query-button"
                                    style={{ 
                                        flex: 1, 
                                        margin: '0 5px', 
                                        height: '80px',  
                                        whiteSpace: 'normal', 
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        // backgroundColor: activeButton === 'neighbor' ? '#99c7b1' : 'white',
                                        border: 'none',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Example Query 2: Find genes related to Alzheimer's disease based on literature
                                </AntButton>
                                <AntButton 
                                    onClick={() => handleExampleQuery(2)}
                                    className="example-query-button"
                                    style={{ 
                                        flex: 1, 
                                        margin: '0 5px', 
                                        height: '80px',  
                                        whiteSpace: 'normal', 
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        // backgroundColor: activeButton === 'neighbor' ? '#99c7b1' : 'white',
                                        border: 'none',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Example Query 3: Find biomedical terms related to SOX2 based on curated databases
                                </AntButton>
                            </>
                        ) : (
                            <>
                                <AntButton 
                                    onClick={() => navigateToLLMAgent("Who are you?")}
                                    className="example-query-button"
                                    style={{ 
                                        flex: 1, 
                                        margin: '0 5px', 
                                        height: '80px',  
                                        whiteSpace: 'normal', 
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        // backgroundColor: activeButton === 'llm' ? '#99c7b1' : 'white',
                                        border: 'none',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Example Query 1: Who are you?
                                </AntButton>
                                <AntButton 
                                    onClick={() => navigateToLLMAgent("What is the role of BRCA1 in breast cancer?")}
                                    className="example-query-button"
                                    style={{ 
                                        flex: 1, 
                                        margin: '0 5px', 
                                        height: '80px',  
                                        whiteSpace: 'normal', 
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        // backgroundColor: activeButton === 'llm' ? '#99c7b1' : 'white',
                                        border: 'none',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Example Query 2: What is the role of BRCA1 in breast cancer?
                                </AntButton>
                                <AntButton 
                                    onClick={() => navigateToLLMAgent("How many articles about Alzheimer's disease were published in 2020?")}
                                    className="example-query-button"
                                    style={{ 
                                        flex: 1, 
                                        margin: '0 5px', 
                                        height: '80px',  
                                        whiteSpace: 'normal', 
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        // backgroundColor: activeButton === 'llm' ? '#99c7b1' : 'white',
                                        border: 'none',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Example Query 3: How many articles about Alzheimer's disease are published in 2020?
                                </AntButton>
                            </>
                        )}
                    </div>
                </div>
                <AntButton 
                    onClick={() => setRunTour(true)}
                    // style={{ marginTop: '20px' }}
                    icon={<QuestionCircleOutlined />}
                    style={{position: 'fixed', bottom: '20px',right: '20px'}}
                >
                    Take a Guided Tour to GLKB
                </AntButton>
            </div>

            <div className="footer">
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 0px' }}>
                    <p style={{ textAlign: 'center', color: 'rgba(0, 0, 0, 0.8)', fontSize: '14px', margin: 0 }}>
                        © 2024 Liu Lab, Department of Computational Medicine and Bioinformatics, University of Michigan
                    </p>
                </div>
            </div>
        </div>
    )
}

export default HomePage
