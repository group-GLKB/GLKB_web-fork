import React, { useEffect, useState } from 'react'
import './scoped.css'
import { Row, Col, Slider, Collapse, Transfer, InputNumber, Typography, Button, Modal, Tree, Input, Menu, Checkbox} from 'antd';
import { DownOutlined, SmileOutlined } from '@ant-design/icons';
import { CaretRightOutlined, PlusCircleOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { NewGraph } from '../../service/NewNode'
import {CypherService} from '../../service/Cypher'
import { render } from '@testing-library/react';
const { Panel } = Collapse;
const { Title } = Typography;

const Filter = props => {
    const graphNodes = [];
    let uniqueLabelsSet;
    let currentLabelsSet;
    let uniqueEdgeLabelsSet;
    let currentEdgeLabelsSet;
    if (props.data.edges) {
        uniqueEdgeLabelsSet = new Set(props.data.edges.map(edge => edge.data.label));
    }
    if (props.data.nodes) {
        uniqueLabelsSet = new Set(props.data.nodes.map(node => node.data.label));
        //setUniqueLabelsArray([...uniqueLabelsSet]);
        for (let i = 0; i < props.data.nodes.length; i++) {
            graphNodes.push(props.data.nodes[i].data.id)
        }
    }
    let existingNodes = []
    const groupedNodes = {}
    if (props.allNodes.length != 0) {
        console.log(props.allNodes)
        props.allNodes.forEach((node, index) => {
            const type = node.type.split(';')[0];
            if (!groupedNodes[type]) {
              groupedNodes[type] = { key: type, title: type, children: [] };
            }
            groupedNodes[type].children.push({ key: node.id, title: node.name, icon: <PlusCircleOutlined style={{color: 'green'}}/>});
          });
          
        existingNodes = Object.values(groupedNodes);
    }
    let initRightTreeData = [];
    useEffect(() => {
        if (props.graphShownData != {}) {
            initRightTreeData = []
            if (props.graphShownData.nodes) {
                for (let i = 0; i < props.graphShownData.nodes.length; i++) {
                    const node = props.graphShownData.nodes[i];
                    const label = node.data.label;
                    const newNode = { key: node.data.id, title: node.data.display, icon: <MinusCircleOutlined style={{color: 'red'}}/> };

                    const labelData = initRightTreeData.find(group => group.key === label);

                    if (labelData) {
                        labelData.children.push(newNode);
                    } else {
                        initRightTreeData.push({ key: label, title: label, children: [newNode] });
                    }
                }
            }
            setRightData(initRightTreeData)
        }
    },[props.graphShownData])

    async function entityToArticle(content) {
        let cypherServ = new CypherService()
        const response = await cypherServ.Term2Article(content)
        console.log('Term2Article -> ', response)
        props.setData(response)
    }

    async function articleToEntity() {
        props.search(props.search_data);
    }

    /* source is visible nodes, target is invisible nodes */
    const [displayLeftTree, setDisplayLeftTree] = useState(true);
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [autoExpandParent, setAutoExpandParent] = useState(false);
    const [checkedKeys, setCheckedKeys] = useState(graphNodes);
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [leftData, setLeftData] = useState(existingNodes);
    const [rightData, setRightData] = useState(initRightTreeData)
    const [newList, setNewList] = useState();
    const [uniqueLabelsArray, setUniqueLabelsArray] = useState([...uniqueLabelsSet]);
    const [uniqueEdgeLabelsArray, setUniqueEdgeLabelsArray] = useState([...uniqueEdgeLabelsSet])

    const toggleTreeDisplay = () => {
        setDisplayLeftTree((prevDisplayLeftTree) => !prevDisplayLeftTree);
    };

    const currentTreeData = displayLeftTree ? leftData : rightData;

    const boolValues = {};
    const boolEdgeValues = {};
    currentLabelsSet = new Set(props.graphShownData.nodes.map(node => node.data.label));
    currentEdgeLabelsSet = new Set(props.graphShownData.edges.map(edge => edge.data.label));
    uniqueEdgeLabelsArray.forEach(label => {
        if (currentEdgeLabelsSet) {
            if (currentEdgeLabelsSet.has(label))
                boolEdgeValues[label] = true;
            else 
                boolEdgeValues[label] = false;
        } else {
            boolEdgeValues[label] = true;
        }
    });
    uniqueLabelsArray.forEach(label => {
        if (currentLabelsSet) {
            if (currentLabelsSet.has(label))
                boolValues[label] = true;
            else 
                boolValues[label] = false;
        } else {
            boolValues[label] = true;
        }
    });
    


    const existingNodeList = []
    for (var i = 0; i < rightData.length; i++) {
        existingNodeList.push(rightData[i].children.map(child => child.key).join('|'))
    }
    const existing = existingNodeList.join('|')

    const onChangeNode = (e) => {
        if (!e.target.checked) {
            const tempKeys = [];
            for (let i = 0; i < props.graphShownData.nodes.length; i++) {
                if (props.graphShownData.nodes[i].data.label != e.target.value) {
                    tempKeys.push(props.graphShownData.nodes[i].data.id);
                }
            }
            setCheckedKeys(tempKeys);
            props.setGraphData(tempKeys);
            boolValues[e.target.value] = false;
        } else {
            var tempKeys = [];
            for (let i = 0; i < props.data.nodes.length; i++) {
                if (props.data.nodes[i].data.label == e.target.value) {
                    tempKeys.push(props.data.nodes[i].data.id);
                }
            }
            checkedKeys.forEach(id => tempKeys.push(id));
            setCheckedKeys(tempKeys);
            props.setGraphData(tempKeys);
            boolValues[e.target.value] = true;
        }
    }

    const LegendItem = ({ label, size, color }) => {
        const isQueryTerms = label === 'query terms';
        
        return (
            <div className="legend-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {label.includes("relationship") ? (
                            <div style={{ marginLeft: "0px", width: "30px", height: "0", borderBottom: '0.5px black', borderBottom: size}}></div>
                        ) : (
                            <div className="legend-circle" style={{ backgroundColor: color, width: size, height: size, marginLeft: size === 5 ? "6px" : size === 10 ? "4px" : "0" }}></div>
                        )}
                    <div className="legend-label" style={{ marginLeft: '10px' }}>{label}</div>
                </div>
                {label.includes("relationship") ? (<Checkbox value={label} defaultChecked={boolEdgeValues[label]}></Checkbox>) : (<Checkbox value={label} defaultChecked={boolValues[label]} onChange={onChangeNode}></Checkbox>)}
            </div>
        );
    };

    const shapeData = [
        { label: 'query terms', size: 20, color: '#A9A9A9' },
        { label: 'non-query terms', size: 20, color: '#A9A9A9' },
    ]
      
    const sizeData = [
        { label: 'frequency < 30', size: 5, color: '#A9A9A9' },
        { label: '30 <= frequency < 60', size: 10, color: '#A9A9A9' },
        { label: 'frequency >= 60', size: 20, color: '#A9A9A9' }
    ];

    const legendDataAll = [
        { label: 'AnatomicalEntity', size: 20, color: '#E43333' },
        { label: 'ChemicalEntity', size: 20, color: '#E8882F' },
        { label: 'DiseaseOrPhenotypicFeature', size: 20, color: '#67BE48' },
        { label: 'Gene', size: 20, color: '#46ACAC' },
        { label: 'BiologicalProcessOrActivity', size: 20, color: '#5782C2' },
        { label: 'MeshTerm', size: 20, color: '#9B58C5' },
        { label: 'SequenceVariant', size: 20, color: '#D829B1' },
    ];

    const edgeDataAll = [
        {label: 'Semantic_relationship', size: 'solid', color: 'black'},
        {label: 'Curated_relationship', size: 'dashed', color: 'black'},
        {label: 'Hierarchical_relationship', size: 'dotted', color: 'black'},
    ]

    const legendData = legendDataAll.filter(item => uniqueLabelsArray.includes(item.label));
    const legendEdgeData = edgeDataAll.filter(item => uniqueEdgeLabelsArray.includes(item.label));
    const onExpand = (expandedKeysValue) => {
        setExpandedKeys(expandedKeysValue);
        setAutoExpandParent(false);
    };

    const onCheck = (checkedKeysValue) => {
        if (newList) {
            const tempKeys = []
            for (var i = 0; i < newList.length; i++) {
                for (var j = 0; j < newList[i].children.length; j++) {
                    tempKeys.push(newList[i].children[j].key)
                }
            }
            console.log(checkedKeys)
            const tempCheckedKeys = checkedKeys.filter(key => tempKeys.includes(key))
            setCheckedKeys(checkedKeys.filter(key => !tempCheckedKeys.includes(key)).concat(checkedKeysValue));
            console.log(checkedKeys);
            return;
        }
        setCheckedKeys(checkedKeysValue);
        props.setGraphData(checkedKeysValue)
    };

    const onSelect = (selectedKeysValue, info) => {
        setSelectedKeys(selectedKeysValue);
        props.handleSelectNodeID(selectedKeysValue);
    };

    const buttonClick = () => {
        const existingList = existing.split('|')
        const filteredList = checkedKeys.filter(item => !isNaN(item))
        const newNode = filteredList.filter(id => !existingList.includes(id)).join('|')
        if (newNode) {
            console.log(newNode)
            drawNewGraph(existing, newNode)
        }
        props.setGraphData(checkedKeys)
    }

    async function drawNewGraph(existing, newNode) {
        let detailServ = new NewGraph()
        const response = await detailServ.AddNodes(existing, newNode)
        console.log(response)
        const newData = JSON.parse(JSON.stringify(props.data));
        for (var i = 0; i < response.data.nodes.length; i++) {
            newData.nodes.push({'data': response.data.nodes[i]})
        }
        for (var i = 0; i < response.data.links.length; i++) {
            newData.edges.push({'data': response.data.links[i]})
        }
        props.setData(newData)
    }

    // const onCheckHandler = displayLeftTree ? onCheck : undefined;
    // const checkedKeysHandler = displayLeftTree ? checkedKeys : undefined;
    // const onSelectHandler = displayLeftTree ? onSelect : undefined;
    // const selectedKeysHandler = displayLeftTree ? selectedKeys : undefined;

    const onSearch = (val, context) => {
        if (!val) {
            setLeftData(existingNodes)
            if (props.graphShownData != {}) {
                initRightTreeData = []
                if (props.graphShownData.nodes) {
                    for (let i = 0; i < props.graphShownData.nodes.length; i++) {
                        const node = props.graphShownData.nodes[i];
                        const label = node.data.label;
                        const newNode = { key: node.data.id, title: node.data.display };
    
                        const labelData = initRightTreeData.find(group => group.key === label);
    
                        if (labelData) {
                            labelData.children.push(newNode);
                        } else {
                            initRightTreeData.push({ key: label, title: label, children: [newNode] });
                        }
                    }
                }
                setRightData(initRightTreeData)
            }
            if (context === 'left') {
                setCheckedKeys(checkedKeys)
            }
            return;
        }
        const data = (context === 'left' ? leftData : rightData)
        const newDeptList = data?.map(item => {
            item = Object.assign({}, item)
            if (item.children) {
                item.children = item.children?.filter(res => (res.title.indexOf(val) > -1))
            }
            return item
        }).filter(item => {
            if (item.children?.length > 0 || val.length == 0) {
                item = Object.assign({}, item)
                item.children?.filter(e => (
                    e.title.indexOf(val) > -1 ? '' : item.title.indexOf(val) > -1
                ))
            } else {
                item = item.title.indexOf(val) > -1
            }
            return item
        })
        if (context === 'left') {
            setLeftData(newDeptList)
            setNewList(newDeptList)
        }
        if (context === 'right') {
            setRightData(newDeptList)
        }
    };

    // const items = () => {
    // return (
    //     <div className="legend-container">
    //         <div className="legend-section">
    //             <div className="legend-row">
    //                 {legendData.map((item, index) => (
    //                     <LegendItem key={index} label={item.label} size={item.size} color={item.color} />
    //                 ))}
    //             </div>
    //         </div>
    //     </div>
    //     );
    // };


    const leftPanel = () => {
        if (!props.displayArticleGraph) {
            return (
                <div style={{marginLeft: '10px', overflow: 'auto', height: '85vh'}}>
                <Collapse defaultActiveKey={['1', '2']} ghost expandIcon={({ isActive }) => <CaretRightOutlined style={{color: '#014484', fontSize: 20}} rotate={isActive ? 90 : 0} />}>
                    <Panel key="1" header={<h3 style={{color: '#014484', fontSize: 20, fontWeight: 'bold'}}>Node types</h3>}>
                        {legendData.map((item, index) => (
                                <LegendItem key={index} label={item.label} size={item.size} color={item.color} />
                            ))}
                    </Panel>
                    <Panel key="2" header={<h3 style={{color: '#014484', fontSize: 20, fontWeight: 'bold'}}>Relationship types</h3>}>
                        {legendEdgeData.map((item, index) => (
                                <LegendItem key={index} label={item.label} size={item.size} color={item.color} />
                            ))}
                    </Panel>
                    <Panel key="3" header={<h3 style={{ color: '#014484', fontSize: 20, fontWeight: 'bold' }}>Suggested questions</h3>}>

                    </Panel>
                    {/* <Panel key="3" header={<h3 style={{color: '#014484', fontSize: 20, fontWeight: 'bold'}}>Node citations</h3>}>
                    <div>
                    <Row>
                        <Col span={12}>Frequency</Col>
                        <Col span={6}>
                            <InputNumber style={{width: '100%'}} defaultValue={props.minGtdcFreq} value={props.gtdcFreq[0]} onBlur={props.handleGtdcFreq1} onPressEnter={props.handleGtdcFreq1} min={props.minGtdcFreq} max={props.maxGtdcFreq}/>
                        </Col>
                        <Col span={6}>
                            <InputNumber style={{width: '100%'}} defaultValue={props.maxGtdcFreq} value={props.gtdcFreq[1]} onBlur={props.handleGtdcFreq2} onPressEnter={props.handleGtdcFreq2} min={props.minGtdcFreq} max={props.maxGtdcFreq}/>
                        </Col>
                    </Row>
                    <Slider range tooltip={{open:false}} value={props.gtdcFreq} onChange={props.handleGtdcFreq} min={props.minGtdcFreq} max={props.maxGtdcFreq}/>
                </div>
                    <div>
                        <Row>
                            <Col span={12}>Citations</Col>
                            <Col span={6}>
                                <InputNumber style={{width: '100%'}} defaultValue={props.minGtdcNoc} value={props.gtdcNoc[0]} onBlur={props.handleGtdcNoc1} onPressEnter={props.handleGtdcNoc1} min={props.minGtdcNoc} max={props.maxGtdcNoc}/>
                            </Col>
                            <Col span={6}>
                                <InputNumber style={{width: '100%'}} defaultValue={props.maxGtdcNoc} value={props.gtdcNoc[1]} onBlur={props.handleGtdcNoc2} onPressEnter={props.handleGtdcNoc2} min={props.minGtdcNoc} max={props.maxGtdcNoc}/>
                            </Col>
                        </Row>
                        <Slider range tooltip={{open:false}} value={props.gtdcNoc} onChange={props.handleGtdcNoc} min={props.minGtdcNoc} max={props.maxGtdcNoc} />
                    </div>
                    </Panel> */}
                    {/* <Panel key="4" header={<h3 style={{color: '#014484', fontSize: 20, fontWeight: 'bold'}}>Node display</h3>}>
                    <Tree
                            // checkStrictly={true}
                            checkable
                            blockNode
                            height={200}
                            onExpand={onExpand}
                            expandedKeys={expandedKeys}
                            autoExpandParent={autoExpandParent}
                            onCheck={onCheck}
                            checkedKeys={checkedKeys}
                            onSelect={onSelect}
                            selectedKeys={selectedKeys}
                            // Add other props based on the currentTreeData
                            treeData={leftData.map(renderTreeNode)}
                        />
                    </Panel> */}
                </Collapse>
            </div>
            );
        } else {
            return (
                <div style={{marginLeft: '10px', overflow: 'auto', height: '85vh'}}>
                    <Collapse defaultActiveKey={['1', '2']} ghost expandIcon={({ isActive }) => <CaretRightOutlined style={{color: '#014484', fontSize: 20}} rotate={isActive ? 90 : 0} />}>
                        <Panel key="1" header={<h3 style={{color: '#014484', fontSize: 20, fontWeight: 'bold'}}>Node citations</h3>}>
                        <div>
                            <Row>
                                <Col span={12}>Citations</Col>
                                <Col span={6}>
                                    <InputNumber style={{width: '100%'}} defaultValue={props.minGtdcNoc} value={props.gtdcNoc[0]} onBlur={props.handleGtdcNoc1} onPressEnter={props.handleGtdcNoc1} min={props.minGtdcNoc} max={props.maxGtdcNoc}/>
                                </Col>
                                <Col span={6}>
                                    <InputNumber style={{width: '100%'}} defaultValue={props.maxGtdcNoc} value={props.gtdcNoc[1]} onBlur={props.handleGtdcNoc2} onPressEnter={props.handleGtdcNoc2} min={props.minGtdcNoc} max={props.maxGtdcNoc}/>
                                </Col>
                            </Row>
                            <Slider range tooltip={{open:false}} value={props.gtdcNoc} onChange={props.handleGtdcNoc} min={props.minGtdcNoc} max={props.maxGtdcNoc} />
                        </div>
                        </Panel>
                        <Panel key="2" header={<h3 style={{ color: '#014484', fontSize: 20, fontWeight: 'bold' }}>Suggested questions</h3>}></Panel>
                        {/* <Panel key="2" header={<h3 style={{color: '#014484', fontSize: 20, fontWeight: 'bold'}}>Node display</h3>}>
                        <Tree
                                // checkStrictly={true}
                                checkable
                                blockNode
                                height={200}
                                onExpand={onExpand}
                                expandedKeys={expandedKeys}
                                autoExpandParent={autoExpandParent}
                                onCheck={onCheck}
                                checkedKeys={checkedKeys}
                                onSelect={onSelect}
                                selectedKeys={selectedKeys}
                                // Add other props based on the currentTreeData
                                treeData={leftData.map(renderTreeNode)}
                            />
                        </Panel> */}
                    </Collapse>
                </div>
            )
        }
    }


    const renderTreeNode = (node) => {
        return {
            ...node,
            checkable: !node.children,
        };
    };

    const changeLeftPanel = () => {
        if (!props.displayArticleGraph) {
            props.setDisplayArticleGraph(true);
            props.setDetailId(null);
            entityToArticle(props.data);
        } else {
            props.setDisplayArticleGraph(false);
            props.setDetailId(null);
            articleToEntity();
        }
    }

    // No collapse Version
    return (
        <div>
            {leftPanel()}
            <div className='legend-container'>
                <button onClick={changeLeftPanel} style={{borderWidth: '2px', width: '278px', height: '43px', borderRadius: '10px'}}>
                    {props.displayArticleGraph ? "Convert to biomedical term graph" : "Convert to article graph"}
                </button>
            </div>
        </div>

    );
};
export default Filter;
