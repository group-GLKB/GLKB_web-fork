import React from 'react';

import {
  Outlet,
  useLocation,
} from 'react-router-dom';

import NavBarWhite from '../Units/NavBarWhite';

const AppLayout = () => {
    const location = useLocation();
    const hideSidebar = location.pathname.startsWith('/account')
        || location.pathname.startsWith('/about');

    return (
        <>
            {!hideSidebar && <NavBarWhite />}
            <div className="app-layout-content">
                <Outlet />
            </div>
        </>
    );
};

export default AppLayout;
