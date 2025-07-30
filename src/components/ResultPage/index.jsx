import 'antd/dist/reset.css';
import './scoped.css';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Button as AntButton,
  Spin,
  Tooltip,
} from 'antd';
import { debounce } from 'lodash';
import Joyride, { STATUS } from 'react-joyride';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { InfoCircleOutlined } from '@ant-design/icons';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
//import mui button as muibutton
import {
  Box,
  Button as MuiButton,
  Grid,
  Typography,
} from '@mui/material';

import downArrow from '../../img/down_arrow.svg';
import NoResultImage from '../../img/placeholdericon.png';
import { CypherService } from '../../service/Cypher';
import Graph from '../Graph';
import Information from '../Information';
import { trackEvent } from '../Units/analytics';
import NavBarWhite from '../Units/NavBarWhite';
import SearchBarKnowledge from '../Units/SearchBarKnowledge';
import SearchBarNeighborhood from '../Units/SearchBarNeighborhood';

// const StyledButton = styled(Button)(({ theme }) => ({
//     backgroundColor: '#99c7b1',
//     color: 'black',
//     '&:hover': {
//         backgroundColor: '#577265',
//         color: 'black',
//     },
//     '&:focus': {
//         color: 'black',
//     },
//     minWidth: '60px',
//     height: '40px',
// }));

const LegendTooltipContent = (
    <div className="legends-tooltip-content">
        GLKB currently supports the following node types:<br />
        Gene, ChemicalEntity, DiseaseOrPhenotypicFeature, AnatomicalEntity, SequenceVariant,<br />
        BiologicalProcessOrActivity, and MeshTerm.<br />
        <br />
        Two types of relationships are supported:<br />
        - Semantic Relationships, which are automatically extracted from PubMed abstracts<br />
        - Curated Relationships, which are manually annotated from established data repositories.
    </div>
);

const ResultPage = () => {
    // const urlParams = new URLSearchParams(window.location.search);
    // const alltags = urlParams.get('data');
    const location = useLocation();
    const navigate = useNavigate();
    console.log(location.state);
    const search_data = location.state?.search_data;
    const chipDataID = location.state?.chipDataID;
    // const { result } = location.state;
    // console.log(location.state)
    // const otags = alltags.split('|')
    // const otags = ""
    // const [tags, setTags] = useState(otags);
    const [detailId, setDetailId] = useState(null);
    // const [allNodes, setAllNodes] = useState([]);
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

    const searchBarKnowledgeRef = useRef(null);


    /* ====== range activation functions ====== */

    // Genomic Terms Density Control
    // frequency
    const [gtdcFreq, setGtdcFreq] = useState([0, 0]);
    const handleGtdcFreq = (range) => {
        setGtdcFreq(range);
    }
    // const handleGtdcFreq1 = (props) => {
    //     let value = parseInt(props.target.value);
    //     setGtdcFreq([value, gtdcFreq[1]]);
    // }
    // const handleGtdcFreq2 = (props) => {
    //     let value = parseInt(props.target.value);
    //     setGtdcFreq([gtdcFreq[0], value]);
    // }

    // number of citations
    const [gtdcNoc, setGtdcNoc] = useState([0, 0]);
    const handleGtdcNoc = (range) => {
        setGtdcNoc(range);
    }
    // const handleGtdcNoc1 = (props) => {
    //     let value = parseInt(props.target.value);
    //     setGtdcNoc([value, gtdcNoc[1]]);
    // }
    // const handleGtdcNoc2 = (props) => {
    //     let value = parseInt(props.target.value);
    //     setGtdcNoc([gtdcNoc[0], value]);
    // }

    /* ====== node type ====== */


    const [searchFlag, setSearchFlag] = useState(false);
    // const [chipData, setChipData] = useState([]);
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
    // const [cachedTermGraph, setCachedTermGraph] = useState(null);
    // const [cachedArticleGraph, setCachedArticleGraph] = useState(null);

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
        // {
        //     target: '.graph-control-button',
        //     content: 'Switch between biomedical term graph and article graph views.',
        // },
        // {
        //     target: '.floating-settings',
        //     content: 'Modify graph visualization and access node and edge summaries here.',
        // },
        {
            target: '.floating-information-new',
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
                const minWidth = 600;
                if (windowWidth < minWidth) {
                    containerRef.current.style.width = `${minWidth}px`;
                } else {
                    containerRef.current.style.width = '100%';
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
            const minWidth = 600; // Should match the CSS min-width
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
        } else {
            setSearchFlag(true);
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
            // const nodesList = neighborData[1];  // Contains simplified node list

            setData(graphData);
            // setAllNodes(nodesList);
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
            // setAllNodes(response[1]);
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

                // graphContainerRef.current.style.position = 'fixed';
                // graphContainerRef.current.style.top = `${topOffset}px`;
                // graphContainerRef.current.style.left = isSettingsVisible ? SETTINGS_PANEL_WIDTH : '0';
                // graphContainerRef.current.style.right = isInformationVisible ? INFORMATION_PANEL_WIDTH : '0';
                // graphContainerRef.current.style.bottom = '0';
            }
        };

        window.addEventListener('resize', updateGraphPosition);
        updateGraphPosition(); // Initial call

        return () => window.removeEventListener('resize', updateGraphPosition);
    }, [isSettingsVisible, isInformationVisible]);

    // const initialize = () => {
    //     setSearchFlag(false)
    // }

    // Add new state for storing graph data
    // const [graphForQuestions, setGraphForQuestions] = useState(null);

    // Modify the search function to store the graph data
    async function search(content) {
        setSearchFlag(false)
        // setCachedTermGraph(null);
        // setCachedArticleGraph(null);
        setDisplayArticleGraph(false);

        let cypherServ = new CypherService();
        const response = await cypherServ.Triplet2Cypher(content);
        console.log('function -> ', response);
        setData(response[0]);
        // setAllNodes(response[1])
        // Store just the graph data, not the entire response
        // setGraphForQuestions(response[0])
        // setCachedTermGraph(response);
        setSearchFlag(true);
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
    }, [graphData, data]);

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

    // async function handleSelectNodeID(targetID) {
    //     let temp_id = targetID[0];
    //     if (!informationOpen) {
    //         handleInformation();
    //     }
    //     setDetailId(temp_id);
    //     selectedID = temp_id;
    // }

    // let nevigate = useNavigate();

    // const handleSearch = async (v) => {
    //     initialize()
    //     nevigate(`/result?q=${v}`)
    //     search(v)
    // }

    const handleInformation = () => {
        setInformationOpen(!informationOpen);
    };
    // console.log(graphShownData)

    // const toggleSettings = () => {
    //     setIsSettingsVisible(!isSettingsVisible);
    // };

    // const toggleInformation = () => {
    //     setIsInformationVisible(!isInformationVisible);
    // };

    //const [isGraphLoading, setIsGraphLoading] = useState(false);

    // const changeLeftPanel = async () => {
    //     trackEvent('Graph', 'Change Graph Type',
    //         displayArticleGraph ? 'Term Graph' : 'Article Graph'
    //     );

    //     setIsGraphLoading(true);

    //     try {
    //         if (!displayArticleGraph) {
    //             setDisplayArticleGraph(true);
    //             setDetailId(null);
    //             await entityToArticle(data);
    //         } else {
    //             setDisplayArticleGraph(false);
    //             setDetailId(null);
    //             // Pass the original search content when switching back
    //             await articleToEntity(searchContent);
    //         }
    //     } finally {
    //         setIsGraphLoading(false);
    //     }
    // }

    // async function entityToArticle(content) {
    //     if (cachedArticleGraph) {
    //         setData(cachedArticleGraph);
    //     } else {
    //         let cypherServ = new CypherService()
    //         const response = await cypherServ.Term2Article(content)
    //         console.log('Term2Article -> ', response)
    //         setData(response)
    //         setCachedArticleGraph(response);
    //     }
    // }

    // async function articleToEntity(content) {
    //     if (searchType === 'neighbor') {
    //         handleNeighborSearch(content);
    //     } else {
    //         if (cachedTermGraph) {
    //             setData(cachedTermGraph[0]);
    //             setAllNodes(cachedTermGraph[1]);
    //         } else {
    //             search(content);
    //         }
    //     }
    // }

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
    // const [uniqueLabelsSet, setUniqueLabelsSet] = useState(new Set());
    // const [uniqueEdgeLabelsSet, setUniqueEdgeLabelsSet] = useState(new Set());
    const [uniqueLabelsArray, setUniqueLabelsArray] = useState([]);
    const [uniqueEdgeLabelsArray, setUniqueEdgeLabelsArray] = useState([]);
    const [boolValues, setBoolValues] = useState({});
    // const [boolEdgeValues, setBoolEdgeValues] = useState({});

    useEffect(() => {
        if (data.edges) {
            const edgeLabelsSet = new Set(data.edges.map(edge => edge.data.label));
            // setUniqueEdgeLabelsSet(edgeLabelsSet);
            setUniqueEdgeLabelsArray([...edgeLabelsSet]);
        }
        if (data.nodes) {
            const labelsSet = new Set(data.nodes.map(node => node.data.label));
            // setUniqueLabelsSet(labelsSet);
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
            // setBoolEdgeValues(newBoolEdgeValues);
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

    const LegendItem = ({ label, size, color }) => {
        return (
            <div className="legend-item">
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                }}>
                    <div style={{
                        width: "30px",
                        height: "0",
                        borderBottom: size,
                        borderColor: color,
                        marginLeft: '5px',
                    }}></div>
                    <div className="legend-label">
                        {label}
                    </div>
                    <div style={{
                        width: "30px",
                        height: "0",
                        borderBottom: size,
                        borderColor: color,
                        marginRight: '5px',
                    }}></div>
                </div>
            </div>
        );
    };

    const LegendButton = ({ label, size, color, explanation }) => {
        return (
            <MuiButton variant="contained" onClick={(e) => { /*onChangeNode(e, label, boolValues[label])*/ }} sx={{
                backgroundColor: boolValues[label] ? color : '#fff',
                boxShadow: "none",
                ":hover": {
                    backgroundColor: boolValues[label] ? color : '#f0f0f0',

                },
                color: "black",
                borderRadius: '16px',
                border: boolValues[label] ? 'solid 2px transparent' : 'solid 2px #ccc',
                height: '39px',
                fontWeight: 'normal',
                padding: '9px 9px',
                fontSize: '14px',
                lineHeight: '1.5',
                letterSpacing: '0.15px',
            }}>
                {label}
            </MuiButton>);
    };

    const legendDataAll = [
        { label: 'AnatomicalEntity', size: 20, color: '#88E9C0' },
        { label: 'ChemicalEntity', size: 20, color: '#FFC0C0' },
        { label: 'DiseaseOrPhenotypicFeature', size: 20, color: '#F6C858' },
        { label: 'Gene', size: 20, color: '#ADCFF2' },
        { label: 'BiologicalProcessOrActivity', size: 20, color: '#EDC0FF' },
        { label: 'MeshTerm', size: 20, color: '#FFB77D' },
        { label: 'SequenceVariant', size: 20, color: '#DBF4B1' },
        { label: 'Article', size: 20, color: '#E5E5E5' },
    ];

    const edgeDataAll = [
        { label: 'Semantic Relationship', key: 'Semantic_relationship', size: 'solid 2px', color: 'black', explanation: 'Relationships extracted from PubMed abstracts.' },
        { label: 'Curated Relationship', key: 'Curated_relationship', size: 'dashed 2px', color: 'black', explanation: 'Manually annotated relationships from data repositories.' },
        { label: 'Hierarchical Relationship', key: 'Hierarchical_relationship', size: 'dotted 2px', color: 'black', explanation: 'Relationships that represent a hierarchy.' },
    ];

    const legendData = legendDataAll.filter(item => uniqueLabelsArray.includes(item.label));
    const legendEdgeData = edgeDataAll.filter(item => uniqueEdgeLabelsArray.includes(item.key));

    // const [isLegendVisible, setIsLegendVisible] = useState(true);

    // const toggleLegend = () => {
    //     setIsLegendVisible(!isLegendVisible);
    // };
    const [isLegendVisible, setLegendVisible] = useState(true);
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
            <Box sx={{ width: '100%', marginTop: '40px' }}>
                <Grid className="main-grid" container sx={{ width: "unset" }} >
                    <Grid item xs={12} className="subgrid">
                        <MuiButton variant="text" sx={{
                            color: '#333333',
                            alignSelf: 'flex-start',
                            zIndex: 1,
                            borderRadius: '24px',
                            transform: 'translateY(-10px)',
                        }}
                            onClick={() => navigate('/')}>
                            <ArrowBackIcon />Back
                        </MuiButton>
                        <div className="search-bar-container" >
                            <div className="search-bar-wrapper" >
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
                                        ref={searchBarKnowledgeRef}
                                        initialContent={searchContent} // Pass initial content
                                        chipData={[]}
                                        chipDataIDResult={chipDataIDResult}
                                        displayArticleGraph={displayArticleGraph}
                                        setDisplayArticleGraph={setDisplayArticleGraph}
                                        onSearch={(data) => {
                                            // setSearchContent(data); // Update stored content
                                            // search(data);
                                            window.location.reload();
                                            navigate('/result', {
                                                state: {
                                                    search_data: data,
                                                    searchType: 'triplet',
                                                }
                                            });
                                        }}
                                    />
                                )}
                            </div>
                            {/* <div className="graph-controls">
                                <Button
                                    onClick={startTour}
                                    className="start-tour-button"
                                    disabled={!searchFlag || isGraphLoading}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        marginLeft: "1vw",
                                        marginRight: "0.5vw"
                                    }}
                                >
                                    <InfoCircleOutlined style={{ fontSize: "30px", color: "#8D8D8D" }} />
                                </Button>
                            </div> */}
                        </div>
                    </Grid>
                    <Grid item xs={12}>
                        <div className='main-content' style={{ minHeight: "unset", height: "100%" }}>
                            {(!searchFlag) && (
                                <div className='loading-container'>
                                    <Spin size='large' />
                                </div>
                            )}
                            {searchFlag && (
                                <div className='result-content' style={{ paddingTop: "36px" }}>
                                    <div className='result-container-wrapper'>
                                        <Box sx={{
                                            // display: 'flex',
                                            // flexDirection: 'row',
                                            // width: '100%',
                                            // paddingTop: "20px",
                                            paddingBottom: "20px",
                                            height: '100%',
                                            // justifyContent: 'center',
                                            // alignItems: 'center',
                                            // maxWidth: '1200px',
                                            // marginLeft: '20px',
                                            // marginRight: '20px',
                                            flexDirection: 'row',
                                            flexGrow: 1,
                                        }}>
                                            <Grid container spacing={'48px'} height={"calc(100% + 48px)"}>
                                                {/* Left */}
                                                <Grid item xs={6} height={"100%"}>
                                                    <Box sx={{
                                                        borderRadius: "20px",
                                                        //width: '100%',
                                                        height: "100%",
                                                        //minHeight: "600px",
                                                        bgcolor: "white",
                                                        position: 'relative',
                                                        // boxShadow: "0px 4px 4px rgba(0, 0, 0, 0.25)",
                                                        // marginLeft: "1%",
                                                        // marginRight: "1%",
                                                        // marginTop: "20px",
                                                        overflow: 'hidden',
                                                    }} className="graph-container-wrapper">
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
                                                                {/* <MuiButton
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
                                                                </MuiButton> */}
                                                            </span>
                                                        </Tooltip>
                                                        {!graphShownData?.nodes?.length ?
                                                            <Box sx={{
                                                                display: 'flex',
                                                                justifyContent: 'center',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                height: '100%',
                                                                fontSize: '20px',
                                                                color: '#888888',
                                                            }}>
                                                                <Box
                                                                    component="img"
                                                                    src={NoResultImage}
                                                                    alt="No results"
                                                                    sx={{
                                                                        width: '100px',
                                                                        height: '100px',
                                                                        marginBottom: '4px',
                                                                    }}
                                                                />
                                                                <Typography sx={{
                                                                    fontFamily: 'Inter, sans-serif',
                                                                    fontSize: '14px',
                                                                    fontWeight: 400,
                                                                }}
                                                                >
                                                                    Start searching to view relationship graph
                                                                </Typography>
                                                            </Box> :
                                                            <>
                                                                <Box sx={{
                                                                    width: '100%',
                                                                    height: isLegendVisible ? 'calc(100% - 175px)' : '85%',
                                                                }}>
                                                                    <div className="graph-container" style={{
                                                                        position: 'relative',
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        overflow: 'hidden'
                                                                    }}>
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
                                                                    </div>
                                                                </Box>
                                                                <Box sx={{
                                                                    // width: '100%',
                                                                    // height: '50%',
                                                                    // position: 'relative',
                                                                    // left: '0',
                                                                }}>
                                                                    <div className="graph-legend">
                                                                        <div className="legend-section">
                                                                            <div className="legend-subsection">
                                                                                <div className="legend-subtitle-row">
                                                                                    <div className="legend-subtitle">Legends</div>
                                                                                    <Tooltip title={LegendTooltipContent} styles={{ root: { maxWidth: '380px' }, body: { fontSize: '16px' } }}>
                                                                                        <InfoCircleOutlined style={{ color: '#1890ff' }} />
                                                                                    </Tooltip>
                                                                                    <button
                                                                                        className="toggle-button"
                                                                                        onClick={() => setLegendVisible(!isLegendVisible)}
                                                                                    >
                                                                                        <img
                                                                                            src={downArrow}
                                                                                            alt="Toggle legend"
                                                                                            className="legend-toggle-icon"
                                                                                            style={isLegendVisible ? {} : { transform: 'rotate(180deg)' }}
                                                                                        />
                                                                                    </button>
                                                                                </div>

                                                                                {isLegendVisible && (
                                                                                    <div>
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
                                                                                        <div className="legend-column">
                                                                                            {legendEdgeData.map((item, index) => (
                                                                                                <LegendItem
                                                                                                    key={index}
                                                                                                    label={item.label}
                                                                                                    size={item.size}
                                                                                                    color={item.color}
                                                                                                />
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                        </div>
                                                                    </div>
                                                                </Box>
                                                            </>
                                                        }
                                                    </Box>
                                                </Grid>
                                                {/* Right */}
                                                <Grid item xs={6} height={"100%"}>
                                                    <Box sx={{
                                                        borderRadius: "20px",
                                                        height: "100%",
                                                        //minHeight: "600px",
                                                        bgcolor: "white",
                                                        paddingBottom: "20px",
                                                        // marginLeft: "1%",
                                                        // marginRight: "1%",
                                                        // marginTop: "20px",
                                                        // boxShadow: "0px 4px 4px rgba(0, 0, 0, 0.25)",
                                                        '& *': {
                                                            fontFamily: "Inter !important",
                                                        },

                                                    }} className="floating-information-new">
                                                        <Information
                                                            isOpen={informationOpen}
                                                            toggleSidebar={handleInformation}
                                                            detailId={detailId}
                                                            displayArticleGraph={displayArticleGraph}
                                                        />
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </Box>


                                    </div>

                                    {/* <Button
                                        className="legend-toggle-button"
                                        onClick={toggleLegend}
                                        icon={isLegendVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                                    >
                                        Legend
                                    </Button> */}
                                    {/* <div ref={settingsRef} className={`floating-settings ${isSettingsVisible ? 'open' : ''}`} style={{ width: settingsWidth, minWidth: '400px', display: 'none' }}>
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
                                    /> */}
                                </div>
                            )}
                        </div>
                    </Grid>
                </Grid>
            </Box>
            <AntButton
                onClick={() => startTour()}
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
                disabled={!searchFlag}
            >
                ?
            </AntButton>
        </div>
    )
}

export default ResultPage
