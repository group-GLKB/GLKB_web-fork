import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import 'antd/dist/reset.css';
import { TweenOneGroup } from "rc-tween-one";
import {Input, Col, Row, Spin, Tag, Menu, Button} from 'antd';
import './scoped.css'
import GLKBLogoImg from '../../img/glkb_logo.png'
import UMLogo from '../../img/um_logo.jpg'
import MedSchoolLogo from '../../img/MedSchoolLogo.png'
import { DingtalkCircleFilled } from '@ant-design/icons';
import NavBar from '../NavBar';
import NavBarWhite from '../Units/NavBarWhite';
import SearchBarKnowledge from "../Units/SearchBarKnowledge";
import logo from "../../img/logo.svg";
import umLogo from "../../img/um_logo.jpg";
import exampleQueries from '../../components/Units/SearchBarKnowledge/example_query.json';

const { Search } = Input;

const HomePage = () => {
    let navigate = useNavigate();
    const [tags, setTags] = useState([]);

    const handleSearch = async (v) => {
        navigate(`/result?q=${v}`)
    }

    const handleExampleQuery = (index) => {
        if (exampleQueries && exampleQueries.length > index) {
            const exampleQuery = exampleQueries[index];
            navigate('/result', { 
                state: { 
                    search_data: exampleQuery,
                    chipDataID: exampleQuery.triplets.map(triplet => [triplet.source[0], triplet.target[0]])
                } 
            });
        }
    }

    return (
        <div className="HomePageContainer">
            <NavBarWhite showLogo={false} />
            <div className="content">
                <img src={logo} alt="Logo" />
                <div className="search-section">
                    <SearchBarKnowledge 
                        chipData = {[]}
                    />
                    <div className="example-queries">
                        <Button 
                            onClick={() => handleExampleQuery(0)}
                            className="example-query-button"
                        >
                            Example Query 1: SPRY2, RFX6, HNF4A, and Type 2 Diabetes
                        </Button>
                        <Button 
                            onClick={() => handleExampleQuery(1)}
                            className="example-query-button"
                        >
                            Example Query 2: TP53, SOX2, and Breast Cancer
                        </Button>
                        <Button 
                            onClick={() => handleExampleQuery(2)}
                            className="example-query-button"
                        >
                            Example Query 3: CYP2C19, Cardiovascular Abnormalities, and Clopidogrel
                        </Button>
                    </div>
                </div>
            </div>

            <div className="footer">
                <img src={umLogo} alt="Michigan Medicine Logo" className="footer-img" />
                <p>© 2024 U-M Liu Lab, Department of Computational Medicine and Bioinformatics</p>
            </div>
        </div>
    )
}

export default HomePage
