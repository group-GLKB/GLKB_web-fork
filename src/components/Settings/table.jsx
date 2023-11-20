import React, { useEffect } from 'react';
import './scoped.css';
import { Transfer, Tree, Button } from 'antd';
import { useState } from 'react';
import { NewGraph } from '../../service/NewNode'
import Graph from '../Graph';

const App = (props) => {

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
    const tableClass = props.isTableOpen ? "table open" : "table";
    
    const existingNodeList = []
    for (var i = 0; i < rightData.length; i++) {
        existingNodeList.push(rightData[i].children.map(child => child.key).join('|'))
    }
    const existing = existingNodeList.join('|')
    const treeData = existingNodes

    
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
            console.log(existingList)
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

    console.log(rightData)

    return (
      <div className={tableClass} style={{width: '80%', marginLeft: '10%', alignItems: 'center'}}>
        <Button onClick={openTable} type="primary">Add New Nodes</Button>
        <div style={{ marginRight: '10px', display: 'flex'}}>
            <div style={{ paddingLeft: '10px', width: 'calc(50% - 5px)' }}>
                <Tree
                    checkable
                    height={200}
                    onExpand={onExpand}
                    expandedKeys={expandedKeys}
                    autoExpandParent={autoExpandParent}
                    onCheck={onCheck}
                    checkedKeys={checkedKeys}
                    onSelect={onSelect}
                    selectedKeys={selectedKeys}
                    treeData={treeData}
                />
            </div>
            <div style={{ paddingLeft: '10px', width: 'calc(50% - 5px)' }}>
                <Tree
                height={200}
                onExpand={onExpandRight}
                expandedKeys={expandedKeysRight}
                autoExpandParent={autoExpandParentRight}
                treeData={rightData}
                />
            </div>
        </div>
        <Button onClick={buttonClick} type="primary" style={{marginLeft: '96%'}}>Apply</Button>
      </div>
    ) 
}

export default App;
