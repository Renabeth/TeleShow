//Written by Moses Pierre
import React, { useState, useEffect } from "react";
import { Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import axiosRetry from "axios-retry";
import MediaSlides from "../components/MediaSlides.js";
import SearchWidget from "../components/SearchWidget.js";
import "../styles/Home.css";
import LZString from "lz-string";

function HomePage() {
  //Allow requests to retry after failure.
  axiosRetry(axios, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
  });
  const TREND_TTL = 24 * 60 * 60 * 1000;
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [popularTV, setPopularTV] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    let check = sessionStorage.getItem("userId") ? true : false;
    return check;
  });
  const [autoplay, setAutoPlay] = useState(true);
  const host = process.env.REACT_APP_NETWORK_HOST;
  const navigate = useNavigate();
  //Make the Title the focus when the user gets to the landing page.
  useEffect(() => {
    const element = document.getElementById("homepage-title");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    fetchTrendingContent();
  }, []);

  const fetchTrendingContent = async () => {
    try {
      setLoading(true);
      const TREND_CACHE_KEY = "todays-trending";
      const cache = localStorage.getItem(TREND_CACHE_KEY);

      if (cache) {
        const { compressed, data, timestamp } = JSON.parse(cache);
        if (Date.now() - timestamp < TREND_TTL) {
          const decompressed = compressed
            ? JSON.parse(LZString.decompress(data))
            : JSON.parse(data);
          setTrendingMovies(decompressed.movies);
          setPopularTV(decompressed.tv);
          console.log("Trending cache hit");
          setLoading(false);
          return;
        }
      } else {
        sessionStorage.removeItem(TREND_CACHE_KEY);
      }

      const response = await axios.get(`${host}trending`);
      if (response.data.movies && response.data.tv) {
        localStorage.setItem(
          TREND_CACHE_KEY,
          JSON.stringify({
            compressed: true,
            data: LZString.compress(JSON.stringify(response.data)),
            timestamp: Date.now(),
          })
        );
      }
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
          <div className="search-widget-container">
            <SearchWidget />
          </div>
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
