import React, { useEffect, useState } from 'react'
import './scoped.css'
import { Row, Col, Slider, Collapse, Transfer, InputNumber } from 'antd';
const { Panel } = Collapse;

const Filter = props => {
    const panelStyle = {
        marginLeft: 10,
        marginRight: 9,
        marginBottom: 11,
        border: 'none',
        borderRadius: 8,
        background: '#EEEEEE'
    };

    /* source is visible nodes, target is invisible nodes */

    const [selectedArticleKeys, setSelectedArticleKeys] = useState([]);
    const [selectedTermKeys, setSelectedTermKeys] = useState([]);
    const [selectedRelationKeys, setSelectedRelationKeys] = useState([]);
    const [invisibleArticleKey, setInvisibleArticleKey] = useState([]);
    const [invisibleTermKey, setInvisibleTermKey] = useState([]);
    const [invisibleRelationKey, setInvisibleRelationKey] = useState([]);
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

    // minGtdcNoc={props.minGtdcNoc} 
    // maxGtdcNoc={props.maxGtdcNoc} 

    return (
        <Collapse expandIconPosition='end' size='small' ghost defaultActiveKey={1}>

            {/* Article Density Control */}
            {/* <Panel header="Articles Density Control" key="1">
                <div>
                    <div>
                        <Row>
                            <Col span={12}>Frequency</Col>
                            <Col span={6}>
                                <InputNumber defaultValue={props.minAdcFreq} value={props.adcFreq[0]} onBlur={props.handleAdcFreq1} onPressEnter={props.handleAdcFreq1} min={props.minAdcFreq} max={props.maxAdcFreq}/>
                            </Col>
                            <Col span={6}>
                                <InputNumber defaultValue={props.maxAdcFreq} value={props.adcFreq[1]} onBlur={props.handleAdcFreq2} onPressEnter={props.handleAdcFreq2} min={props.minAdcFreq} max={props.maxAdcFreq}/>
                            </Col>
                        </Row>
                        <Slider range value={props.adcFreq} onChange={props.handleAdcFreq} min={props.minAdcFreq} max={props.maxAdcFreq}/>
                    </div>
                    
                    <div>
                        <Row>
                            <Col span={12}>
                                Publication Date
                            </Col>
                            <Col span={6}>
                                <InputNumber value={props.adcPd[0]} onBlur={props.handleAdcPd1} onPressEnter={props.handleAdcPd1} min={props.minAdcPd} max={props.maxAdcPd}/>
                            </Col>
                            <Col span={6}>
                                <InputNumber value={props.adcPd[1]} onBlur={props.handleAdcPd2} onPressEnter={props.handleAdcPd2} min={props.minAdcPd} max={props.maxAdcPd}/>
                            </Col>
                        </Row>
                        <Slider range value={props.adcPd} onChange={props.handleAdcPd}  min={props.minAdcPd} max={props.maxAdcPd}/>
                    </div>

                    <div>
                        <Row>
                            <Col span={12}>Number of Citations</Col>
                            <Col span={6}>
                                <InputNumber value={props.adcNoc[0]} onBlur={props.handleAdcNoc1} onPressEnter={props.handleAdcNoc1} min={props.minAdcNoc} max={props.maxAdcNoc}/>
                            </Col>
                            <Col span={6}>
                                <InputNumber value={props.adcNoc[1]} onBlur={props.handleAdcNoc2} onPressEnter={props.handleAdcNoc2} min={props.minAdcNoc} max={props.maxAdcNoc}/>
                            </Col>
                        </Row>
                        <Slider range value={props.adcNoc} onChange={props.handleAdcNoc} min={props.minAdcNoc} max={props.maxAdcNoc} />
                    </div>
                </div>
            </Panel> */}

            {/* Genomic Terms Density Control */}
            <Panel header="Genomic Terms Density Control" key="1">
                <div>
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
                            <Col span={12}>Recency</Col>
                            <Col span={6}>
                                <InputNumber value={props.adcPd[0]} onBlur={props.handleAdcPd1} onPressEnter={props.handleAdcPd1} min={props.minAdcPd} max={props.maxAdcPd}/>
                            </Col>
                            <Col span={6}>
                                <InputNumber value={props.adcPd[1]} onBlur={props.handleAdcPd2} onPressEnter={props.handleAdcPd2} min={props.minAdcPd} max={props.maxAdcPd}/>
                            </Col>
                        </Row>
                        <Slider range value={props.adcPd} onChange={props.handleAdcPd}  min={props.minAdcPd} max={props.maxAdcPd}/>
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
                </div>
            </Panel>

            {/* Articles Visibility */}
            {/* <Panel header="Articles Visibility" key="3" style={panelStyle}>
                <div>
                    <Transfer
                        dataSource={props.articleNodes}
                        titles={['Visible Nodes', 'Invisible Nodes']}
                        targetKeys={invisibleArticleKey}
                        selectedKeys={selectedArticleKeys}
                        onChange={onArticleChange}
                        onSelectChange={onArticleSelectChange}
                        onScroll={onScroll}
                        render={(item) => item.title}
                        showSelectAll = 'false'
                        showSearch = 'true'
                    />
                </div>
            </Panel>

            {/* Genomic Terms Visibility */}
            {/* <Panel header="Genomic Terms Visibility" key="4" style={panelStyle}>
                <div>
                    <Transfer
                        dataSource={props.termNodes}
                        titles={['Visible Nodes', 'Invisible Nodes']}
                        targetKeys={invisibleTermKey}
                        selectedKeys={selectedTermKeys}
                        onChange={onTermChange}
                        onSelectChange={onTermSelectChange}
                        onScroll={onScroll}
                        render={(item) => item.title}
                        showSelectAll = 'false'
                        showSearch = 'true'
                    />
                </div>
            </Panel> */}

            {/* Relations Visibility */}
            {/* <Panel header="Relations Visibility" key="5" style={panelStyle}>
                <div>
                    <Transfer
                        dataSource={props.relationNodes}
                        titles={['Visible Nodes', 'Invisible Nodes']}
                        targetKeys={invisibleRelationKey}
                        selectedKeys={selectedRelationKeys}
                        onChange={onRelationChange}
                        onSelectChange={onRelationSelectChange}
                        onScroll={onScroll}
                        render={(item) => item.title}
                        showSelectAll = 'false'
                        showSearch = 'true'
                    />
                </div>
            </Panel>  */}
        </Collapse>
  );
};
export default Filter;
