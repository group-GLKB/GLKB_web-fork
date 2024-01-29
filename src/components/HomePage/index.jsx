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
        console.log(tags)
        if (!inputValue && tags.length != 0) {
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
            <NavBar 
                handleSearchTags = {handleSearch}
                tags = {tags}
                setTags = {setTags}    
            />
            {/* Navigation Bar */}
            {/* <Menu
                mode="horizontal"
                style={{
                    backgroundColor: '#f0f2f5',
                    //borderBottom: '1px solid #e8e8e8',
                    borderBottom :'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    padding: '0 40px',
                    fontSize: '25px',
                    lineHeight: '50px',
                    transition: 'background-color 0.3s ease',
                }}
            >
                <Menu.Item key="home" >
                    Home
                </Menu.Item>
                {/*<Menu.Item key="about">*/}
                {/*    <a href="https://google.com" target="_blank" rel="noopener noreferrer">*/}
                {/*        About*/}
                {/*    </a>*/}
                {/*</Menu.Item>*/}
                {/* <Menu.Item key="API">
                    <a href="https://glkb.dcmb.med.umich.edu/docs" target="_blank" rel="noopener noreferrer">
                        API Doc
                    </a>
                </Menu.Item>
            </Menu> */}
        
            {/* Filter Bar */}
            {/* <div className="line"></div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '140px'}}>
                <div style={{ textAlign: 'left', width: '600px', padding: '20px', background: '#F6F6F6', borderRadius: '14px'}}>
                    <div className="heading-search">
                        <Search placeholder="input search text" value={searchText} enterButton="Search" onChange={handleInputChange} onPressEnter={handleInputConfirm} onSearch={handleInputConfirm}/>
                    </div>
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
            </div> */}
        </div>
    )
}

export default HomePage