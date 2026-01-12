import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './scoped.css';
import NavBarWhite from '../../Units/NavBarWhite';
import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleContinue = () => {
    if (email.trim()) {
      setShowPasswordInput(true);
    } // .trim() to remove leading/trailing spaces
  };

  const handleGoogleLogin = () => {
    // TODO: Implement Google OAuth
    console.log('Google login clicked');
  };

  const handleAppleLogin = () => {
    // TODO: Implement Apple OAuth
    console.log('Apple login clicked');
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  const handleClose = () => {
    navigate('/');
  };

  return (
    <>
      <NavBarWhite />
      <div className="login-page-container">
        <div className="login-modal">
          <div className="login-logo">
            <img src="/GLKB_login_logo.jpg" alt="GLKB Logo" />
          </div>
          
          <h2 className="login-title">Please log in to unlock more features of GLKB</h2>
          
          <button className="oauth-button google-button" onClick={handleGoogleLogin}>
            <span className="oauth-icon"><FcGoogle size={30} /></span>
            Continue with Google
          </button>
          
          <button className="oauth-button apple-button" onClick={handleAppleLogin}>
            <span className="oauth-icon"><FaApple size={30} /></span>
            Continue with Apple
          </button>
          
          <div className="divider">
            <span>OR</span>
          </div>
          
          {!showPasswordInput ? (
            <>
              <input
                type="text"
                className="login-input"
                placeholder="Email address or phone number"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleContinue()}
              />
              
              <button 
                className="continue-button"
                onClick={handleContinue}
                disabled={!email.trim()} // button disabled if email is empty
              >
                Continue
              </button>
            </>
          ) : (
            <form onSubmit={handleEmailLogin}>
              <input
                type="text"
                className="login-input"
                placeholder="Email address or phone number"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password" // changed to password type for security (asterisks)
                className="login-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              
              <div className="forgot-password-link">
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
              
              {error && <div className="error-message">{error}</div>}
              
              <button 
                type="submit"
                className="continue-button"
                disabled={loading || !password.trim()} // button disabled if password is empty
              >
                {loading ? 'Logging in...' : 'Log in'}
              </button>
            </form>
          )}
          
          <div className="signup-link">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </div>
          
          <button className="close-button" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
