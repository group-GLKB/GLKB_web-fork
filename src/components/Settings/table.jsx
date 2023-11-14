import React from 'react';
import './scoped.css';
import { Transfer, Tree, Button } from 'antd';
import { useState } from 'react';
import { NewGraph } from '../../service/NewNode'

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
            if (Array.isArray(node.type)) {
                node.type = node.type[1]
            }
            const type = node.type.split(';')[0];
            if (!groupedNodes[type]) {
              groupedNodes[type] = { key: type, title: type, children: [] };
            }
            groupedNodes[type].children.push({ key: String(node.id), title: node.name });
          });
          
        existingNodes = Object.values(groupedNodes);
    }
    
    const initRightTreeData = [];
    if (props.data.nodes) {
        for (let i = 0; i < props.data.nodes.length; i++) {
            const node = props.data.nodes[i];
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

    const [targetKeys, setTargetKeys] = useState(graphNodes)
    const [rightTreeData, setRightTreeData] = useState(initRightTreeData)
    
    const existingNodeList = []
    for (var i = 0; i < initRightTreeData.length; i++) {
        existingNodeList.push(initRightTreeData[i].children.map(child => child.key).join('|'))
    }
    const existing = existingNodeList.join('|')
    const treeData = existingNodes
    console.log(treeData)
    console.log(targetKeys.includes("54095130"))
    const tableClass = props.isTableOpen ? "table open" : "table";
    const generateTree = (treeNodes = [], checkedKeys = []) =>
            treeNodes.map(({ children, ...props }) => ({
                ...props,
                disabled: checkedKeys.includes(props.key),
                children: generateTree(children, checkedKeys),
            }))
 
    const dealCheckboxSeleted = ({ node, onItemSelect, onItemSelectAll }, direction) => {
        let {
            checked,
            halfCheckedKeys,
            node: { key, children },
        } = node
        if (children?.length > 0) {
            let keys = []
            let temp = []
            if (direction === 'left') {
                let state = false
                if (rightTreeData.length > 0) {
                    rightTreeData?.map(item => {
                        if (item.childCompanies?.length > 0 && (item.key == key)) {
                            temp = childCompanies.filter(v => !item.childCompanies.some((t => t.key === v.key)))
                            temp?.forEach(child => {
                                keys.push(child.key)
                            })
                        } else {
                            state = true
                        }
                    })
                } else {
                    state = true
                }
                if (state) {
                    children?.forEach(child => {
                        keys.push(child.key)
                    })
                }
                onItemSelectAll([...keys, key], checked)
            }
            if (direction === 'right') {
                children?.forEach(child => {
                    keys.push(child.key)
                })
                onItemSelectAll([...keys], checked)
            }
        } else {
            if (!checked) {
                let parentKeys = []
                parentKeys = [halfCheckedKeys?.[0]] || []
                if (parentKeys[0] == undefined) {
                    treeData.forEach(tree => {
                        if (tree.children) {
                            tree.children?.forEach(child => {
                                if (child?.key === key) {
                                    parentKeys.push(tree?.key)
                                }
                            })
                        }
                    })
                }
                onItemSelectAll([...parentKeys, key], checked)
            } else {
                let parentKey = ''
                treeData.forEach(tree => {
                    if (tree?.children) {
                        tree.children?.forEach(child => {
                            if (child?.key === key) {
                                parentKey = tree?.key
                            }
                        })
                    }
                })
 
                if (!halfCheckedKeys?.includes(parentKey) && parentKey != '') {
                    onItemSelectAll([key, parentKey], checked)
                } else {
                    onItemSelect(key, checked)
                }
            }
        }
    }
 
    const TreeTransfer = ({ dataSource, targetKeys, ...restProps }) => {
        const transferDataSource = []
        const dataSourceData = dataSource
        let test = [...rightTreeData]
        function flatten(list = []) {
            list.forEach(item => {
                transferDataSource.push(item)
                flatten(item.children)
            })
        }
        flatten(dataSource)
 
        return (
            <Transfer
                {...restProps}
                targetKeys={targetKeys}
                dataSource={transferDataSource}
                className="tree-transfer"
                showSearch
                showSelectAll={true}
                render={item => item.title}
                rowKey={record => record.key}
                onSearch={(dir, val) => {
                    let data = (dir === 'left' ? dataSourceData : rightTreeData)
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
                    if (dir === 'left') {
                        dataSource = newDeptList
                    }
                    if (dir === 'right') {
                        test = newDeptList
                    }
                }}
            >
                {({ direction, onItemSelect, onItemSelectAll, selectedKeys }) => {
                    if (direction === 'left') {
                        const checkedKeys = [...selectedKeys, ...targetKeys]
                        return (
                            <Tree
                                height={200}
                                blockNode
                                checkable
                                defaultExpandAll
                                checkedKeys={checkedKeys}
                                treeData={generateTree(dataSource, targetKeys)}
                                fieldNames={{ title: 'title', key: 'key', children: 'children' }}
                                onCheck={(_, node) => {
                                    dealCheckboxSeleted({ node, onItemSelect, onItemSelectAll }, direction)
                                }}
                                onSelect={(_, node) => {
                                    dealCheckboxSeleted({ node, onItemSelect, onItemSelectAll }, direction)
                                }}
                            />
                        )
                    }
                    if (direction === 'right') {
                        const checkedKeys = [...selectedKeys]
                        return (
                            <Tree
                                height={200}
                                blockNode
                                checkable
                                defaultExpandAll
                                checkedKeys={checkedKeys}
                                treeData={test}
                                fieldNames={{ title: 'title', key: 'key', children: 'children' }}
                                onCheck={(_, node) => {
                                    dealCheckboxSeleted({ node, onItemSelect, onItemSelectAll }, direction)
                                }}
                                onSelect={(_, node) => {
                                    dealCheckboxSeleted({ node, onItemSelect, onItemSelectAll }, direction)
                                }}
                            />
                        )
                    }
                }}
            </Transfer>
        )
    }
    const getRightTreeData = (keys, type) => {
        let arr = [...rightTreeData]
        if (keys?.length > 0) {
            keys.forEach(key => {
                treeData.forEach(data => {
                    if (key === data.key) {
                        let index = arr.findIndex(i => {
                            return i.key === key
                        })
                        if (type === 1) {
                            if (index === -1) {
                                arr.push(data)
                            } else if (index > -1 && arr?.[index]?.children?.length < data?.children?.length) {
                                arr.splice(index, 1)
                                arr.push(data)
                            }
                        } else if (type === 0) {
                            if (index > -1) {
                                arr.splice(index, 1)
                            }
                        }
                    } else {
                        let selectedParentKey = ''
                        let selectedObj = {}
                        if (data?.children?.length > 0) {
                            data.children.forEach(child => {
                                if (key === child.key) {
                                    selectedParentKey = data.key
                                    selectedObj = child
                                }
                            })
                        }
                        if (Object.keys(selectedObj)?.length > 0) {
                            let newData = {}
                            let index = arr.findIndex(item => {
                                return item.key === selectedParentKey
                            })
                            if (index > -1) {
                                let oldChildArr = [...arr[index].children]
                                let selectedIndex = oldChildArr?.findIndex(o => {
                                    return o.key === selectedObj.key
                                })
                                if (selectedIndex === -1 && type === 1) {
                                    arr[index].children.push(selectedObj)
                                }
                                if (selectedIndex > -1 && type === 0) {
                                    arr[index].children.splice(selectedIndex, 1)
                                    if (arr[index].children?.length === 0) {
                                        arr.splice(index, 1)
                                    }
                                }
                            } else {
                                if (type === 1) {
                                    newData = { ...data }
                                    newData.children = []
                                    newData.children.push(selectedObj)
                                    arr.push(newData)
                                } else if (type === 0) {
                                    arr = []
                                }
                            }
                        }
                    }
                })
            })
            setRightTreeData(arr)
        }
    }
 
    const onChange = (keys, direction, moveKeys) => {
        let changeArrType = 1
        if (direction == 'left') {
            changeArrType = 0
            if (keys.length > 0) {
                treeData.forEach(item => {
                    let index = keys.indexOf(item.key)
                    if (index > -1 && item.children?.length > 0) {
                        item.children?.forEach(v => {
                            if (moveKeys.includes(v.key)) {
                                keys.splice(index, 1)
                            }
                        })
                    }
                })
            }
        }
        setTargetKeys(keys)
        let keysList = changeArrType === 1 ? keys : moveKeys
        getRightTreeData(keysList, changeArrType)
    };
    
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
            const rightTreeDataList = []
            for (var i = 0; i < rightTreeData.length; i++) {
                rightTreeDataList.push(rightTreeData[i].children.map(child => child.key).join('|'))
            }
            const rightTreeNodes = rightTreeDataList.join('|').split('|')
            const existingNodes = existing.split('|')
            const newNode = rightTreeNodes.filter(id => !existingNodes.includes(id)).join('|')
            if (newNode) {
                console.log(newNode)
                drawNewGraph(existing, newNode)
            }
            props.setGraphData(rightTreeData)
        }
    }

    const openTable = () => {
        if (!props.isTableOpen) {
            props.toggleTable()
        }
    }
    console.log(rightTreeData)
    return (
      <div className={tableClass} style={{width: '80%', marginLeft: '10%', alignItems: 'center'}}>
        <Button onClick={openTable} type="primary">Add New Nodes</Button>
        <TreeTransfer dataSource={treeData} targetKeys={targetKeys} onChange={onChange} />
        <Button onClick={buttonClick} type="primary" style={{marginLeft: '96%'}}>Apply</Button>
      </div>
    ) 
}

export default App;
