import React, { useEffect, useState } from 'react'
import './scoped.css'
import { Col, Row, Collapse, InputNumber, Slider, Transfer, DatePicker, Button } from 'antd';
import {
    MenuFoldOutlined,
    MenuUnfoldOutlined
} from '@ant-design/icons';
import View from './view';
import Filter from './filter';
import Table from './table'

const { Panel } = Collapse;

const Settings = props => {
    //const settingsClass = props.isOpen ? "settings open" : "settings";
    const settingsClass = "settings open";
    //const buttonClass = props.isOpen ? "settings-button open" : "settings-button";
    return (
        <div>
            <div className={settingsClass}>
                {/* <View
                    view={props.view}
                    handleView={props.handleView}
                    articleNodes={props.articleNodes}
                    termNodes={props.termNodes}
                    termEdges={props.termEdges}
                    setVisibleArticles={props.setVisibleArticles}
                    setVisibleTerms={props.setVisibleTerms}
                    setVisibleRelations={props.setVisibleRelations}
                    visibleArticles={props.visibleArticles}
                    visibleTerms={props.visibleTerms}
                    visibleRelations={props.visibleRelations}
                /> */}

                <Filter
                    minAdcFreq={props.minAdcFreq}
                    maxAdcFreq={props.maxAdcFreq}
                    minAdcPd={props.minAdcPd}
                    maxAdcPd={props.maxAdcPd}
                    minAdcNoc={props.minAdcNoc} 
                    maxAdcNoc={props.maxAdcNoc}
                    minGtdcFreq={props.minGtdcFreq} 
                    maxGtdcFreq={props.maxGtdcFreq} 
                    minGtdcNoc={props.minGtdcNoc} 
                    maxGtdcNoc={props.maxGtdcNoc} 
                    adcFreq={props.adcFreq}
                    handleAdcFreq={props.handleAdcFreq}
                    handleAdcFreq1={props.handleAdcFreq1}
                    handleAdcFreq2={props.handleAdcFreq2}
                    adcPd={props.adcPd}
                    handleAdcPd={props.handleAdcPd}
                    handleAdcPd1={props.handleAdcPd1}
                    handleAdcPd2={props.handleAdcPd2}
                    adcNoc={props.adcNoc}
                    handleAdcNoc={props.handleAdcNoc}
                    handleAdcNoc1={props.handleAdcNoc1}
                    handleAdcNoc2={props.handleAdcNoc2}
                    gtdcFreq={props.gtdcFreq}
                    handleGtdcFreq={props.handleGtdcFreq}
                    handleGtdcFreq1={props.handleGtdcFreq1}
                    handleGtdcFreq2={props.handleGtdcFreq2}
                    gtdcNoc={props.gtdcNoc}
                    handleGtdcNoc={props.handleGtdcNoc}
                    handleGtdcNoc1={props.handleGtdcNoc1}
                    handleGtdcNoc2={props.handleGtdcNoc2}
                    setVisibleArticles={props.setVisibleArticles}
                    setVisibleTerms={props.setVisibleTerms}
                    setVisibleRelations={props.setVisibleRelations}
                    articleNodes={props.articleNodes}
                    termNodes={props.termNodes}
                    relationNodes={props.relationNodes}
                    visibleArticles={props.visibleArticles}
                    visibleTerms={props.visibleTerms}
                    visibleRelations={props.visibleRelations}
                />  
            </div>
            {/*<Button*/}
            {/*    onClick={props.toggleSidebar}*/}
            {/*    className={buttonClass}*/}
            {/*>*/}
            {/*    { !props.isOpen ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}*/}
            {/*</Button>*/}
            <Table 
                isTableOpen = {props.isTableOpen}
                toggleTable = {props.toggleTable}
                data = {props.data}
                setData = {props.setData}
                allNodes = {props.allNodes}
                setGraphData = {props.setGraphData}
                graphShownData = {props.graphShownData}
            />
        </div>
        
  );
};
export default Settings;
