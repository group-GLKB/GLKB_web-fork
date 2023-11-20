import React, { useEffect } from "react";
import './scoped.css'
import { Checkbox, Row, Col, List} from 'antd';
import { useState } from "react";

function Article(props) {
    // console.log(props)
    // ['Genes and Gene Products',
    //               'Anatomy', 'Chemicals and Drugs', 'GO', 'Diseases', 'Organisms', 'Unmapped_entity']
    // const [geneExisted, setGeneFilter] = useState(false)
    // const [geneSelected, setGeneFlag] = useState(true)
    // const [anatomyExisted, setAnatomyFilter] = useState(false)
    // const [anatomySelected, setAnatomyFlag] = useState(true)
    // const [chemicalsExisted, setChemicalsFilter] = useState(false)
    // const [chemicalsSelected, setChemicalsFlag] = useState(true)
    // const [goExisted, setGoFilter] = useState(false)
    // const [goSelected, setGoFlag] = useState(true)
    // const [diseasesExisted, setDiseasesFilter] = useState(false)
    // const [diseasesSelected, setDiseasesFlag] = useState(true)
    // const [organismsExisted, setOrganismsFilter] = useState(false)
    // const [organismsSelected, setOrganismsFlag] = useState(true)

    // useEffect(() => {
    //     setGeneFilter(false)
    //     setAnatomyFilter(false)
    //     setChemicalsFilter(false)
    //     setGoFilter(false)
    //     setDiseasesFilter(false)
    //     setOrganismsFilter(false)
    //     for (let prop of props.highlight) {
    //         if (prop == "Genes and Gene Products") {
    //             setGeneFilter(true)
    //             setGeneFlag(true)
    //         }
    //         if (prop == "Anatomy") {
    //             setAnatomyFilter(true)
    //             setAnatomyFlag(true)
    //         }
    //         if (prop == "Chemicals and Drugs") {
    //             setChemicalsFilter(true)
    //             setChemicalsFlag(true)
    //         }
    //         if (prop == "GO") {
    //             setGoFilter(true)
    //             setGoFlag(true)
    //         }
    //         if (prop == "Diseases") {
    //             setDiseasesFilter(true)
    //             setDiseasesFlag(true)
    //         }
    //         if (prop == "Organisms") {
    //             setOrganismsFilter(true)
    //             setOrganismsFlag(true)
    //         }
    //     }
    // }, [props])

    // const genesClick = (e) => {
    //     setGeneFlag(!geneSelected)
    // };

    // const anatomyClick = (e) => {
    //     setAnatomyFlag(!anatomySelected)
    // };

    // const chemicalsClick = (e) => {
    //     setChemicalsFlag(!chemicalsSelected)
    // };

    // const goClick = (e) => {
    //     setGoFlag(!goSelected)
    // };

    // const diseasesClick = (e) => {
    //     setDiseasesFlag(!diseasesSelected)
    // };

    // const organismsClick = (e) => {
    //     setOrganismsFlag(!organismsSelected)
    // };

    return (
        <div className="article-container">
            <div className="article-title">{props.title}</div>
            <br/>
            <div className='article-authors'>
                <p>
                {props.authors === null || props.authors[0] == ' ' && (
                    <span>No authors listed</span>
                )}
                {props.authors != null && props.authors[0] != ' ' && (props.authors.map((author, index) => {
                    return (
                    <span>
                        {author}
                        {index < props.authors.length - 1 && (
                            <span>, </span>
                        )}
                        {index === props.authors.length - 1 && (
                            <span>;</span>
                        )}
                    </span>
                    )
                }))}
                </p>
            </div>
            <div className='article-id'>
                <p>PMID: {props.pmid}</p>
            </div>
            {/* <div className='highlight-selector'>
                {geneExisted && (
                    <Checkbox checked={geneSelected} onChange={genesClick}>Genes and Gene Products</Checkbox>
                )}
                {anatomyExisted && (
                    <Checkbox checked={anatomySelected} onChange={anatomyClick}>Anatomy</Checkbox>
                )}
                {chemicalsExisted && (
                    <Checkbox checked={chemicalsSelected} onChange={chemicalsClick}>Chemicals and Drugs</Checkbox>
                )}
                {goExisted && (
                    <Checkbox checked={goSelected} onChange={goClick}>GO</Checkbox>
                )}
                {diseasesExisted && (
                    <Checkbox checked={diseasesSelected} onChange={diseasesClick}>Diseases</Checkbox>
                )}
                {organismsExisted && (
                    <Checkbox checked={organismsSelected} onChange={organismsClick}>Organisms</Checkbox>
                )}
            </div> */}
            {/* TODO: fix the maximum height of the content */}
            <div className='article-abstract'>
                <p className='abstract-title'>Abstract</p>
                <p className='abstract-content'>{props.abstract}</p>
                {/* <p className="abstract-content">
                    {props.abstract_list.map((abstract_tuple, index) => {
                        let backgroundFlag = false
                        if ((abstract_tuple[1] == 'Genes and Gene Products') && geneSelected ||
                        (abstract_tuple[1] == 'Anatomy') && anatomySelected ||
                        (abstract_tuple[1] == 'Chemicals and Drugs') && chemicalsSelected ||
                        (abstract_tuple[1] == 'GO') && goSelected ||
                        (abstract_tuple[1] == 'Diseases') && diseasesSelected ||
                        (abstract_tuple[1] == 'Organisms') && organismsSelected) {
                            backgroundFlag = true
                        }
                        return (
                            <span>
                                {(abstract_tuple[1] == 'Genes and Gene Products') && backgroundFlag && (
                                    <span className="genesHighlight">{abstract_tuple[0]}</span>
                                )}
                                {(abstract_tuple[1] == 'Anatomy') && backgroundFlag && (
                                    <span className="anatomyHighlight">{abstract_tuple[0]}</span>
                                )}
                                {(abstract_tuple[1] == 'Chemicals and Drugs') && backgroundFlag && (
                                    <span className="chemicalsHighlight">{abstract_tuple[0]}</span>
                                )}
                                {(abstract_tuple[1] == 'GO') && backgroundFlag && (
                                    <span className="goHighlight">{abstract_tuple[0]}</span>
                                )}
                                {(abstract_tuple[1] == 'Diseases') && backgroundFlag && (
                                    <span className="diseasesHighlight">{abstract_tuple[0]}</span>
                                )}
                                {(abstract_tuple[1] == 'Organisms') && backgroundFlag &&  (
                                    <span className="organismsHighlight">{abstract_tuple[0]}</span>
                                )}
                                {!backgroundFlag &&  (
                                    <span>{abstract_tuple[0]}</span>
                                )}
                            </span>
                        )
                    })}
                </p> */}
            </div>
        </div>
    )
}

export default Article