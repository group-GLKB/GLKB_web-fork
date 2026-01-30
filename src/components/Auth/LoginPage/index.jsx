import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './scoped.css';
import NavBarWhite from '../../Units/NavBarWhite';
import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { sendCode } = useAuth();

  const handleGoogleLogin = () => {
    // TODO: Implement Google OAuth
    console.log('Google login clicked');
  };

  const handleAppleLogin = () => {
    // TODO: Implement Apple OAuth
    console.log('Apple login clicked');
  };

  const handleContinue = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await sendCode(email);

    if (result.success) {
      // Navigate to verification page with email
      navigate('/verify-code', { state: { email } });
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
          <h2 className="login-title">Sign in below to unlock the full potential of GLKB</h2>
          
          <p className="login-subtitle">New to GLKB? An account will be <strong>automatically created</strong> for you upon your first sign-in.</p>
          
          <button className="oauth-button google-button" onClick={handleGoogleLogin}>
            <span className="oauth-icon"><FcGoogle size={24} /></span>
            Continue with Google
          </button>
          
          <button className="oauth-button apple-button" onClick={handleAppleLogin}>
            <span className="oauth-icon"><FaApple size={24} /></span>
            Continue with Apple
          </button>
          
          <div className="divider">
            <span>OR</span>
          </div>
          
          <form onSubmit={handleContinue}>
            <input
              type="email"
              className="login-input"
              placeholder="sarah@yahoo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            
            {error && <div className="error-message">{error}</div>}
            
            <button 
              type="submit"
              className="continue-button"
              disabled={loading || !email.trim()}
            >
              {loading ? 'Sending...' : 'Continue'}
            </button>
          </form>
          
          <div className="sso-text">
            Single sign-on (SSO)
          </div>
          
          <div className="privacy-text">
            By clicking continuing, you agree to our <a href="/privacy-policy">privacy policy</a>.
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
