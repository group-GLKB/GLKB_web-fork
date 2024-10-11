import React, {useEffect, useState} from 'react';
import { Stack, Chip, TextField, Button, Select, MenuItem, FormControl,
    InputLabel, Box, Container, Typography, Autocomplete, Card, Grid} from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import { FormGroup, FormControlLabel, Switch } from '@mui/material';
import {CypherService} from '../../../service/Cypher'
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import {useNavigate} from 'react-router-dom';
import {matchSorter} from 'match-sorter'
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { debounce } from 'lodash'; // Add this import

export default function SearchBarKnowledge(props) {
    const navigate = useNavigate();
    const [relationship, setRelationship] = React.useState('');
    const [sourceNodeOptions, setSourceNodeOptions] = React.useState([]);
    const [targetNodeOptions, setTargetNodeOptions] = React.useState([]);
    const [chipData, setChipData] =React.useState([]);
    const [chipDataID, setChipDataID] = React.useState([]);
    const [triplets, setTriplets] = React.useState(["", "", ""]); // Represent source, rel, target
    const [expanded, setExpanded] = React.useState(false);
    const [maxArticles, setMaxArticles] = React.useState(0);
    const [maxBioTerms, setMaxBioTerms] = React.useState(0);
    const [maxRel, setMaxRel] = React.useState(0);
    const [moreNodes, setMoreNodes] = React.useState(false);
    const [moreRel, setMoreRel] = React.useState(false);
    const [sourceNodeData, setSourceNodeData] = React.useState([]);
    const [targetNodeData, setTargetNodeData] = React.useState([]);
    const [tripletLimitReached, setTripletLimitReached] = React.useState(false);
    const [selectedSource, setSelectedSource] = useState(null);
    const [inputValue, setInputValue] = useState('');

    const showAdvance = true;
    const relationTypes = ["Associate", "Bind", "Comparison", "Cotreatment", "PositiveCorrelation", "NegativeCorrelation"];
    const example_data = {
        "triplets": [
            {
                "source": [91717148, "CYP1A1"],
                "rel": "",
                "target": [92079547, "Leukemia, Myeloid, Acute"]
            },
            {
                "source": [92079547, "Leukemia, Myeloid, Acute"],
                "rel": "Associate",
                "target": []
            }
        ],
        "params": {
            "max_articles": 50,
            "max_terms": 20,
            "max_rels": 100,
            "more_terms": "True",
            "more_rels": "True"
        }
    };

    const example_node_data = [{'element_id': 'mesh:D016158',
        'name': 'Genes, p53',
        'aliases': [],
        'type': 'Entity',
        'external_sources': {'mesh': 'D016158'},
        'n_citations': 20592,
        'database_id': '92088230',
        'description': 'Tumor suppressor genes located on the short arm of human chromosome 17 and coding for the phosphoprotein p53.'},
        {'element_id': 'efo:1002010',
            'name': 'TP53 Positive Breast Carcinoma',
            'aliases': [],
            'type': 'Entity',
            'external_sources': {'efo': '1002010'},
            'n_citations': 0,
            'database_id': '89120777',
            'description': 'A biologic subset of breast carcinoma defined by high expression of TP53'},
        {'element_id': 'hgnc:53222',
            'name': 'LINC02303',
            'aliases': [],
            'type': 'Entity',
            'external_sources': {'hgnc': '53222'},
            'n_citations': 4,
            'database_id': '91739502',
            'description': 'long intergenic non-protein coding RNA 2303'},
        {'element_id': 'doid:0080705',
            'name': 'medulloblastoma SHH activated and TP53 wild-type',
            'aliases': [],
            'type': 'DiseaseOrPhenotypicFeature',
            'external_sources': {'doid': '0080705'},
            'n_citations': 0,
            'database_id': '91695654',
            'description': 'A medulloblastoma SHH activated that is characterized as a molecular subtype by activation of the sonic hedgehog (SHH) pathway and the absence of TP53 mutations.'},
        {'element_id': 'hgnc:11998',
            'name': 'TP53',
            'aliases': [],
            'type': 'Entity',
            'external_sources': {'hgnc': '11998'},
            'n_citations': 100947,
            'database_id': '91705649',
            'description': 'tumor protein p53'},
        {'element_id': 'hgnc:17026',
            'name': 'TP53TG1',
            'aliases': [],
            'type': 'Entity',
            'external_sources': {'hgnc': '17026'},
            'n_citations': 25,
            'database_id': '91710884',
            'description': 'TP53 target 1'},
        {'element_id': 'reactome:R-HSA-5633007',
            'name': 'Regulation of TP53 Activity',
            'aliases': [],
            'type': 'Entity',
            'external_sources': {'reactome': 'R-HSA-5633007'},
            'n_citations': 0,
            'database_id': '494066359',
            'description': 'Regulation of TP53 Activity'},
        {'element_id': 'efo:0008382',
            'name': 'TP53 mutation status',
            'aliases': [],
            'type': 'Entity',
            'external_sources': {'efo': '0008382'},
            'n_citations': 0,
            'database_id': '89111596',
            'description': 'quantification of some aspect of TP53 mutation, such as the number of accummulated mutations, determined either through immunohistochemistry or DNA sequencing'},
        {'element_id': 'hgnc:17296',
            'name': 'RRM2B',
            'aliases': [],
            'type': 'Entity',
            'external_sources': {'hgnc': '17296'},
            'n_citations': 247,
            'database_id': '91685803',
            'description': 'ribonucleotide reductase regulatory TP53 inducible subunit M2B'},
        {'element_id': 'reactome:R-HSA-3700989',
            'name': 'Transcriptional Regulation by TP53',
            'aliases': [],
            'type': 'Entity',
            'external_sources': {'reactome': 'R-HSA-3700989'},
            'n_citations': 0,
            'database_id': '494065120',
            'description': 'Transcriptional Regulation by TP53'}];


    useEffect(() => {
        setChipData(props.chipData);
        if (props.chipDataIDResult) {
            setChipDataID(props.chipDataIDResult);
        }
    }, [props.chipData])

    useEffect(() => {
        if (sourceNodeData.length > 0) {
            setSourceNodeOptions([
                ...sourceNodeData.map(node => [node.database_id, `${node.name} (${node.element_id})`])
            ]);
        }
    }, [sourceNodeData]);

    // Create debounced search functions
    const debouncedSourceEntitySearch = React.useCallback(
        debounce((value) => {
            sourceEntitySearch(value);
        }, 200),
        []
    );

    const debouncedTargetEntitySearch = React.useCallback(
        debounce((value) => {
            targetEntitySearch(value);
        }, 200),
        []
    );

    const updateSource = (event, value) => {
        console.log("updateSource called with value:", value);
        if (value === null || value.trim() === '') {
            setSourceNodeOptions([]);
            const newTriplet = ["", triplets[1], triplets[2]];
            setTriplets(newTriplet);
            setSelectedSource(null);
        } else {
            const searchValue = value.split(' (')[0];
            console.log("Search value:", searchValue);
            if (event && event.type === "click") {
                sourceEntitySearch(searchValue);
            } else {
                debouncedSourceEntitySearch(searchValue);
            }
            const newTriplet = [searchValue, triplets[1], triplets[2]];
            setTriplets(newTriplet);
        }
    };

    useEffect(() => {
        if (targetNodeData.length > 0) {
            setTargetNodeOptions([
                ...targetNodeData.map(node => [node.database_id, `${node.name} (${node.element_id})`])
            ]);
        }
    }, [targetNodeData]);

    const updateTarget = (event, value) => {
        if (value === null || value.trim() === '') {
            setTargetNodeOptions([]);
            const newTriplet = [triplets[0], triplets[1], ""];
            setTriplets(newTriplet);
        } else {
            if (event && event.type === "click") {
                targetEntitySearch(value);
            } else {
                debouncedTargetEntitySearch(value);
            }
            const newTriplet = [triplets[0], triplets[1], value];
            setTriplets(newTriplet);
        }
    };

    const updateRelationship = (event) => {
        setRelationship(event.target.value);
        setTriplets([triplets[0], event.target.value, triplets[2]]);
    };
    //Handle advance params
    const updateMaxArticles = (event)=> {
        setMaxArticles(event.target.value);
        // console.log(event.target.value);
    };
    const updateMaxBioTerms = (event)=>{
        setMaxBioTerms(event.target.value);
    }

    const updateMaxRel = (event)=>{
        setMaxRel(event.target.value);
    }

    const updateMoreNodes = (event) =>{
        setMoreNodes(event.target.checked);
    }

    const updateMoreRel = (event) =>{
        setMoreRel(event.target.checked);
    }


    // const handleClick = () => {
    //     console.info('You clicked the Chip.');
    // };

    //This function is called after clicked on the delete cross button on the chip
    const handleDelete = (data) => {
        const index = chipData.indexOf(data);

        if (index !== -1) {
            const newChipData = chipData.filter((chip, idx) => idx !== index);
            const newChipDataID = chipDataID.filter((id, idx) => idx !== index);
            setChipData(newChipData);
            setChipDataID(newChipDataID);

            // Check if the limit is no longer reached after deleting
            if (newChipData.length < 5) {
                setTripletLimitReached(false);
            }
        }
    };



    const handleToggle = () => {
        setExpanded(!expanded);
    };

    function getIdFromName(name, nodeOptions) {
        for (let option of nodeOptions) {
            // Check if the name matches (ignoring the element_id part)
            if (option[1].split(' (')[0] === name) {
                // Return the corresponding ID
                return option[0];
            }
        }
        // If name not found, return null or throw an exception, depending on your requirements
        return null;
    }

    //This function is called after click on Add Triplet button, adding three fields of the triplets to ChipData
    const handleAddTriplet = () => {
        console.log("Adding triplet:", triplets);
        if (triplets[0] === "" || chipData.length >= 5) return;
        
        let chip_str = `(${triplets[0]})-[any relationships]-()`;
        if (chipData.includes(chip_str)) return;
        
        const newData = [...chipData, chip_str];
        setChipData(newData);
        
        const sourceNode = sourceNodeData.find(node => 
            node.name.toLowerCase() === triplets[0].toLowerCase() ||
            node.aliases.some(alias => alias.toLowerCase() === triplets[0].toLowerCase())
        );
        
        console.log("Found source node:", sourceNode);
        setChipDataID([...chipDataID, [sourceNode, null]]);
        
        // Clear the inputs after adding the triplet
        setTriplets(["", "", ""]);
        setRelationship("");
        setSourceNodeOptions([]);
        setTargetNodeOptions([]);
        setSelectedSource(null);
        setInputValue("");

        if (newData.length >= 5) {
            setTripletLimitReached(true);
        }
    }

    // This function is called after clicking on the search button
    const handleSearch = async () => {
        console.log("Searching with chip data:", chipData);
        console.log("Chip data IDs:", chipDataID);
        let search_data = {
            "triplets": chipData.map((triplet, index) => {
                const parts = triplet.replace(/{|}/g, "").split("-");
                const sourceNode = chipDataID[index][0];
                const targetNode = chipDataID[index][1];
                console.log("Processing triplet:", triplet);
                console.log("Source node:", sourceNode);
                console.log("Target node:", targetNode);
                return {
                    "source": [Number(sourceNode ? sourceNode.database_id : 0), parts[0].trim()],
                    "rel": parts[1].trim(),
                    "target": [Number(targetNode ? targetNode.database_id : 0), parts[2].trim()]
                };
            }),
            "params": {
                "max_articles": maxArticles,
                "max_terms": maxBioTerms,
                "max_rels": maxRel,
                "more_terms": moreNodes === true ? "True" : "False",
                "more_rels": moreRel === true ? "True" : "False",
                "merge": "True"
            }
        };
        console.log("Search data:", search_data);

        // If we're on the result page, use the provided search function
        if (props.onSearch) {
            props.onSearch(search_data);
        } else {
            // If we're on the home page, navigate to the result page
            navigate('/result', { state: { search_data, chipDataID } });
        }

        if (props.displayArticleGraph) {
            props.setDisplayArticleGraph(false);
        }
    };

    // async function search(content) {
    //     navigate('/result', { state: { content } });
    //     // let cypherServ = new CypherService()
    //     // const response = await cypherServ.Triplet2Cypher(content)
    //     // console.log('function -> ', response)
    //     // //console.log(sampleGraphData)
    //     // // setData(sampleGraphData[0])
    //     // // setAllNodes(sampleGraphData[1])
    //     // setData(response.data[0])
    //     // setAllNodes(response.data[1])
    //     // setSearchFlag(true)
    // }

    async function sourceEntitySearch(content) {
        let cypherServ = new CypherService()
        const response = await cypherServ.Entity2Cypher(content)
        console.log('source -> ', response)
        setSourceNodeData(response.data)
    }

    async function targetEntitySearch(content) {
        let cypherServ = new CypherService()
        const response = await cypherServ.Entity2Cypher(content)
        console.log('target -> ', response)
        setTargetNodeData(response.data)
    }

    const boxStyle = {
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '16px',
    };

    const formGroupStyle = {
        padding: '16px',
        // border: '1px solid #ccc',
        borderRadius: '8px',
        marginBottom: '16px',
        display: expanded ? 'block' : 'none',
    };

    const buttonStyle = {
        textTransform: 'none', // Prevents uppercase transformation
        color: 'blue', // Adjust color as needed
        fontWeight: 'bold', // Adjust font weight as needed
        fontSize: '16px', // Adjust font size as needed
    };

    // const filterOptions = (options, { inputValue }) => matchSorter(options, inputValue);
    const filterOptions = (options, { inputValue }) => options;

    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const isMediumScreen = useMediaQuery(theme.breakpoints.between('sm', 'md'));

    const processChipData = (data) => {
        if (typeof data === 'string') {
            return data.replace(/[()]/g, '');
        }
        // If it's not a string, return it as is or apply appropriate processing
        return data;
    };

    return (
        <Container maxWidth={isSmallScreen ? "xs" : isMediumScreen ? "sm" : "md"}>
            <Box sx={{ marginTop: 2, marginBottom: 2 }}>
                <Box display="flex" alignItems="center" gap={2} flexDirection={isSmallScreen ? 'column' : 'row'}>
                    <FormControl sx={{ flexGrow: 1, width: isSmallScreen ? '100%' : 'auto' }}>
                        <Autocomplete
                            freeSolo
                            autoHighlight={true}
                            filterOptions={filterOptions}
                            onInputChange={(event, newInputValue) => {
                                console.log("Input changed to:", newInputValue);
                                setInputValue(newInputValue);
                                updateSource(event, newInputValue);
                            }}
                            options={sourceNodeOptions.map(option => option[1])}
                            renderInput={(params) => (
                                <TextField 
                                    {...params} 
                                    label="Type in a biomedical term and select from dropdown menu" 
                                    variant="outlined" 
                                    size="small" 
                                    fullWidth 
                                    disabled={tripletLimitReached}
                                    helperText={tripletLimitReached ? "Maximum of 5 triplets reached" : ""}
                                    className="search-autocomplete-box"
                                    // Remove onKeyDown prop
                                />
                            )}
                            value={selectedSource}
                            inputValue={inputValue}
                            onChange={(event, newValue) => {
                                console.log("Selected value:", newValue);
                                setSelectedSource(newValue);
                                if (newValue) {
                                    const newTriplet = [newValue.split(' (')[0], triplets[1], triplets[2]];
                                    setTriplets(newTriplet);
                                }
                            }}
                            disabled={tripletLimitReached}
                        />
                    </FormControl>

                    <Box display="flex" gap={2} flexDirection={isSmallScreen ? 'column' : 'row'} width={isSmallScreen ? '100%' : 'auto'}>
                        <Button 
                            variant="contained" 
                            color="primary"
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
                            disabled={chipData.length === 0}
                            className="search-button"
                        >
                            Search
                        </Button>
                    </Box>
                </Box>

                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Card variant="outlined" sx={{ p: 1, flexGrow: 1, mr: 2 }} className="log-box">
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
}