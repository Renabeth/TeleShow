import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Auth.css";  // Reuse the same styles as Login/Signup

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  return (
    <div className="login-container">
      <div className="login-card">
        
        <div className="logo-container">
          <img src="/logo.png" alt="TeleShow Logo" className="logo" />
        </div>

        
        <h2 className="login-title">Reset Password</h2>

        
        <input
          className="login-input"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Reset Password Button (Functionality will be added with Firebase later) */}
        <button className="login-button primary">
          Send Reset Link
        </button>

        {/* Back to Login */}
        <button className="login-button link" onClick={() => navigate("/")}>
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default ForgotPassword;
