import '../../NavBar/scoped.css';
import './scoped.css';

import React from 'react';

import {
    Link,
    useLocation,
    useNavigate,
} from 'react-router-dom';

import logo from '../../../img/glkb-6.png';

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
                    <Link to="/" style={{ display: 'block', height: '75px', marginLeft: '50px' }}>
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
                {
                    [["Home", "/"], ["Search", "/result"], ["Chat", "/llm-agent"], ["About", "/about"]].map(([name, path]) => (
                        <Link
                            key={name}
                            className={relativePath === path ? "nav-link active" : "nav-link nonactive"}
                            to={path}
                            style={{ position: "relative" }}
                        >
                            {name}
                        </Link>
                    ))
                }
                <a className="nav-link nonactive" href="https://glkb.dcmb.med.umich.edu/api/docs" target="_blank" >API Doc</a>
                <a className="nav-link nonactive" href="https://jieliu6.github.io/" target="_blank">Contact Us</a>
            </div>
        </nav>
    );
}

export default NavBarWhite;
