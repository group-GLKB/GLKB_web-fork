import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { CypherService } from '../../service/Cypher'
import { DetailService } from '../../service/Detail'
import 'antd/dist/reset.css';
import { Col, Row, Input, Spin, Tag, Menu, Button, Tooltip, Checkbox } from 'antd';
import { TweenOneGroup } from 'rc-tween-one';

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
import { PlusOutlined, MinusOutlined, InfoCircleOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ApartmentOutlined, FileTextOutlined, QuestionCircleOutlined, CaretRightOutlined } from '@ant-design/icons';
import { styled } from '@mui/material/styles';
import Joyride, { STATUS } from 'react-joyride';
import SearchBarNeighborhood from "../Units/SearchBarNeighborhood";
import { trackEvent } from '../Units/analytics';
import { debounce } from 'lodash';
import { Box } from '@mui/material';
//import mui button as muibutton
import { Button as MUIButton } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import './scoped.css'

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

    // Add new state for search content
    const [searchContent, setSearchContent] = useState(null);

    useEffect(() => {
        if (search_data) {
            // Store the initial search content
            setSearchContent(search_data);
            const searchType = location.state.searchType;

            if (searchType === 'neighbor') {
                handleNeighborSearch(search_data);
            } else {
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

    // Memoize handleSelect
    const handleSelect = useCallback((target) => {
        let temp_id;
        if (target.article_source) {
            temp_id = ["edge", ...target.eid];
        } else {
            temp_id = ["node", ...target.database_id];
        }
        setDetailId(temp_id);
    }, []);

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
        trackEvent('Graph', 'Change Graph Type',
            displayArticleGraph ? 'Term Graph' : 'Article Graph'
        );

        setIsGraphLoading(true);

        try {
            if (!displayArticleGraph) {
                setDisplayArticleGraph(true);
                setDetailId(null);
                await entityToArticle(data);
            } else {
                setDisplayArticleGraph(false);
                setDetailId(null);
                // Pass the original search content when switching back
                await articleToEntity(searchContent);
            }
        } finally {
            setIsGraphLoading(false);
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

    async function articleToEntity(content) {
        if (searchType === 'neighbor') {
            handleNeighborSearch(content);
        } else {
            if (cachedTermGraph) {
                setData(cachedTermGraph[0]);
                setAllNodes(cachedTermGraph[1]);
            } else {
                search(content);
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

    // Add legend-related state and functions
    const [uniqueLabelsSet, setUniqueLabelsSet] = useState(new Set());
    const [uniqueEdgeLabelsSet, setUniqueEdgeLabelsSet] = useState(new Set());
    const [uniqueLabelsArray, setUniqueLabelsArray] = useState([]);
    const [uniqueEdgeLabelsArray, setUniqueEdgeLabelsArray] = useState([]);
    const [boolValues, setBoolValues] = useState({});
    const [boolEdgeValues, setBoolEdgeValues] = useState({});

    useEffect(() => {
        if (data.edges) {
            const edgeLabelsSet = new Set(data.edges.map(edge => edge.data.label));
            setUniqueEdgeLabelsSet(edgeLabelsSet);
            setUniqueEdgeLabelsArray([...edgeLabelsSet]);
        }
        if (data.nodes) {
            const labelsSet = new Set(data.nodes.map(node => node.data.label));
            setUniqueLabelsSet(labelsSet);
            setUniqueLabelsArray([...labelsSet]);
        }
    }, [data]);

    useEffect(() => {
        if (graphShownData?.nodes && graphShownData?.edges) {
            const currentLabelsSet = new Set(graphShownData.nodes.map(node => node.data.label));
            const currentEdgeLabelsSet = new Set(graphShownData.edges.map(edge => edge.data.label));

            const newBoolValues = {};
            const newBoolEdgeValues = {};

            uniqueEdgeLabelsArray.forEach(label => {
                newBoolEdgeValues[label] = currentEdgeLabelsSet ? currentEdgeLabelsSet.has(label) : true;
            });

            uniqueLabelsArray.forEach(label => {
                newBoolValues[label] = currentLabelsSet ? currentLabelsSet.has(label) : true;
            });

            setBoolValues(newBoolValues);
            setBoolEdgeValues(newBoolEdgeValues);
        }
    }, [graphShownData, uniqueLabelsArray, uniqueEdgeLabelsArray]);

    const onChangeNode = (e, label, prevChecked) => {
        console.log(label, prevChecked);
        if (prevChecked) {
            const tempKeys = [];
            for (let i = 0; i < graphShownData.nodes.length; i++) {
                if (graphShownData.nodes[i].data.label !== label) {
                    tempKeys.push(graphShownData.nodes[i].data.id);
                }
            }
            setGraphData(tempKeys);
            setBoolValues({ ...boolValues, [label]: false });
        } else {
            const tempKeys = [];
            for (let i = 0; i < data.nodes.length; i++) {
                if (data.nodes[i].data.label === label) {
                    tempKeys.push(data.nodes[i].data.id);
                }
            }
            const currentKeys = graphData || [];
            setGraphData([...currentKeys, ...tempKeys]);
            setBoolValues({ ...boolValues, [label]: true });
        }
    };

    const LegendItem = ({ label, size, color, explanation }) => {
        const isQueryTerms = label === 'query terms';
        const isRelationship = label.includes("relationship");

        return (
            <div className="legend-item">
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    {isRelationship ? (
                        <div style={{
                            width: "30px",
                            height: "0",
                            borderBottom: size,
                            borderColor: color,
                            marginRight: '10px',
                            marginLeft: '5px',
                        }}></div>
                    ) : (
                        <div className="legend-circle" style={{
                            backgroundColor: color,
                            width: size,
                            height: size,
                            marginLeft: size === 5 ? "6px" : size === 10 ? "4px" : "0"
                        }}></div>
                    )}
                    <div className="legend-label" style={{ marginLeft: '5px' }}>
                        {label}
                        {isRelationship && (
                            <Tooltip title={explanation}>
                                <InfoCircleOutlined style={{ marginLeft: '8px', color: '#1890ff', marginRight: "5px" }} />
                            </Tooltip>
                        )}
                    </div>
                </div>
                {!isRelationship && !isQueryTerms && (
                    <Checkbox
                        value={label}
                        checked={boolValues[label]}
                        onChange={onChangeNode}
                        style={{ marginLeft: 'auto' }}
                    />
                )}
            </div>
        );
    };

    const LegendButton = ({ label, size, color, explanation }) => {
        return (
            <MUIButton variant="contained" onClick={(e) => { onChangeNode(e, label, boolValues[label]) }} sx={{
                backgroundColor: boolValues[label] ? color : '#fff',
                boxShadow: "none",
                ":hover": {
                    backgroundColor: boolValues[label] ? color : '#f0f0f0',

                },
                color: "black",
                borderRadius: '16px',
                border: boolValues[label] ? 'solid 2px transparent' : 'solid 2px #ccc',
                height: '39px',
                padding: '9px 9px',
                fontSize: '14px',
                lineHeight: '1.5',
                letterSpacing: '0.15px',
            }}>
                {label}
            </MUIButton>);
    };

    const legendDataAll = [
        { label: 'AnatomicalEntity', size: 20, color: '#374B73' },
        { label: 'ChemicalEntity', size: 20, color: '#94B0DA' },
        { label: 'DiseaseOrPhenotypicFeature', size: 20, color: '#E3E8F0' },
        { label: 'Gene', size: 20, color: '#E07A5F' },
        { label: 'BiologicalProcessOrActivity', size: 20, color: '#3D405B' },
        { label: 'MeshTerm', size: 20, color: '#81B29A' },
        { label: 'SequenceVariant', size: 20, color: '#F2CC8F' },
        { label: 'Article', size: 20, color: '#C4C4C4' },
    ];

    const edgeDataAll = [
        { label: 'Semantic_relationship', size: 'solid 2px', color: 'black', explanation: 'Relationships extracted from PubMed abstracts.' },
        { label: 'Curated_relationship', size: 'dashed 2px', color: 'black', explanation: 'Manually annotated relationships from data repositories.' },
        { label: 'Hierarchical_relationship', size: 'dotted 2px', color: 'black', explanation: 'Relationships that represent a hierarchy.' },
    ];

    const legendData = legendDataAll.filter(item => uniqueLabelsArray.includes(item.label));
    const legendEdgeData = edgeDataAll.filter(item => uniqueEdgeLabelsArray.includes(item.label));

    // const [isLegendVisible, setIsLegendVisible] = useState(true);

    // const toggleLegend = () => {
    //     setIsLegendVisible(!isLegendVisible);
    // };

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
                            initialContent={searchContent} // Pass initial content
                            onSearch={(data) => {
                                setSearchContent(data); // Update stored content
                                setSearchFlag(false);
                                handleNeighborSearch(data);
                            }}
                        />
                    ) : (
                        <SearchBarKnowledge
                            initialContent={searchContent} // Pass initial content
                            chipData={chipData}
                            chipDataIDResult={chipDataIDResult}
                            displayArticleGraph={displayArticleGraph}
                            setDisplayArticleGraph={setDisplayArticleGraph}
                            onSearch={(data) => {
                                setSearchContent(data); // Update stored content
                                search(data);
                            }}
                        />
                    )}
                </div>
                {(
                    <div className="graph-controls">
                        <Button
                            icon={<QuestionCircleOutlined />}
                            onClick={startTour}
                            className="start-tour-button"
                            disabled={!searchFlag || isGraphLoading}
                        >
                            Take a Guided Tour to the Result
                        </Button>
                    </div>
                )}
            </div>
            <div className='main-content'>
                {(!searchFlag || isGraphLoading) && (
                    <div className='loading-container'>
                        <Spin size='large' />
                    </div>
                )}
                {searchFlag && !isGraphLoading && (
                    <div className='result-content'>
                        <div className='graph-container-wrapper'>
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                width: '100%',
                                height: '80%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                {/* Left */}
                                <Box sx={{
                                    borderRadius: "30px",
                                    width: '30%',
                                    height: "100%",
                                    bgcolor: "white",
                                    position: 'relative',
                                }}>
                                    <Tooltip title={getButtonTooltip()} className="graph-control-button-container">
                                        <span>
                                            {/* <StyledButton
                                                onClick={changeLeftPanel}
                                                variant="contained"
                                                startIcon={displayArticleGraph ? <ApartmentOutlined /> : <FileTextOutlined />}
                                                className="graph-control-button"
                                                disabled={totalNodeCount > NODE_LIMIT && !displayArticleGraph}
                                            >
                                                {displayArticleGraph ? "Convert to biomedical term graph" : "Convert to article graph"}
                                            </StyledButton> */}
                                            <MUIButton
                                                onClick={changeLeftPanel}
                                                variant="contained"
                                                className="graph-control-button"
                                                disabled={totalNodeCount > NODE_LIMIT && !displayArticleGraph}
                                                startIcon={<SwapHorizIcon />}
                                                sx={{
                                                    backgroundColor: '#F5F9FD',
                                                    color: 'black',
                                                    '&:hover': {
                                                        backgroundColor: '#F7FBFF',
                                                        color: 'black',
                                                    },
                                                    '&:focus': {
                                                        color: 'black',
                                                    },
                                                    minWidth: '40px',
                                                    height: '25px',
                                                    fontSize: '16px',
                                                    fontWeight: 400,
                                                    letterSpacing: '0px',
                                                    boxShadow: 'none',
                                                    cornerRadius: '8px',
                                                }}>
                                                {displayArticleGraph ? "Biomedical term graph" : "Article graph"}
                                            </MUIButton>
                                        </span>
                                    </Tooltip>
                                    <Box sx={{
                                        width: '100%',
                                        height: '50%',
                                    }}>
                                        <div className="graph-container" style={{
                                            position: 'relative',
                                            width: '100%',
                                            height: '100%',
                                            overflow: 'hidden'
                                        }}>
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
                                                    style={{
                                                        width: '100%',
                                                        height: '100%'
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </Box>
                                    <Box sx={{
                                        width: '100%',
                                        height: '50%',
                                        position: 'relative',
                                        left: '0',
                                    }}>
                                        <div className="graph-legend">
                                            <div className="legend-section">
                                                <div className="legend-subsection">
                                                    <div className="legend-subtitle">Legends</div>
                                                    <div className="legend-column">
                                                        {legendData.map((item, index) => (
                                                            <LegendButton
                                                                key={index}
                                                                label={item.label}
                                                                size={item.size}
                                                                color={item.color}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="legend-subsection">
                                                    <div className="legend-row">
                                                        {legendEdgeData.map((item, index) => (
                                                            <LegendItem
                                                                key={index}
                                                                label={item.label}
                                                                size={item.size}
                                                                color={item.color}
                                                                explanation={item.explanation}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Box>
                                </Box>
                                <Box sx={{ width: '3%' }}></Box>
                                {/* Right */}
                                <Box sx={{
                                    borderRadius: "30px",
                                    width: '30%',
                                    height: "100%",
                                    bgcolor: "white",
                                    paddingBottom: "20px"
                                }}>
                                    <Information
                                        isOpen={informationOpen}
                                        toggleSidebar={handleInformation}
                                        detailId={detailId}
                                        displayArticleGraph={displayArticleGraph}
                                    />
                                </Box>
                            </Box>

                        </div>

                        {/* <Button
                            className="legend-toggle-button"
                            onClick={toggleLegend}
                            icon={isLegendVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                        >
                            Legend
                        </Button> */}
                        <div ref={settingsRef} className={`floating-settings ${isSettingsVisible ? 'open' : ''}`} style={{ width: settingsWidth, minWidth: '400px', display: 'none' }}>
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
                        <div ref={informationRef} className={`floating-information ${isInformationVisible ? 'open' : ''}`} style={{ minWidth: '400px', display: 'none' }}>
                            <Information
                                isOpen={informationOpen}
                                toggleSidebar={handleInformation}
                                detailId={detailId}
                                displayArticleGraph={displayArticleGraph}
                            />
                        </div>
                        <FloatButton
                            style={{ display: 'none' }}
                            icon={isSettingsVisible ?
                                <MenuFoldOutlined
                                    style={{
                                        color: '#4a7298',
                                        fontSize: 16,
                                    }}
                                /> :
                                <MenuUnfoldOutlined
                                    style={{
                                        color: '#4a7298',
                                        fontSize: 16,
                                    }}
                                />
                            }
                            onClick={toggleSettings}
                            className={`settings-float-button ${!isSettingsVisible ? 'collapsed' : ''}`}
                        />
                        <FloatButton
                            style={{ display: 'none' }}
                            icon={isInformationVisible ?
                                <MenuUnfoldOutlined
                                    style={{
                                        color: '#4a7298',
                                        fontSize: 16,
                                    }}
                                /> :
                                <MenuFoldOutlined
                                    style={{
                                        color: '#4a7298',
                                        fontSize: 16,
                                    }}
                                />
                            }
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
