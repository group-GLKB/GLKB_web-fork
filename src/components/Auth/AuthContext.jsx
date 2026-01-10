import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const login = async (username, password) => {
    const result = await AuthService.login(username, password);
    
    if (result.success) {
      setUser(result.user);
      setIsAuthenticated(true);
    }
    
    return result;
  };

  // Signup function
  const signup = async (username, email, password) => {
    const result = await AuthService.signup(username, email, password);
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
