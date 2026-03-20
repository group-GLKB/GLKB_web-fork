import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import * as AuthService from '../../service/Auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing authentication on mount
  useEffect(() => {
    const initAuth = () => {
      const token = AuthService.getToken();
      const currentUser = AuthService.getCurrentUser();

      if (token && currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  // Login function
  // - Email-only mode: login(email) => send verification code
  // - Legacy mode: login(username, password) => password login
  const login = async (identifier, password) => {
    // Email login/signup in one flow
    if (!password) {
      const result = await AuthService.sendVerificationCode(identifier);
      return result;
    }

    // Legacy username/password login
    const result = await AuthService.login(identifier, password);

    if (result.success) {
      setUser(result.user);
      setIsAuthenticated(true);
    }

    return result;
  };

  // Signup function (legacy)
  const signup = async (username, email, password) => {
    const result = await AuthService.signup(username, email, password);
    return result;
  };

  // Send verification code (new email auth)
  const sendCode = async (email) => {
    const result = await AuthService.sendVerificationCode(email);
    return result;
  };

  // Verify code and login (new email auth)
  const verifyCode = async (email, code) => {
    const result = await AuthService.verifyCode(email, code);

    if (result.success) {
      setUser(result.user);
      setIsAuthenticated(true);
    }

    return result;
  };

  // Google login (ID token)
  const loginWithGoogle = async (credential) => {
    const result = await AuthService.loginWithGoogle(credential);

    if (result.success) {
      setUser(result.user);
      setIsAuthenticated(true);
    }

    return result;
  };

  // Logout function
  const logout = async () => {
    const result = await AuthService.logout();

    setUser(null);
    setIsAuthenticated(false);

    return result;
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    signup,
    sendCode,
    verifyCode,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
