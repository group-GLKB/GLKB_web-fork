import React from 'react';

import { Outlet } from 'react-router-dom';

import NavBarWhite from '../Units/NavBarWhite';

const AppLayout = () => (
    <>
        <NavBarWhite />
        <div className="app-layout-content">
            <Outlet />
        </div>
    </>
);

export default AppLayout;
