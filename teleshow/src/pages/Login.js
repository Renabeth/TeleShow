import React from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  return (
    <div className="d-flex vh-100 justify-content-center align-items-center bg-light">
      <div className="card shadow p-4" style={{ width: "400px" }}>
        <h2 className="text-center mb-4">Login</h2>

        <input className="form-control mb-3" type="text" placeholder="Username" />
        <input className="form-control mb-3" type="password" placeholder="Password" />

        <button className="btn btn-primary w-100 mb-2" onClick={() => navigate("/dashboard")}>
          Login
        </button>
        <button className="btn btn-link w-100" onClick={() => navigate("/forgot-password")}>
          Forgot Password?
        </button>
        <button className="btn btn-secondary w-100" onClick={() => navigate("/signup")}>
          Sign Up
        </button>
      </div>
    </div>
  );
}

export default Login;
