import React, { useState, useEffect } from 'react'
import './scoped.css'
import { DetailService } from '../../service/Detail'
import { Button } from 'antd';
import { Descriptions, List, Collapse, Divider, Typography} from 'antd';
import {
    ConsoleSqlOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined
} from '@ant-design/icons';

const { Panel } = Collapse;
const { Title } = Typography;
const Information = props => {
    const informationClass = props.isOpen ? "information open" : "information";
    const buttonClass = props.isOpen ? "information-button open" : "information-button";
    const relatedClass = props.isOpen ? "related open" : "related";
    const [nodeDetail, setNodeDetail] = useState({});
    const [edgeDetail, setEdgeDetail] = useState({});
    const [activeKey, setActiveKey] = useState(0);

    const handleCollapseChange = key => {
        // Make the edge collapse panel act same time with the article collapse component
        setActiveKey(key);
    };

    const handleClick = (event, link) => {
        event.preventDefault();
        window.open(link, '_blank');
    };

    useEffect(() => {
        setNodeDetail({});
        setEdgeDetail({});
        async function searchInfoNode(content) {
            let detailServ = new DetailService()
            const response = await detailServ.Nid2Detail(content)
            setNodeDetail(response.data)
            setEdgeDetail({})
        }
        async function searchInfoEdge(content) {
            let detailServ = new DetailService()
            // console.log(content)
            const response = await detailServ.Eid2Detail(content[0], content[1])
            setEdgeDetail(response.data)
            setNodeDetail({})
        }
        if (props.detailId) {
            if (!Array.isArray(props.detailId)) {
                searchInfoNode(props.detailId);
            }
            else{
                searchInfoEdge(props.detailId);
            }
        }
    }, [props.detailId]);


    const nodeForMap = (url) => {
        return(
            <div>
                <a href={url[1]} onClick={(event) => handleClick(event, url[1])}>{url[0]}</a>
                {/*<span> (Number of Citation: {url[2]}, Date: {url[3]})</span>*/}
                <p>Number of Citations: {url[2]}, Date: {url[3]}</p>
            </div>
        )
    }
    const urls = Object.keys(nodeDetail).length !== 0 ? nodeDetail[1].map(nodeForMap) : []



    function renderExternal() {
        if (Object.keys(nodeDetail).length !== 0) {
            const elements = [];
            for (const source in nodeDetail[0].external_sources) {
                elements.push(
                    <div>
                      {source}: {nodeDetail[0].external_sources[source]}
                    </div>
                );
            }
            return elements;
        }
    }
    if (Object.keys(edgeDetail).length !== 0) {
        console.log(edgeDetail);

    }
        return (
            <div>
                <div className={informationClass}>
                    {Object.keys(nodeDetail).length === 0 && Object.keys(edgeDetail).length === 0 && (
                       <div className='article-container'>
                            <div>Loading... or you have not yet select any node or edge</div>
                       </div>
                    )}
                    {Object.keys(nodeDetail).length !== 0 && (

                        <div className='article-container'>
                            <Title level={4}>{nodeDetail[0].name.charAt(0).toUpperCase() + nodeDetail[0].name.slice(1)}</Title>
                            {/*<Title level={4}>{nodeDetail[0].name}</Title>*/}

                            <Descriptions column={1}  size="small" className="custom-descriptions">
                                <Descriptions.Item label="Entity ID">{nodeDetail[0].element_id}</Descriptions.Item>
                                <Descriptions.Item label="Aliases">{nodeDetail[0].aliases}</Descriptions.Item>
                                <Descriptions.Item label="Description">{nodeDetail[0].description}</Descriptions.Item>
                                <Descriptions.Item label="Type">{nodeDetail[0].type}</Descriptions.Item>
                                <Descriptions.Item label="External ID">{renderExternal()}</Descriptions.Item>
                            </Descriptions>
                        </div>
                    )}
                    {Object.keys(edgeDetail).length !== 0 && (
                        <div className='article-container'>
                            <Title level={4}>Edges Detail</Title>
                            <Collapse accordion activeKey={activeKey} onChange={handleCollapseChange}>
                                {edgeDetail.map((edge, index) => (
                                    <Panel header={`Edge ${index + 1}: ${edge[0].node1} - ${edge[0].node2}`} key={index}>
                                        <div className='edge-article-container'>
                                            {/*<Descriptions title="Edge Details" bordered column={1}>*/}
                                            <Descriptions column={1}>
                                                <Descriptions.Item label="Node 1">{edge[0].node1}</Descriptions.Item>
                                                <Descriptions.Item label="Node 2">{edge[0].node2}</Descriptions.Item>
                                                <Descriptions.Item label="Relationship Label">{edge[0]['relationship label']}</Descriptions.Item>
                                                <Descriptions.Item label="Relationship Type">{edge[0]['relationship type']}</Descriptions.Item>
                                                <Descriptions.Item label="Number of Citations">
                                                    {/*{edge[0]['number of citations']}*/}
                                                    {edge[0]['number of citations'] !== null ? edge[0]['number of citations'] : 'N/A'}
                                                </Descriptions.Item>
                                            </Descriptions>
                                        </div>
                                    </Panel>
                                ))}
                            </Collapse>
                        </div>
                    )}

                </div>
                <Button
                    onClick={props.toggleSidebar}
                    className={buttonClass}
                >
                    { !props.isOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                </Button>
                <div className={relatedClass}>
                    {Object.keys(nodeDetail).length !== 0 && (
                        <div className='article-container'>
                            <Title level={4}>Related Articles</Title>
                            <List
                                size="small"
                                dataSource={urls} // Assuming 'urls' is an array of URL strings or objects
                                renderItem={item => (
                                    <List.Item>
                                        {/* Render your URL or article title here */}
                                        {/* Example: <a href={item.url}>{item.title}</a> */}
                                        {item}
                                    </List.Item>
                                )}
                            />
                        </div>
                    )}
                    {Object.keys(edgeDetail).length !== 0 && (
                        <div className='article-container'>
                            <Title level={4}>Related Articles</Title>
                            <Collapse accordion activeKey={activeKey} onChange={handleCollapseChange}>
                                {edgeDetail.map((edge, edgeIndex) => (
                                    <Panel header={`Edge ${edgeIndex + 1}`} key={edgeIndex}>
                                        {edge[1] && edge[1].length > 0 ? (
                                            edge[1].map((url, urlIndex) => (
                                                <div key={urlIndex}>
                                                    <a href={url[1]} onClick={(event) => handleClick(event, url[1])}>
                                                        {url[0]}
                                                    </a>
                                                    <p> Number of Citations: {url[2]}, Date: {url[3]}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div>N/A</div>
                                        )}
                                    </Panel>
                                ))}
                            </Collapse>
                        </div>
                    )}

                </div>
            </div>


      );
};
export default Information;