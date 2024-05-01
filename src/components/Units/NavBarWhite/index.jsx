import React from 'react';
import { Link } from 'react-router-dom';
import './scoped.css'; // This is where you will import your CSS from
import logo_l from '../../../img/blue_1.svg'

function NavBarWhite() {
    return (
        <nav className="navigation-bar">
            <div className="logo" >
                <Link to="/">
                    <img src={logo_l} alt="Logo" style={{width: '80px', height: 'auto'}}/>
                </Link>
                {/* <a>Genomic Literature Knowledge Base</a> */}
            </div>
            <div className="nav-links">
                {/* These links will be aligned to the right */}
                <a href="https://www.google.com" target="_blank" >About</a>
                <a href="https://www.google.com" target="_blank" >API Doc</a>
                <a href="https://www.google.com" target="_blank" >Contact Us</a>
            </div>
        </nav>
    );
}

export default NavBarWhite;