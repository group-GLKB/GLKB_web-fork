import React, { useEffect } from 'react';
import './scoped.css';
import { Transfer, Tree, Button, Input } from 'antd';
import { useState } from 'react';
import { NewGraph } from '../../service/NewNode'
import Graph from '../Graph';

const App = (props) => {
    const { Search } = Input;
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

    const [expandedKeys, setExpandedKeys] = useState([]);
    const [checkedKeys, setCheckedKeys] = useState(graphNodes);
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [autoExpandParent, setAutoExpandParent] = useState(false);
    const [expandedKeysRight, setExpandedKeysRight] = useState();
    const [autoExpandParentRight, setAutoExpandParentRight] = useState(false);
    const [rightData, setRightData] = useState(initRightTreeData)
    const [leftData, setLeftData] = useState(existingNodes);
    const tableClass = props.isTableOpen ? "table open" : "table";
    const existingNodeList = []
    for (var i = 0; i < rightData.length; i++) {
        existingNodeList.push(rightData[i].children.map(child => child.key).join('|'))
    }
    const existing = existingNodeList.join('|')


    
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

    const buttonClick = () => {
        if (props.isTableOpen) {
            const existingList = existing.split('|')
            const filteredList = checkedKeys.filter(item => !isNaN(item))
            const newNode = filteredList.filter(id => !existingList.includes(id)).join('|')
            if (newNode) {
                console.log(newNode)
                drawNewGraph(existing, newNode)
            }
            props.setGraphData(checkedKeys)
        }
    }

    const openTable = () => {
        if (!props.isTableOpen) {
            props.toggleTable()
        }
    }

    const onExpand = (expandedKeysValue) => {
        setExpandedKeys(expandedKeysValue);
        setAutoExpandParent(false);
    };

    const onCheck = (checkedKeysValue) => {
        setCheckedKeys(checkedKeysValue);
    };

    const onSelect = (selectedKeysValue, info) => {
        setSelectedKeys(selectedKeysValue);
    };

    const onExpandRight = (expandedKeysValueRight) => {
        setExpandedKeysRight(expandedKeysValueRight);
        setAutoExpandParentRight(false);
    };

    useEffect(() => {
        if (!props.isTableOpen) {
            setExpandedKeys([]);
            setExpandedKeysRight([]);
        }
    },[props.isTableOpen])

    const onSearch = (val, context) => {
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
        }
        if (context === 'right') {
            setRightData(newDeptList)
        }
    }

    return (
      <div className={tableClass} style={{width: '80%', marginLeft: '10%', alignItems: 'center'}}>
        <div style={{ backgroundColor: '#f0f2f5', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>
        <Button onClick={openTable} type="primary">More Biomedical Terms</Button>
        
        <div style={{ display: 'flex', marginTop: '20px' }}>
            <div style={{ flex: '0 0 50%', marginRight: '20px' }}>
            <h3 style={{ marginBottom: '8px', fontSize: '16px', color: '#1890ff' }}>All Related Terms</h3>
            <Input.Search style={{ marginBottom: '8px' }} placeholder="Search" onSearch={(value) => onSearch(value, 'left')} />
            <Tree
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
                treeData={leftData}
            />
            </div>

            <div style={{ flex: '0 0 50%', paddingLeft: '20px' }}>
            <h3 style={{ marginBottom: '8px', fontSize: '16px', color: '#1890ff' }}>Current Terms in Graph</h3>
            <Input.Search style={{ marginBottom: '8px' }} placeholder="Search" onSearch={(value) => onSearch(value, 'right')} />
            <Tree
                blockNode
                height={200}
                onExpand={onExpandRight}
                expandedKeys={expandedKeysRight}
                autoExpandParent={autoExpandParentRight}
                treeData={rightData}
            />
            </div>
        </div>

        <Button onClick={buttonClick} type="primary" style={{ marginLeft: 'auto', marginTop: '20px', display: 'block' }}>Apply</Button>
        </div>
      </div>
    ) 
}

export default App;
