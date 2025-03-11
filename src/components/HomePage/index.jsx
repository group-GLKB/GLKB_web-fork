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

    // Add refs for the search components
    const searchBarKnowledgeRef = useRef(null);
    const searchBarNeighborhoodRef = useRef(null);

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
            },
            // {
            //     target: '.search-mode-buttons',
            //     content: 'Choose between two search modes: "Search biomedical terms" to explore relationships between multiple terms, or "Explore neighboring terms" to find related terms for a single entity.',
            //     placement: 'bottom',
            // }
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
            ...(activeButton === 'triplet' ? tripletSteps : neighborSteps),
            ...finalSteps
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
                disableOverlayClose={true}
                disableCloseOnEsc={true}
                spotlightClicks={true}
            />
            <NavBarWhite showLogo={false} />
            <div className="content">
                <img src={logo} alt="Logo" />
                {/* <Box 
                    display="flex" 
                    justifyContent="center" 
                    gap={2} 
                    mt={2} 
                    mb={2}
                    className="search-mode-buttons"  // Add this class
                >
                    <Button 
                        variant={activeButton === 'triplet' ? 'contained' : 'outlined'}
                        sx={{ 
                            backgroundColor: activeButton === 'triplet' ? '#F7EFAE' : 'transparent',
                            color: 'black', 
                            '&:hover': { backgroundColor: '#F3C846' }
                        }}
                        onClick={() => setActiveButton('triplet')}
                    >
                        Search biomedical terms
                    </Button>
                    <Button 
                        variant={activeButton === 'neighbor' ? 'contained' : 'outlined'}
                        sx={{ 
                            backgroundColor: activeButton === 'neighbor' ? '#F7EFAE' : 'transparent',
                            color: 'black', 
                            '&:hover': { backgroundColor: '#F3C846' }
                        }}
                        onClick={() => setActiveButton('neighbor')}
                    >
                        Explore related terms
                    </Button>
                </Box> */}
                <div className="search-section" style={{ width: '80%', maxWidth: '1000px' }}>
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
                    ) : (
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
                    )}
                    <div className="example-queries">
                        {activeButton === 'triplet' ? (
                            <>
                                <AntButton 
                                    onClick={() => handleExampleQuery(0)}
                                    className="example-query-button"
                                >
                                    Example Query 1: SPRY2, RFX6, HNF4A, and Type 2 Diabetes
                                </AntButton>
                                <AntButton 
                                    onClick={() => handleExampleQuery(1)}
                                    className="example-query-button"
                                >
                                    Example Query 2: TP53, SOX2, and Breast Cancer
                                </AntButton>
                                <AntButton 
                                    onClick={() => handleExampleQuery(2)}
                                    className="example-query-button"
                                >
                                    Example Query 3: CYP2C19, Cardiovascular Abnormalities, and Clopidogrel
                                </AntButton>
                            </>
                        ) : (
                            <>
                                <AntButton 
                                    onClick={() => handleExampleQuery(0)}
                                    className="example-query-button"
                                >
                                    Example Query 1: Find sequence variants related to TP53 based on literature
                                </AntButton>
                                <AntButton 
                                    onClick={() => handleExampleQuery(1)}
                                    className="example-query-button"
                                >
                                    Example Query 2: Find genes related to Alzheimer's disease based on literature
                                </AntButton>
                                <AntButton 
                                    onClick={() => handleExampleQuery(2)}
                                    className="example-query-button"
                                >
                                    Example Query 3: Find biomedical terms related to SOX2 based on curated databases
                                </AntButton>
                            </>
                        )}
                    </div>
                </div>
                <AntButton 
                    onClick={() => setRunTour(true)}
                    style={{ marginTop: '20px' }}
                    icon={<QuestionCircleOutlined />}
                >
                    Take a Guided Tour to GLKB
                </AntButton>
            </div>

            <div className="footer" style={{ 
                backgroundColor: '#4a7298', 
                padding: '20px 0',
                marginTop: '40px',
                width: '100%'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
                    <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px', margin: 0 }}>
                        © 2024 Liu Lab, Department of Computational Medicine and Bioinformatics, University of Michigan
                    </p>
                </div>
            </div>
        </div>
    )
}

export default HomePage
