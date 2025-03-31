//Written by Moses Pierre
import React, { useState, useEffect } from "react";
import { Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import axiosRetry from "axios-retry";
import MediaSlides from "../components/MediaSlides.js";
import SearchWidget from "../components/SearchWidget.js";
import "../styles/Home.css";

function HomePage() {
  axiosRetry(axios, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
  });
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [popularTV, setPopularTV] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [autoplay, setAutoPlay] = useState(true);
  const navigate = useNavigate();
  //Make the Title the focus when the user gets to the landing page.
  useEffect(() => {
    const element = document.getElementById("homepage-title");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    // Checks if the user is logged in
    const userId = sessionStorage.getItem("userId");
    if (userId) {
      setIsLoggedIn(true);
    }
    fetchTrendingContent();
  }, []);

  const fetchTrendingContent = async () => {
    try {
      setLoading(true);

      const response = await axios.get("http://localhost:5000/trending");
      setTrendingMovies(response.data.movies);
      setPopularTV(response.data.tv);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching trending content:", error);
      setLoading(false);
    }
  };

  const handleMouseEnter = () => {
    setAutoPlay(false);
  };

  const handleMouseLeave = () => {
    setAutoPlay(true);
  };

  const handleLogin = () => navigate("/login");
  const handleSignup = () => navigate("/signup");

  return (
    <div className="home-page">
      <div className="hero-section">
        <div className="hero-content">
          <h1 id="homepage-title">
            Explore Stories That Captivate and Inspire{" "}
          </h1>
          <div className="search-widget-container">
            <SearchWidget />
          </div>
          {!isLoggedIn ? (
            <div className="user-buttons">
              <button className="btn-login" onClick={handleLogin}>
                Log in
              </button>
              <button className="btn-signup" onClick={handleSignup}>
                Sign Up
              </button>
            </div>
          ) : (
            <button
              className="dashboard-btn"
              onClick={() => navigate("/dashboard")}
            >
              Dashboard
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div className="loading-spinner">
          <Spinner animation="border" variant="primary" />
          <span> Finding Trending Titles...</span>
        </div>
      ) : (
        <div
          className="media-container"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <section className="trending-section">
            <h2>Trending Movies</h2>
            <MediaSlides items={trendingMovies} autoplay={autoplay} />
          </section>
          <section className="popular-section">
            <h2>Popular TV</h2>
            <MediaSlides items={popularTV} autoplay={autoplay} />
          </section>
        </div>
      )}
    </div>
  );
}

export default HomePage;
