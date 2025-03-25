import React, {useState} from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Auth.css";

// Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
import {signInWithEmailAndPassword} from 'firebase/auth'
import {auth, db} from '../firebase'

// Help from https://firebase.google.com/docs/firestore/quickstart
// And https://www.rowy.io/blog/firestore-timestamp
import { collection, serverTimestamp, getDoc, getDocs, query, where, limit } from "firebase/firestore"


function Login() {

  const navigate = useNavigate();

  // Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onLogin = (e) => {
    e.preventDefault()
    signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      navigate("/dashboard")
      alert("Log-in successful.")
      console.log(user)
    })
    .catch((error) => {
      const errorCode = error.code
      const errorMessage = error.message
      console.log(errorCode, errorMessage)
      //alert(error.code)
      // Help from https://firebase.google.com/docs/auth/admin/errors
      switch(error.code) {
        case ("auth/invalid-email"): {
          alert("Email is not valid.");
          break;
        }
        case ("auth/missing-password"): {
          alert("Please enter your password.");
          break;
        }
        case ("auth/invalid-credential"): {
          alert("Invalid email and/or password.");
          break;
        }
        default: {
          alert(error.code);
          break;
        }
      }
    })
  }

  return (
    <div className="login-container">
      
      <div className="login-card">
        {/* TeleShow Logo */}
        <div className="logo-container">
          <img src="/logo.png" alt="TeleShow Logo" className="logo" />
        </div>

        <form>
          <div>
        {/* Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/ */}
        <input 
        className="login-input" 
        type="text" 
        placeholder="Email" 
        id="email-address"
        name="email"
        onChange={(e)=>setEmail(e.target.value)}
        />

        <input 
        className="login-input" 
        type="password" 
        placeholder="Password" 
        id="password"
        name="password"
        onChange={(e)=>setPassword(e.target.value)}
        />

          </div>

          <button className="login-button primary" onClick={onLogin}>Login</button>

        </form>

        {/*<button className="login-button primary" onClick={() => navigate("/dashboard")}>
          Login
        </button>*/}
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
