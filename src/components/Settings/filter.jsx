import React, { useEffect, useState } from 'react'
import './scoped.css'
import { Row, Col, Slider, Collapse, Transfer, InputNumber, Typography, Button, Modal, Tree, Input} from 'antd';
import { DownOutlined, SmileOutlined } from '@ant-design/icons';
import { NewGraph } from '../../service/NewNode'
import { render } from '@testing-library/react';
const { Panel } = Collapse;
const { Title } = Typography;

const Filter = props => {
    const graphNodes = [];
    if (props.data.nodes) {
        for (let i = 0; i < props.data.nodes.length; i++) {
            graphNodes.push(props.data.nodes[i].data.id)
        }
    }

    let existingNodes = []
    const groupedNodes = {}
    if (props.allNodes.length != 0) {
        props.allNodes.forEach((node, index) => {
            const type = node.type.split(';')[0];
            if (!groupedNodes[type]) {
              groupedNodes[type] = { key: type, title: type, children: [] };
            }
            groupedNodes[type].children.push({ key: node.id, title: node.name });
          });
          
        existingNodes = Object.values(groupedNodes);
    }

    let initRightTreeData = [];
    useEffect(() => {
        if (props.graphShownData != {}) {
            initRightTreeData = []
            if (props.graphShownData.nodes) {
                let uniqueLabelsSet = new Set(props.graphShownData.nodes.map(node => node.data.label));
                setUniqueLabelsArray([...uniqueLabelsSet]);
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
    },[props.graphShownData])


    /* source is visible nodes, target is invisible nodes */
    const [displayLeftTree, setDisplayLeftTree] = useState(true);
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [autoExpandParent, setAutoExpandParent] = useState(false);
    const [checkedKeys, setCheckedKeys] = useState(graphNodes);
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [leftData, setLeftData] = useState(existingNodes);
    const [rightData, setRightData] = useState(initRightTreeData)
    const [newList, setNewList] = useState();
    const [uniqueLabelsArray, setUniqueLabelsArray] = useState([]);

    const toggleTreeDisplay = () => {
        setDisplayLeftTree((prevDisplayLeftTree) => !prevDisplayLeftTree);
    };

    const currentTreeData = displayLeftTree ? leftData : rightData;

    const existingNodeList = []
    for (var i = 0; i < rightData.length; i++) {
        existingNodeList.push(rightData[i].children.map(child => child.key).join('|'))
    }
    const existing = existingNodeList.join('|')

    const LegendItem = ({ label, size, color }) => {
        const isQueryTerms = label === 'query terms';
        
        return (
            <div className="legend-item">
            {isQueryTerms ? (
                <div className="legend-triangle" style={{marginLeft: "0px"}}></div>
            ) : (
                <div className="legend-circle" style={{ backgroundColor: color, width: size, height: size, marginLeft: size === 5 ? "6px" : size === 10 ? "4px" : "0" }}></div>
            )}
            <div className="legend-label">{label}</div>
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
        { label: 'Anatomy', size: 20, color: '#E43333' },
        { label: 'Chemicals and Drugs', size: 20, color: '#E8882F' },
        { label: 'Diseases', size: 20, color: '#67BE48' },
        { label: 'Genes and Gene Products', size: 20, color: '#46ACAC' },
        { label: 'GO', size: 20, color: '#5782C2' },
        { label: 'Organisms', size: 20, color: '#9B58C5' },
        { label: 'Pathway', size: 20, color: '#D829B1' },
    ];

    const legendData = legendDataAll.filter(item => uniqueLabelsArray.includes(item.label));

    const onExpand = (expandedKeysValue) => {
        setExpandedKeys(expandedKeysValue);
        setAutoExpandParent(false);
    };

    const onCheck = (checkedKeysValue) => {
        if (displayLeftTree) {
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
        }
        setCheckedKeys(checkedKeysValue);
    };

    const onSelect = (selectedKeysValue, info) => {
        setSelectedKeys(selectedKeysValue);
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

    const onCheckHandler = displayLeftTree ? onCheck : undefined;
    const checkedKeysHandler = displayLeftTree ? checkedKeys : undefined;
    const onSelectHandler = displayLeftTree ? onSelect : undefined;
    const selectedKeysHandler = displayLeftTree ? selectedKeys : undefined;

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

    const items = () => {
    return (
        <div className="legend-container">
            <div className="legend-section">
                <div className="legend-row">
                    <div className='legend-subtitle'>Shape:</div>
                    {shapeData.map((item, index) => (
                        <LegendItem key={index} label={item.label} size={item.size} color={item.color} />
                    ))}
                </div>
            </div>
            <div className="legend-section">
                <div className="legend-row">
                    <div className='legend-subtitle'>Frequency:</div>
                    {sizeData.map((item, index) => (
                        <LegendItem key={index} label={item.label} size={item.size} color={item.color} />
                    ))}
                </div>
            </div>
            <div className="legend-section">
                <div className="legend-row">
                    <div className='legend-subtitle'>Label:</div>
                    {legendData.map((item, index) => (
                        <LegendItem key={index} label={item.label} size={item.size} color={item.color} />
                    ))}
                </div>
            </div>
        </div>
        );
    };


    const renderTreeNode = (node) => {
        return {
            ...node,
            checkable: !node.children,
        };
    };

    // No collapse Version
    return (
        <div style={{marginLeft: '10px'}}>
            <Title level={2}>Customize your search</Title>
            <div>
                <div>
                    <h3>
                    {displayLeftTree ? 'All Related Terms' : 'Current Terms in Graph'}
                    </h3>
                    <Input.Search
                        placeholder="Search"
                        onSearch={(value) => onSearch(value, displayLeftTree ? 'left' : 'right')}
                        style={{ marginBottom: '20px' }}
                    />
                    <Tree
                        // checkStrictly={true}
                        checkable={displayLeftTree}
                        blockNode
                        height={200}
                        onExpand={onExpand}
                        expandedKeys={expandedKeys}
                        autoExpandParent={autoExpandParent}
                        onCheck={onCheckHandler}
                        checkedKeys={checkedKeysHandler}
                        onSelect={onSelectHandler}
                        selectedKeys={selectedKeysHandler}
                        // Add other props based on the currentTreeData
                        treeData={currentTreeData.map(renderTreeNode)}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button onClick={buttonClick} type="primary" style={{ marginTop: '20px', width: '20%', textAlign: 'center'}}>Apply</Button>
                    <Button onClick={toggleTreeDisplay} style={{ marginTop: '20px', width: '50%' }}>{displayLeftTree ? 'Show current terms' : 'Show all terms'}</Button>
                </div>
            </div>
            <h3 style={{ marginTop: '20px' }}>Adjust geonomic term density</h3>
               <div style={{ marginTop: '20px' }}>
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
                <div style={{ marginTop: '20px' }}>
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
            {items()}
        </div>

    );
};
export default Filter;
