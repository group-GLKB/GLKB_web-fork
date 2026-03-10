import './scoped.css';

import React, {
    useCallback,
    useEffect,
    useState,
} from 'react';

import { debounce } from 'lodash';
import { useNavigate } from 'react-router-dom';

import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import CancelIcon from '@mui/icons-material/Cancel';
import {
    Autocomplete,
    Box,
    IconButton,
    Paper,
    Popper,
    TextField,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { CypherService } from '../../../service/Cypher';
import nodeStyleColors from '../../Graph/nodeStyleColors.json';
import SearchButton from '../../Units/SearchButton/SearchButton';

const MAX_PILLS = 5;

const SearchBarKnowledge = React.forwardRef((props, ref) => {
    const navigate = useNavigate();
    const [sourceNodeOptions, setSourceNodeOptions] = useState([]);
    const [sourceNodeData, setSourceNodeData] = useState([]);
    const [chipData, setChipData] = useState([]);
    const [chipDataID, setChipDataID] = useState([]);
    const [selectedSources, setSelectedSources] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [termType, setTermType] = useState('All');
    const [tripletLimitReached, setTripletLimitReached] = useState(false);
    const [maxArticles, setMaxArticles] = useState(0);
    const [maxBioTerms, setMaxBioTerms] = useState(0);
    const [maxRel, setMaxRel] = useState(0);
    const [moreNodes, setMoreNodes] = useState(false);
    const [moreRel, setMoreRel] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const inputTimeoutRef = React.useRef(null);
    const hasTrackedInputRef = React.useRef(false);
    const activeSearchTokenRef = React.useRef(0);

    useEffect(() => {
        props.setOpen && props.setOpen(isOpen);
    }, [isOpen]);

    const CustomPopper = (props) => {
        const { style, ...rest } = props;
        return (
            <Popper
                {...rest}
                placement="bottom-start"
                disablePortal={false}
                style={{
                    ...style,
                    width: 'min(700px, 90vw)',
                    maxWidth: '90vw',
                }}
                modifiers={[
                    {
                        name: 'flip',
                        enabled: false, // prevent flipping to top
                    },
                    {
                        name: 'preventOverflow',
                        enabled: false,
                    }
                ]}
            />
        );
    };


    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    // Add mapping for group names
    const databaseTypeMapping = {
        'ChemicalEntity': 'Chemical',
        'MeshTerm': 'MeSH',
        'DiseaseOrPhenotypicFeature': 'Disease',
        'Gene': 'Gene',
        'Variant': 'Variant'
    };
    // Add category order priority
    const categoryOrder = ['Gene', 'Disease', 'Chemical', 'MeSH', 'Variant', 'All Biomedical Terms'];
    const labelPriority = [
        'MeshTerm',
        'Gene',
        'SequenceVariant',
        'AnatomicalEntity',
        'ChemicalEntity',
        'DiseaseOrPhenotypicFeature',
        'BiologicalProcessOrActivity',
    ];

    // Sort function for options
    const sortByCategory = (a, b) => {
        const categoryA = getDisplayCategory(a[3]);
        const categoryB = getDisplayCategory(b[3]);

        // First sort by category order
        const orderDiff = categoryOrder.indexOf(categoryA) - categoryOrder.indexOf(categoryB);
        if (orderDiff !== 0) return orderDiff;

        return a[0] - b[0];
    };
    // Convert database type to display category

    const getDisplayCategory = (databaseType) => {
        // console.log('Processing type:', databaseType);
        const category =
            databaseType?.startsWith('Explore ') ? databaseType :
                (databaseTypeMapping[databaseType] || 'All Biomedical Terms');
        // console.log('Mapped to category:', category);
        return category;
    };

    // Simple debounced search function
    const debouncedSearch = useCallback(
        debounce((searchFn) => searchFn(), 500),
        []
    );

    const pickNodeLabel = (labels) => {
        if (!Array.isArray(labels)) return 'Vocabulary';
        const match = labelPriority.find((label) => labels.includes(label));
        return match || 'Vocabulary';
    };

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

    // Main search function that always uses current term type
    const performSearch = async (searchValue) => {
        const requestToken = ++activeSearchTokenRef.current;
        let cypherServ = new CypherService();
        const response = await cypherServ.Entity2Cypher(searchValue, termType);
        if (requestToken !== activeSearchTokenRef.current) return;
        const sortedOptions = response.data
            ?.map((node, index) => [
                index,
                node.database_id,
                `${node.name} (${node.entity_id})`,
                pickNodeLabel(node.labels)
            ])
            .sort(sortByCategory)
            .map(([, database_id, name, type]) => [database_id, name, type]);
        if (sortedOptions) {
            setSourceNodeOptions(sortedOptions);
        }
        // setSourceNodeData(response.data);
        // setSourceNodeOptions([
        //     ...response.data.map(node => [node.database_id, `${node.name} (${node.element_id})`,node.type])
        // ]);
    };

    const updateSource = (event, newInputValue) => {
        if (newInputValue === null || newInputValue.trim() === '') {
            activeSearchTokenRef.current += 1;
            setSourceNodeOptions([]);
            setInputValue('');
            return;
        }

        const searchValue = newInputValue.split(' (')[0];
        setInputValue(newInputValue);

        const searchFn = () => performSearch(searchValue);

        if (event && event.type === "click") {
            searchFn();
        } else {
            debouncedSearch(searchFn);
        }
    };

    const addSelectedSource = (option) => {
        if (!Array.isArray(option)) return;
        setSelectedSources((prev) => {
            if (prev.length >= MAX_PILLS) return prev;
            const exists = prev.some((item) => `${item[0]}` === `${option[0]}`);
            if (exists) return prev;
            return [...prev, option];
        });
        activeSearchTokenRef.current += 1;
        setInputValue('');
        setSourceNodeOptions([]);
    };

    const removeSelectedSource = (index) => {
        setSelectedSources((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    };

    // const handleDelete = (data) => {
    //     const index = chipData.indexOf(data);
    //     if (index !== -1) {
    //         const newChipData = chipData.filter((chip, idx) => idx !== index);
    //         const newChipDataID = chipDataID.filter((id, idx) => idx !== index);
    //         setChipData(newChipData);
    //         setChipDataID(newChipDataID);
    //         if (newChipData.length < 5) {
    //             setTripletLimitReached(false);
    //         }
    //     }
    // };

    // const handleAddTriplet = () => {
    //     if (!selectedSource || chipData.length >= 5) return;

    //     const sourceName = selectedSource[1].split(' (')[0];
    //     let chip_str = `(${sourceName})-[any relationships]-()`;
    //     if (chipData.includes(chip_str)) return;

    //     const sourceNode = sourceNodeData.find(node => 
    //         node.name.toLowerCase() === sourceName.toLowerCase() ||
    //         node.aliases.some(alias => alias.toLowerCase() === sourceName.toLowerCase())
    //     );

    //     setChipData(prev => [...prev, chip_str]);
    //     setChipDataID(prev => [...prev, [sourceNode, null]]);

    //     setSelectedSource(null);
    //     setInputValue("");
    //     setSourceNodeOptions([]);

    //     if (chipData.length + 1 >= 5) {
    //         setTripletLimitReached(true);
    //     }
    // };

    useEffect(() => {
        // Generate new chipData and chipDataID based on selectedSources
        const newChipData = [];
        const newChipDataID = [];

        selectedSources.forEach((source) => {
            const sourceName = source.name || source[1].replace(/\s*\([^)]*\)$/, "").trim(); // Extract source name
            const chip_str = `(${sourceName})-[any relationships]-()`;
            const sourceNode = [
                { database_id: source[0], name: sourceName },
                null,
            ];

            // Check if the chip already exists in newChipData
            const tripletExists = newChipData.some((chip) => chip === chip_str);
            // console.log('Generated chip_str:', chip_str, 'Exists:', tripletExists); // Debugging log

            if (!tripletExists) {
                newChipData.push(chip_str); // Add to newChipData
                newChipDataID.push(sourceNode); // Add to newChipDataID
            }
        });

        // Update chipData and chipDataID states
        setChipData(newChipData);
        setChipDataID(newChipDataID);

        // console.log('Updated chipData:', newChipData);
        // console.log('Updated chipDataID:', newChipDataID);
    }, [selectedSources]); // Trigger this effect whenever selectedSources changes

    useEffect(() => {
        // Filter out chips that are not in selectedSources
        const updatedChipDataID = chipDataID.filter((chipID) => {
            return selectedSources.some(
                (source) => Number(source[0]) === chipID[0]?.database_id
            );
        });
        // Filter chipData to keep only entries corresponding to updatedChipDataID
        const updatedChipData = chipData.filter((_, index) => {
            return updatedChipDataID.includes(chipDataID[index]);
        });

        // Update chipData and chipDataID if they have changed
        if (updatedChipData.length !== chipData.length) {
            setChipData(updatedChipData);
        }
        if (updatedChipDataID.length !== chipDataID.length) {
            setChipDataID(updatedChipDataID);
        }

        // console.log('Filtered chipData:', updatedChipData);
        // console.log('Filtered chipDataID:', updatedChipDataID);
    }, [selectedSources]); // Trigger this effect whenever selectedSources, chipData, or chipDataID changes

    useEffect(() => {
        // Update tripletLimitReached based on the number of selected terms
        if (selectedSources.length >= 5) {
            setTripletLimitReached(true);
        } else {
            setTripletLimitReached(false);
        }
    }, [selectedSources]); // Trigger this effect whenever selectedSources changes

    const normalizeDatabaseId = (value) => {
        if (value === null || value === undefined) return value;
        const asString = `${value}`;
        const suffix = asString.split(':').pop();
        const asNumber = Number(suffix);
        return Number.isNaN(asNumber) ? suffix : asNumber;
    };

    const parseTripletParts = (triplet) => {
        const match = triplet.match(/^\((.*?)\)-\[(.*?)\]-\((.*?)\)$/);
        if (match) {
            return {
                source: match[1],
                rel: match[2],
                target: match[3],
            };
        }

        const parts = triplet.replace(/{|}/g, "").split("-");
        return {
            source: parts[0]?.replace(/^\(|\)$/g, "")?.trim() || "",
            rel: parts[1]?.replace(/^\[|\]$/g, "")?.trim() || "",
            target: parts[2]?.replace(/^\(|\)$/g, "")?.trim() || "",
        };
    };

    const handleClearPills = () => {
        setSelectedSources([]);
        setChipData([]);
        setChipDataID([]);
        setInputValue('');
        setSourceNodeOptions([]);
        activeSearchTokenRef.current += 1;
    };

    // Handle search button click
    const handleSearch = () => {
        if (!chipData || chipData.length === 0 || !chipDataID || chipDataID.length === 0) {
            return;
        }
        // Clear input timeout to prevent search_input event after submission
        if (inputTimeoutRef.current) {
            clearTimeout(inputTimeoutRef.current);
            hasTrackedInputRef.current = true;
        }
        const search_data = {
            "triplets": chipData.map((triplet, index) => {
                const parts = parseTripletParts(triplet);
                const sourceNode = chipDataID[index]?.[0];
                if (!sourceNode) {
                    console.error(`Missing sourceNode for chipDataID at index ${index}`);
                    return null; // Skip this triplet if sourceNode is missing
                }
                return {
                    "source": [normalizeDatabaseId(sourceNode.database_id), parts.source.trim()],
                    "rel": parts.rel.trim(),
                    "target": [0, parts.target.trim()]
                };
            }),
            "params": {
                "max_articles": maxArticles,
                "max_terms": maxBioTerms,
                "max_rels": maxRel,
                "more_terms": moreNodes ? "True" : "False",
                "more_rels": moreRel ? "True" : "False",
                "merge": "True"
            },
            "sources": selectedSources.map((source) => [
                normalizeDatabaseId(source[0]),
                source[1],
                source[2],
            ])
        };
        if (props.onSearch) {
            props.onSearch(search_data);
        } else {
            navigate('/search', { state: { search_data, chipDataID } });
        }

        // console.log('Chip data:', chipDataID);
        if (props.displayArticleGraph) {
            props.setDisplayArticleGraph(false);
        }
    };

    // Initialize with props.initialContent if available
    useEffect(() => {
        if (props.initialContent) {
            const initialTriplets = props.initialContent.triplets;
            if (initialTriplets) {
                setChipData(initialTriplets.map(triplet => {
                    const sourceName = triplet.source[1].replace(/[()]/g, '');
                    return `(${sourceName})-[any relationships]-()`;
                }));

                setChipDataID(initialTriplets.map(triplet => [
                    { database_id: triplet.source[0], name: triplet.source[1].replace(/[()]/g, '') },
                    null
                ]));
                setSelectedSources(props.initialContent.sources || []);
            }

            const params = props.initialContent.params;
            if (params) {
                setMaxArticles(params.max_articles || 0);
                setMaxBioTerms(params.max_terms || 0);
                setMaxRel(params.max_rels || 0);
                setMoreNodes(params.more_terms === "True");
                setMoreRel(params.more_rels === "True");
            }
        }
    }, [props.initialContent]);

    // Add imperative handle for example filling
    React.useImperativeHandle(ref, () => ({
        fillWithExample: (exampleQuery) => {
            setChipData([]);
            setChipDataID([]);
            const newSelectedSources = [];
            exampleQuery.triplets.forEach(triplet => {
                const sourceName = triplet.source[1].replace(/[()]/g, '');
                const chip_str = `(${sourceName})-[any relationships]-()`;
                const sourceNode = [
                    { database_id: triplet.source[0], name: sourceName },
                    null
                ];
                setChipData(prev => [...prev, chip_str]);
                setChipDataID(prev => [...prev, sourceNode]);
                // console.log('ChipdataID is:',sourceNode)
                // Add to newSelectedSources
                newSelectedSources.push(
                    [triplet.source[0], sourceName, triplet.source[2]]
                );
            });
            setSelectedSources(newSelectedSources);

            if (exampleQuery.params) {
                setMaxArticles(exampleQuery.params.max_articles || 0);
                setMaxBioTerms(exampleQuery.params.max_terms || 0);
                setMaxRel(exampleQuery.params.max_rels || 0);
                setMoreNodes(exampleQuery.params.more_terms === "True");
                setMoreRel(exampleQuery.params.more_rels === "True");
            }
        }
    }));

    // React.useEffect(() => {
    //     console.log('Selected sources (after update):', selectedSources);
    // }, [selectedSources]);

    const remainingSlots = Math.max(0, MAX_PILLS - selectedSources.length);
    const showInput = remainingSlots > 0;
    const skeletonCount = Math.max(0, remainingSlots - 1);
    const canSearch = selectedSources.length > 0 && inputValue.trim() === '';

    return (
        <Box sx={{ mt: 0, mb: 0, ml: 0, mr: 0, padding: 0, width: '100%' }}>
            <Box sx={{ mb: 0, backgroundColor: 'transparent', }}>
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'white',
                    borderRadius: '20px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#E6F0FC',
                    boxShadow: '0px 2px 3px -1px #00000026',
                    padding: '12px 20px',
                    alignItems: 'stretch',
                }}>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontFamily: '"DM Sans", sans-serif',
                        fontWeight: 700,
                        fontSize: '12px',
                        color: '#2A83FF',
                    }}>
                        <span>{selectedSources.length}/5</span>
                        <Box
                            component="button"
                            type="button"
                            onClick={handleClearPills}
                            sx={{
                                border: 'none',
                                background: 'transparent',
                                padding: 0,
                                margin: 0,
                                cursor: selectedSources.length ? 'pointer' : 'default',
                                fontFamily: '"DM Sans", sans-serif',
                                fontWeight: 700,
                                fontSize: '12px',
                                color: selectedSources.length ? '#2A83FF' : '#90A1BA',
                            }}
                            disabled={!selectedSources.length}
                        >
                            clear all
                        </Box>
                    </Box>
                    <Box sx={{
                        display: 'flex',
                        flexDirection: isSmallScreen ? 'column' : 'row',
                        alignItems: isSmallScreen ? 'stretch' : 'flex-end',
                        gap: '16px',
                        padding: '12px 0',
                    }}>
                        <Box className="explore-pill-row">
                            {selectedSources.map((source, index) => (
                                <Box
                                    key={`${source[0]}-${index}`}
                                    className="explore-pill explore-pill-filled"
                                    sx={() => {
                                        const colors = getPillColors(source[2]);
                                        return {
                                            borderColor: colors.base,
                                            backgroundColor: colors.background,
                                            color: colors.text,
                                            boxShadow: `0px 4px 6px ${colors.shadow}`,
                                        };
                                    }}
                                >
                                    <span className="explore-pill-label">
                                        {source[1].replace(/\s*\([^)]*\)$/, "")}
                                    </span>
                                    <IconButton
                                        size="small"
                                        aria-label="Remove term"
                                        onClick={() => removeSelectedSource(index)}
                                        className="explore-pill-remove"
                                        sx={() => {
                                            const colors = getPillColors(source[2]);
                                            return {
                                                color: colors.base,
                                                '&:hover': {
                                                    backgroundColor: toRgba(colors.base, 0.15),
                                                    color: colors.base,
                                                },
                                            };
                                        }}
                                    >
                                        <CancelIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Box>
                            ))}
                            {showInput && (
                                <Autocomplete
                                    options={sourceNodeOptions.filter((option) => (
                                        !selectedSources.some((item) => `${item[0]}` === `${option[0]}`)
                                    ))}
                                    autoHighlight={true}
                                    openOnFocus
                                    onInputChange={(event, newInputValue) => {
                                        if (!tripletLimitReached) {
                                            setInputValue(newInputValue);
                                            updateSource(event, newInputValue);

                                            if (inputTimeoutRef.current) {
                                                clearTimeout(inputTimeoutRef.current);
                                            }
                                        }
                                    }}
                                    filterOptions={(options) => options}
                                    groupBy={(option) => getDisplayCategory(option[2])}
                                    getOptionLabel={(option) => (Array.isArray(option) ? option[1] : option)}
                                    ListboxProps={{
                                        style: {
                                            maxHeight: '340px',
                                        }
                                    }}
                                    PopperComponent={CustomPopper}
                                    inputValue={inputValue}
                                    value={null}
                                    onOpen={() => setIsOpen(true)}
                                    onClose={() => setIsOpen(false)}
                                    onChange={(event, newValue) => {
                                        addSelectedSource(newValue);
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            placeholder={selectedSources.length === 0 ? 'Add a term' : 'Add another term'}
                                            variant="standard"
                                            className="explore-pill explore-pill-input"
                                            fullWidth
                                            InputProps={{
                                                ...params.InputProps,
                                                disableUnderline: true,
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key !== 'Enter') return;
                                                if (inputValue.trim() !== '') return;
                                                if (selectedSources.length === 0) return;
                                                e.preventDefault();
                                                handleSearch();
                                            }}
                                        />
                                    )}
                                    PaperComponent={({ children }) => (
                                        <Paper
                                            sx={{
                                                boxShadow: 'none',
                                                boxSizing: 'border-box',
                                                width: '100%',
                                                maxWidth: '100%',
                                                overflowX: 'hidden',
                                                borderRadius: '0px 20px 20px 20px',
                                                borderWidth: '1px',
                                                borderStyle: 'solid',
                                                borderColor: '#E6F0FC',
                                                boxShadow: '0px 2px 3px -1px #00000026',
                                                marginBottom: '5px',
                                                overflow: 'hidden',
                                                fontFamily: 'Open Sans, sans-serif',
                                                "& .MuiAutocomplete-option.Mui-focused": {
                                                    backgroundColor: '#EDF5FE !important',
                                                },
                                                "& .MuiAutocomplete-option.Mui-focused span.highlight-arrow": {
                                                    color: '#196ED8 !important',
                                                },
                                                "& .MuiAutocomplete-groupLabel": {
                                                    fontFamily: 'Open Sans, sans-serif',
                                                }
                                            }}
                                        >
                                            {children}
                                        </Paper>
                                    )}
                                    renderOption={(props, option) => (
                                        <Box
                                            component="li"
                                            {...props}
                                            sx={{
                                                minHeight: '36px !important',
                                                margin: '0px 10px',
                                                marginLeft: '0px',
                                                paddingLeft: '26px',
                                                borderRadius: '0px 18px 18px 0px',
                                                whiteSpace: 'normal',
                                                overflowWrap: 'anywhere',
                                                '& .MuiAutocomplete-option.Mui-focused': {
                                                    backgroundColor: '#F3F5FF !important',
                                                },
                                            }}
                                        >
                                            {option[1]}
                                            <span className={"highlight-arrow"} style={{ color: 'white', marginLeft: 'auto' }}><ArrowOutwardIcon fontSize="small" /></span>
                                        </Box>
                                    )}
                                />
                            )}
                            {Array.from({ length: skeletonCount }).map((_, index) => (
                                <Box key={`pill-skeleton-${index}`} className="explore-pill explore-pill-skeleton" />
                            ))}
                        </Box>
                        <Box sx={{ alignSelf: 'flex-end' }}>
                            <SearchButton
                                onClick={handleSearch}
                                disabled={!canSearch}
                                alterColor={props.alterColor}
                                hide={isOpen}
                                size={44}
                                variant="home"
                            />
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
});

export default SearchBarKnowledge;
