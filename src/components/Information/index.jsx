import React, { useState, useEffect } from 'react'
import './scoped.css'
import Article from './article'
import Term from './term'
import { DetailService } from '../../service/Detail'
import { Button } from 'antd';
import {
    ConsoleSqlOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined
} from '@ant-design/icons';

const Information = props => {
    const informationClass = props.isOpen ? "information open" : "information";
    const buttonClass = props.isOpen ? "information-button open" : "information-button";
    const relatedClass = props.isOpen ? "related open" : "related";
    const [nodeDetail, setNodeDetail] = useState({});
    const [edgeDetail, setEdgeDetail] = useState({});

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
            console.log(content)
            const response = await detailServ.Eid2Detail(content)
            console.log(response.data)
            setEdgeDetail(response.data)
            setNodeDetail({})
        }
        if (props.detailId) {
            if (!Array.isArray(props.detailId)) {
                searchInfoNode(props.detailId);
            }
            else{
                searchInfoEdge(props.detailId[0]);
            }
        }
    }, [props.detailId]);
    

    const nodeForMap = (url) => {
        return(
            <div>
                <a href={url[1]} onClick={(event) => handleClick(event, url[1])}>{url[0]}</a>
            </div>
        )
    }
    const urls = Object.keys(nodeDetail).length !== 0 ? nodeDetail[1].map(nodeForMap) : []

    const edgeUrl = (url) => {
        return(
            <div>
                <a href={url[1]} onClick={(event) => handleClick(event, url[1])}>{url[0]}</a>
            </div>
        )
    }
    const edgeUrls = Object.keys(edgeDetail).length !== 0 ? edgeDetail[0][1].map(edgeUrl) : []

    
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
    if (Object.keys(nodeDetail).length !== 0) {
        // console.log(nodeDetail[0])
    }
    // if (!detail) {
    //     return <div>Loading</div>
    // }

//     return (
//         <div>
//             <div className={informationClass}>
//                 {Object.keys(props.detail).length != 0 && props.detailType == "article" && (
//                     <Article
//                         title={props.detail.title}
//                         authors={props.detail.authors}
//                         pmid={props.detail.pmid}
//                         abstract={props.detail.abstract}
//                         abstract_list={props.detail.abstract_list}
//                     />
//                 )}
//                 {Object.keys(props.detail).length != 0 && props.detailType == "term" && (
//                     <Term
//                         entity_id={props.detail.element_id}
//                         name={props.detail.name}
//                         aliases={props.detail.aliases}
//                         description={props.detail.description}
//                         type={props.detail.type}
//                         external_id={props.detail.external_sources}
//                     />
//                 )}
//             </div>
//             <Button
//                 onClick={props.toggleSidebar}
//                 className={buttonClass}
//             >
//                 { !props.isOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
//             </Button>
//         </div>
        
//   );
        return (
            <div>
                <div className={informationClass}>
                    {/* {Object.keys(detail).length != 0 && props.detailType == "article" && 'title' in detail && (
                        <Article
                            title={detail.title}
                            authors={detail.authors}
                            pmid={detail.pmid}
                            abstract={detail.abstract}
                            abstract_list={detail.abstract_list}
                        />
                    )}
                    {Object.keys(detail).length != 0 && props.detailType == "term" && 'element_id' in detail && (
                        <Term
                            entity_id={detail.element_id}
                            name={detail.name}
                            aliases={detail.aliases}
                            description={detail.description}
                            type={detail.type}
                            external_id={detail.external_sources}
                        />
                    )} */}
                    {Object.keys(nodeDetail).length == 0 && Object.keys(edgeDetail).length == 0 && (
                       <div className='article-container'>
                            <div>Loading</div>
                       </div>
                    )}
                    {Object.keys(nodeDetail).length != 0 && (
                        <div className='article-container'>
                            <div className='article-titile'>Entity ID: {nodeDetail[0].element_id}</div>
                            <div className='article-titile'>Name: {nodeDetail[0].name}</div>
                            <div className='article-titile'>Aliases: {nodeDetail[0].aliases}</div>
                            <div className='article-titile'>Description: {nodeDetail[0].description}</div>
                            <div className='article-titile'>Type: {nodeDetail[0].type}</div>
                            <div className='article-titile'>
                            External ID: {renderExternal()}
                            </div>
                        </div>
                    )}
                    {Object.keys(edgeDetail).length != 0 && (
                        <div className='article-container'>
                            <div className='article-titile'>Node 1: {edgeDetail[0][0].node1}</div>
                            <div className='article-titile'>Node 2: {edgeDetail[0][0].node2}</div>
                            <div className='article-titile'>relationship label: {edgeDetail[0][0]['relationship label']}</div>
                            <div className='article-titile'>relationship type: {edgeDetail[0][0]['relationship type']}</div>
                            <div className='article-titile'>number of citations: {edgeDetail[0][0]['number of citations']}</div>
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
                    {/* {Object.keys(detail).length != 0 && props.detailType == "article" && 'title' in detail && (
                        <Article
                            title={detail.title}
                            authors={detail.authors}
                            pmid={detail.pmid}
                            abstract={detail.abstract}
                            abstract_list={detail.abstract_list}
                        />
                    )}
                    {Object.keys(detail).length != 0 && props.detailType == "term" && 'element_id' in detail && (
                        <Term
                            entity_id={detail.element_id}
                            name={detail.name}
                            aliases={detail.aliases}
                            description={detail.description}
                            type={detail.type}
                            external_id={detail.external_sources}
                        />
                    )} */}
                    {Object.keys(nodeDetail).length != 0 && (
                        <div className='article-container'>
                            <div className='article-titile'>Related Articles</div>
                            {urls}
                        </div>
                    )} 
                    {Object.keys(edgeDetail).length != 0 && (
                        <div className='article-container'>
                            <div className='article-titile'>Related Articles</div>
                            {edgeUrls}
                        </div>
                    )}
                    
                </div>
            </div>
            
            
      );
};
export default Information;
