import React from 'react';
import { Link } from 'react-router-dom';
import './scoped.css'; // This is where you will import your CSS from
import logo_l from '../../../img/glkb_logo.png'

function NavBarWhite() {
    return (
        <nav className="navigation-bar">
            <div className="logo" >
                <Link to="/">
                    <img src={logo_l} alt="Logo" style={{width: 'auto', height: '40px'}}/>
                </Link>
                {/* <a>Genomic Literature Knowledge Base</a> */}
            </div>
            <div className="nav-links">
                {/* These links will be aligned to the right */}
                <a href="https://www.google.com" target="_blank" >About</a>
                <a href="https://glkb.dcmb.med.umich.edu/api/docs" target="_blank" >API Doc</a>
                <a href="mailto:hyhao@umich.edu">Contact Us</a>
            </div>
        </nav>
    );
}

export default NavBarWhite;