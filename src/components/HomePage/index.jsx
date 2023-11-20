import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import 'antd/dist/reset.css';
import { TweenOneGroup } from "rc-tween-one";
import {Input, Col, Row, Spin, Tag} from 'antd';
import './scoped.css'
import GLKBLogoImg from '../../img/glkb_logo.png'
import UMLogo from '../../img/um_logo.jpg'
import MedSchoolLogo from '../../img/MedSchoolLogo.png'
import { DingtalkCircleFilled } from '@ant-design/icons';

const { Search } = Input;

const HomePage = () => {
    let nevigate = useNavigate();
    const handleSearch = async (v) => {
        const alltags = tags.join("|")
        console.log(alltags)
        // console.log(v)
        nevigate(`/result?q=${alltags}`)
    }

    const [tags, setTags] = useState([]);
    const [inputVisible, setInputVisible] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        if (inputVisible) {
        inputRef.current?.focus();
        }
    }, [inputVisible]);

    const handleClose = (removedTag) => {
        const newTags = tags.filter((tag) => tag !== removedTag);
        console.log(newTags);
        setTags(newTags);
    };

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
        setSearchText(e.target.value);
    };

    const handleInputConfirm = (e) => {
        setSearchText('');
        if (!inputValue) {
            handleSearch();
        }
        if (inputValue && tags.indexOf(inputValue) === -1) {
        setTags([...tags, inputValue]);
        }
        setInputVisible(false);
        setInputValue("");
    };

    const forMap = (tag) => {
        const tagElem = (
        <Tag
            className='tag-box'
            closable
            onClose={(e) => {
            e.preventDefault();
            handleClose(tag);
            }}
            style={{ border: '1px solid #4F4F4F', borderRadius: '18px' }}
        >
            {tag}
        </Tag>
        );
        return (
        <span key={tag} style={{ display: "inline-block" }}>
            {tagElem}
        </span>
        );
    };

    const tagChild = tags.map(forMap);

    return (
    // <div className="home-container">
    //     <div className="home-head-container">
    //         <img src={GLKBLogoImg} style={{ height: 100 }} />
    //         <div className="head-text">
    //             A database and data mining platform for biomedical
    //             literature
    //         </div>
    //         <div className='search-container'>
    //             <div className='termContainer'>
    //                 <h2>Terms</h2>
    //                 <div style={{ marginBottom: 16 }}>
    //                 <TweenOneGroup
    //                     enter={{
    //                         scale: 0.8,
    //                         opacity: 0,
    //                         type: "from",
    //                         duration: 100
    //                     }}
    //                     onEnd={(e) => {
    //                         if (e.type === "appear" || e.type === "enter") {
    //                             e.target.style = "display: inline-block";
    //                         }
    //                     }}
    //                     leave={{ opacity: 0, width: 0, scale: 0, duration: 200 }}
    //                     appear={false}
    //                     >
    //                     {tagChild}
    //                     </TweenOneGroup>
    //                 </div>
    //             </div>
    //             <button onClick={handleSearch} className='map-button'>
    //                 Map Terms!
    //             </button>
    //             <Input
    //                     type="text"
    //                     size="large"
    //                     placeholder="Input terms here, hit enter to confirm the term"
    //                     className='search-bar'
    //                     value={inputValue}
    //                     onChange={handleInputChange}
    //                     onBlur={handleInputConfirm}
    //                     onPressEnter={handleInputConfirm}
    //                 />
    //         </div>
    //     </div>
    //     <div className="footer-container">
    //         <div className="UMichLogo-container">
    //             <img src={MedSchoolLogo} style={{ height: 100 }} />
    //         </div>
    //         <div className="Department-container">
    //             Department of
    //             Computational Medicine
    //             and Bioinformatics
    //         </div>
    //         <div className="contact-container">
    //             <div className="contact-heading">
    //                 Contacts:
    //             </div>
    //         </div>
    //         <div className="address-container">
    //             Palmer Commons 2035D, Ann Arbor, MI 48109
    //         </div>
    //         <div className="footnote-container">
    //             This website is free and open to all users and there is no login requirement. User cookies are not collected.
    //         </div>
    //     </div>
    // </div>
        <div>
            {/* Navigation Bar */}
            <div className="heading-container">
                <Row>
                    <Col span={7}>
                        <div className="GLKB-container">
                            <img className='GLKBLogo' src={GLKBLogoImg}/>
                        </div> 
                    </Col>
                    <Col span={10}>
                        <div className="heading-search">
                            <Search placeholder="input search text" value={searchText} enterButton="Search" onChange={handleInputChange} onPressEnter={handleInputConfirm}/>
                        </div>
                    </Col>
                    <Col span={7}>
                        <div className="UM-container">
                            <img className='UMLogo' src={UMLogo}/>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* Filter Bar */}
            <div className="line"></div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '45px'}}>
                <div style={{ textAlign: 'left', width: '600px', padding: '20px', background: '#F6F6F6', borderRadius: '14px'}}>
                    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <span style={{ marginRight: '20px' }}>Term List:</span>
                        <TweenOneGroup
                            enter={{
                                scale: 0.8,
                                opacity: 0,
                                type: 'from',
                                duration: 100,
                            }}
                            onEnd={(e) => {
                                if (e.type === 'appear' || e.type === 'enter') {
                                    e.target.style = 'display: inline-block';
                                }
                            }}
                            leave={{ opacity: 0, width: 0, scale: 0, duration: 200 }}
                            appear={false}
                        >
                            {tagChild}
                        </TweenOneGroup>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HomePage