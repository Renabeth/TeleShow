import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

// Oguzhan's code
import { getAuth, sendPasswordResetEmail } from "firebase/auth"; // Import Firebase functions

import "../styles/Auth.css";  // Reuse the same styles as Login/Signup

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  // Oguzhan's code
  const [message, setMessage] = useState(""); // For success/error messages
 
  const handleResetPassword = async () => {
    if (!email) {
      setMessage("Please enter your email.");
      return;
    }
 
    const auth = getAuth();
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset link sent! Check your email.");
    } catch (error) {
      setMessage("Error: " + error.message);
    }
  };

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

        {/* Oguzhan's code */}
        {/* Show Success/Error Message */}
        {message && <p className="message">{message}</p>}
 
        {/* Reset Password Button */}
        <button className="login-button primary" onClick={handleResetPassword}>
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
