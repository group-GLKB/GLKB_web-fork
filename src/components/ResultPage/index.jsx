import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { CypherService } from '../../service/Cypher'
import { DetailService } from '../../service/Detail'
import 'antd/dist/reset.css';
import { Col, Row, Input, Spin, Tag, Menu, Button, Tooltip } from 'antd';
import { TweenOneGroup } from 'rc-tween-one';
import './scoped.css'
import NavBarWhite from '../Units/NavBarWhite'
import GLKBLogoImg from '../../img/glkb_logo.png'
import NavBar from '../NavBar';
import UMLogo from '../../img/um_logo.jpg'
import queryString from 'query-string'
import Settings from "../Settings";
import Graph from "../Graph";
import Information from '../Information';
import axios from 'axios'
import sampleGraphData from './sampleData.json';
import SearchBarKnowledge from "../Units/SearchBarKnowledge";
import { FloatButton } from "antd";
import { PlusOutlined, MinusOutlined, InfoCircleOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ApartmentOutlined, FileTextOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { styled } from '@mui/material/styles';
import Joyride, { STATUS } from 'react-joyride';
import SearchBarNeighborhood from "../Units/SearchBarNeighborhood";
import { trackEvent } from '../Units/analytics';
import { debounce } from 'lodash';

const { Search } = Input;

const StyledButton = styled(Button)(({ theme }) => ({
    backgroundColor: '#99c7b1',
    color: 'black',
    '&:hover': {
        backgroundColor: '#577265',
        color: 'black',
    },
    '&:focus': {
        color: 'black',
    },
    minWidth: '60px',
    height: '40px',
}));

const ResultPage = () => {
    // const urlParams = new URLSearchParams(window.location.search);
    // const alltags = urlParams.get('data');
    const location = useLocation();
    const search_data = location.state.search_data;
    const chipDataID = location.state.chipDataID;
    // const { result } = location.state;
    // console.log(location.state)
    // const otags = alltags.split('|')
    const otags = ""
    const [tags, setTags] = useState(otags);
    const [detailId, setDetailId] = useState(null);
    const [allNodes, setAllNodes] = useState([]);
    const [data, setData] = useState({});
    const [graphData, setGraphData] = useState();
    /* ====== range initialization functions ====== */
    const [minGtdcFreq, setMinGtdcFreq] = useState(Infinity);
    const handleMinGtdcFreq = (value) => {
        setMinGtdcFreq(value)
    }
    const [maxGtdcFreq, setMaxGtdcFreq] = useState(-1);
    const handleMaxGtdcFreq = (value) => {
        setMaxGtdcFreq(value)
    }
    const [minGtdcNoc, setMinGtdcNoc] = useState(Infinity);
    const handleMinGtdcNoc = (value) => {
        setMinGtdcNoc(value)
    }
    const [maxGtdcNoc, setMaxGtdcNoc] = useState(-1);
    const handleMaxGtdcNoc = (value) => {
        setMaxGtdcNoc(value)
    }

    /* ====== range activation functions ====== */

    // Genomic Terms Density Control
    // frequency
    const [gtdcFreq, setGtdcFreq] = useState([0, 0]);
    const handleGtdcFreq = (range) => {
        setGtdcFreq(range);
    }
    const handleGtdcFreq1 = (props) => {
        let value = parseInt(props.target.value);
        setGtdcFreq([value, gtdcFreq[1]]);
    }
    const handleGtdcFreq2 = (props) => {
        let value = parseInt(props.target.value);
        setGtdcFreq([gtdcFreq[0], value]);
    }

    // number of citations
    const [gtdcNoc, setGtdcNoc] = useState([0, 0]);
    const handleGtdcNoc = (range) => {
        setGtdcNoc(range);
    }
    const handleGtdcNoc1 = (props) => {
        let value = parseInt(props.target.value);
        setGtdcNoc([value, gtdcNoc[1]]);
    }
    const handleGtdcNoc2 = (props) => {
        let value = parseInt(props.target.value);
        setGtdcNoc([gtdcNoc[0], value]);
    }

    /* ====== node type ====== */


    const [searchFlag, setSearchFlag] = useState(false)
    const [chipData, setChipData] = useState([]);
    const [chipDataIDResult, setChipDataIDResult] = useState([]);
    const [informationOpen, setInformationOpen] = useState(true);
    const [graphShownData, setGraphShownData] = useState();
    const [displayArticleGraph, setDisplayArticleGraph] = useState(false);
    const [isSettingsVisible, setIsSettingsVisible] = useState(true);
    const [isInformationVisible, setIsInformationVisible] = useState(true);

    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const containerRef = useRef(null);
    const SETTINGS_PANEL_WIDTH = '25vw';
    const INFORMATION_PANEL_WIDTH = '25vw';
    const MIN_PANEL_WIDTH = 400; // Minimum width for panels
    const [settingsWidth, setSettingsWidth] = useState('25vw');
    const [informationWidth, setInformationWidth] = useState(400);
    const settingsRef = useRef(null);
    const informationRef = useRef(null);

    // Modify these state variables for caching
    const [cachedTermGraph, setCachedTermGraph] = useState(null);
    const [cachedArticleGraph, setCachedArticleGraph] = useState(null);

    const graphContainerRef = useRef(null);

    // Add new state for the tour
    const [runTour, setRunTour] = useState(false);
    const [tourKey, setTourKey] = useState(0); // Add this new state

    // Define the steps for the guided tour
    const steps = [
        {
            target: '.search-bar-wrapper',
            content: 'Modify or start a new search here.',
            disableBeacon: true,
        },
        {
            target: '.graph-container-wrapper',
            content: 'This is the main graph visualization area. You can interact with nodes and edges here.',
        },
        {
            target: '.graph-control-button',
            content: 'Switch between biomedical term graph and article graph views.',
        },
        {
            target: '.floating-settings',
            content: 'Modify graph visualization and access node and edge summaries here.',
        },
        {
            target: '.floating-information',
            content: 'View detailed information about selected nodes or edges.',
        },
    ];

    // Handle tour events
    const handleJoyrideCallback = (data) => {
        const { status } = data;
        if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
            setRunTour(false);
            setTourKey(prevKey => prevKey + 1); // Increment the key when tour ends
        }
    };

    // Add this new function to start the tour
    const startTour = () => {
        // Track tour starts
        trackEvent('Tour', 'Start Tour', 'Result Page');
        setRunTour(true);
        setTourKey(prevKey => prevKey + 1);
    };

    useEffect(() => {
        const debouncedHandleResize = debounce(() => {
            if (containerRef.current) {
                const minWidth = 1200;
                if (windowWidth < minWidth) {
                    containerRef.current.style.width = `${minWidth}px`;
                } else {
                    containerRef.current.style.width = '100vw';
                }
            }

            // Update panel widths
            if (settingsRef.current) {
                setSettingsWidth(Math.max(settingsRef.current.offsetWidth, 400));
            }
            if (informationRef.current) {
                setInformationWidth(Math.max(informationRef.current.offsetWidth, 400));
            }
        }, 100); // 100ms delay

        window.addEventListener('resize', debouncedHandleResize);
        return () => {
            window.removeEventListener('resize', debouncedHandleResize);
            debouncedHandleResize.cancel();
        };
    }, [windowWidth]);

    useEffect(() => {
        if (containerRef.current) {
            const minWidth = 1200; // Should match the CSS min-width
            if (windowWidth < minWidth) {
                containerRef.current.style.width = `${minWidth}px`;
            } else {
                containerRef.current.style.width = '100vw';
            }
        }

        // Check and collapse settings panel if necessary
        if (settingsWidth < MIN_PANEL_WIDTH) {
            setIsSettingsVisible(false);
        }

        // Check and collapse information panel if necessary
        if (informationWidth < MIN_PANEL_WIDTH) {
            setIsInformationVisible(false);
        }
    }, [windowWidth, settingsWidth, informationWidth]);

    useEffect(() => {
        const updateWidths = () => {
            if (settingsRef.current) {
                setSettingsWidth(Math.max(settingsRef.current.offsetWidth, 400));
            }
            if (informationRef.current) {
                setInformationWidth(Math.max(informationRef.current.offsetWidth, 400));
            }
        };

        updateWidths();
        window.addEventListener('resize', updateWidths);
        return () => window.removeEventListener('resize', updateWidths);
    }, []);

    useEffect(() => {
        if (search_data) {
            const searchType = location.state.searchType;
            
            if (searchType === 'neighbor') {
                handleNeighborSearch(search_data);
            } else {
                // Default to triplet search
                handleTripletSearch(search_data);
            }
        }
    }, [search_data]);

    const handleNeighborSearch = async (searchData) => {
        try {
            let cypherServ = new CypherService();
            const neighborData = await cypherServ.Neighbor2Cypher(
                searchData.source.database_id,
                searchData.params.type,
                searchData.params.limit,
                searchData.params.rel_type,
                searchData.source.name
            );

            // Add validation check for neighborData
            if (!Array.isArray(neighborData) || neighborData.length < 2) {
                console.error('Invalid neighbor data format:', neighborData);
                return;
            }

            const graphData = neighborData[0];  // Contains nodes and edges
            const nodesList = neighborData[1];  // Contains simplified node list

            setData(graphData);
            setAllNodes(nodesList);
            setSearchFlag(true);
        } catch (error) {
            console.error('Error fetching neighbor data:', error);
            // Add error handling UI here
        }
    };

    const handleTripletSearch = async (searchData) => {
        try {
            let cypherServ = new CypherService();
            const response = await cypherServ.Triplet2Cypher(searchData);
            setData(response[0]);
            setAllNodes(response[1]);
            setSearchFlag(true);
        } catch (error) {
            console.error('Error fetching triplet data:', error);
            // Add error handling UI here
        }
    };

    useEffect(() => {
        if (chipDataID) {
            const newArray = [];
            chipDataID.forEach(idArray => { newArray.push(idArray) });
            console.log(newArray)
            setChipDataIDResult(newArray);
        }
        // Set information panel to open by default
        setInformationOpen(true);
    }, [chipDataID])

    useEffect(() => {
        const updateWidths = () => {
            if (settingsRef.current) {
                setSettingsWidth(settingsRef.current.offsetWidth);
            }
            if (informationRef.current) {
                setInformationWidth(informationRef.current.offsetWidth);
            }
        };

        updateWidths();
        window.addEventListener('resize', updateWidths);
        return () => window.removeEventListener('resize', updateWidths);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--settings-panel-width', SETTINGS_PANEL_WIDTH);
        root.style.setProperty('--information-panel-width', INFORMATION_PANEL_WIDTH);
    }, []);

    useEffect(() => {
        if (windowWidth < 1500) {
            setIsSettingsVisible(false);
            setIsInformationVisible(false);
        } else {
            setIsSettingsVisible(true);
            setIsInformationVisible(true);
        }
    }, [windowWidth]);

    useEffect(() => {
        const updateGraphPosition = () => {
            if (graphContainerRef.current) {
                const searchBarHeight = document.querySelector('.search-bar-container').offsetHeight;
                const navbarHeight = document.querySelector('.navbar-wrapper').offsetHeight;
                const topOffset = navbarHeight + searchBarHeight;

                graphContainerRef.current.style.position = 'fixed';
                graphContainerRef.current.style.top = `${topOffset}px`;
                graphContainerRef.current.style.left = isSettingsVisible ? SETTINGS_PANEL_WIDTH : '0';
                graphContainerRef.current.style.right = isInformationVisible ? INFORMATION_PANEL_WIDTH : '0';
                graphContainerRef.current.style.bottom = '0';
            }
        };

        window.addEventListener('resize', updateGraphPosition);
        updateGraphPosition(); // Initial call

        return () => window.removeEventListener('resize', updateGraphPosition);
    }, [isSettingsVisible, isInformationVisible]);

    const initialize = () => {
        setSearchFlag(false)
    }

    // Add new state for storing graph data
    const [graphForQuestions, setGraphForQuestions] = useState(null);

    // Modify the search function to store the graph data
    async function search(content) {
        setSearchFlag(false)
        setCachedTermGraph(null);
        setCachedArticleGraph(null);
        setDisplayArticleGraph(false);

        let cypherServ = new CypherService()
        const response = await cypherServ.Triplet2Cypher(content)
        console.log('function -> ', response)
        setData(response[0])
        setAllNodes(response[1])
        // Store just the graph data, not the entire response
        setGraphForQuestions(response[0])
        setCachedTermGraph(response);
        setSearchFlag(true)
    }

    useEffect(() => {
        let nodeIdsToKeep = []
        if (graphData) {
            for (var i = 0; i < graphData.length; i++) {
                nodeIdsToKeep.push(graphData[i])
            }
            const nodeIds = data.nodes.filter(node => nodeIdsToKeep.includes(node.data.id));
            const uniqueIds = new Set();
            const filteredNodes = [];
            nodeIds.forEach(node => {
                if (!uniqueIds.has(node.data.id)) {
                    uniqueIds.add(node.data.id);
                    filteredNodes.push(node);
                }
            });
            const filteredEdges = data.edges.filter(edge =>
                nodeIdsToKeep.includes(edge.data.source) && nodeIdsToKeep.includes(edge.data.target)
            );
            const filteredData = {
                nodes: filteredNodes,
                edges: filteredEdges
            };
            setGraphShownData(filteredData);
            setNodeCount(filteredNodes.length);
            setTotalNodeCount(data.nodes?.length || 0);
        } else {
            if (data.edges) {
                setGraphShownData(data);
                setNodeCount(data.nodes?.length || 0);
                setTotalNodeCount(data.nodes?.length || 0);
                setSearchFlag(true);
            }
        }
    }, [graphData, data])

    async function handleSelect(target) {
        let temp_id
        if (target.article_source) {
            temp_id = ["edge", ...target.eid];
        } else {
            temp_id = ["node", ...target.database_id];
        }
        console.log(temp_id)
        setDetailId(temp_id);
    }

    let selectedID;

    async function handleSelectNodeID(targetID) {
        let temp_id = targetID[0];
        if (!informationOpen) {
            handleInformation();
        }
        setDetailId(temp_id);
        selectedID = temp_id;
    }

    let nevigate = useNavigate();

    const handleSearch = async (v) => {
        initialize()
        nevigate(`/result?q=${v}`)
        search(v)
    }

    const handleInformation = () => {
        setInformationOpen(!informationOpen);
    };
    console.log(graphShownData)

    const toggleSettings = () => {
        setIsSettingsVisible(!isSettingsVisible);
    };

    const toggleInformation = () => {
        setIsInformationVisible(!isInformationVisible);
    };

    const [isGraphLoading, setIsGraphLoading] = useState(false);

    const changeLeftPanel = async () => {
        // Track graph type changes
        trackEvent('Graph', 'Change Graph Type', 
            displayArticleGraph ? 'Term Graph' : 'Article Graph'
        );

        setIsGraphLoading(true); // Start loading
        
        try {
            if (!displayArticleGraph) {
                setDisplayArticleGraph(true);
                setDetailId(null);
                await entityToArticle(data);
            } else {
                setDisplayArticleGraph(false);
                setDetailId(null);
                await articleToEntity();
            }
        } finally {
            setIsGraphLoading(false); // End loading regardless of success/failure
        }
    }

    async function entityToArticle(content) {
        if (cachedArticleGraph) {
            setData(cachedArticleGraph);
        } else {
            let cypherServ = new CypherService()
            const response = await cypherServ.Term2Article(content)
            console.log('Term2Article -> ', response)
            setData(response)
            setCachedArticleGraph(response);
        }
    }

    async function articleToEntity() {
        if (searchType === 'neighbor') {
            // Handle neighborhood search case
            handleNeighborSearch(search_data);
        } else {
            // Handle triplet search case
            if (cachedTermGraph) {
                setData(cachedTermGraph[0]);
                setAllNodes(cachedTermGraph[1]);
            } else {
                search(search_data);
            }
        }
    }

    const expandInformation = () => {
        setIsInformationVisible(true);
    };

    useEffect(() => {
        const updateSettingsWidth = () => {
            const vw25 = window.innerWidth * 0.25;
            setSettingsWidth(vw25 < 400 ? '400px' : '25vw');
        };

        updateSettingsWidth();
        window.addEventListener('resize', updateSettingsWidth);
        return () => window.removeEventListener('resize', updateSettingsWidth);
    }, []);

    // Add state to track search type
    const [searchType, setSearchType] = useState('triplet'); // default to triplet

    useEffect(() => {
        if (location.state?.searchType) {
            setSearchType(location.state.searchType);
        }
    }, [location.state]);

    // Add new state for node count
    const [totalNodeCount, setTotalNodeCount] = useState(0);
    const [nodeCount, setNodeCount] = useState(0);
    const NODE_LIMIT = 10;

    const getButtonTooltip = () => {
        if (totalNodeCount > NODE_LIMIT) {
            return `Cannot convert to article graph when there are more than ${NODE_LIMIT} nodes in the original graph (total: ${totalNodeCount} nodes). Please modify your search to reduce the number of nodes.`;
        } else if (displayArticleGraph) {
            return "Convert back to biomedical term graph";
        } else {
            return "Convert to article graph";
        }
    };

    return (
        <div className="result-container" ref={containerRef}>
            <Joyride
                steps={steps}
                run={runTour}
                continuous={true}
                showSkipButton={true}
                showProgress={true}
                styles={{
                    options: {
                        primaryColor: '#007bff',
                        zIndex: 10000,
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
                callback={handleJoyrideCallback}
                key={tourKey}
            />
            <div className="navbar-wrapper">
                <NavBarWhite />
            </div>
            <div className="search-bar-container">
                <div className="search-bar-wrapper">
                    {searchType === 'neighbor' ? (
                        <SearchBarNeighborhood
                            onSearch={(data) => {
                                setSearchFlag(false);
                                handleNeighborSearch(data);
                            }}
                        />
                    ) : (
                        <SearchBarKnowledge
                            chipData={chipData}
                            chipDataIDResult={chipDataIDResult}
                            displayArticleGraph={displayArticleGraph}
                            setDisplayArticleGraph={setDisplayArticleGraph}
                            onSearch={search}
                        />
                    )}
                </div>
            </div>
            <div className='main-content'>
                {(!searchFlag || isGraphLoading) && (
                    <div className='loading-container'>
                        <Spin size='large' />
                    </div>
                )}
                {searchFlag && !isGraphLoading && (
                    <div className='result-content'>
                        <div className="graph-controls">
                            <Tooltip title={getButtonTooltip()}>
                                <span>
                                    <StyledButton
                                        onClick={changeLeftPanel}
                                        variant="contained"
                                        startIcon={displayArticleGraph ? <ApartmentOutlined /> : <FileTextOutlined />}
                                        className="graph-control-button"
                                        disabled={totalNodeCount > NODE_LIMIT && !displayArticleGraph}
                                    >
                                        {displayArticleGraph ? "Convert to biomedical term graph" : "Convert to article graph"}
                                    </StyledButton>
                                </span>
                            </Tooltip>
                            <Button
                                icon={<QuestionCircleOutlined />}
                                onClick={startTour}
                                className="start-tour-button"
                            >
                                Take a Guided Tour to the Result
                            </Button>
                        </div>
                        <div className='graph-container-wrapper'>
                            <div className="graph-container">
                                {graphShownData && (graphShownData.nodes?.length === 0 || !graphShownData.nodes) ? (
                                    <div className="empty-graph-message" style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        textAlign: 'center',
                                        color: '#666'
                                    }}>
                                        <h2>No Results Found</h2>
                                        <p>Try modifying your search criteria or adjusting the filters.</p>
                                    </div>
                                ) : (
                                    <Graph
                                        data={graphShownData}
                                        selectedID={selectedID}
                                        minGtdcFreq={minGtdcFreq}
                                        maxGtdcFreq={maxGtdcFreq}
                                        minGtdcNoc={minGtdcNoc}
                                        maxGtdcNoc={maxGtdcNoc}
                                        gtdcFreq={gtdcFreq}
                                        handleGtdcFreq={handleGtdcFreq}
                                        handleMinGtdcFreq={handleMinGtdcFreq}
                                        handleMaxGtdcFreq={handleMaxGtdcFreq}
                                        gtdcNoc={gtdcNoc}
                                        handleGtdcNoc={handleGtdcNoc}
                                        handleMinGtdcNoc={handleMinGtdcNoc}
                                        handleMaxGtdcNoc={handleMaxGtdcNoc}
                                        handleSelect={handleSelect}
                                        handleInformation={handleInformation}
                                        informationOpen={informationOpen}
                                        expandInformation={expandInformation}
                                        className="graph"
                                        ref={graphContainerRef}
                                    />
                                )}
                            </div>
                        </div>
                        <div ref={settingsRef} className={`floating-settings ${isSettingsVisible ? 'open' : ''}`} style={{ width: settingsWidth, minWidth: '400px' }}>
                            <Settings
                                minGtdcFreq={minGtdcFreq}
                                maxGtdcFreq={maxGtdcFreq}
                                minGtdcNoc={minGtdcNoc}
                                maxGtdcNoc={maxGtdcNoc}
                                gtdcFreq={gtdcFreq}
                                handleGtdcFreq={handleGtdcFreq}
                                handleGtdcFreq1={handleGtdcFreq1}
                                handleGtdcFreq2={handleGtdcFreq2}
                                gtdcNoc={gtdcNoc}
                                handleGtdcNoc={handleGtdcNoc}
                                handleGtdcNoc1={handleGtdcNoc1}
                                handleGtdcNoc2={handleGtdcNoc2}
                                data={data}
                                allNodes={allNodes}
                                graphShownData={graphShownData}
                                setData={setData}
                                setGraphData={setGraphData}
                                handleSelectNodeID={handleSelectNodeID}
                                search={search}
                                search_data={search_data}
                                displayArticleGraph={displayArticleGraph}
                                setDisplayArticleGraph={setDisplayArticleGraph}
                                setDetailId={setDetailId}
                                onClose={() => setIsSettingsVisible(false)}
                                width={settingsWidth}
                                graphForQuestions={graphForQuestions}
                            />
                        </div>
                        <div ref={informationRef} className={`floating-information ${isInformationVisible ? 'open' : ''}`} style={{ minWidth: '400px' }}>
                            <Information
                                isOpen={informationOpen}
                                toggleSidebar={handleInformation}
                                detailId={detailId}
                                displayArticleGraph={displayArticleGraph}
                            />
                        </div>
                        <FloatButton
                            icon={isSettingsVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                            onClick={toggleSettings}
                            className={`settings-float-button ${!isSettingsVisible ? 'collapsed' : ''}`}
                        />
                        <FloatButton
                            icon={isInformationVisible ? <MinusOutlined /> : <InfoCircleOutlined />}
                            onClick={toggleInformation}
                            className={`information-float-button ${!isInformationVisible ? 'collapsed' : ''}`}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

export default ResultPage
