import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Auth.css";  // Reusing the same styles

// Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth, db } from '../firebase'

// Help from https://firebase.google.com/docs/firestore/quickstart
// And https://www.rowy.io/blog/firestore-timestamp
import { collection, addDoc, serverTimestamp } from "firebase/firestore"

function Signup() {

  const navigate = useNavigate();
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);

  // Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()

    let errorReport = ""

    /* Help from https://www.geeksforgeeks.org/how-to-perform-form-validation-in-react/ */

    if (!username.trim()) {
      errorReport += "Please provide a username.\n"
    } else if (username.length < 8) {
      errorReport += "Username should be at least eight characters long.\n"
    }

    if (!email.trim()) {
      errorReport += "Email is required\n"
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errorReport += "Email is invalid\n"
    }

    if (!password) {
      errorReport += "Please provide a password.\n"
    } 
    
    if (password.length < 8) {
      errorReport += "Password should be at least eight characters long.\n"
      // Help from https://www.w3schools.com/js/js_regexp.asp
    } 
    
    if (/\s/.test(password)) {
      errorReport += "No spaces allowed in passwords.\n";
    } 
    
    if (!/[a-z]/.test(password)) {
      errorReport += "Password must contain at least one lowercase character.\n";
    } 
    
    if (!/[A-Z]/.test(password)) {
      errorReport += "Password must contain at least one uppercase character.\n";
    } 
    
    if (!/[0-9]/.test(password)) {
      errorReport += "Password must contain a number.\n";
    } 
    
    if (password !== confirmPassword) {
      errorReport += "Passwords do not match.\n"
    }

    if (errorReport === "") {
      await createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user

        // Help from https://stackoverflow.com/questions/40389946/how-do-i-set-the-displayname-of-firebase-user
        // And https://firebase.google.com/docs/auth/web/manage-users
        updateProfile(auth.currentUser, {
          displayName: username,
          photoURL: "../../Logo.png" // Placeholder; this is for the profile picture
        })

        alert("Signup successful! Returning to the log-in screen to log in.")
        console.log(user)

        navigate("/")
      })
      .catch((error) => {
        const errorCode = error.code
        const errorMessage = error.message
        console.log(errorCode, errorMessage)
        //alert(error)

        // Help from https://stackoverflow.com/questions/31014919/create-custom-error-messages-for-firebase-authentication
        switch (error.code) {
          case ("auth/email-already-in-use"): {
            alert("The email you have entered is already in use.\n");
            break;
          }
          default: {
            alert(error.code);
            break;
          }
        }
      })
    } else {
      alert(errorReport)
    }
  }

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
        {/*<div className="profile-upload">
          <label htmlFor="profile-pic">
            {preview ? (
              <img src={preview} alt="Profile Preview" className="profile-preview" />
            ) : (
              <div className="upload-placeholder">Click to Upload</div>
            )}
          </label>
          <input type="file" id="profile-pic" accept="image/*" onChange={profilePicture} />
        </div>*/}

        <form>

        {/* User input fields */}
        {/* Help from https://www.geeksforgeeks.org/how-to-perform-form-validation-in-react/ */}
        <div>
          <input 
            className="login-input" 
            type="text" 
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div>
          <input 
            className="login-input" 
            type="email" 
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        
        <div>
          <input 
            className="login-input" 
            type="password" 
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)} 
          />
        </div>
        
        <div>
          <input 
            className="login-input" 
            type="password" 
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} 
          />
        </div>

        <button className="login-button secondary" type="submit" onClick={onSubmit}>Sign Up</button>

        </form>

        {/* Buttons */}
        {/*<button className="login-button primary" onClick={() => navigate("/dashboard")}>
          Sign Up
        </button>*/}
        <button className="login-button link" onClick={() => navigate("/login")}>
          Already have an account? Login
        </button>
        <button className="login-button" onClick={() => navigate("/")}>
          Return to Home Page
        </button>
      </div>
    </div>
  );
}

export default Signup;
