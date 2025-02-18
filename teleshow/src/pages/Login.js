import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";


function Login() {
  const navigate = useNavigate();

  return (
    <div className="login-container">
      <div className="login-card">
        {/* TeleShow Logo */}
        <div className="logo-container">
          <img src="/logo.png" alt="TeleShow Logo" className="logo" />
        </div>

        <input className="login-input" type="text" placeholder="Username" />
        <input className="login-input" type="password" placeholder="Password" />

        <button className="login-button primary" onClick={() => navigate("/dashboard")}>
          Login
        </button>
        <button className="login-button secondary" onClick={() => navigate("/signup")}>
          Sign Up
        </button>
        <button className="login-button link" onClick={() => navigate("/forgot-password")}>
          Forgot Password?
        </button>
      </div>
    </div>
  );
}

export default Login;
