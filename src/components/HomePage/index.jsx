import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import 'antd/dist/reset.css';
import { TweenOneGroup } from "rc-tween-one";
import {Input, Col, Row, Spin, Tag, Menu} from 'antd';
import './scoped.css'
import GLKBLogoImg from '../../img/glkb_logo.png'
import UMLogo from '../../img/um_logo.jpg'
import MedSchoolLogo from '../../img/MedSchoolLogo.png'
import { DingtalkCircleFilled } from '@ant-design/icons';
import NavBar from '../NavBar';

const { Search } = Input;

const HomePage = () => {
    let nevigate = useNavigate();
    const handleSearch = async (v) => {
        nevigate(`/result?q=${v}`)
    }

    const [tags, setTags] = useState([]);

    return (
        <div>
            <NavBar 
                handleSearchTags = {handleSearch}
                tags = {tags}
                setTags = {setTags}    
            />
        </div>
    )
}

export default HomePage