import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Auth.css";  // Reusing the same styles

function Signup() {
  const navigate = useNavigate();
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);

  // Image Selecting
  const profilePicture = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImage(file);

      // Generate image preview
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">

        {/* Logo */}
        <div className="logo-container">
          <img src="/logo.png" alt="TeleShow Logo" className="logo" />
        </div>

        {/* Profile Picture Upload */}
        <div className="profile-upload">
          <label htmlFor="profile-pic">
            {preview ? (
              <img src={preview} alt="Profile Preview" className="profile-preview" />
            ) : (
              <div className="upload-placeholder">Click to Upload</div>
            )}
          </label>
          <input type="file" id="profile-pic" accept="image/*" onChange={profilePicture} />
        </div>

        {/* User input fields */}
        <input className="login-input" type="text" placeholder="Username" />
        <input className="login-input" type="email" placeholder="Email" />
        <input className="login-input" type="password" placeholder="Password" />
        <input className="login-input" type="password" placeholder="Confirm Password" />

        {/* Buttons */}
        <button className="login-button primary" onClick={() => navigate("/dashboard")}>
          Sign Up
        </button>
        <button className="login-button link" onClick={() => navigate("/")}>
          Already have an account? Login
        </button>
      </div>
    </div>
  );
}

export default Signup;
