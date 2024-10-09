import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import 'antd/dist/reset.css';
import { TweenOneGroup } from "rc-tween-one";
import {Input, Col, Row, Spin, Tag, Menu, Button, Space, Divider} from 'antd';
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
import logo from "../../img/logo.svg";
import umLogo from "../../img/MedSchoolLogo.png";
import exampleQueries from '../../components/Units/SearchBarKnowledge/example_query.json';

const { Search } = Input;

const HomePage = () => {
    let navigate = useNavigate();
    const [tags, setTags] = useState([]);
    const [runTour, setRunTour] = useState(false);

    const handleSearch = async (v) => {
        navigate(`/result?q=${v}`)
    }

    const handleExampleQuery = (index) => {
        if (exampleQueries && exampleQueries.length > index) {
            const exampleQuery = exampleQueries[index];
            navigate('/result', { 
                state: { 
                    search_data: exampleQuery,
                    chipDataID: exampleQuery.triplets.map(triplet => [triplet.source[0], triplet.target[0]])
                } 
            });
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

    const steps = [
        {
            target: '.content img',  // Targeting the logo
            content: 'Welcome to GLKB! Let\'s explore how to use the search and visualize the biomedical knowledge from 33 million+ Pubmed articles and nine well-curated databases.',
            placement: 'bottom',
        },
        {
            target: '.search-autocomplete-box',  // Targeting the autocomplete box
            content: 'Start typing here to see autocomplete suggestions for your search terms.',
            placement: 'bottom',
        },
        {
            target: '.add-biomedical-term-button',  // Updated target
            content: 'After selecting a term, click here to add it to your search query.',
            placement: 'bottom',
        },
        {
            target: '.log-box',  // New step
            content: 'Your added terms will appear here, at most five terms can be added in one search. You can remove terms when you no longer need them.',
            placement: 'bottom',
        },
        {
            target: '.search-button',  // Updated target
            content: 'Once you finish adding terms, click here to perform the search.',
            placement: 'bottom',
        },
        {
            target: '.example-queries',
            content: 'Not sure where to start? Try one of these example queries to see how it works.',
            placement: 'top',
        },
        {
            target: '.example-query-button:first-child',
            content: 'Click on an example query to see it in action.',
            placement: 'bottom',
        }
    ];

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
                    }
                }}
                disableOverlayClose={true}
                disableCloseOnEsc={true}
                spotlightClicks={true}
            />
            <NavBarWhite showLogo={false} />
            <div className="content">
                <img src={logo} alt="Logo" />
                <div className="search-section" style={{ width: '80%', maxWidth: '1000px' }}>
                    <SearchBarKnowledge 
                        chipData = {[]}
                    />
                    <div className="example-queries">
                        <Button 
                            onClick={() => handleExampleQuery(0)}
                            className="example-query-button"
                        >
                            Example Query 1: SPRY2, RFX6, HNF4A, and Type 2 Diabetes
                        </Button>
                        <Button 
                            onClick={() => handleExampleQuery(1)}
                            className="example-query-button"
                        >
                            Example Query 2: TP53, SOX2, and Breast Cancer
                        </Button>
                        <Button 
                            onClick={() => handleExampleQuery(2)}
                            className="example-query-button"
                        >
                            Example Query 3: CYP2C19, Cardiovascular Abnormalities, and Clopidogrel
                        </Button>
                    </div>
                </div>
                <Button 
                    onClick={() => setRunTour(true)}
                    style={{ marginTop: '20px' }}
                    icon={<QuestionCircleOutlined />}
                >
                    Take a Guided Tour to GLKB
                </Button>
            </div>

            <div className="footer" style={{ 
                backgroundColor: '#4a7298', 
                padding: '20px 0',
                marginTop: '40px',
                width: '100%'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
                    {/* <Row justify="space-between" align="middle" gutter={[0, 16]}>
                        <Col xs={24} sm={12}>
                            <Space align="center" size="large">
                                <img src={umLogo} alt="Michigan Medicine Logo" style={{ height: '40px' }} />
                                <a href="https://jieliu6.github.io/" target="_blank" rel="noopener noreferrer" style={{ color: '#ffffff', fontSize: '16px' }}>Liu Lab, University of Michigan</a>
                            </Space>
                        </Col>
                        <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                            <Space align="center" size="large">
                                <GithubOutlined style={{ fontSize: '24px', color: '#ffffff' }} />
                                <a href="https://github.com/yuanhao96/GLKB" target="_blank" rel="noopener noreferrer" style={{ color: '#ffffff', fontSize: '16px' }}>GLKB GitHub Repository</a>
                            </Space>
                        </Col>
                    </Row> */}
                    <Divider style={{ margin: '20px 0', borderColor: 'rgba(255, 255, 255, 0.2)' }} />
                    <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px', margin: 0 }}>
                        © 2024 Liu Lab, Department of Computational Medicine and Bioinformatics, University of Michigan
                    </p>
                </div>
            </div>
        </div>
    )
}

export default HomePage
