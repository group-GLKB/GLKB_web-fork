import React, { useEffect, useState } from 'react'
import './scoped.css'
import { Row, Col, Slider, Collapse, Transfer, InputNumber, Typography, Button, Modal, Tree, Input} from 'antd';
import { DownOutlined, SmileOutlined } from '@ant-design/icons';
import { NewGraph } from '../../service/NewNode'
const { Panel } = Collapse;
const { Title } = Typography;

const Filter = props => {
    const panelStyle = {
        marginLeft: 10,
        marginRight: 9,
        marginBottom: 11,
        border: 'none',
        borderRadius: 8,
        background: '#EEEEEE'
    };

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
    const [selectedArticleKeys, setSelectedArticleKeys] = useState([]);
    const [selectedTermKeys, setSelectedTermKeys] = useState([]);
    const [selectedRelationKeys, setSelectedRelationKeys] = useState([]);
    const [invisibleArticleKey, setInvisibleArticleKey] = useState([]);
    const [invisibleTermKey, setInvisibleTermKey] = useState([]);
    const [invisibleRelationKey, setInvisibleRelationKey] = useState([]);
    const [displayLeftTree, setDisplayLeftTree] = useState(true);
    const [expandedKeys, setExpandedKeys] = useState([]);
    const [autoExpandParent, setAutoExpandParent] = useState(false);
    const [checkedKeys, setCheckedKeys] = useState(graphNodes);
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [leftData, setLeftData] = useState(existingNodes);
    const [rightData, setRightData] = useState(initRightTreeData)
    const [newList, setNewList] = useState();

    const toggleTreeDisplay = () => {
        setDisplayLeftTree((prevDisplayLeftTree) => !prevDisplayLeftTree);
    };

    const currentTreeData = displayLeftTree ? leftData : rightData;

    const onArticleChange = (nextTargetKeys, direction, moveKeys) => {
        if (direction == "right") {
            let temp = props.visibleArticles
            for (let key of moveKeys) {
                temp = temp.filter(item => item.key != key)
            }
            props.setVisibleArticles(temp)
        } else {
            for (let key of moveKeys) {
                let temp = props.articleNodes.find(item => item.key == key)
                props.setVisibleArticles([...props.visibleArticles, temp])
            }
        }
        setInvisibleArticleKey(nextTargetKeys);
    };
    const onTermChange = (nextTargetKeys, direction, moveKeys) => {
        if (direction == "right") {
            let temp = props.visibleTerms
            for (let key of moveKeys) {
                temp = temp.filter(item => item.key != key)
            }
            props.setVisibleTerms(temp)
        } else {
            for (let key of moveKeys) {
                let temp = props.termNodes.find(item => item.key == key)
                props.setVisibleTerms([...props.visibleTerms, temp])
            }
        }
        setInvisibleTermKey(nextTargetKeys);
    };
    const onRelationChange = (nextTargetKeys, direction, moveKeys) => {
        if (direction == "right") {
            let temp = props.visibleRelations
            for (let key of moveKeys) {
                console.log(key)
                temp = temp.filter(item => item.key != key)
            } 
            props.setVisibleRelations(temp)
        } else {
            for (let key of moveKeys) {
                let temp = props.relationNodes.find(item => item.key == key)
                props.setVisibleRelations([...props.visibleRelations, temp])
            }
        }
        setInvisibleRelationKey(nextTargetKeys);
    };
    const onArticleSelectChange = (sourceSelectedKeys, targetSelectedKeys) => {
        setSelectedArticleKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
    };
    const onTermSelectChange = (sourceSelectedKeys, targetSelectedKeys) => {
        setSelectedTermKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
    };
    const onRelationSelectChange = (sourceSelectedKeys, targetSelectedKeys) => {
        setSelectedRelationKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
    };
    const onScroll = (direction, e) => {
    };

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
        { label: 'query terms', size: 20, color: 'black' },
        { label: 'non-query terms', size: 20, color: 'black' },
    ]
      
    const sizeData = [
        { label: 'frequency < 30', size: 5, color: 'black' },
        { label: '30 <= frequency < 60', size: 10, color: 'black' },
        { label: 'frequency >= 60', size: 20, color: 'black' }
    ];

    const legendData = [
        { label: 'Anatomy', size: 20, color: '#E43333' },
        { label: 'Chemicals and Drugs', size: 20, color: '#E8882F' },
        { label: 'Diseases', size: 20, color: '#67BE48' },
        { label: 'Genes and Gene Products', size: 20, color: '#46ACAC' },
        { label: 'GO', size: 20, color: '#5782C2' },
        { label: 'Organisms', size: 20, color: '#9B58C5' },
        { label: 'Pathway', size: 20, color: '#D829B1' },
    ];

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
                const tempCheckedKeys = checkedKeys.filter(key => tempKeys.includes(key))
                setCheckedKeys(checkedKeys.filter(key => !tempCheckedKeys.includes(key)).concat(checkedKeysValue));
                console.log(checkedKeys);
                return;
            }
        }
        setCheckedKeys(checkedKeysValue);
        console.log(checkedKeys)
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
                <h3>shape</h3>
                <div className="legend-column">
                    {shapeData.map((item, index) => (
                    <LegendItem key={index} label={item.label} size={item.size} color={item.color} />
                    ))}
                </div>
                <h3>frequency</h3>
                <div className="legend-column">
                    {sizeData.map((item, index) => (
                    <LegendItem key={index} label={item.label} size={item.size} color={item.color} />
                    ))}
                </div>
                <h3 color='black'>label</h3>
                <div className="legend-column">
                    {legendData.map((item, index) => (
                    <LegendItem key={index} label={item.label} size={item.size} color={item.color} />
                    ))}
                </div>
            </div>
        )
    }

    const [isModalOpen, setIsModalOpen] = useState(false);

    const showModal = () => {
        setIsModalOpen(true);
    };

    const handleOk = () => {
        setIsModalOpen(false);
    };

    const handleCancel = () => {
        setIsModalOpen(false);
    };
    // minGtdcNoc={props.minGtdcNoc} 
    // maxGtdcNoc={props.maxGtdcNoc}


    // No collapse Version
    return (
        <div>
            <Title level={4}>Custom your search</Title>
            <div>
                <div>
                    <h3>
                    {displayLeftTree ? 'All Related Terms' : 'Current Terms in Graph'}
                    </h3>
                    <Input.Search
                        placeholder="Search"
                        onSearch={(value) => onSearch(value, displayLeftTree ? 'left' : 'right')}
                    />
                    <Tree
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
                        treeData={currentTreeData}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button onClick={buttonClick} type="primary" style={{ marginTop: '20px' }}>Apply</Button>
                    <Button onClick={toggleTreeDisplay} style={{ marginTop: '20px' }}>Show current terms in graph only</Button>
                </div>
            </div>
               <div>
                   <Row>
                       <Col span={12}>Frequency</Col>
                       <Col span={6}>
                           <InputNumber defaultValue={props.minGtdcFreq} value={props.gtdcFreq[0]} onBlur={props.handleGtdcFreq1} onPressEnter={props.handleGtdcFreq1} min={props.minGtdcFreq} max={props.maxGtdcFreq}/>
                       </Col>
                       <Col span={6}>
                           <InputNumber defaultValue={props.maxGtdcFreq} value={props.gtdcFreq[1]} onBlur={props.handleGtdcFreq2} onPressEnter={props.handleGtdcFreq2} min={props.minGtdcFreq} max={props.maxGtdcFreq}/>
                       </Col>
                   </Row>
                   <Slider range value={props.gtdcFreq} onChange={props.handleGtdcFreq} min={props.minGtdcFreq} max={props.maxGtdcFreq}/>
               </div>
            <div>
                <Row>
                    <Col span={12}>Number of Citations</Col>
                    <Col span={6}>
                        <InputNumber defaultValue={props.minGtdcNoc} value={props.gtdcNoc[0]} onBlur={props.handleGtdcNoc1} onPressEnter={props.handleGtdcNoc1} min={props.minGtdcNoc} max={props.maxGtdcNoc}/>
                    </Col>
                    <Col span={6}>
                        <InputNumber defaultValue={props.maxGtdcNoc} value={props.gtdcNoc[1]} onBlur={props.handleGtdcNoc2} onPressEnter={props.handleGtdcNoc2} min={props.minGtdcNoc} max={props.maxGtdcNoc}/>
                    </Col>
                </Row>
                <Slider range value={props.gtdcNoc} onChange={props.handleGtdcNoc} min={props.minGtdcNoc} max={props.maxGtdcNoc} />
            </div>
            <Button type="primary" onClick={showModal}>
                Legends
            </Button>
            <Modal title="legends" open={isModalOpen} onOk={handleOk} onCancel={handleCancel}>
                {items()}
            </Modal>
        </div>

    );

  //   return (
  //       <Collapse expandIconPosition='end' size='small' ghost defaultActiveKey={1}>
  //
  //           {/* Article Density Control */}
  //           {/* <Panel header="Articles Density Control" key="1">
  //               <div>
  //                   <div>
  //                       <Row>
  //                           <Col span={12}>Frequency</Col>
  //                           <Col span={6}>
  //                               <InputNumber defaultValue={props.minAdcFreq} value={props.adcFreq[0]} onBlur={props.handleAdcFreq1} onPressEnter={props.handleAdcFreq1} min={props.minAdcFreq} max={props.maxAdcFreq}/>
  //                           </Col>
  //                           <Col span={6}>
  //                               <InputNumber defaultValue={props.maxAdcFreq} value={props.adcFreq[1]} onBlur={props.handleAdcFreq2} onPressEnter={props.handleAdcFreq2} min={props.minAdcFreq} max={props.maxAdcFreq}/>
  //                           </Col>
  //                       </Row>
  //                       <Slider range value={props.adcFreq} onChange={props.handleAdcFreq} min={props.minAdcFreq} max={props.maxAdcFreq}/>
  //                   </div>
  //
  //                   <div>
  //                       <Row>
  //                           <Col span={12}>
  //                               Publication Date
  //                           </Col>
  //                           <Col span={6}>
  //                               <InputNumber value={props.adcPd[0]} onBlur={props.handleAdcPd1} onPressEnter={props.handleAdcPd1} min={props.minAdcPd} max={props.maxAdcPd}/>
  //                           </Col>
  //                           <Col span={6}>
  //                               <InputNumber value={props.adcPd[1]} onBlur={props.handleAdcPd2} onPressEnter={props.handleAdcPd2} min={props.minAdcPd} max={props.maxAdcPd}/>
  //                           </Col>
  //                       </Row>
  //                       <Slider range value={props.adcPd} onChange={props.handleAdcPd}  min={props.minAdcPd} max={props.maxAdcPd}/>
  //                   </div>
  //
  //                   <div>
  //                       <Row>
  //                           <Col span={12}>Number of Citations</Col>
  //                           <Col span={6}>
  //                               <InputNumber value={props.adcNoc[0]} onBlur={props.handleAdcNoc1} onPressEnter={props.handleAdcNoc1} min={props.minAdcNoc} max={props.maxAdcNoc}/>
  //                           </Col>
  //                           <Col span={6}>
  //                               <InputNumber value={props.adcNoc[1]} onBlur={props.handleAdcNoc2} onPressEnter={props.handleAdcNoc2} min={props.minAdcNoc} max={props.maxAdcNoc}/>
  //                           </Col>
  //                       </Row>
  //                       <Slider range value={props.adcNoc} onChange={props.handleAdcNoc} min={props.minAdcNoc} max={props.maxAdcNoc} />
  //                   </div>
  //               </div>
  //           </Panel> */}
  //
  //           {/* Genomic Terms Density Control */}
  //           {/*<Panel header="Genomic Terms Density Control" key="1">*/}
  //           <Panel header={<Title level={4} style={{ marginBottom: 0 }}>Genomic Terms Density Control</Title>}  key="1">
  //               <div>
  //                   <div>
  //                       <Row>
  //                           <Col span={12}>Frequency</Col>
  //                           <Col span={6}>
  //                               <InputNumber defaultValue={props.minGtdcFreq} value={props.gtdcFreq[0]} onBlur={props.handleGtdcFreq1} onPressEnter={props.handleGtdcFreq1} min={props.minGtdcFreq} max={props.maxGtdcFreq}/>
  //                           </Col>
  //                           <Col span={6}>
  //                               <InputNumber defaultValue={props.maxGtdcFreq} value={props.gtdcFreq[1]} onBlur={props.handleGtdcFreq2} onPressEnter={props.handleGtdcFreq2} min={props.minGtdcFreq} max={props.maxGtdcFreq}/>
  //                           </Col>
  //                       </Row>
  //                       <Slider range value={props.gtdcFreq} onChange={props.handleGtdcFreq} min={props.minGtdcFreq} max={props.maxGtdcFreq}/>
  //                   </div>
  //                   {/*<div>*/}
  //                   {/*    <Row>*/}
  //                   {/*        <Col span={12}>Recency</Col>*/}
  //                   {/*        <Col span={6}>*/}
  //                   {/*            <InputNumber value={props.adcPd[0]} onBlur={props.handleAdcPd1} onPressEnter={props.handleAdcPd1} min={props.minAdcPd} max={props.maxAdcPd}/>*/}
  //                   {/*        </Col>*/}
  //                   {/*        <Col span={6}>*/}
  //                   {/*            <InputNumber value={props.adcPd[1]} onBlur={props.handleAdcPd2} onPressEnter={props.handleAdcPd2} min={props.minAdcPd} max={props.maxAdcPd}/>*/}
  //                   {/*        </Col>*/}
  //                   {/*    </Row>*/}
  //                   {/*    <Slider range value={props.adcPd} onChange={props.handleAdcPd}  min={props.minAdcPd} max={props.maxAdcPd}/>*/}
  //                   {/*</div>*/}
  //                   <div>
  //                       <Row>
  //                           <Col span={12}>Number of Citations</Col>
  //                           <Col span={6}>
  //                               <InputNumber defaultValue={props.minGtdcNoc} value={props.gtdcNoc[0]} onBlur={props.handleGtdcNoc1} onPressEnter={props.handleGtdcNoc1} min={props.minGtdcNoc} max={props.maxGtdcNoc}/>
  //                           </Col>
  //                           <Col span={6}>
  //                               <InputNumber defaultValue={props.maxGtdcNoc} value={props.gtdcNoc[1]} onBlur={props.handleGtdcNoc2} onPressEnter={props.handleGtdcNoc2} min={props.minGtdcNoc} max={props.maxGtdcNoc}/>
  //                           </Col>
  //                       </Row>
  //                       <Slider range value={props.gtdcNoc} onChange={props.handleGtdcNoc} min={props.minGtdcNoc} max={props.maxGtdcNoc} />
  //                   </div>
  //               </div>
  //           </Panel>
  //
  //           {/* Articles Visibility */}
  //           {/* <Panel header="Articles Visibility" key="3" style={panelStyle}>
  //               <div>
  //                   <Transfer
  //                       dataSource={props.articleNodes}
  //                       titles={['Visible Nodes', 'Invisible Nodes']}
  //                       targetKeys={invisibleArticleKey}
  //                       selectedKeys={selectedArticleKeys}
  //                       onChange={onArticleChange}
  //                       onSelectChange={onArticleSelectChange}
  //                       onScroll={onScroll}
  //                       render={(item) => item.title}
  //                       showSelectAll = 'false'
  //                       showSearch = 'true'
  //                   />
  //               </div>
  //           </Panel>
  //
  //           {/* Genomic Terms Visibility */}
  //           {/* <Panel header="Genomic Terms Visibility" key="4" style={panelStyle}>
  //               <div>
  //                   <Transfer
  //                       dataSource={props.termNodes}
  //                       titles={['Visible Nodes', 'Invisible Nodes']}
  //                       targetKeys={invisibleTermKey}
  //                       selectedKeys={selectedTermKeys}
  //                       onChange={onTermChange}
  //                       onSelectChange={onTermSelectChange}
  //                       onScroll={onScroll}
  //                       render={(item) => item.title}
  //                       showSelectAll = 'false'
  //                       showSearch = 'true'
  //                   />
  //               </div>
  //           </Panel> */}
  //
  //           {/* Relations Visibility */}
  //           {/* <Panel header="Relations Visibility" key="5" style={panelStyle}>
  //               <div>
  //                   <Transfer
  //                       dataSource={props.relationNodes}
  //                       titles={['Visible Nodes', 'Invisible Nodes']}
  //                       targetKeys={invisibleRelationKey}
  //                       selectedKeys={selectedRelationKeys}
  //                       onChange={onRelationChange}
  //                       onSelectChange={onRelationSelectChange}
  //                       onScroll={onScroll}
  //                       render={(item) => item.title}
  //                       showSelectAll = 'false'
  //                       showSearch = 'true'
  //                   />
  //               </div>
  //           </Panel>  */}
  //       </Collapse>
  //
  //
  // );
};
export default Filter;
