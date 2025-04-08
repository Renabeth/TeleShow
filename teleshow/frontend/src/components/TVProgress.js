//Written by Moses Pierre
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Modal,
  Button,
  Tabs,
  Tab,
  ProgressBar,
  Badge,
  ListGroup,
  Alert,
  ModalFooter,
} from "react-bootstrap";
import { FaCheckCircle, FaRegCircle } from "react-icons/fa";
import "./TVProgress.css";

const TVProgress = ({ tvId, tvName, isOpen, onClose, isLoggedIn }) => {
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSeasonNumber, setActiveSeasonNumber] = useState(1);
  const [userProgress, setUserProgress] = useState({});
  const host = process.env.REACT_APP_NETWORK_HOST;

  const userId = sessionStorage.getItem("userId");
  const image_url = "https://image.tmdb.org/t/p/w342";

  useEffect(() => {
    if (tvId && isOpen) {
      setLoading(true);
      setError(null);
      fetchSeasonData();
      console.log("hi");

      if (isLoggedIn && userId) {
        fetchProgress();
      }
    }
  }, [tvId, isOpen, isLoggedIn, userId]);

  //Gets the season number and episodes
  const fetchSeasonData = () => {
    setLoading(true);
    axios
      .get(`${host}tv/seasons`, {
        params: { id: tvId },
      })
      .then((seasonsResponse) => {
        if (
          !seasonsResponse.data.seasons ||
          seasonsResponse.data.seasons.length === 0
        ) {
          console.log("No Seasons Found");
          setLoading(false);
          return;
        }
        const seasonData = seasonsResponse.data.seasons;
        setSeasons(seasonData);
        const firstSeason =
          seasonData.find((s) => s.season_number === 1) ||
          seasonsResponse.data.seasons[0];
        setActiveSeasonNumber(firstSeason.season_number);

        const episodeResponse = seasonData.map((season) =>
          axios
            .get(`${host}tv/seasons/episodes`, {
              params: {
                id: tvId,
                season_number: season.season_number,
              },
            })
            .then((response) => ({
              seasonNumber: season.season_number,
              episodes: response.data.episodes || [],
            }))
        );

        return Promise.all(episodeResponse);
      })
      .then((seasonEpisodes) => {
        const episodesBySeason = {};
        seasonEpisodes.forEach((item) => {
          episodesBySeason[item.seasonNumber] = item.episodes;
        });
        setEpisodes(episodesBySeason);
      })
      .catch((err) => {
        console.error("Error fetching TV Data:", err);
        setError("Failed to load TV Data. Please try again");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  //Gets user progress from firestore
  const fetchProgress = async () => {
    try {
      const response = await axios.get(
        `${host}interactions/tv/get-episode-progress`,
        {
          params: {
            user_id: userId,
            tv_id: tvId,
          },
        }
      );

      if (response.data.progress) {
        setUserProgress(response.data.progress);
      }
    } catch (err) {
      console.error("Error fetching user progress:", err);
    }
  };

  //Marks episode as watched in firestore
  const markEpisodeWatched = async (
    seasonNumber,
    episodeNumber,
    watched = true
  ) => {
    if (!isLoggedIn || !userId) {
      alert("Please log in to track your progress");
      return;
    }

    try {
      const response = await axios.post(
        `${host}interactions/tv/set-episode-progress`,
        {
          user_id: userId,
          tv_id: tvId,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          watched: watched,
        }
      );
      //Update local progress
      if (response.data.status === "success") {
        fetchProgress();
      }
    } catch (err) {
      console.error("Error updating episode progress:", err);
      alert("Failed to update your progress. Please try again.");
    }
  };

  //Checks if episode is watched on firestore
  const isEpisodeWatched = (seasonNumber, episodeNumber) => {
    const seasons = userProgress?.seasons || {};
    const season = seasons[seasonNumber];
    if (!season) return false;

    const episodes = season.episodes || {};
    const episode = episodes[episodeNumber];
    return episode?.watched || false;
  };

  //Calculates the season progress by taking the number of episodes in season and filtering the episodes marked as watched
  //Returns result for progressbar to register
  const calculateSeasonProgress = (seasonNumber) => {
    const episodesForSeason = episodes[seasonNumber] || [];
    if (episodesForSeason.length === 0) return 0;

    const seasons = userProgress?.seasons || {};
    const season = seasons[seasonNumber];
    if (!season || !season.episodes) return 0;

    console.log("Episodes:", episodes);
    console.log("User Progress:", userProgress);
    //Pulls the object values from season
    //Filters where the episodes watched property is true
    const watchedCount = Object.values(season.episodes).filter(
      (ep) => ep.watched
    ).length;
    return Math.round((watchedCount / episodesForSeason.length) * 100);
  };

  //Apparently components can have multiple return functions. Just learned that.
  //These returns allow for better conditional rendering and easier to read code
  //Makes error checking way easier also
  //Render Seasons
  const renderSeasonTabs = () => {
    return (
      <Tabs
        activeKey={activeSeasonNumber}
        onSelect={(e) => setActiveSeasonNumber(parseInt(e))}
        className="mb-3 nav-tabs"
      >
        {seasons.map((season) => (
          <Tab
            key={`season-${season.season_number}`}
            eventKey={season.season_number}
            title={`Season ${season.season_number}`}
          >
            <div className="season-info mb-3">
              {season.overview && <p>{season.overview}</p>}
              {/*Progress bar render will show how far a user is in season at a glance */}
              <ProgressBar
                now={calculateSeasonProgress(activeSeasonNumber)}
                label={`${calculateSeasonProgress(activeSeasonNumber)}%`}
                className="mb-3 progress"
              />
            </div>
            {renderEpisodeList()}
          </Tab>
        ))}
      </Tabs>
    );
  };
  //Displays the episdes
  const renderEpisodeList = () => {
    const episodesForSeason = episodes[activeSeasonNumber] || [];
    if (loading) {
      return <div className="text-center py-3">Loading episodes...</div>;
    }
    if (episodesForSeason.length === 0) {
      return <Alert variant="info">No episodes found for this season</Alert>;
    }

    return (
      <ListGroup className="episode-list">
        {episodesForSeason.map((episode) => {
          const watched = isEpisodeWatched(
            activeSeasonNumber,
            episode.episode_number
          );

          return (
            <ListGroup.Item
              key={`episode-${activeSeasonNumber}-${episode.episode_number}`}
              className="episode-item d-flex"
            >
              <div>
                {episode.still_path ? (
                  <img
                    src={`${image_url}${episode.still_path}`}
                    alt={`Episode ${episode.episode_number}`}
                    className="episode-thumbnail"
                  />
                ) : (
                  <div
                    className="d-flex align-items-center justify-content-center bg-light text-muted"
                    style={{ height: "90px", borderradius: "4px" }}
                  >
                    No image
                  </div>
                )}
              </div>
              <div className=" episode-title flex-grow-1">
                <h5>
                  {episode.episode_number}. {episode.name}
                  {watched && (
                    <Badge bg="success" className="ms-2">
                      Watched
                    </Badge>
                  )}
                </h5>
                <p>{episode.air_date}</p>
                <p>{episode.overview || "No overview available"}</p>

                {isLoggedIn && (
                  <div className="mt-2">
                    {watched ? (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() =>
                          markEpisodeWatched(
                            activeSeasonNumber,
                            episode.episode_number,
                            false
                          )
                        }
                      >
                        <FaCheckCircle className="me-1" />
                        Mark as Unwatched
                      </Button>
                    ) : (
                      <Button
                        variant="dark"
                        size="sm"
                        onClick={() =>
                          markEpisodeWatched(
                            activeSeasonNumber,
                            episode.episode_number,
                            true
                          )
                        }
                      >
                        <FaRegCircle className="me-1" />
                        Mark as Watched
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </ListGroup.Item>
          );
        })}
      </ListGroup>
    );
  };

  return (
    <Modal
      show={isOpen}
      onHide={onClose}
      size="lg"
      centered
      className="tv-progress-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>{tvName} - Episodes</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading episode data...</p>
          </div>
        ) : (
          <>
            {seasons.length > 0 ? (
              renderSeasonTabs()
            ) : (
              <Alert variant="info">No seasons found for this TV show</Alert>
            )}
          </>
        )}
      </Modal.Body>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default TVProgress;
