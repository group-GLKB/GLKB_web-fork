import axios from 'axios';

const API_BASE_URL = '/api/v1/auth';

/**
 * Auth Service
 * Handles all authentication-related API calls
 */

// Sign up a new user
export const signup = async (username, email, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/signup`, {
      username,
      email,
      password
    });
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.detail || 'Signup failed. Please try again.'
    };
  }
};

// Login user and get JWT token
export const login = async (username, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/login`, {
      username,
      password
    });
    
    const { access_token, token_type, user } = response.data;
    
    // Store token in localStorage (or you can use sessionStorage)
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('token_type', token_type);
    localStorage.setItem('user', JSON.stringify(user));
    
    return {
      success: true,
      token: access_token,
      user: user
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.detail || 'Login failed. Please check your credentials.'
    };
  }
};

// Logout user
export const logout = async () => {
  try {
    await axios.post(`${API_BASE_URL}/logout`);
    
    // Clear stored token and user data
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('user');
    
    return {
      success: true,
      message: 'Logged out successfully'
    };
  } catch (error) {
    // Even if API call fails, clear local storage
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('user');
    
    return {
      success: true,
      message: 'Logged out'
    };
  }
};

// Get current user from localStorage
export const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    return null;
  }
};

// Get token from localStorage
export const getToken = () => {
  return localStorage.getItem('access_token');
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!getToken();
};
