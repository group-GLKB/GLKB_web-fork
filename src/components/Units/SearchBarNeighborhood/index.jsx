import React, { useState, useCallback, useEffect } from 'react';
import { Box, Container, TextField, Button, Autocomplete } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CypherService } from '../../../service/Cypher';
import { debounce } from 'lodash';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Select, Tooltip, Typography } from 'antd';
import 'antd/dist/reset.css';  // Make sure you have antd styles imported

export default function SearchBarNeighborhood(props) {
    const navigate = useNavigate();
    const [sourceNodeOptions, setSourceNodeOptions] = useState([]);
    const [sourceNodeData, setSourceNodeData] = useState([]);
    const [selectedSource, setSelectedSource] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [searchType, setSearchType] = useState('Vocabulary');
    const [searchLimit, setSearchLimit] = useState(10);
    const [relationType, setRelationType] = useState('semantic relationships');
    const [termType, setTermType] = useState('All');

    // Simple debounced search function
    const debouncedSearch = useCallback(
        debounce((searchFn) => searchFn(), 200),
        []
    );

    // Main search function that always uses current term type
    const performSearch = async (searchValue) => {
        console.log('Performing search with:', { searchValue, termType });
        let cypherServ = new CypherService();
        const response = await cypherServ.Entity2Cypher(searchValue, termType);
        setSourceNodeData(response.data);
        setSourceNodeOptions([
            ...response.data.map(node => [node.database_id, `${node.name} (${node.element_id})`])
        ]);
    };

    const updateSource = (event, newInputValue) => {
        console.log("updateSource called with:", { newInputValue, termType });
        
        if (newInputValue === null || newInputValue.trim() === '') {
            setSourceNodeOptions([]);
            setSelectedSource(null);
            setInputValue('');
            return;
        }

        const searchValue = newInputValue.split(' (')[0];
        setInputValue(newInputValue);
        
        // Always create a new search function with current values
        const searchFn = () => performSearch(searchValue);
        
        if (event && event.type === "click") {
            searchFn();
        } else {
            debouncedSearch(searchFn);
        }
    };

    const handleSearch = async () => {
        if (!selectedSource) return;

        const sourceNode = sourceNodeData.find(node => 
            node.name === selectedSource.split(' (')[0] ||
            node.aliases.some(alias => alias === selectedSource.split(' (')[0])
        );

        const search_data = {
            source: {
                ...sourceNode,
                name: selectedSource.split(' (')[0]
            },
            params: {
                type: searchType,
                limit: searchLimit,
                rel_type: relationType
            }
        };

        if (props.onSearch) {
            props.onSearch(search_data);
        } else {
            navigate('/result', { 
                state: { 
                    search_data,
                    searchType: 'neighbor'
                } 
            });
        }
    };

    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    // Effect to re-search when term type changes
    useEffect(() => {
        if (inputValue) {
            const searchValue = inputValue.split(' (')[0];
            performSearch(searchValue);
        }
    }, [termType]);

    return (
        <Container maxWidth={isSmallScreen ? "xs" : "md"}>
            <Box sx={{ marginTop: 2, marginBottom: 2 }}>
                {/* First row with term type and Autocomplete */}
                <Box sx={{ mb: 2, display: 'flex', gap: 2, flexDirection: isSmallScreen ? 'column' : 'row' }}>
                    <Box sx={{ width: isSmallScreen ? '100%' : '200px' }}>
                        <Tooltip 
                            title="Type of the input biomedical term"
                            placement="top"
                        >
                            <Select
                                className="term-type-dropdown"
                                style={{ width: '100%' }}
                                value={termType}
                                onChange={setTermType}
                                options={[
                                    { value: 'Gene', label: 'Gene' },
                                    { value: 'Disease', label: 'Disease' },
                                    { value: 'Chemical', label: 'Chemical' },
                                    { value: 'MeSH', label: 'MeSH' },
                                    { value: 'Variant', label: 'Variant' },
                                    { value: 'All', label: 'All' },
                                ]}
                            />
                        </Tooltip>
                    </Box>

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
                                    label="Type in a biomedical term" 
                                    variant="outlined" 
                                    size="small" 
                                    fullWidth 
                                    className="search-autocomplete-box"
                                />
                            )}
                            value={selectedSource}
                            inputValue={inputValue}
                            onChange={(event, newValue) => {
                                setSelectedSource(newValue);
                            }}
                        />
                    </Box>
                </Box>

                {/* Second row with dropdowns and search button */}
                <Box display="flex" gap={2} flexDirection={isSmallScreen ? 'column' : 'row'}>
                    <Box display="flex" gap={1} flexDirection={isSmallScreen ? 'column' : 'row'} sx={{ flexGrow: 1 }}>
                        <Box>
                            <Tooltip 
                                title="Select the type of related biomedical terms related to the selected term. 'Vocabulary' will search for all biomedical terms related to the selected term."
                                placement="top"
                            >
                                <Select
                                    className="term-type-dropdown"
                                    style={{ minWidth: '150px' }}
                                    value={searchType}
                                    onChange={setSearchType}
                                    options={[
                                        { value: 'Gene', label: 'Gene' },
                                        { value: 'ChemicalEntity', label: 'Chemical Entity' },
                                        { value: 'DiseaseOrPhenotypicFeature', label: 'Disease/Phenotype' },
                                        { value: 'SequenceVariant', label: 'Sequence Variant' },
                                        { value: 'Vocabulary', label: 'Vocabulary' },
                                    ]}
                                />
                            </Tooltip>
                        </Box>

                        <Box>
                            <Tooltip 
                                title="Choose how many results to display in the neighborhood graph"
                                placement="top"
                            >
                                <Select
                                    className="results-limit-dropdown"
                                    style={{ minWidth: '100px' }}
                                    value={searchLimit}
                                    onChange={setSearchLimit}
                                    options={[
                                        { value: 10, label: '10 results' },
                                        { value: 15, label: '15 results' },
                                        { value: 20, label: '20 results' },
                                    ]}
                                />
                            </Tooltip>
                        </Box>

                        <Box>
                            <Tooltip 
                                title={
                                    <div>
                                        <p>Choose the type of relationships to display:</p>
                                        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                                            <li>Curated: Manually verified relationships from databases</li>
                                            <li>Semantic: Extracted relationships from literature</li>
                                        </ul>
                                    </div>
                                }
                                placement="top"
                            >
                                <Select
                                    className="relationship-type-dropdown"
                                    style={{ minWidth: '180px' }}
                                    value={relationType}
                                    onChange={setRelationType}
                                    options={[
                                        { value: 'curated relationships', label: 'Curated Relationships' },
                                        { value: 'semantic relationships', label: 'Semantic Relationships' },
                                    ]}
                                />
                            </Tooltip>
                        </Box>
                    </Box>

                    <Button 
                        variant="contained" 
                        color="primary"
                        sx={{ 
                            minWidth: '60px', 
                            height: '40px', 
                            backgroundColor: '#F7EFAE', 
                            color: 'black', 
                            '&:hover': { backgroundColor: '#F3C846' },
                            width: isSmallScreen ? '100%' : 'auto'
                        }}
                        onClick={handleSearch}
                        disabled={!selectedSource}
                        className="search-button"
                    >
                        Search
                    </Button>
                </Box>
            </Box>
        </Container>
    );
}
