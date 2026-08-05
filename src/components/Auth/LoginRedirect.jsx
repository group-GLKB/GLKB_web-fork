import { useEffect } from 'react';

import { Navigate } from 'react-router-dom';

import { useAuth } from './AuthContext';

/**
 * `/login` is no longer a page. Anyone landing on it (bookmark, old link,
 * ProtectedRoute redirect) gets sent home with the sign-in overlay opened.
 */
const LoginRedirect = () => {
    const { isAuthenticated, openLoginModal } = useAuth();

    useEffect(() => {
        if (!isAuthenticated) {
            openLoginModal();
        }
    }, [isAuthenticated, openLoginModal]);

    return <Navigate to="/" replace />;
};

export default LoginRedirect;
