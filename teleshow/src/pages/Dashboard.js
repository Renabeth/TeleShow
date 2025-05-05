import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Navbar,
  Nav,
  Button,
  Spinner,
  ToggleButtonGroup,
  ToggleButton,
} from "react-bootstrap";
import {
  FaSun,
  FaMoon,
  FaBars,
  FaTimes,
  FaRegUserCircle,
} from "react-icons/fa";
import "../styles/Dashboard.css";
import SearchWidget from "../components/SearchWidget";
import MediaSlides from "../components/MediaSlides.js";
import MediaCalendar from "../components/MediaCalendar.js";
import UserStatsWidget from "../components/UserStatsWidget";
// Credit to JustWatch as TMDB API watch providers data source
import { redirect, useNavigate } from "react-router-dom";
// Help from https://developer.themoviedb.org/reference/trending-movies
import axios from "axios";
// Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";

// Help from https://www.youtube.com/watch?v=91LWShFZn40

function Dashboard() {
  // "Setters" for user information -WA
  const [userID, setUserID] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const host = process.env.REACT_APP_NETWORK_HOST;
  const [lightMode, setLightMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const STORAGE_KEY = "platform_selection";
  //enables user filters
  //Attempts to get value from session variable
  const [selectedPlatforms, setSelectedPlatforms] = useState(() => {
    const savedPlatforms = sessionStorage.getItem(STORAGE_KEY);
    if (savedPlatforms) {
      try {
        return JSON.parse(savedPlatforms);
      } catch (err) {
        console.error("Error parsing saved platforms:", err);
      }
    }
    return ["all"]; // Default filter
  });
  const beingFiltered = selectedPlatforms.includes("all") ? false : true;

  // Help from https://www.rowy.io/blog/firestore-react-query
  const [tvLoading, setTvLoading] = useState(false);
  const [movieLoading, setMovieLoading] = useState(false);
  const [recommendedTv, setRecommendedTv] = useState([]);
  const [recommendedMovies, setRecommendedMovies] = useState([]);
  const [autoplay, setAutoPlay] = useState(true);
  useEffect(() => {
    if (isLoggedIn && userID) {
      getRecommendations();
    }
  }, [selectedPlatforms, isLoggedIn, userID]);

  const getRecommendations = async () => {
    setTvLoading(true);
    setMovieLoading(true);
    const platforms = selectedPlatforms.includes("all")
      ? "all"
      : selectedPlatforms.join(",");
    const user_id = sessionStorage.getItem("userId");
    // Worked with Moses on this -William
    const response = await axios.get(`${host}user-recommendations`, {
      params: {
        user_id,
        platforms,
      },
    });

    console.log(response.data);

    const movies = randomizeRecs(response.data.movie_recs, 10);
    const tv = randomizeRecs(response.data.tv_recs, 10);

    setRecommendedMovies(movies);
    setRecommendedTv(tv);

    setTvLoading(false);
    setMovieLoading(false);
  };

  const randomizeRecs = (items, count) => {
    if (!items || items.length <= count) return items;

    //Shuffle recommendations
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Help from https://www.geeksforgeeks.org/how-to-create-dark-light-theme-in-bootstrap-with-react/

  // Help from https://developer.themoviedb.org/docs/image-basics

  // Help from https://react-bootstrap.netlify.app/docs/components/modal/

  // Help from https://www.geeksforgeeks.org/using-the-useref-hook-to-change-an-elements-style-in-react/#

  // Help from https://react-bootstrap.netlify.app/docs/components/modal/

  // Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uid = user.uid;
        console.log("uid", uid);
        setIsLoggedIn(true);
        setDisplayName(user.displayName);
        sessionStorage.setItem("userName", user.displayName);
        setUserID(uid);

        // Check if we already initialized for this user
        const currentInitialized = sessionStorage.getItem(
          "listenersInitialized"
        );
        if (currentInitialized !== uid) {
          // Initialize only if not done already for this user
          await initializeFirebase(uid);
        }
      } else {
        console.log("You appear to be signed out.");
        setIsLoggedIn(false);
        setUserID("");
        sessionStorage.removeItem("listenersInitialized");
      }
    });
  }, []);

  const initializeFirebase = async (user_id) => {
    if (isInitializing) return;
    try {
      setIsInitializing(true);
      const response = await axios.post(
        `${host}interactions/initialize-listeners`,
        {
          user_id,
        }
      );
      if (response.data.status === "success") {
        console.log("Initalized listeners");
        sessionStorage.setItem("listenersInitialized", userID);
      }
    } catch (err) {
      console.log(`Error inialiazing listeners ${err}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const shutdownFirebase = async (user_id) => {
    try {
      const response = await axios.post(`${host}interactions/stop-listeners`, {
        user_id,
      });
      if (response.data.status === "success") {
        console.log("Stopped listeners");
      }
    } catch (err) {
      console.log(`Error inialiazing listeners ${err}`);
    }
  };

  const navigate = useNavigate();

  const handleLogout = () => {
    // Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
    signOut(auth)
      .then(() => {
        shutdownFirebase(userID);
        sessionStorage.removeItem("userId");
        sessionStorage.removeItem("userName");
        sessionStorage.removeItem("listenersInitialized");
        navigate("/"); // Go back to login after logging out
        alert("You have logged out successfully.");
      })
      .catch((error) => {
        alert(error);
      });
  };
  const handleMouseEnter = () => {
    setAutoPlay(false);
  };

  const handleMouseLeave = () => {
    setAutoPlay(true);
  };

  return (
    <div className={`dashboard ${lightMode ? "light" : ""}`} id="dashboard">
      <h2>Dashboard</h2>
      <Navbar expand="lg" className="dashboard-header">
        <Button
          variant="link"
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <FaTimes /> : <FaBars />}
        </Button>
        <Navbar.Brand>Teleshow</Navbar.Brand>
        <Nav className="ms-auto align-items-center">
          <FaRegUserCircle
            style={{
              fontSize: "35px",
              cursor: "pointer",
              float: "left",
              marginRight: "10px",
            }}
            onClick={() =>
              alert(
                "Profile functionality has not yet been fully implemented. We thank you for your patience."
              )
            }
          />

          <span className="me-3">Hello, {displayName || "Guest"}</span>
          <ToggleButtonGroup
            type="radio"
            name="theme"
            value={lightMode ? "light" : "dark"}
            onChange={(val) => setLightMode(val === "light")}
          >
            <ToggleButton id="tgl-dark" value="dark" variant="outline-light">
              <FaMoon />
            </ToggleButton>
            <ToggleButton id="tgl-light" value="light" variant="outline-light">
              <FaSun />
            </ToggleButton>
          </ToggleButtonGroup>
        </Nav>
      </Navbar>
      {/*Container will take 100% of viewport when using fluid*/}
      <Container fluid className="dashboard-body">
        <Row>
          {/* Sidebar */}
          {sidebarOpen && (
            <Col xs={12} md={2} className="dashboard-sidebar">
              <Nav className="flex-column">
                <Nav.Link onClick={() => navigate("/")}>Home</Nav.Link>
                {showCalendar ? (
                  <Nav.Link onClick={() => setShowCalendar(false)}>
                    Dashboard
                  </Nav.Link>
                ) : (
                  <Nav.Link onClick={() => setShowCalendar(true)}>
                    Media Calendar
                  </Nav.Link>
                )}
                <Nav.Link onClick={() => navigate("/watchlist")}>
                  Watchlist
                </Nav.Link>

                <Nav.Link onClick={() => navigate("/settings")}>
                  Settings
                </Nav.Link>
                <Nav.Link onClick={() => setShowStats(!showStats)}>
                  {showStats ? "Hide Stats" : "View Stats"}
                </Nav.Link>
                <Nav.Link onClick={handleLogout}>Logout</Nav.Link>
              </Nav>
            </Col>
          )}

          {/* Main Content */}
          <Col xs={12} md={sidebarOpen ? 10 : 12} className="dashboard-content">
            <SearchWidget />
            {!showCalendar ? (
              <>
                {showStats && (
                  <section className="stats-section">
                    <UserStatsWidget userId={userID} />
                  </section>
                )}
                <section
                  className="recommendation-section"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <h2>{`Recommended Movies ${
                    beingFiltered ? "(Filtered) " : " "
                  }:`}</h2>
                  <MediaSlides
                    items={recommendedMovies}
                    autoplay={autoplay}
                    loading={movieLoading}
                  />
                </section>

                <section
                  className="recommendation-section"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <h2>{`Recommended TV: ${
                    beingFiltered ? "(Filtered) " : " "
                  }`}</h2>

                  <MediaSlides
                    items={recommendedTv}
                    autoplay={autoplay}
                    loading={tvLoading}
                  />
                </section>
              </>
            ) : (
              <section className="calendar-section full-width">
                <h2>Your Media Calendar</h2>
                <MediaCalendar isLoggedIn={isLoggedIn} />
              </section>
            )}
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Dashboard;

/*

Other Resources used/referred to:
- https://www.freecodecamp.org/news/javascript-fetch-api-for-beginners/
- https://www.geeksforgeeks.org/how-to-keep-a-mutable-variable-in-react-useref-hook/
- https://www.w3schools.com/react/react_render.asp
- https://stackoverflow.com/questions/76990183/how-to-display-the-current-user-display-name-in-firebase-using-react
- https://www.geeksforgeeks.org/writing-and-reading-data-in-cloud-firestore/
- https://www.rowy.io/blog/firestore-react-query
- https://stackoverflow.com/questions/49873223/why-does-my-firebase-onauthstatechanged-trigger-multiple-times-react-native
- https://cloud.google.com/blog/products/databases/aggregate-with-sum-and-avg-in-firestore
- https://nithinkvarrier.medium.com/sum-and-average-in-firestore-leverage-getaggregatefromserver-in-the-latest-update-november-2023-06fd10f92347
- https://firebase.google.com/docs/firestore/query-data/indexing 
- https://www.geeksforgeeks.org/using-the-useref-hook-to-change-an-elements-style-in-react/#

- https://stackoverflow.com/questions/29810914/react-js-onclick-cant-pass-value-to-method
- https://upmostly.com/tutorials/pass-a-parameter-through-onclick-in-react

*/
