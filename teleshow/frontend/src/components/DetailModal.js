//Written by Moses Pierre
import { React, useEffect, useState } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import RecommendationList from "./RecommendationList";
import { FaBell, FaRegBell, FaPlus } from "react-icons/fa";
import axios from "axios";
import "./DetailModal.css";
import "./TVProgress";
import TVProgress from "./TVProgress";
import {
  getDetails,
  getRecommendations,
  checkIfFollowed,
  getWatchlists,
} from "../API/Flask_API";
import StarRate from "../components/starRate"; //Component Made Completely by Serena and William
import GetAverageRating from "../scripts/GetAverageRating.js"; //Component Made Completely by Serena and William
import FetchComments from "../components/FetchComments.js"; //Component Made by William

const DetailModal = ({ item: givenItem, mediaId, mediaType, show, onHide }) => {
  const [item, setItem] = useState(givenItem);
  const [loading, setLoading] = useState(!givenItem && mediaId && mediaType);
  const [rec_loading, setRecLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [followed, setFollowed] = useState(false);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false); //Shows watchlist selection
  const [watchlists, setWatchlists] = useState([]); //Array of user watchlists from firestore
  const [selectedWatchlist, setSelectedWatchlist] = useState(false); //Tracks selected watchlist
  const [newWatchlistName, setNewWatchlistName] = useState(""); //Name for watchlist
  const [addingToWatchlist, setAddingToWatchlist] = useState(false); //Loading indicator
  const [showEpisodeTracker, setShowEpisodeTracker] = useState(false);
  const image_url = " https://image.tmdb.org/t/p/w342"; // Base URL for TMDB image paths
  const [userId, setUserId] = useState(sessionStorage.getItem("userId") || 0);
  const host = process.env.REACT_APP_NETWORK_HOST;
  const displayName = sessionStorage.getItem("userName");

  const isLoggedIn = !!sessionStorage.getItem("userId");

  useEffect(() => {
    if (item && isLoggedIn) {
      checkIfFollowed(item.tmdb.id, item.tmdb.media_type).then((status) =>
        setFollowed(status)
      );
    }
  }, [item, isLoggedIn, userId]);

  useEffect(() => {
    if (showWatchlistModal && isLoggedIn) {
      fetchWatchlists();
    }
  }, [showWatchlistModal, isLoggedIn]);

  //Had to use promise chaining so i could tie the rating data to the item info
  //Otherwise it was giving me an issue where the item wasnt being set before attempted retreival
  useEffect(() => {
    const fetchItemDetails = () => {
      //If only the mediaId and mediaType are passed
      if (!givenItem && mediaId && mediaType) {
        let detailData;
        setLoading(true);

        getDetails(mediaId, mediaType)
          .then((data) => {
            detailData = data;
            return fetchRating(
              userId,
              detailData.tmdb.id,
              detailData.tmdb.media_type
            );
          })
          .then((response) => {
            detailData.tmdb.rating = response.rating;
            return GetAverageRating(
              detailData.tmdb.id,
              detailData.tmdb.media_type
            );
          })
          .then((avgRatingResponse) => {
            detailData.tmdb.avgRating = avgRatingResponse;
            setItem(detailData);
            setLoading(false);

            setRecLoading(true);
            return getRecommendations(detailData);
          })
          .then((recData) => {
            setRecommendations(recData);
            setRecLoading(false);
          })
          .catch((error) => {
            console.error("Error fetching details:", error);
            setLoading(false);
            setRecLoading(false);
          });
      } else if (givenItem && !(mediaId && mediaType)) {
        // If item given just get recommendations
        setRecLoading(true);

        getRecommendations(givenItem)
          .then((recData) => {
            setRecommendations(recData);
            setRecLoading(false);
          })
          .catch((error) => {
            console.error("Error fetching recommendations:", error);
            setRecLoading(false);
          });
      }
    };

    fetchItemDetails();
  }, [givenItem, mediaId, mediaType]);

  //What happens when someone clicks the follow button.
  //Adds keywords, genres, and production company.
  //If valid, tv show is added to calendar.
  const handleFollow = async () => {
    const action = followed ? "unfollow" : "follow";

    if (!userId) {
      // Handle not logged in state
      alert("Please log in to follow content");
      return;
    }
    //Pull information that can be used for recommendations from followed media or return empty array
    const genres =
      item.tmdb.genres?.map((genre) => ({
        id: genre.id,
        name: genre.name,
      })) || [];

    const keywords =
      item.tmdb.keywords?.map((keyword) => ({
        id: keyword.id,
        name: keyword.name,
      })) || [];

    const producers =
      item.tmdb.production_companies?.map((company) => ({
        id: company.id,
        name: company.name,
      })) || [];

    const payload = {
      user_id: userId,
      media_id: item.tmdb.id,
      media_type: item.tmdb.media_type,
      title: item.tmdb.title || item.tmdb.name,
      genres: genres,
      keywords: keywords,
      producers,
      action: action,
    };
    const response = await axios.post(
      `${host}interactions/media_followed`,
      payload
    );

    if (response.data.status === "success") {
      setFollowed(!followed);
    }

    console.log(response.data);
  };

  // Fetch watchlists using the backend
  const fetchWatchlists = async () => {
    const lists = await getWatchlists();
    setWatchlists(lists);
  };

  //Adds media to watchlist using backend
  const handleAddToWatchList = () => {
    if (!isLoggedIn) {
      alert("Please log in to add to watchlist");
      return;
    }
    setShowWatchlistModal(true);
  };

  const handleCloseWatchlistModal = () => {
    setShowWatchlistModal(false);
    setSelectedWatchlist("");
    setNewWatchlistName("");
    setAddingToWatchlist("");
  };
  //In the backend if a name matches an existing watchlist, media is added to that watchlist
  //Else a new one is created
  const handleAddToSelectedWatchlist = async () => {
    const watchlistName = selectedWatchlist || newWatchlistName;
    if (!watchlistName.trim()) {
      alert("Please select or create a watchlist");
      return;
    }
    if (!userId) return;

    setAddingToWatchlist(true);

    try {
      const mediaInfo = {
        id: item.tmdb.id,
        media_name: item.tmdb.title || item.tmdb.name,
        media_type: item.tmdb.media_type,
        overview: item.tmdb.overview,
        release_date: item.tmdb.release_date || item.tmdb.first_air_date,
        poster_path: item.tmdb.poster_path,
      };

      const response = await axios.post(`${host}interactions/add-watchlist`, {
        user_id: userId,
        watchlist_name: watchlistName,
        media_info: mediaInfo,
      });

      if (response.data.status === "success") {
        alert(`Added to watchlist: ${watchlistName}`);
        handleCloseWatchlistModal();
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.error) {
        alert(error.response.data.error);
      } else {
        console.error("Error adding to watchlist:", error);
        alert("Failed to add to watchlist");
      }
    } finally {
      setAddingToWatchlist(false);
    }
  };

  const handleRecClick = async (recItem) => {
    let detailData;
    try {
      setLoading(true);
      detailData = await getDetails(recItem.id, recItem.media_type);
      setItem(detailData);
      setRecommendations([]);
    } catch (error) {
      console.error("Error loading recommendations", error);
    } finally {
      setLoading(false);
    }
    try {
      setRecLoading(true);
      const recData = await getRecommendations(detailData);
      setRecommendations(recData);
    } catch (error) {
      console.error("Error loading recommendations", error);
    } finally {
      setRecLoading(false);
    }
  };

  const fetchRating = async (user_id, media_id, media_type) => {
    if (!user_id || !isLoggedIn) {
      console.log("No user ID available or user not logged in");
      return { rating: null };
    }
    try {
      const response = await axios.get(`${host}interactions/get-ratings`, {
        params: {
          user_id,
          media_id,
          media_type,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching ratings:", error);
      return { rating: null };
    }
  };

  if (loading) {
    return (
      <div className="text-center py-3">
        <Spinner animation="border" />
        <div className="text-muted small mt-2">Fetching details...</div>
      </div>
    );
  }

  return (
    <>
      <Modal
        show={show}
        onHide={onHide}
        centered
        size="lg"
        className="detail-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>{item?.tmdb?.title || item?.tmdb?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row">
            <div className="col-md-4 mb-3">
              {item.tmdb.poster_path ? (
                <img //Selected movie picture
                  src={`${image_url}${item.tmdb.poster_path}`}
                  alt={item.tmdb.title || item.tmdb.name}
                  className="img-fluid rounded"
                />
              ) : (
                <div className="text-center p-5 bg-light rounded">
                  No Image Available
                </div>
              )}
              {isLoggedIn ? (
                <div className="d-flex flex-wrap justify-content-between gap-2 mt-2">
                  <Button
                    variant={followed ? "danger" : "outline-danger"}
                    onClick={() => handleFollow(item)}
                    className="btn-follow flex-grow-0"
                  >
                    {followed ? <FaBell /> : <FaRegBell />}{" "}
                    {followed ? "Following" : "Follow"}
                  </Button>
                  <Button
                    variant="outline-primary"
                    onClick={handleAddToWatchList}
                    className="btn-watchlist flex-grow-0"
                  >
                    <FaPlus /> Watchlist
                  </Button>
                  {item.tmdb.media_type === "tv" ? (
                    <Button
                      variant="outline-primary"
                      className="mt-2 mb-2 w-auto px-3"
                      onClick={() => setShowEpisodeTracker(true)}
                    >
                      View Episodes
                    </Button>
                  ) : (
                    <p>{""}</p>
                  )}
                  <div className="media-interactions">
                    {/* Serena and William Rating section */}
                    <div className="rating-section">
                      <h5>Leave a Rating:</h5>
                      {isLoggedIn ? (
                        <StarRate
                          userID={userId}
                          currentMediaID={item.tmdb.id}
                          currentMediaType={item.tmdb.media_type}
                          initialRate={item.tmdb.rating}
                          initialAvgRate={item.tmdb.avgRating}
                        />
                      ) : (
                        <p>Log in to rate this {item.tmdb.media_type}</p>
                      )}
                    </div>

                    {/*William Comments section */}
                    <div className="comments-section mt-4">
                      {isLoggedIn ? (
                        <FetchComments
                          userID={userId}
                          mediaId={item.tmdb.id}
                          mediaType={item.tmdb.media_type}
                          displayName={displayName}
                        />
                      ) : (
                        <p>Log in to view and add comments</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                ""
              )}
            </div>

            {/* Displays release dates for movies or first air date for tv */}
            <div className="col-md-8">
              {item.tmdb.media_type === "tv" && followed && (
                <div className="mt-3">
                  {item.tmdb.status === "Returning Series" ||
                  item.tmdb.in_production ? (
                    <div className="alert alert-info">
                      <small>
                        <strong>{`${item.tmdb.name} is Ongoing`}</strong>
                        {item.tmdb.next_episode_to_air ? (
                          <>
                            <br />
                            <strong>Next Episode: </strong>S
                            {item.tmdb.next_episode_to_air.season_number}E
                            {item.tmdb.next_episode_to_air.episode_number} -{" "}
                            {item.tmdb.next_episode_to_air.name}
                            <br />
                            <em>This show will appear in your TV Calendar</em>
                          </>
                        ) : (
                          <>
                            <br />
                            <em>No upcoming episodes scheduled yet</em>
                          </>
                        )}
                      </small>
                    </div>
                  ) : (
                    <div className="alert alert-secondary">
                      <small>
                        <em>Finished shows don't appear in the TV Calendar</em>
                      </small>
                    </div>
                  )}
                </div>
              )}
              {item.tmdb.media_type === "tv" ? (
                <p>
                  <strong>Series Status:</strong> {item.tmdb.status || "Ended"}
                </p>
              ) : (
                <p>
                  <strong>Status:</strong> {item.tmdb.status || "Unreleased"}
                </p>
              )}
              <p>
                <strong>Release Date: </strong>{" "}
                {item.tmdb.release_date || item.tmdb.first_air_date ? (
                  <>{item.tmdb.release_date || item.tmdb.first_air_date}</>
                ) : (
                  "N/A"
                )}
              </p>
              {/* Displays rounded rating out of 10 */}
              <p>
                <strong>TMDB Rating: </strong>{" "}
                {Math.round(item.tmdb.vote_average)}
                /10
              </p>
              <p>
                {/* Displays runtime for movies or number of seasons for TV shows */}
                {/* Math.floor rounds a number down */}
                {item.tmdb.runtime ? (
                  <>
                    <strong>Runtime: </strong>
                    {`${Math.floor(item.tmdb.runtime / 60)}h ${
                      item.tmdb.runtime % 60
                    }m`}
                  </>
                ) : (
                  ""
                )}
                {item.tmdb.runtime && item.tmdb.number_of_seasons ? " • " : ""}
                {item.tmdb.number_of_seasons ? (
                  <>
                    <strong>Seasons: </strong>
                    {`${item.tmdb.number_of_seasons} seasons`}
                  </>
                ) : (
                  ""
                )}
              </p>
              {/* Genres Section */}
              <div className="d-flex flex-wrap gap-2 mb-2">
                {item.tmdb.genres && item.tmdb.genres.length > 0 ? (
                  item.tmdb.genres.map((genre) => (
                    <span key={genre.id} className="badge bg-info text-black">
                      {genre.name}
                    </span>
                  ))
                ) : (
                  <span className="text-muted">No genres available</span>
                )}
              </div>
              {/* Displays overview and tagline of the content */}
              <div className="overview-section">
                {item.tmdb.tagline ? <p>*{item.tmdb.tagline}*</p> : <p>{""}</p>}

                <p>{item.tmdb.overview}</p>
              </div>

              {/*Cast information section*/}
              <div className="mt-3">
                <h5>Cast</h5>
                {item.cast.length > 0 ? (
                  <div className="row row-cols-2 row-cols-md-4 row-col-lg-5 g-2 cast-section">
                    {item.cast.map((actor) => (
                      <div key={actor.id} className="col">
                        <div className="card h-100 border-0 cast-card">
                          {actor.profile_path ? (
                            <figure className="figure">
                              <img
                                src={`${image_url}${actor.profile_path}`}
                                alt={actor.name}
                                className="card-img-top rounded"
                              />
                              <figcaption className="figure-caption">
                                {actor.name} as {actor.character}
                              </figcaption>
                            </figure>
                          ) : (
                            <figure className="figure">
                              <div //No Cast Information formatted placeholders
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  borderRadius: "50%",
                                  backgroundColor: "#e9ecef",
                                  marginRight: "10px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <small>N/A</small>
                              </div>
                              <figcaption className="figure-caption">
                                {actor.name} as {actor.character}
                              </figcaption>
                            </figure>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No cast information available</p>
                )}
              </div>
            </div>
            {/* Displays streaming availability in a table format */}
            {/* Table shows platform name, price information, and region availability */}
            <div className="mt-4">
              <h3>Where to Watch</h3>
              {item.watchmode?.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Platform</th>
                        <th>Price</th>
                        <th>Region</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.watchmode
                        .sort((a, b) => a.region?.localeCompare(b.region))
                        .map((service, index) => (
                          <tr
                            key={`${service.name}-${service.region}-${index}`}
                          >
                            <td>
                              {/*Users can click on service name and be taken to link*/}
                              <a
                                href={service.web_url}
                                target="_blank"
                                rel="nooperner noreferrer"
                                style={{
                                  cursor: "pointer",
                                }}
                                className="btn btm-sm btn-outline-primary"
                              >
                                {service.name}
                              </a>
                            </td>
                            <td>{service.price || service.type}</td>
                            <td>{service.region}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="alert alert-secondary">
                  <p>no streaming information is currently available</p>
                </div>
              )}
            </div>
          </div>
          {/*Recommendations*/}
          {recommendations && !rec_loading ? (
            <RecommendationList
              recommendations={recommendations}
              onRecommendationClick={handleRecClick}
            />
          ) : (
            <div className="loading-spinner">
              <Spinner animation="border" variant="primary" />
              <span> Finding similar titles...</span>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button variant="outline-secondary" onClick={onHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Watchlist Selection Modal */}
      <Modal
        show={showWatchlistModal}
        onHide={handleCloseWatchlistModal}
        centered
        className="detail-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Add to Watchlist</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {addingToWatchlist ? (
            <div className="text-center">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Adding to watchlist...</p>
            </div>
          ) : (
            <>
              {/*Handles adding to wathlist */}
              {/*If the user has watchlists, show a selection dropdown */}
              {/*If not then they can create a new one with a new name */}
              {watchlists.length > 0 ? (
                <div className="mb-3">
                  <label>Select Watchlist:</label>
                  <select
                    className="form-control"
                    value={selectedWatchlist}
                    onChange={(e) => setSelectedWatchlist(e.target.value)}
                  >
                    <option value="">-- Select Watchlist --</option>
                    {watchlists.map((watchlist) => (
                      <option key={watchlist.id} value={watchlist.name}>
                        {watchlist.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p> You don't have any watchlists yet. Create one below:</p>
              )}
              <div className="mb-3">
                <label>
                  {watchlists.length > 0
                    ? "Or Create New Watchlist:"
                    : "Create New Watchlist:"}
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  placeholder="Enter watchlist name"
                />
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseWatchlistModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAddToSelectedWatchlist}
            disabled={
              (!selectedWatchlist && !newWatchlistName.trim()) ||
              addingToWatchlist
            } //Stops users from adding content while operation is in progress.
          >
            Add to Watchlist
          </Button>
        </Modal.Footer>
      </Modal>
      {item && item.tmdb && item.tmdb.media_type === "tv" && (
        <TVProgress
          tvId={item.tmdb.id}
          tvName={item.tmdb.name || item.tmdb.title}
          isOpen={showEpisodeTracker}
          onClose={() => setShowEpisodeTracker(false)}
          isLoggedIn={isLoggedIn}
        />
      )}
    </>
  );
};

export default DetailModal;
