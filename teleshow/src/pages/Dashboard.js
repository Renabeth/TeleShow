import React from "react";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/"); // Go back to login after logging out
  };

  return (
    <div className="container">
      <h2>Dashboard in Progress Stay Tuned</h2>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default Dashboard;