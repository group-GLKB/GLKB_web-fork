import React, {useEffect, useState} from 'react';
import { Stack, Chip, TextField, Button, Select, MenuItem, FormControl,
    InputLabel, Box, Container, Typography, Autocomplete, Card, Grid} from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import { FormGroup, FormControlLabel, Switch } from '@mui/material';
import {CypherService} from '../../../service/Cypher'
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import {useNavigate} from 'react-router-dom';
import {matchSorter} from 'match-sorter'

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
                // ...sourceNodeOptions, 
                ...sourceNodeData.map(node => [node.database_id, node.name])
            ]);
        }
    }, [sourceNodeData]);

    let sourceTimer;
    const updateSource = (event, value) => {
        if (value.trim() === '') {
            //setSourceNodeOptions([]);
        } else {
            // setSourceNodeOptions([
            //     `Option ${value}`,
            //     `Option ${value + "4"}`,
            //     `Option ${value + "$$$$"}`,
            // ]);
            // TODO: Connect and set this to call API to autocomplete
            // setSourceNodeOptions([
            //     value
            // ]);
            if (event.type == "click") {
                sourceEntitySearch(value);
                const newTriplet = [value, triplets[1], triplets[2]];
                setTriplets(newTriplet);
            } else {
                clearTimeout(sourceTimer);
                sourceTimer = setTimeout(() => {
                    sourceEntitySearch(value);
                    const newTriplet = [value, triplets[1], triplets[2]];
                    setTriplets(newTriplet);
                }, 1000);
            }
        }
    };
    useEffect(() => {
        if (targetNodeData.length > 0) {
            setTargetNodeOptions([
                //...targetNodeOptions, 
                ...targetNodeData.map(node => [node.database_id, node.name])
            ]);
        }
    }, [targetNodeData]);

    let targetTimer;
    const updateTarget = (event, value) => {
        if (value.trim() === '') {
            //setTargetNodeOptions([]);
        } else {
            // setSourceNodeOptions([
            //     `Option ${value}`,
            //     `Option ${value + "4"}`,
            //     `Option ${value + "$$$$"}`,
            // ]);
            // TODO: Connect and set this to call API to autocomplete
            // setTargetNodeOptions([
            //     value
            // ]);
            if (event.type == "click") {
                targetEntitySearch(value);
                const newTriplet = [triplets[0], triplets[1], value];
                setTriplets(newTriplet);
            } else {
                clearTimeout(targetTimer);
                targetTimer = setTimeout(() => {
                    targetEntitySearch(value);
                    const newTriplet = [triplets[0], triplets[1], value];
                    setTriplets(newTriplet);
                }, 1000)
            }
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
        }
    };



    const handleToggle = () => {
        setExpanded(!expanded);
    };

    function getIdFromName(name, nodeOptions) {
        for (let option of nodeOptions) {
            // Check if the name matches
            if (option[1] === name) {
                // Return the corresponding ID
                return option[0];
            }
        }
        // If name not found, return null or throw an exception, depending on your requirements
        return null;
    }

    //This function is called after click on Add Triplet button, adding three fields of the triplets to ChipData
    const handleAddTriplet = () =>{
        if (triplets[0] === "" && triplets[1] === "" && triplets[2] === "") return;
        // let newKey = chipData.length;
        let chip_str = triplets.map((item, index) => {
            if (index == 1 && item == "") {
                return "[any relationships]"
            } else if (index == 2 && item == "") {
                return "()"
            } else if (index == 1) {
                return "[" + item + "]"
            } else {
                return "(" + item + ")"
            }
        }).join("-");
        console.log(chip_str)
        if (chipData.includes((chip_str))) return;
        // chipData.push({key:newKey, label:''})
        // const newData = [...chipData, {key:newKey, label:chip_str}]
        console.log(chipData);
        const newData = [...chipData, chip_str];
        setChipData(newData);
        const sourceID = getIdFromName(triplets[0], sourceNodeOptions);
        const targetID = getIdFromName(triplets[2], targetNodeOptions);
        console.log(chipDataID);
        setChipDataID([...chipDataID, [sourceID, targetID]]);
    }

    // This function is called after clicking on the search button
    const handleSearch = async () => {
        // Here should trigger search result api and route to the result page
        console.log("searching result with data: ");
        console.log(chipData); // Here need to trim the data before send to backend
        console.log(maxArticles);
        console.log(maxRel);
        console.log(maxBioTerms);
        console.log(moreNodes);
        console.log(moreRel);
        //Create search result based on the status
        let search_data = {
            "triplets": chipData.map((triplet, index) =>{
                // console.log(triplet)
                const parts = triplet.replace(/{|}/g, "").split("-");
                console.log(triplet)
                return {
                    "source": [Number(chipDataID[index][0]), parts[0].trim()],
                    "rel": parts[1].trim(),
                    "target": [Number(chipDataID[index][1]), parts[2].trim()]
                };
            }),
            "params": {
                "max_articles": maxArticles,
                "max_terms": maxBioTerms,
                "max_rels": maxRel,
                "more_terms": moreNodes===true ? "True":"False",
                "more_rels": moreRel===true ? "True":"False",
                "merge": "True"
            }
        };
        console.log(search_data);
        // let cypherServ = new CypherService()
        // const response = await cypherServ.Triplet2Cypher(search_data)
        navigate('/result', { state: { search_data, chipDataID } });
        if (props.displayArticleGraph) {
            props.setDisplayArticleGraph(false);
        }
    };

    // async function search(content) {
    //     navigate('/result', { state: { content } });
    //     // let cypherServ = new CypherService()
    //     // const response = await cypherServ.Triplet2Cypher(content)
    //     // console.log('function -> ', response)
    //     //console.log(sampleGraphData)
    //     // setData(sampleGraphData[0])
    //     // setAllNodes(sampleGraphData[1])
    //     // // setData(response.data[0])
    //     // // setAllNodes(response.data[1])
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

    return (
        <Container maxWidth="md">
            <Box sx={{ marginTop: 4 }}>

                <Box display="flex" alignItems="center" gap={2} p={2}>
                    <FormControl fullWidth>
                    <Autocomplete
                        freeSolo
                        autoHighlight={true}
                        filterOptions={filterOptions}
                        // inputValue={inputValue}
                        onInputChange={(event, newInputValue) => {
                            updateSource(event, newInputValue);
                        }}
                        options={sourceNodeOptions.length > 0 ? sourceNodeOptions.map(option => (option[1])) : []}
                        renderInput={(params) => (
                            <TextField {...params} label="Name" variant="outlined" />
                        )}
                    />
                    </FormControl>

                    {/* <FormControl fullWidth>
                        <InputLabel id="relationship-label">Relationship(Optional)</InputLabel>
                        <Select
                            labelId="relationship-label"
                            id="relationship"
                            value={relationship}
                            label="Relationship"
                            onChange={updateRelationship}
                        >
                            {relationTypes.map((type)=>(
                                <MenuItem value={type}>{type}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <Autocomplete
                            freeSolo
                            autoHighlight={true}
                            filterOptions={filterOptions}
                            // inputValue={inputValue}
                            onInputChange={(event, newInputValue) => {
                                updateTarget(event, newInputValue);
                            }}
                            options={targetNodeOptions.length > 0 ? targetNodeOptions.map(option => option[1]) : []}
                            renderInput={(params) => (
                                <TextField {...params} label="Target Node" variant="outlined" />
                            )}
                        />
                    </FormControl> */}


                    <Button variant="contained" color="primary"
                            sx={{ minWidth:'120px', backgroundColor: '#8BB5D1', color: 'black', '&:hover': { backgroundColor: '#4A7298' } }}
                            onClick={handleAddTriplet}>
                        Add Node
                    </Button>
                </Box>
                <Box display="flex" alignItems="center" gap={2} p={2}>
                    {/* Data display area with chips */}
                    <FormControl>
                        <Card variant="outlined"
                                sx={{ width:'650px'}}
                        >
                            <Stack direction="row" spacing={1} sx={{ marginY: 2 }}>
                                {chipData.map((data) => (
                                    <Chip
                                        label={data.replace(/{|}/g, "").split("-")[0].slice(1, -1).trim()}
                                        // variant="outlined"
                                        // onClick={handleClick}
                                        onDelete={() => handleDelete(data)}
                                    />
                                ))}
                            </Stack>
                        </Card>

                    </FormControl>

                    <Button variant="contained" color="primary"
                            sx={{ minWidth:'100px', backgroundColor: '#F7EFAE', color: 'black', '&:hover': { backgroundColor: '#F3C846' } }}
                            onClick={handleSearch}>
                        Search
                    </Button>
                </Box>

                {/* {showAdvance && (
                <Box style={boxStyle}>
                    <Button
                        variant="text"
                        endIcon={<ExpandLessIcon />}
                        style={buttonStyle}
                        onClick={handleToggle}
                        sx={{width:'200px'}}
                    >
                        Advanced Search
                    </Button> */}
                    {/*<Button variant="contained"  style={buttonStyle}>*/}
                    {/*    Advanced Search*/}
                    {/*</Button>*/}
                    {/* <Box style={formGroupStyle}>
                        <Grid container spacing={1} alignItems="center">
                            <Grid item xs={6}>
                                <TextField
                                    id="max-articles"
                                    label="Maximum articles:"
                                    type="number"
                                    variant="outlined"
                                    // size="small"
                                    onChange={(event) => updateMaxArticles(event)}
                                    // InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <FormControlLabel
                                    control={<Switch
                                        checked = {moreNodes}
                                        onChange = {(event)=>updateMoreNodes(event)}
                                    />}
                                    label="More nodes"
                                    labelPlacement="start"
                                />
                            </Grid>

                            <Grid item xs={6}>
                                <TextField
                                    label="Maximum biomedical terms:"
                                    variant="outlined"
                                    type="number"
                                    // size="small"
                                    margin="normal"
                                    onChange={(event) => updateMaxBioTerms(event)}
                                    // InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <FormControlLabel
                                    control={<Switch
                                        checked = {moreRel}
                                        onChange = {(event)=>updateMoreRel(event)}
                                    />}
                                    label="More relationships"
                                    labelPlacement="start"
                                />
                            </Grid>

                            <Grid item xs={6}>
                                <TextField
                                    label="Maximum relationships:"
                                    variant="outlined"
                                    // size="small"
                                    type="number"
                                    margin="normal"
                                    onChange={(event) => updateMaxRel(event)}
                                    // InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                        </Grid>
                    </Box> */}
                    {/*<Button variant="contained" color="primary" style={buttonStyle}>*/}
                    {/*    Search*/}
                    {/*</Button>*/}
                {/* </Box>
                )} */}

                {/* ... more UI components as needed ... */}
            </Box>

        </Container>
    );
}





















//
//
// import React, { useState } from 'react';
// import { Input, Select,  Space, SelectProps } from 'antd';
// import './scoped.css'; // Import the CSS file for styling
// import Button from '@mui/material/Button';
//
// import Chip from '@mui/material/Chip';
// import Stack from '@mui/material/Stack';
//
//
// const { Option } = Select;
//
//
// const SearchBarKnowledge = () => {
//     const [inputValue, setInputValue] = useState('');
//     const [showLog, setShowLog] = useState(false);
//
//     const handleInputChangeField1 = (e) => {
//         const value = e.target.value;
//         setInputValue(value);
//         setShowLog(value !== ''); // Set showLog to false when the input is empty
//     };
//
//     for (let i = 10; i < 36; i++) {
//         options.push({
//             label: i.toString(36) + i,
//             value: i.toString(36) + i,
//         });
//     }
//
//
//     const handleChange = (value) => {
//         console.log(`selected ${value}`);
//     };
//
//     const handleDelete = () => {
//         console.info('You clicked the delete icon.');
//     };
//
//     return (
//         <div className="search-bar-container">
//             <Select
//                 mode="tags"
//                 style={{ width: '100%' }}
//                 placeholder="Tags Mode"
//                 onChange={handleChange}
//                 options={options}
//             />
//             <Space style={{ width: '100%' }} direction="vertical">
//                 <Select
//                     mode="multiple"
//                     allowClear
//                     style={{ width: '100%' }}
//                     placeholder="Please select"
//                     defaultValue={['a10', 'c12']}
//                     onChange={handleChange}
//                     options={options}
//                 />
//                 <Select
//                     mode="multiple"
//                     style={{ width: '100%' }}
//                     placeholder="Please select"
//                     defaultValue={['a10', 'c12']}
//                 />
//             </Space>
//             <div className="input-container">
//                 <Input
//                     className="input-field"
//                     placeholder="First Field"
//                     value={inputValue}
//                     onChange={handleInputChangeField1}
//                 />
//                 {showLog && (
//                     <div className="log-box">
//                         Log: {inputValue}
//                     </div>
//                 )}
//             </div>
//             <Select
//                 className="dropdown-field"
//                 defaultValue="Relationship"
//                 onChange={setInputValue}
//                 style={{ width: 200 }}
//             >
//                 <Option value="1">1</Option>
//                 <Option value="2">2</Option>
//                 <Option value="3">3</Option>
//             </Select>
//             <div className="input-container">
//                 <Input
//                     className="input-field"
//                     placeholder="Third Field"
//                 />
//             </div>
//             <Button variant="contained">Hello World</Button>
//
//                 {/*<Button className="add-button" type="primary">Add triplet</Button>*/}
//             <Stack direction="row" spacing={1}>
//                 <Chip label="Deletable" onDelete={handleDelete} />
//                 <Chip label="Deletable" variant="outlined" onDelete={handleDelete} />
//             </Stack>
//
//         </div>
//     );
// };
//
// export default SearchBarKnowledge;