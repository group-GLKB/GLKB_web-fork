import React, { useEffect, useState, useCallback } from 'react';
import { Box, Container, TextField, Button, Autocomplete, Card, Typography } from '@mui/material';
import { Stack, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CypherService } from '../../../service/Cypher';
import { debounce, set } from 'lodash';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Select as AntSelect, Tooltip } from 'antd';
import CloseIcon from '@mui/icons-material/Close'; // Import the Clear (cross) icon
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SendIcon from '@mui/icons-material/Send';
import 'antd/dist/reset.css';

const SearchBarKnowledge = React.forwardRef((props, ref) => {
    const navigate = useNavigate();
    const [sourceNodeOptions, setSourceNodeOptions] = useState([]);
    const [sourceNodeData, setSourceNodeData] = useState([]);
    const [chipData, setChipData] = useState([]);
    const [chipDataID, setChipDataID] = useState([]);
    const [selectedSource, setSelectedSource] = React.useState(null);
    const [selectedSources, setSelectedSources] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [termType, setTermType] = useState('All');
    const [tripletLimitReached, setTripletLimitReached] = useState(false);
    const [maxArticles, setMaxArticles] = useState(0);
    const [maxBioTerms, setMaxBioTerms] = useState(0);
    const [maxRel, setMaxRel] = useState(0);
    const [moreNodes, setMoreNodes] = useState(false);
    const [moreRel, setMoreRel] = useState(false);


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

    // Sort function for options
    const sortByCategory = (a, b) => {
        const categoryA = getDisplayCategory(a[2]);
        const categoryB = getDisplayCategory(b[2]);

        // First sort by category order
        const orderDiff = categoryOrder.indexOf(categoryA) - categoryOrder.indexOf(categoryB);
        if (orderDiff !== 0) return orderDiff;

        // Then sort alphabetically within category
        return a[1].localeCompare(b[1]);
    };
    // Convert database type to display category

    const getDisplayCategory = (databaseType) => {
        // console.log('Processing type:', databaseType);
        const category = databaseTypeMapping[databaseType] || 'All Biomedical Terms';
        // console.log('Mapped to category:', category);
        return category;
    };

    // Simple debounced search function
    const debouncedSearch = useCallback(
        debounce((searchFn) => searchFn(), 200),
        []
    );

    // Main search function that always uses current term type
    const performSearch = async (searchValue) => {
        let cypherServ = new CypherService();
        const response = await cypherServ.Entity2Cypher(searchValue, termType);
        const sortedOptions = response.data
            .map(node => [
                node.database_id,
                `${node.name} (${node.element_id})`,
                node.type
            ])
            .sort(sortByCategory);
        setSourceNodeOptions(sortedOptions);
        // setSourceNodeData(response.data);
        // setSourceNodeOptions([
        //     ...response.data.map(node => [node.database_id, `${node.name} (${node.element_id})`,node.type])
        // ]);
    };

    const updateSource = (event, newInputValue) => {
        if (newInputValue === null || newInputValue.trim() === '') {
            setSourceNodeOptions([]);
            setSelectedSource(null);
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
                { database_id: Number(source[0]), name: sourceName },
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

        console.log('Updated chipData:', newChipData);
        console.log('Updated chipDataID:', newChipDataID);
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

        console.log('Filtered chipData:', updatedChipData);
        console.log('Filtered chipDataID:', updatedChipDataID);
    }, [selectedSources]); // Trigger this effect whenever selectedSources, chipData, or chipDataID changes

    useEffect(() => {
        // Update tripletLimitReached based on the number of selected terms
        if (selectedSources.length >= 5) {
            setTripletLimitReached(true);
        } else {
            setTripletLimitReached(false);
        }
    }, [selectedSources]); // Trigger this effect whenever selectedSources changes

    // Handle search button click
    const handleSearch = () => {
        const search_data = {
            "triplets": chipData.map((triplet, index) => {
                const parts = triplet.replace(/{|}/g, "").split("-");
                const sourceNode = chipDataID[index]?.[0];
                if (!sourceNode) {
                    console.error(`Missing sourceNode for chipDataID at index ${index}`);
                    return null; // Skip this triplet if sourceNode is missing
                }
                return {
                    "source": [Number(sourceNode.database_id), parts[0].trim()],
                    "rel": parts[1].trim(),
                    "target": [0, parts[2].trim()]
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
            "sources": selectedSources
        };
        if (props.onSearch) {
            props.onSearch(search_data);
        } else {
            navigate('/result', { state: { search_data, chipDataID } });
        }

        console.log('Chip data:', chipDataID);
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

    React.useEffect(() => {
        console.log('Selected sources (after update):', selectedSources);
    }, [selectedSources]);

    return (
        <Container maxWidth={isSmallScreen ? "xs" : "md"} sx={{ mt: 2, mb: 2, ml: 0, mr: 0, padding: 0, maxWidth: 'none !important' }}>
            <Box sx={{ mb: 0, backgroundColor: 'transparent' }}>
                {/* First row with term type and search input */}
                <Box sx={{
                    display: 'flex',
                    gap: 2,
                    flexDirection: isSmallScreen ? 'column' : 'row',
                    backgroundColor: 'white'
                }}>

                    {/* Search Input */}
                    <Box sx={{ flexGrow: 1 }}>
                        <Autocomplete
                            multiple
                            freeSolo
                            limitTags={5}
                            autoHighlight={true}
                            onInputChange={(event, newInputValue) => {
                                if (!tripletLimitReached) {
                                    setInputValue(newInputValue);
                                    updateSource(event, newInputValue);
                                }
                            }}
                            options={sourceNodeOptions || []}
                            filterOptions={(options) => options}
                            filterSelectedOptions={true}
                            groupBy={(option => getDisplayCategory(option[2]))}
                            getOptionLabel={(option) => {
                                // console.log('Option:', option);
                                return option[1]
                            }}
                            renderTags={(value, getTagProps) =>
                                value.map((option, index) => (
                                    <Chip
                                        key={option.database_id}
                                        label={option[1].replace(/\s*\([^)]*\)$/, "")}
                                        size="small"
                                        {...getTagProps({ index })} // Pass props for chip behavior
                                    />
                                ))
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder={"Start searching with biomedical terms"} // Update placeholder
                                    variant="outlined"
                                    sx={{
                                        minHeight: '60px', // Increase the height of the input box
                                        '& .MuiInputBase-root': {
                                            height: 'auto', // Allow the height to grow dynamically
                                            minHeight: '60px',
                                            alignItems: 'center', // Center the text vertically
                                        },
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'grey', // Optional: Customize border color
                                        },
                                        "& .MuiOutlinedInput-root": {
                                            paddingRight: "70px!important",
                                        },
                                    }}
                                    size="small"

                                    className="search-autocomplete-box"
                                    InputProps={{
                                        ...params.InputProps,
                                        endAdornment: (
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    justifyContent: 'center',
                                                    position: 'absolute',
                                                    right: 10,
                                                    height: '100%', // Ensure alignment with TextField height
                                                }}
                                            >
                                                {/* Clear Icon */}
                                                <CloseIcon
                                                    className="close-button"
                                                    onClick={() => {
                                                        setSelectedSource([]); // Clear sel`ected options
                                                        setInputValue(''); // Clear input value
                                                    }}
                                                    sx={{
                                                        color: 'grey.500',
                                                        cursor: 'pointer',
                                                        fontSize: '20px', // Adjust size as needed 
                                                    }}
                                                />
                                                {/* Search Icon */}
                                                <SendOutlinedIcon
                                                    className="search-button"
                                                    onClick={handleSearch} // Trigger the search function
                                                    sx={{
                                                        color: '#45628880', // Make the inside color transparent
                                                        cursor: 'pointer',
                                                        fontSize: '35px', // Adjust size as needed
                                                    }}
                                                />
                                            </Box>
                                        ),
                                    }}
                                />
                            )}
                            value={selectedSources}
                            inputValue={inputValue}
                            onChange={(event, newValue) => {
                                setSelectedSources(newValue);
                                console.log('New sources:', newValue);
                            }}

                        />
                    </Box>


                </Box>
            </Box>
        </Container>
    );
});

export default SearchBarKnowledge;