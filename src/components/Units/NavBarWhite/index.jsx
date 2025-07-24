import '../../NavBar/scoped.css';
import './scoped.css'; // This is where you will import your CSS from

import React from 'react';

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import logo from '../../../img/glkb_logo.png';

function NavBarWhite({ showLogo = true, activeButton }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { state } = location || {};
    const relativePath = window.location.href.toString().split(window.location.host)[1] || '';

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
                    <Link to="/">
                        <img
                            src={logo} // Path to the logo image
                            style={{
                                height: '75px', // Adjust the width of the image
                                width: 'auto',
                                marginRight: '8px', // Add spacing between the image and text
                            }}
                        />
                    </Link>
                )}

            </div>
            <div className="nav-links">
                <Link
                    className={relativePath === "/" ? "nav-link active" : "nav-link"}
                    to="/"
                    style={relativePath === "/" ? {
                        color: "#5D38D2", position: "relative"
                    } : { position: "relative" }}>Home</Link>
                <Link
                    className={relativePath === "/about" ? "nav-link active" : "nav-link"}
                    to="/about"
                    style={relativePath === "/about" ? { color: "#5D38D2", position: "relative" } : { position: "relative" }}>About</Link>
                {/* <Link to="/llm-agent" className="beta-link">
                    LLM Agent
                    <span className="beta-tag">Beta</span>
                </Link> */}
                <a href="https://glkb.dcmb.med.umich.edu/api/docs" target="_blank" >API Doc</a>
                <a href="https://jieliu6.github.io/" target="_blank">Contact Us</a>
            </div>
        </nav>
    );
}

export default NavBarWhite;
