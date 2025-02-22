import React from "react";

// Help from https://www.w3schools.com/react/showreact.asp?filename=demo2_react_conditionals_if
import ReactDOM from 'react-dom/client'

import { useNavigate } from "react-router-dom";

// Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
import { useState, useEffect, useRef } from 'react'
import { onAuthStateChanged, signOut } from "firebase/auth"
import { auth } from '../firebase'

function Dashboard() {
  // Help from https://stackoverflow.com/questions/76990183/how-to-display-the-current-user-display-name-in-firebase-using-react
  //const displayName = useRef(auth?.currentUser?.displayName || "Loading...")
  
  // Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        const uid = user.uid;
        console.log(user)
        console.log(user.displayName)
        console.log("uid", uid)
        console.log("You appear to be signed in.")
      } else {
        console.log("You appear to be signed out.")
      }
    })
  })

  const navigate = useNavigate();

  const handleLogout = () => {

    // Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
    signOut(auth).then(() => {
      navigate("/"); // Go back to login after logging out
      alert("You have logged out successfully.")
    }).catch((error) => {
      alert(error)
    })

  };

  return (
    <div className="container">
      <h2>Dashboard in Progress Stay Tuned</h2>

      {/* Help from https://stackoverflow.com/questions/76990183/how-to-display-the-current-user-display-name-in-firebase-using-react */}
      <p>Welcome, !</p>

      <button onClick={handleLogout}>Logout</button>
      <div className="dashboard">

      </div>
    </div>
  );
}

export default Dashboard;