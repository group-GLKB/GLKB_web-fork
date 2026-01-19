import axios from 'axios';

const API_BASE_URL = '/api/v1/auth';
const EMAIL_AUTH_BASE_URL = '/api/v1/email-auth';

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

// ============ Email Verification Auth ============

// Send verification code to email (auto-registers new users)
export const sendVerificationCode = async (email) => {
  try {
    const response = await axios.post(`${EMAIL_AUTH_BASE_URL}/send-code`, {
      email
    });
    return {
      success: true,
      message: response.data.message,
      isNewUser: response.data.is_new_user,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.detail || 'Failed to send verification code. Please try again.'
    };
  }
};

// Verify code and get JWT token
export const verifyCode = async (email, code) => {
  try {
    const response = await axios.post(`${EMAIL_AUTH_BASE_URL}/verify`, {
      email,
      code
    });
    
    const { access_token, token_type, user } = response.data;
    
    // Store token in localStorage
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
      message: error.response?.data?.detail || 'Verification failed. Please check your code.'
    };
  }
};
