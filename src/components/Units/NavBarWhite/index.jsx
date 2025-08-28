import '../../NavBar/scoped.css';
import './scoped.css';

import React from 'react';

import {
    Link,
    useLocation,
    useNavigate,
} from 'react-router-dom';

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
    Box,
    Stack,
} from '@mui/material';
import Tooltip from '@mui/material/Tooltip';

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
                        className={relativePath === path ? "nav-link active" : "nav-link nonactive"}
                        to={path}
                        style={{ position: "relative" }}
                    >
                        {name}
                    </Link>
                ))}
                <Tooltip
                    title={
                        <Stack>
                            <a className="nav-link nonactive" href="/about" >About</a>
                            <a className="nav-link nonactive" href="https://glkb.dcmb.med.umich.edu/api/docs" target="_blank" >API Doc</a>
                        </Stack>
                    }
                    leaveDelay={200}
                    slotProps={{
                        "tooltip": {
                            sx: {
                                Width: "100px",
                                paddingBottom: "1rem",
                                Height: "auto",
                                backgroundColor: "white",
                                boxShadow: "0px 0px 4px 0px #00000040",
                                borderRadius: "5px",
                            }
                        }
                    }
                    }
                >
                    <Link
                        key={"More"}
                        className={"nav-link nonactive"}
                        style={{ position: "relative", alignItems: "center", display: "flex" }}
                    >
                        More&nbsp;&nbsp;<KeyboardArrowDownIcon fontSize="10px" />
                    </Link>
                </Tooltip>
                <Link to={"https://jieliu6.github.io/"} target='_blank'>
                    <Box className="nav-link contact" >Contact</Box>
                </Link>
            </div>
        </nav>
    );
}

export default NavBarWhite;
