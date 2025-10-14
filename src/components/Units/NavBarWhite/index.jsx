import '../../NavBar/scoped.css';
import './scoped.css';

import React from 'react';

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  Box,
} from '@mui/material';

import logo from '../../../img/glkb-6.png';

function NavBarWhite({ showLogo = true, activeButton }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { state } = location || {};
    const relativePath = window.location.pathname || '';

    const handleSearchClick = () => {
        navigate('/', { state: { activeButton: "triplet" } }); // Navigate to the search page
    };
    const handleChatClick = () => {
        navigate('/', { state: { activeButton: "llm" } });
    };

    return (
        <nav className="navigation-bar">
            <div className="logo">
                {showLogo && (
                    <Link to="/" style={{ display: 'block', height: '75px', marginLeft: '0px' }}>
                        <div style={{ height: '75px', width: '300px', overflow: 'hidden', position: 'relative' }}>
                            <img
                                src={logo} // Path to the logo image
                                style={{
                                    height: '250px', // Adjust the width of the image
                                    width: 'auto',
                                    position: 'absolute',
                                    top: '55%',
                                    transform: 'translate(-80px, -50%)',
                                }}
                            />
                        </div>
                    </Link>
                )}

            </div>
            <div className="nav-links">
                {[["Home", "/"], ["Search", "/result"], ["Chat", "/llm-agent"]].map(([name, path]) => (
                    <Link
                        key={name}
                        className={
                            relativePath === path ?
                                (path === "/" ? "nav-link active-main" : "nav-link active")
                                : "nav-link nonactive"}
                        to={path}
                        style={{ position: "relative" }}
                    >
                        {name}
                    </Link>
                ))}
                <a
                    key="API Doc"
                    className="nav-link nonactive"
                    href="https://glkb.dcmb.med.umich.edu/api/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ position: "relative" }}
                >
                    API Doc
                </a>
                <Link
                    key="About"
                    className={relativePath === "/about" ? "nav-link active" : "nav-link nonactive"}
                    to="/about"
                    style={{ position: "relative" }}
                >
                    About
                </Link>
                <Link to={"https://jieliu6.github.io/"} target='_blank'>
                    <Box className={relativePath === "/" ? "nav-link contact-main" : "nav-link contact"} >Contact</Box>
                </Link>
            </div>
        </nav>
    );
}

export default NavBarWhite;
