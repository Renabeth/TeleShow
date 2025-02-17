import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleResetPassword = () => {
    alert(`Password reset link sent to ${email}`);
    navigate("/");
  };

  return (
    <div className="container">
      <h2>Forgot Password</h2>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={handleResetPassword}>Reset Password</button>
      <br />
      <button onClick={() => navigate("/")}>Back to Login</button>
    </div>
  );
}

export default ForgotPassword;
