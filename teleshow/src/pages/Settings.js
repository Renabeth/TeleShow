import React, { useState, useEffect } from "react";
import PlatformFilter, {
  updateSelectedPlatforms,
} from "../components/PlatformFilter";
import { useNavigate } from "react-router-dom";
import Button from "react-bootstrap/Button";
import "../styles/Settings.css";
import axios from "axios";
import MediaSlides from "../components/MediaSlides.js";
import { FaSyncAlt } from "react-icons/fa";

function Settings() {
  const [userId, setUserID] = useState(() => {
    if (sessionStorage.getItem("userId")) {
      return sessionStorage.getItem("userId");
    } else {
      return "";
    }
  });
  const host = process.env.REACT_APP_NETWORK_HOST;
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    let check = sessionStorage.getItem("userId") ? true : false;
    return check;
  });
  const [autoplay, setAutoPlay] = useState(true);
  const [hasFollowed, setHasFollowed] = useState(false);
  const [followedMedia, setFollowedMedia] = useState({});
  const [loading, setLoading] = useState(false);
  const STORAGE_KEY = "platform_selection";
  const [selectedPlatforms, setSelectedPlatforms] = useState(() => {
    const savedPlatforms = sessionStorage.getItem(STORAGE_KEY);
    if (savedPlatforms) {
      try {
        return JSON.parse(savedPlatforms);
      } catch (err) {
        console.error("Error parsing saved platforms:", err);
        return ["all"]; // Default if error
      }
    }
    return ["all"]; // Default filter
  });
  const nav = useNavigate();

  useEffect(() => {
    fetchFollowed();
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selectedPlatforms));
  }, [selectedPlatforms]);

  const fetchFollowed = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${host}interactions/get_followed`, {
        params: {
          user_id: userId,
        },
      });

      if (
        response.data.followed_movies.length > 0 ||
        response.data.followed_tv.length > 0
      ) {
        setHasFollowed(true);
        setFollowedMedia(response.data);
      }
    } catch (err) {
      console.error("Error fetching followed: ", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle platform selection changes
  const handlePlatformChange = (platform) => {
    setSelectedPlatforms((prev) => updateSelectedPlatforms(platform, prev));
  };

  const handleMouseEnter = () => {
    setAutoPlay(false);
  };

  const handleMouseLeave = () => {
    setAutoPlay(true);
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-section">
        <h2>Streaming Platforms</h2>
        <p>Select the streaming platforms you have access to:</p>
        {isLoggedIn && (
          <PlatformFilter
            selectedPlatforms={selectedPlatforms}
            onPlatformChange={handlePlatformChange}
          />
        )}
        <div className="settings-info">
          <p>
            Your recommendations will be filtered to only show content available
            on these platforms.
          </p>
        </div>
      </div>

      {isLoggedIn && (
        <div className="settings-section followed-media-section">
          <h2>Your Followed Media</h2>

          {hasFollowed ? (
            <div
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="d-flex justify-content-between align-items-center mb-4">
                <Button variant="outline-primary" onClick={fetchFollowed}>
                  <FaSyncAlt className={loading ? "spin-icon" : ""} /> Refresh
                </Button>
              </div>
              {followedMedia.followed_movies &&
                followedMedia.followed_movies.length > 0 && (
                  <>
                    <h3>Movies</h3>
                    <MediaSlides
                      items={followedMedia.followed_movies.map((movie) => ({
                        id: movie.media_id,
                        title: movie.title,
                        poster_path: movie.poster_path,
                        media_type: "movie",
                        release_date: movie.release_date,
                      }))}
                      autoplay={autoplay}
                      loading={loading}
                    />
                  </>
                )}

              {followedMedia.followed_tv &&
                followedMedia.followed_tv.length > 0 && (
                  <>
                    <h3>TV Shows</h3>
                    <MediaSlides
                      items={followedMedia.followed_tv.map((show) => ({
                        id: show.media_id,
                        name: show.title,
                        poster_path: show.poster_path,
                        media_type: "tv",
                        release_date: show.release_date,
                      }))}
                      autoplay={autoplay}
                      loading={loading}
                    />
                  </>
                )}
            </div>
          ) : (
            <div className="no-followed-media">
              <p>
                <strong>No followed media: </strong>
                Explore and interact with Teleshow library to get personalized
                recommendations.
              </p>
            </div>
          )}
        </div>
      )}

      <Button
        onClick={() => nav("/dashboard")}
        className="save-settings-btn"
        variant="primary"
      >
        Save Settings and Return to Dashboard
      </Button>
    </div>
  );
}

export default Settings;
