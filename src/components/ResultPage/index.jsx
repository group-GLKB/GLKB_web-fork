import 'antd/dist/reset.css';
import './scoped.css';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Button as AntButton,
  Spin,
  Tooltip,
} from 'antd';
import { debounce } from 'lodash';
import { Helmet } from 'react-helmet-async';
import Joyride, { STATUS } from 'react-joyride';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { InfoCircleOutlined } from '@ant-design/icons';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
//import mui button as muibutton
import {
  Box,
  Button as MuiButton,
  Popover,
  Typography,
} from '@mui/material';

import {
  ReactComponent as CategorySearchIcon,
} from '../../img/navbar/category_search.svg';
import downArrow from '../../img/result/down_arrow.svg';
import {
  ReactComponent as PageMenuIcon,
} from '../../img/result/page_menu_ios.svg';
import NoResultImage from '../../img/result/placeholdericon.png';
import { CypherService } from '../../service/Cypher';
import {
  fetchGraphBookmarks,
  getGraphBookmarks,
  toggleGraphBookmark,
} from '../../utils/graphBookmarks';
import { createGraphHistoryEntry } from '../../utils/graphHistory';
import { useAuth } from '../Auth/AuthContext';
import Graph from '../Graph';
import nodeStyleColors from '../Graph/nodeStyleColors.json';
import Information from '../Information';
import SearchBarKnowledge from './SearchBarKnowledge';
import exampleTerms from './SearchBarKnowledge/example.json';

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

const ExploreTooltipContent = (
    <div className="legends-tooltip-content">
        Each node should represent a single concept. Add more concepts as separate nodes.
    </div>
);

const ExampleOptions = [
    ['example_0', 'SPRY2; RFX6; HNF4A; type 2 diabetes mellitus', 'Explore relationships between Type 2 Diabetes and its associated genes.'],
    ['example_1', 'TP53; rs3761624; respiratory syncytial virus infectious disease; TLR8', 'Explore relationships between rs3761624 and RSV infectious disease.'],
    ['example_2', 'Acute coronary syndrome; atrial fibrillation; vascular disease; clopidogrel', 'Explore relationships between clopidogrel and different diseases.'],
];

const hexToRgb = (hex) => {
    if (!hex) return { r: 0, g: 0, b: 0 };
    const cleaned = hex.replace('#', '');
    const normalized = cleaned.length === 3
        ? cleaned.split('').map((char) => `${char}${char}`).join('')
        : cleaned;
    const value = parseInt(normalized, 16);
    if (Number.isNaN(value)) return { r: 0, g: 0, b: 0 };
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
};

const rgbToHex = (r, g, b) => {
    const toHex = (value) => value.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixHex = (baseHex, mixHexValue, amount) => {
    const base = hexToRgb(baseHex);
    const mix = hexToRgb(mixHexValue);
    const ratio = Math.min(Math.max(amount, 0), 1);
    const r = Math.round(base.r * (1 - ratio) + mix.r * ratio);
    const g = Math.round(base.g * (1 - ratio) + mix.g * ratio);
    const b = Math.round(base.b * (1 - ratio) + mix.b * ratio);
    return rgbToHex(r, g, b);
};

const toRgba = (hex, alpha) => {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getPillColors = (label) => {
    const base = nodeStyleColors[label] || nodeStyleColors.default || '#E5E5E5';
    return {
        base,
        background: mixHex(base, '#ffffff', 0.75),
        text: mixHex(base, '#000000', 0.35),
        shadow: toRgba(base, 0.3),
    };
};

const cleanPillLabel = (value) => {
    if (!value) return '';
    return `${value}`.replace(/[()]/g, '').trim();
};

const ResultPage = () => {
    // const urlParams = new URLSearchParams(window.location.search);
    // const alltags = urlParams.get('data');
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, loading } = useAuth();
    // console.log(location.state);
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

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, loading, navigate]);


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
    };
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
    const [examplesOpen, setExamplesOpen] = useState(false);
    const [pendingExample, setPendingExample] = useState(null);
    const [examplesAnchorPosition, setExamplesAnchorPosition] = useState(null);
    const [currentGraphHistory, setCurrentGraphHistory] = useState(null);
    const [graphBookmarks, setGraphBookmarksState] = useState(() => getGraphBookmarks());
    const [bookmarkLoading, setBookmarkLoading] = useState(false);

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
    const searchBarContainerRef = useRef(null);
    const exampleButtonRef = useRef(null);

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
            placement: 'left',
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
                containerRef.current.style.width = '100%';
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

    const normalizeGraphSnapshot = useCallback((graphPayload) => {
        if (!graphPayload?.nodes) return [];
        return graphPayload.nodes
            .map((node) => {
                const data = node?.data || {};
                const rawId = Array.isArray(data.id) ? data.id[0] : data.id;
                const id = rawId || data.element_id || data.database_id;
                if (!id) return null;
                return {
                    id: String(id),
                    name: data.name || data.display || data.label || '',
                    type: data.label || data.type || data.category || '',
                };
            })
            .filter(Boolean);
    }, []);

    const extractSearchTerms = useCallback((searchData) => {
        const sources = Array.isArray(searchData?.sources) ? searchData.sources : [];
        if (sources.length > 0) {
            return sources
                .map((source) => {
                    const name = cleanPillLabel(source?.[1] || '');
                    if (!name) return null;
                    return {
                        id: source?.[0] ?? name,
                        name,
                        type: source?.[2] || 'default',
                    };
                })
                .filter(Boolean);
        }

        const triplets = Array.isArray(searchData?.triplets) ? searchData.triplets : [];
        const seen = new Set();
        const terms = [];
        triplets.forEach((triplet) => {
            const label = cleanPillLabel(triplet?.source?.[1] || '');
            if (!label || seen.has(label)) return;
            seen.add(label);
            terms.push({
                id: triplet?.source?.[0] ?? label,
                name: label,
                type: triplet?.source?.[2] || 'default',
            });
        });
        return terms;
    }, []);

    const saveGraphHistory = useCallback(async (graphPayload, endpointType, terms = []) => {
        const hasToken = typeof window !== 'undefined'
            && Boolean(window.localStorage.getItem('access_token'));
        if (!isAuthenticated && !hasToken) return;
        const graphSnapshot = normalizeGraphSnapshot(graphPayload);
        try {
            const savedEntry = await createGraphHistoryEntry({
                title: 'N/A',
                endpointType,
                graphSnapshot,
                terms,
            });
            setCurrentGraphHistory(savedEntry || null);
        } catch (error) {
            console.warn('Failed to save graph history:', error);
        }
    }, [isAuthenticated, normalizeGraphSnapshot]);

    useEffect(() => {
        if (!isAuthenticated) {
            setGraphBookmarksState([]);
            return;
        }
        let isMounted = true;
        fetchGraphBookmarks()
            .then((list) => {
                if (!isMounted) return;
                setGraphBookmarksState(Array.isArray(list) ? list : []);
            })
            .catch(() => {
                if (!isMounted) return;
                setGraphBookmarksState(getGraphBookmarks());
            });

        const update = (event) => {
            const next = event?.detail || getGraphBookmarks();
            setGraphBookmarksState(Array.isArray(next) ? next : []);
        };
        window.addEventListener('glkb-graph-bookmarks-updated', update);
        return () => {
            isMounted = false;
            window.removeEventListener('glkb-graph-bookmarks-updated', update);
        };
    }, [isAuthenticated]);

    const bookmarkedGraphIds = useMemo(
        () => new Set(graphBookmarks.map((item) => String(item.id))),
        [graphBookmarks]
    );

    const currentGraphTerms = useMemo(
        () => extractSearchTerms(searchContent),
        [extractSearchTerms, searchContent]
    );

    const isCurrentGraphBookmarked = Boolean(
        currentGraphHistory?.id && bookmarkedGraphIds.has(String(currentGraphHistory.id))
    );

    const handleBookmarkCurrentGraph = useCallback(async () => {
        if (bookmarkLoading || !isAuthenticated) return;
        if (!graphShownData?.nodes?.length) return;

        setBookmarkLoading(true);
        try {
            let targetEntry = currentGraphHistory;
            if (!targetEntry?.id) {
                const graphSnapshot = normalizeGraphSnapshot(graphShownData);
                targetEntry = await createGraphHistoryEntry({
                    title: 'N/A',
                    endpointType: 'triplet2graph',
                    graphSnapshot,
                    terms: currentGraphTerms,
                });
                setCurrentGraphHistory(targetEntry || null);
            }
            if (!targetEntry?.id) return;

            const next = await toggleGraphBookmark(targetEntry, currentGraphTerms);
            setGraphBookmarksState(Array.isArray(next) ? next : []);
        } catch (error) {
            console.warn('Failed to toggle graph bookmark:', error);
        } finally {
            setBookmarkLoading(false);
        }
    }, [
        bookmarkLoading,
        isAuthenticated,
        graphShownData,
        currentGraphHistory,
        normalizeGraphSnapshot,
        currentGraphTerms,
    ]);



    useEffect(() => {
        if (search_data) {
            // Store the initial search content
            setSearchContent(search_data);
            handleTripletSearch(search_data);
        } else {
            setSearchFlag(true);
        }
    }, [search_data]);

    const handleTripletSearch = async (searchData) => {
        try {
            let cypherServ = new CypherService();
            const response = await cypherServ.Triplet2Cypher(searchData);
            if (!Array.isArray(response) || !response[0]) {
                console.error('Invalid triplet data format:', response);
                setData({ nodes: [], edges: [] });
                setSearchFlag(true);
                return;
            }
            setData(response[0]);
            // setAllNodes(response[1]);
            setSearchFlag(true);
            saveGraphHistory(response[0], 'triplet2graph', extractSearchTerms(searchData));

            // Track search_no_result event if no results found
            if (!response[0]?.nodes || response[0].nodes.length === 0) {
                const searchTerms = searchData.triplets?.map(t => t.source?.[1]).join(', ') || 'Unknown';
            }
        } catch (error) {
            console.error('Error fetching triplet data:', error);
            setData({ nodes: [], edges: [] });
            setSearchFlag(true);
        }
    };

    useEffect(() => {
        if (chipDataID) {
            const newArray = [];
            chipDataID.forEach(idArray => { newArray.push(idArray) });
            // console.log(newArray)
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
                const searchBarHeight = document.querySelector('.search-bar-container')?.offsetHeight || 0;
                const navbarHeight = document.querySelector('.navbar-wrapper')?.offsetHeight || 0;
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
        // console.log('function -> ', response);
        setData(response[0]);
        // setAllNodes(response[1])
        // Store just the graph data, not the entire response
        // setGraphForQuestions(response[0])
        // setCachedTermGraph(response);
        setSearchFlag(true);
        saveGraphHistory(response[0], 'triplet2graph', extractSearchTerms(content));
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
            setTotalNodeCount(data.nodes?.length || 0);
        } else {
            if (data.edges) {
                setGraphShownData(data);
                setTotalNodeCount(data.nodes?.length || 0);
                setSearchFlag(true);
            }
        }
    }, [graphData, data]);

    // Memoize handleSelect
    const handleSelect = useCallback((target) => {
        console.log('[GraphDebug] ResultPage.handleSelect target:', target);
        const asIdArray = (value) => {
            if (Array.isArray(value)) {
                return value.filter(v => v !== undefined && v !== null && `${v}`.trim() !== '');
            }
            if (value === undefined || value === null || `${value}`.trim() === '') {
                return [];
            }
            return [value];
        };

        const edgeIds = asIdArray(target.eid);
        const nodeDatabaseIds = asIdArray(target.database_id);
        const nodeElementIds = asIdArray(target.element_id);
        const nodeIds = Array.from(new Set([
            ...nodeDatabaseIds,
            ...nodeElementIds,
            ...asIdArray(target.id),
        ]));
        const edgeFallbackIds = edgeIds.length > 0 ? edgeIds : asIdArray(target.id);

        const isEdge = target?.source !== undefined && target?.target !== undefined;
        const temp_id = isEdge
            ? ["edge", ...edgeFallbackIds]
            : ["node", ...nodeIds];

        console.log('[GraphDebug] ResultPage.handleSelect id candidates:', {
            database_id: target.database_id,
            element_id: target.element_id,
            id: target.id,
            chosen: nodeIds,
        });
        console.log('[GraphDebug] ResultPage.handleSelect computed detailId:', temp_id);

        if (temp_id.length <= 1) {
            console.warn('[GraphDebug] ResultPage.handleSelect invalid detailId payload; clearing detail panel');
            setDetailId(null);
            return;
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
    //     if (cachedTermGraph) {
    //         setData(cachedTermGraph[0]);
    //         setAllNodes(cachedTermGraph[1]);
    //     } else {
    //         search(content);
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

    // Add new state for node count
    const [totalNodeCount, setTotalNodeCount] = useState(0);
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

    const [searchBarOpen, setSearchBarOpen] = useState(false);
    const exampleItems = useMemo(() => (
        ExampleOptions.map(([id, pillText, description], index) => {
            const typedTerms = Array.isArray(exampleTerms?.[index])
                ? exampleTerms[index]
                : [];
            const query = {
                triplets: typedTerms.map((term) => ({
                    source: [Number(term.id), `(${term.name})`, term.type],
                    rel: '',
                    target: [0, ''],
                })),
                sources: typedTerms.map((term) => ([
                    Number(term.id),
                    term.name,
                    term.type,
                ])),
            };
            const pills = typedTerms.length
                ? typedTerms.map((term) => ({
                    label: cleanPillLabel(term?.name),
                    type: term?.type || 'default',
                }))
                : pillText
                    .split(';')
                    .map((entry) => entry.trim())
                    .filter(Boolean)
                    .map((label) => ({ label, type: 'default' }));
            return {
                id,
                description,
                pills,
                query,
                index,
            };
        })
    ), []);
    const examplesAnchorEl = exampleButtonRef.current || searchBarContainerRef.current;
    const isExamplesOpen = examplesOpen && Boolean(examplesAnchorEl);

    const handleOpenExamples = () => {
        const searchRect = searchBarContainerRef.current?.getBoundingClientRect();
        const buttonRect = exampleButtonRef.current?.getBoundingClientRect();
        if (searchRect && buttonRect) {
            setExamplesAnchorPosition({
                top: Math.round(searchRect.top + window.scrollY),
                left: Math.round(buttonRect.left + window.scrollX),
            });
        } else {
            setExamplesAnchorPosition(null);
        }
        setExamplesOpen(true);
    };

    const handleCloseExamples = () => {
        setExamplesOpen(false);
    };

    const handleSelectExample = (example) => {
        if (!example?.query) return;
        setSearchContent(example.query);
        setPendingExample(example.query);
        setExamplesOpen(false);
    };

    useEffect(() => {
        if (!pendingExample) return;
        if (!searchBarKnowledgeRef.current?.fillWithExample) return;
        searchBarKnowledgeRef.current.fillWithExample(pendingExample);
        setPendingExample(null);
    }, [pendingExample]);

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

    // const onChangeNode = (e, label, prevChecked) => {
    //     console.log(label, prevChecked);
    //     if (prevChecked) {
    //         const tempKeys = [];
    //         for (let i = 0; i < graphShownData.nodes.length; i++) {
    //             if (graphShownData.nodes[i].data.label !== label) {
    //                 tempKeys.push(graphShownData.nodes[i].data.id);
    //             }
    //         }
    //         setGraphData(tempKeys);
    //         setBoolValues({ ...boolValues, [label]: false });
    //     } else {
    //         const tempKeys = [];
    //         for (let i = 0; i < data.nodes.length; i++) {
    //             if (data.nodes[i].data.label === label) {
    //                 tempKeys.push(data.nodes[i].data.id);
    //             }
    //         }
    //         const currentKeys = graphData || [];
    //         setGraphData([...currentKeys, ...tempKeys]);
    //         setBoolValues({ ...boolValues, [label]: true });
    //     }
    // };

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
                fontFamily: 'Inter, sans-serif',
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
        <>
            <Helmet>
                <title>Search - Genomic Literature Knowledge Base</title>
                <meta name="description" content="Discover insights from 33M+ genomic research articles. GLKB enables AI-powered search across genes, diseases, variants, and chemicals with high accuracy." />
                <meta property="og:title" content="Search - Genomic Literature Knowledge Base | AI-Powered Genomics Search" />
            </Helmet>
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
                    locale={{
                        last: 'Close', // Change the text of the final button to "Close"
                        next: 'Next',
                        back: 'Back',
                        skip: 'Skip',
                    }}
                />
                <Box className="result-body" sx={{ width: '100%', paddingTop: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <Box className="main-grid" sx={{ width: '100%', height: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginLeft: 0, marginRight: 0 }}>
                        <Box className="main-content" sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                            <Box className="result-content result-split" sx={{ paddingTop: 0, display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', gap: 0 }}>
                                <Box
                                    className="result-left"
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 6,
                                        minHeight: 0,
                                        gap: '24px',
                                        padding: {
                                            xs: '16px 20px 24px',
                                            md: '20px 28px 28px',
                                            lg: '24px 48px 32px',
                                            xl: '24px 80px 36px',
                                        },
                                    }}
                                >
                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CategorySearchIcon style={{ width: 36, height: 36, color: '#164563' }} />
                                            <Typography sx={{
                                                fontFamily: 'DM Sans, sans-serif',
                                                fontWeight: 600,
                                                fontSize: '32px',
                                                color: '#164563',
                                            }}>
                                                Explore
                                            </Typography>
                                        </Box>
                                        <Typography sx={{
                                            marginTop: '8px',
                                            fontFamily: 'DM Sans, sans-serif',
                                            fontWeight: 500,
                                            fontSize: '14px',
                                            color: '#646464',
                                        }}>
                                            Explore relationships between genes, diseases, and biological processes
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                marginTop: '24px',
                                                color: '#97A7BD',
                                            }}
                                        >
                                            <Tooltip
                                                title={ExploreTooltipContent}
                                                placement="bottomLeft"
                                                zIndex={3000}
                                                classNames={{ root: "explore-help-tooltip" }}
                                                styles={{
                                                    root: { maxWidth: '380px' },
                                                    body: { fontSize: '16px', fontFamily: 'Open Sans, sans-serif' },
                                                }}
                                            >
                                                <InfoCircleOutlined style={{ color: 'inherit' }} />
                                            </Tooltip>
                                            <Typography sx={{
                                                fontFamily: 'DM Sans, sans-serif',
                                                fontWeight: 400,
                                                fontSize: '14px',
                                                color: 'inherit',
                                            }}>
                                                Add one concept per node
                                            </Typography>
                                            <MuiButton
                                                ref={exampleButtonRef}
                                                onClick={handleOpenExamples}
                                                className="examples-trigger"
                                                sx={{
                                                    minWidth: 0,
                                                    padding: 0,
                                                    textTransform: 'none',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    color: 'inherit',
                                                    fontFamily: 'DM Sans, sans-serif',
                                                    fontSize: '14px',
                                                    fontWeight: 600,
                                                    '&:hover': {
                                                        backgroundColor: 'transparent',
                                                    },
                                                }}
                                            >
                                                <PageMenuIcon className="examples-trigger-icon" />
                                                <span>Examples</span>
                                            </MuiButton>
                                        </Box>
                                        <div
                                            ref={searchBarContainerRef}
                                            className="search-bar-container"
                                            style={{ marginTop: '8px', boxShadow: "0 1px 10px 0 rgba(0, 0, 0, 0.05)", borderRadius: '20px' }}
                                        >
                                            <div className="search-bar-wrapper">
                                                <SearchBarKnowledge
                                                    ref={searchBarKnowledgeRef}
                                                    initialContent={searchContent} // Pass initial content
                                                    chipData={[]}
                                                    chipDataIDResult={chipDataIDResult}
                                                    displayArticleGraph={displayArticleGraph}
                                                    setDisplayArticleGraph={setDisplayArticleGraph}
                                                    alterColor={1}
                                                    setOpen={setSearchBarOpen}
                                                    onSearch={(data) => {
                                                        setSearchFlag(false);
                                                        navigate('/search', {
                                                            state: {
                                                                search_data: data,
                                                            },
                                                            replace: true,
                                                        });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <Popover
                                            open={isExamplesOpen}
                                            onClose={handleCloseExamples}
                                            anchorReference={examplesAnchorPosition ? 'anchorPosition' : 'anchorEl'}
                                            anchorPosition={examplesAnchorPosition || undefined}
                                            anchorEl={examplesAnchorEl}
                                            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                                            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                            PaperProps={{ className: 'examples-popover' }}
                                        >
                                            <Box className="examples-popover-content">
                                                <Box className="examples-list">
                                                    {exampleItems.map((example) => (
                                                        <Box
                                                            key={example.id}
                                                            component="button"
                                                            type="button"
                                                            className="example-card"
                                                            onClick={() => handleSelectExample(example)}
                                                        >
                                                            <Box className="example-card-header">
                                                                <Typography className="example-description">
                                                                    {example.description}
                                                                </Typography>
                                                                <ArrowOutwardIcon className="example-arrow-icon" />
                                                            </Box>
                                                            <Box className="example-pill-row">
                                                                {example.pills.map((pill, index) => {
                                                                    const colors = getPillColors(pill.type || 'default');
                                                                    return (
                                                                        <Box
                                                                            key={`${example.id}-pill-${index}`}
                                                                            className="explore-pill explore-pill-filled example-pill"
                                                                            sx={{
                                                                                borderColor: colors.base,
                                                                                backgroundColor: colors.background,
                                                                                color: colors.text,
                                                                                boxShadow: `0px 4px 6px ${colors.shadow}`,
                                                                            }}
                                                                        >
                                                                            <span className="explore-pill-label">{pill.label}</span>
                                                                        </Box>
                                                                    );
                                                                })}
                                                            </Box>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        </Popover>
                                    </Box>
                                    <Box className="result-container-wrapper" sx={{ flex: 1, minHeight: 0 }}>
                                        <Box sx={{
                                            height: '100%',
                                            flexDirection: 'row',
                                            flexGrow: 1,
                                            width: '100%',
                                        }}>
                                            <Box sx={{
                                                borderRadius: "20px",
                                                height: "100%",
                                                bgcolor: searchBarOpen ? "#f8f8f8" : "white",
                                                position: 'relative',
                                                overflow: 'hidden',
                                                transition: 'background-color 0.3s ease',
                                                boxShadow: "0 1px 10px 0 rgba(0, 0, 0, 0.05)",
                                            }} className="graph-container-wrapper">
                                                {!searchFlag ? (
                                                    <div className="loading-container">
                                                        <Spin size="large" />
                                                        <Typography sx={{
                                                            fontFamily: 'Open Sans, sans-serif',
                                                            fontSize: '14px',
                                                            fontWeight: 400,
                                                            color: '#646464',
                                                        }}>
                                                            Loading graph...
                                                        </Typography>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Tooltip title={getButtonTooltip()} className="graph-control-button-container">
                                                            <span />
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
                                                                    fontFamily: 'Open Sans, sans-serif',
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
                                                                        <MuiButton
                                                                            className="graph-bookmark-button"
                                                                            type="button"
                                                                            onClick={handleBookmarkCurrentGraph}
                                                                            disabled={bookmarkLoading || !isAuthenticated}
                                                                            aria-label={isCurrentGraphBookmarked ? 'Remove bookmark' : 'Bookmark graph'}
                                                                        >
                                                                            {isCurrentGraphBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                                                                        </MuiButton>
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
                                                                <Box>
                                                                    <div className="graph-legend">
                                                                        <div className="legend-section">
                                                                            <div className="legend-subsection">
                                                                                <div className="legend-subtitle-row">
                                                                                    <div className="legend-subtitle">Legends</div>
                                                                                    <Tooltip title={LegendTooltipContent} styles={{ root: { maxWidth: '380px' }, body: { fontSize: '16px', fontFamily: 'Open Sans, sans-serif' } }}>
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
                                                    </>
                                                )}
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                                <Box className="result-right" sx={{ display: 'flex', flexDirection: 'column', flex: 5, minHeight: 0 }}>
                                    <Box sx={{
                                        borderRadius: 0,
                                        height: "100%",
                                        background: '#ffffff',
                                        transition: 'background-color 0.3s ease',
                                        paddingBottom: 0,
                                        borderLeft: '1px solid #F4F4F4',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1,
                                        minHeight: 0,
                                        overflow: 'hidden',
                                        '& *': {
                                            fontFamily: 'Open Sans, sans-serif',
                                        },

                                    }} className="floating-information-new">
                                        <Box className="result-right-scroll" sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                                            <Information
                                                isOpen={informationOpen}
                                                toggleSidebar={handleInformation}
                                                detailId={detailId}
                                                displayArticleGraph={displayArticleGraph}
                                            />
                                        </Box>
                                    </Box>
                                </Box>

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
                            </Box>
                        </Box>
                    </Box>
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
                        backgroundColor: '#E7F1FF',
                        color: '#155DFC',
                        boxShadow: '0px 1px 2px -1px rgba(0, 0, 0, 0.10), 0px 1px 3px rgba(0, 0, 0, 0.10)',
                        border: 'none',
                        fontFamily: 'DM Sans, sans-serif',
                    }}
                    disabled={!searchFlag}
                >
                    ?
                </AntButton>
            </div>
        </>
    )
}

export default ResultPage
