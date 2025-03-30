import React, { useEffect, useState, useCallback } from 'react';
import { Box, Container, TextField, Button, Autocomplete, Card, Typography } from '@mui/material';
import { Stack, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CypherService } from '../../../service/Cypher';
import { debounce } from 'lodash';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Select as AntSelect, Tooltip } from 'antd';
import 'antd/dist/reset.css';

const SearchBarKnowledge = React.forwardRef((props, ref) => {
    const navigate = useNavigate();
    const [sourceNodeOptions, setSourceNodeOptions] = useState([]);
    const [sourceNodeData, setSourceNodeData] = useState([]);
    const [chipData, setChipData] = useState([]);
    const [chipDataID, setChipDataID] = useState([]);
    const [selectedSource, setSelectedSource] = useState(null);
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

    // Simple debounced search function
    const debouncedSearch = useCallback(
        debounce((searchFn) => searchFn(), 200),
        []
    );

    // Main search function that always uses current term type
    const performSearch = async (searchValue) => {
        let cypherServ = new CypherService();
        const response = await cypherServ.Entity2Cypher(searchValue, termType);
        setSourceNodeData(response.data);
        setSourceNodeOptions([
            ...response.data.map(node => [node.database_id, `${node.name} (${node.element_id})`])
        ]);
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

    const handleDelete = (data) => {
        const index = chipData.indexOf(data);
        if (index !== -1) {
            const newChipData = chipData.filter((chip, idx) => idx !== index);
            const newChipDataID = chipDataID.filter((id, idx) => idx !== index);
            setChipData(newChipData);
            setChipDataID(newChipDataID);
            if (newChipData.length < 5) {
                setTripletLimitReached(false);
            }
        }
    };

    const handleAddTriplet = () => {
        if (!selectedSource || chipData.length >= 5) return;
        
        const sourceName = selectedSource.split(' (')[0];
        let chip_str = `(${sourceName})-[any relationships]-()`;
        if (chipData.includes(chip_str)) return;
        
        const sourceNode = sourceNodeData.find(node => 
            node.name.toLowerCase() === sourceName.toLowerCase() ||
            node.aliases.some(alias => alias.toLowerCase() === sourceName.toLowerCase())
        );
        
        setChipData(prev => [...prev, chip_str]);
        setChipDataID(prev => [...prev, [sourceNode, null]]);
        
        setSelectedSource(null);
        setInputValue("");
        setSourceNodeOptions([]);

        if (chipData.length + 1 >= 5) {
            setTripletLimitReached(true);
        }
    };

    const handleSearch = () => {
        const search_data = {
            "triplets": chipData.map((triplet, index) => {
                const parts = triplet.replace(/{|}/g, "").split("-");
                const sourceNode = chipDataID[index][0];
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
            }
        };

        if (props.onSearch) {
            props.onSearch(search_data);
        } else {
            navigate('/result', { state: { search_data, chipDataID } });
        }

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
            
            exampleQuery.triplets.forEach(triplet => {
                const sourceName = triplet.source[1].replace(/[()]/g, '');
                const chip_str = `(${sourceName})-[any relationships]-()`;
                
                setChipData(prev => [...prev, chip_str]);
                setChipDataID(prev => [...prev, [
                    { database_id: triplet.source[0], name: sourceName },
                    null
                ]]);
            });

            if (exampleQuery.params) {
                setMaxArticles(exampleQuery.params.max_articles || 0);
                setMaxBioTerms(exampleQuery.params.max_terms || 0);
                setMaxRel(exampleQuery.params.max_rels || 0);
                setMoreNodes(exampleQuery.params.more_terms === "True");
                setMoreRel(exampleQuery.params.more_rels === "True");
            }
        }
    }));

    return (
        <Container maxWidth={isSmallScreen ? "xs" : "md"} sx={{ mt: 2 }}>
            <Box sx={{ mb: 2, backgroundColor: 'transparent'}}>
                {/* First row with term type and search input */}
                <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    flexDirection: isSmallScreen ? 'column' : 'row',
                    backgroundColor: 'transparent'
                }}>
                    {/* Entity Type Selector */}
                    <Box sx={{ 
                        width: isSmallScreen ? '100%' : '200px',
                        backgroundColor: 'transparent'
                    }}>
                        <AntSelect
                            className="term-type-dropdown"
                            style={{ width: '100%', height: '40px' }}
                            value={termType}
                            onChange={setTermType}
                            options={[
                                { value: 'Gene', label: 'Gene' },
                                { value: 'Disease', label: 'Disease' },
                                { value: 'Chemical', label: 'Chemical' },
                                { value: 'MeSH', label: 'MeSH' },
                                { value: 'Variant', label: 'Variant' },
                                { value: 'All', label: 'Any Biomedical Terms' },
                            ]}
                        />
                    </Box>

                    {/* Search Input */}
                    <Box sx={{ flexGrow: 1 }}>
                        <Autocomplete
                            freeSolo
                            autoHighlight={true}
                            onInputChange={(event, newInputValue) => {
                                setInputValue(newInputValue);
                                updateSource(event, newInputValue);
                            }}
                            options={sourceNodeOptions.map(option => option[1])}
                            renderInput={(params) => (
                                <TextField 
                                    {...params} 
                                    placeholder="Type in a biomedical term"
                                    variant="outlined" 
                                    size="small" 
                                    fullWidth 
                                    className="search-autocomplete-box"
                                />
                            )}
                            value={selectedSource}
                            inputValue={inputValue}
                            onChange={(event, newValue) => {
                                if (options.includes(newValue)) {
                                    setSelectedSource(newValue);
                                }
                            }}
                        />
                    </Box>

                    <Box display="flex" gap={2} 
                        sx={{
                            overflow: 'visible !important',
                            zIndex: 9999,
                            position: 'relative',
                        }}
                    >
                        <Button 
                            variant="contained" 
                            sx={{ 
                                minWidth: '60px', 
                                height: '40px', 
                                backgroundColor: '#8BB5D1', 
                                color: 'black', 
                                '&:hover': { backgroundColor: '#4A7298' },
                                width: isSmallScreen ? '100%' : 'auto'
                            }}
                            onClick={handleAddTriplet}
                            disabled={tripletLimitReached || !selectedSource}
                            className="add-biomedical-term-button"
                        >
                            Add Biomedical Term
                        </Button>

                        <Button 
                            variant="contained" 
                            sx={{ 
                                minWidth: '60px', 
                                height: '40px', 
                                backgroundColor: '#F7EFAE', 
                                color: 'black', 
                                '&:hover': { backgroundColor: '#F3C846' },
                                width: isSmallScreen ? '100%' : 'auto'
                            }}
                            onClick={handleSearch}
                            disabled={chipData.length === 0}
                            className="search-button"
                        >
                            Search
                        </Button>
                    </Box>
                </Box>

                {/* Chips display area */}
                <Box sx={{ 
                    mt: 1, 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    backgroundColor: 'transparent',
                    
                }}>
                    <Card 
                        variant="outlined" 
                        sx={{ 
                            p: 1, 
                            flexGrow: 1, 
                            mr: 2,
                            backgroundColor: 'white',
                            height: '80px'
                        }} 
                        className="log-box"
                    >
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            {chipData.map((data) => (
                                <Chip
                                    key={data}
                                    label={data.replace(/{|}/g, "").split("-")[0].slice(1, -1).trim()}
                                    onDelete={() => handleDelete(data)}
                                    size="small"
                                />
                            ))}
                        </Stack>
                    </Card>
                    <Typography variant="body2" sx={{ minWidth: '40px', textAlign: 'right' }}>
                        {`${chipData.length}/5 added terms`}
                    </Typography>
                </Box>
            </Box>
        </Container>
    );
});

export default SearchBarKnowledge;