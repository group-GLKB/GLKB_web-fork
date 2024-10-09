import React from 'react'
import './scoped.css'
import Filter from './filter';

const Settings = props => {
    const settingsClass = "settings open";
    return (
        <div>
            <div className={settingsClass}>
                <Filter
                    minGtdcFreq={props.minGtdcFreq} 
                    maxGtdcFreq={props.maxGtdcFreq} 
                    minGtdcNoc={props.minGtdcNoc} 
                    maxGtdcNoc={props.maxGtdcNoc} 
                    gtdcFreq={props.gtdcFreq}
                    handleGtdcFreq={props.handleGtdcFreq}
                    handleGtdcFreq1={props.handleGtdcFreq1}
                    handleGtdcFreq2={props.handleGtdcFreq2}
                    gtdcNoc={props.gtdcNoc}
                    handleGtdcNoc={props.handleGtdcNoc}
                    handleGtdcNoc1={props.handleGtdcNoc1}
                    handleGtdcNoc2={props.handleGtdcNoc2}
                    data = {props.data}
                    setData = {props.setData}
                    allNodes = {props.allNodes}
                    setGraphData = {props.setGraphData}
                    graphShownData = {props.graphShownData}
                    handleSelectNodeID={props.handleSelectNodeID}
                    search={props.search}
                    search_data={props.search_data}
                    displayArticleGraph={props.displayArticleGraph}
                    setDisplayArticleGraph={props.setDisplayArticleGraph}
                    setDetailId={props.setDetailId}
                    graphData={props.graphShownData}
                />  
            </div>
        </div>
        
  );
};

export default Settings;
