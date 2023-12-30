// NavBar.js

import React from 'react';
import './scoped.css'; // Make sure to import the CSS file
import MedSchoolLogo from '../../img/MedSchoolLogo.png'

const NavBar = () => {
    return (
        <nav className="navbar">
            <div className="navbar-container">
                <div className="logo">
                    <a href="/">
                        <img src={MedSchoolLogo} alt="MedSchoolLogo" />
                    </a>
                </div>
                <div className="logo">
                    <a href="/">Home</a>
                </div>
                <div className="logo">
                    <a href="https://glkb.dcmb.med.umich.edu/docs" target="_blank">API Doc</a>
                </div>

                <div className="search-bar">
                    <input type="text" placeholder="Search..." />
                    <button type="submit">Search</button>
                </div>
                {/* Add more navbar items here if needed */}
            </div>
        </nav>
    );
};

export default NavBar;
