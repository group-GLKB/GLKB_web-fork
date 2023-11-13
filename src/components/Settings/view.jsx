import React, { useState } from 'react'
import './scoped.css'
import { Row, Col, Checkbox, Collapse, Radio, Cascader } from 'antd';
const { Panel } = Collapse;
const View = props => {
    let Anatomy = []
    let Chemicals = []
    let Diseases = []
    let GO = []
    let Genes = []
    let Journal = []
    let Organisms = []
    let Pathway = []
    for (let term of props.termNodes) {
        if (term.label == "Anatomy") {
            Anatomy.push({label: term.title, value: term.title})
        }
        if (term.label == "Chemicals and Drugs") {
            Chemicals.push({label: term.title, value: term.title})
        }
        if (term.label == "Diseases") {
            Diseases.push({label: term.title, value: term.title})
        }
        if (term.label == "GO") {
            GO.push({label: term.title, value: term.title})
        }
        if (term.label == "Genes and Gene Products") {
            Genes.push({label: term.title, value: term.title})
        }
        if (term.label == "Journal") {
            Journal.push({label: term.title, value: term.title})
        }
        if (term.label == "Organisms") {
            Organisms.push({label: term.title, value: term.title})
        }
        if (term.label == "Pathway") {
            Pathway.push({label: term.title, value: term.title})
        }
    }
    const nodeOptions = [
        {
            label: 'Articles',
            value: 'Articles'
        },
        {
            label: 'Anatomy',
            value: 'Anatomy',
            children: Anatomy
        },
        {
            label: 'Chemicals and Drugs',
            value: 'Chemicals and Drugs',
            children: Chemicals
        },
        {
            label: 'Diseases',
            value: 'Diseases',
            children: Diseases
        },
        {
            label: 'GO',
            value: 'GO',
            children: GO
        },
        {
            label: 'Genes and Gene Products',
            value: 'Genes and Gene Products',
            children: Genes
        },
        {
            label: 'Journal',
            value: 'Journal',
            children: Journal
        },
        {
            label: 'Organisms',
            value: 'Organisms',
            children: Organisms
        },
        {
            label: 'Pathway',
            value: 'Pathway',
            children: Pathway
        },
    ];

    // setVisibleArticles={props.setVisibleArticles}
    // setVisibleTerms={props.setVisibleTerms}
    // setVisibleRelations={props.setVisibleRelations}

    const onChangeNode = (value) => {
        let tempArticles = []
        let tempTerms = []
        for (let tempArray of value) {
            if (tempArray.length == 1) {
                if (tempArray[0] == 'Articles') {
                    tempArticles = props.articleNodes;
                } else {
                    for (let node of props.termNodes) {
                        if (node.label == tempArray[0]) {
                            tempTerms.push(node.title)
                        }
                    }
                }
            } else {
                tempTerms.push(tempArray[1]);
            }
        }
        console.log(tempTerms)
        props.setVisibleArticles(tempArticles);
        const filteredTerms = props.termNodes.filter(item => tempTerms.includes(item.title));
        props.setVisibleTerms(filteredTerms);
    };

    const onChangeEdge = (value) => {
        const obj = {};
        value.forEach((title, index) => {
            obj[index] = {key: (index + 1).toString(), title:title[0]};
        });
        var arr = []
        var i = 0
        for (var item in obj) {
            arr[i] = obj[item]
            i++
        }
        props.setVisibleRelations(arr)
    }

    let Semantic_relationship = []
    let Curated_relationship = []
    let Hierarchical_structure = []

    // for (let term of props.termEdges) {
    //     if (term.label == "Semantic_relationship") {
    //         Semantic_relationship.push({label: term.title, value: term.title})
    //     }
    //     if (term.label == "Curated_relationship") {
    //         Curated_relationship.push({label: term.title, value: term.title})
    //     }
    //     if (term.label == "Hierarchical_structure") {
    //         Hierarchical_structure.push({label: term.title, value: term.title})
    //     }
    // }

    const edgeOptions = [
        {
            label: 'Semantic_relationship',
            value: 'Semantic_relationship',
            children: Semantic_relationship
        },
        {
            label: 'Curated_relationship',
            value: 'Curated_relationship',
            children: Curated_relationship
        },
        {
            label: 'Hierarchical_structure',
            value: 'Hierarchical_structure',
            children: Hierarchical_structure
        }
    ]

    return (
        <Row>
            <Col span={12}>
                <p>
                    Nodes Type Visibility
                </p>
                <Cascader
                    bordered={false}
                    style={{
                        width: '100%',
                        borderBottom: "1px solid black"
                    }}
                    options={nodeOptions}
                    onChange={onChangeNode}
                    multiple
                    maxTagCount="responsive"
                    defaultValue={[['Articles'], ['Anatomy'], ['Chemicals and Drugs'],['Diseases'],['GO'],['Genes and Gene Products'],['Journal'],['Organisms'],['Pathway']]}
                    placeholder="Please select"
                />
            </Col>
            <Col span={12}>
            <p>
                    Edges Type Visibility
                </p>
                <Cascader
                    bordered={false}
                    style={{
                        width: '100%',
                        borderBottom: "1px solid black"
                    }}
                    options={edgeOptions}
                    onChange={onChangeEdge}
                    multiple
                    maxTagCount="responsive"
                    defaultValue={[['Semantic_relationship'], ['Curated_relationship'],['Hierarchical_structure']]}
                    placeholder="Please select"
                />
            </Col>
        </Row>
  );
};
export default View;
