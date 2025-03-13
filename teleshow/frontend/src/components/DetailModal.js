//Written by Moses Pierre
import { React, useEffect, useState } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import RecommendationList from "./RecommendationList";
import { FaHeart, FaRegHeart, FaPlus } from "react-icons/fa";
import axios from "axios";
import "./DetailModal.css";

const DetailModal = ({
  item,
  show,
  onHide,
  recommendations,
  loading,
  onRecommendationClick,
  isLoggedIn,
}) => {
  const [liked, setLiked] = useState(false);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false); //Shows watchlist selection
  const [watchlists, setWatchlists] = useState([]); //Array of user watchlists from firestore
  const [selectedWatchlist, setSelectedWatchlist] = useState(false); //Tracks selected watchlist
  const [newWatchlistName, setNewWatchlistName] = useState(""); //Name for watchlist
  const [addingToWatchlist, setAddingToWatchlist] = useState(false); //Loading indicator
  const image_url = " https://image.tmdb.org/t/p/w342"; // Base URL for TMDB image paths
  useEffect(() => {
    if (item && isLoggedIn) {
      checkIfLiked(item.tmdb.id, item.tmdb.media_type);
    }
  }, [item, isLoggedIn]);

  useEffect(() => {
    if (showWatchlistModal && isLoggedIn) {
      fetchWatchlists();
    }
  }, [showWatchlistModal, isLoggedIn]);

  if (!item) return null;

  const checkIfLiked = async (mediaId, mediaType) => {
    try {
      const userId = sessionStorage.getItem("userId");
      if (!userId) return;

      const response = await axios.get(
        `http://localhost:5000/interactions/check_liked`,
        {
          params: {
            user_id: userId,
            media_id: mediaId,
            media_type: mediaType,
          },
        }
      );
      setLiked(response.data.liked); //returns true if found and false if not
    } catch (error) {
      console.error("Error checking media status", error);
    }
  };
  const handleLike = async (item) => {
    const userId = sessionStorage.getItem("userId");

    const action = liked ? "unlike" : "like";

    if (!userId) {
      // Handle not logged in state
      alert("Please log in to like content");
      return;
    }

    const genres =
      item.tmdb.genres?.map((genre) => ({
        //Pull genres from liked media or return empty array
        id: genre.id,
        name: genre.name,
      })) || [];

    const keywords =
      item.tmdb.keywords?.map((keyword) => ({
        id: keyword.id,
        name: keyword.name,
      })) || [];

    const payload = {
      user_id: userId,
      media_id: item.tmdb.id,
      media_type: item.tmdb.media_type,
      title: item.tmdb.title || item.tmdb.name,
      genres: genres,
      keywords: keywords,
      action: action,
    };
    const response = await axios.post(
      `http://localhost:5000/interactions/media_liked`,
      payload
    );

    if (response.data.status === "success") {
      setLiked(!liked);
    }

    console.log(response.data);
  };

  const fetchWatchlists = async () => {
    const userId = sessionStorage.getItem("userId");
    if (!userId) return;

    try {
      const response = await axios.get(
        "http://localhost:5000/interactions/get-watchlists",
        { params: { user_id: userId } }
      );

      setWatchlists(response.data.watchlists || []);
    } catch (error) {
      console.error("Error fetching watchlists:", error);
    }
  };

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

  const handleAddToSelectedWatchlist = async () => {
    const watchlistName = selectedWatchlist || newWatchlistName;
    if (!watchlistName.trim()) {
      alert("Please select or create a watchlist");
      return;
    }
    const userId = sessionStorage.getItem("userId");
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

      const response = await axios.post(
        `http://localhost:5000/interactions/add-watchlist`,
        {
          user_id: userId,
          watchlist_name: watchlistName,
          media_info: mediaInfo,
        }
      );

      if (response.data.status === "success") {
        alert(`Added to watchlist: ${watchlistName}`);
        handleCloseWatchlistModal();
      }
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      alert("Failed to add to watchlist");
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
        dialogClassName="grey-modal"
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
                <div className="d-flex justify-content-between mt-2">
                  <Button
                    variant={liked ? "danger" : "outline-danger"}
                    onClick={() => handleLike(item)}
                    className="btn-like"
                  >
                    {liked ? <FaHeart /> : <FaRegHeart />}
                    {/*If liked changed to filled heart */}
                  </Button>
                  <Button
                    variant="outline-primary"
                    onClick={handleAddToWatchList}
                    className="btn-watchlist"
                  >
                    <FaPlus /> Watchlist
                  </Button>
                </div>
              ) : (
                ""
              )}
            </div>

            {/* Displays release dates for movies or first air date for tv */}
            <div className="col-md-8">
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
                <strong>Rating: </strong> {Math.round(item.tmdb.vote_average)}
                /10
              </p>
              <p>
                {/* Displays runtime for movies or number of seasons for TV shows */}
                <strong>Runtime/Seasons: </strong>{" "}
                {item.tmdb.runtime || item.tmdb.number_of_seasons ? (
                  <>
                    {item.tmdb.runtime ? `${item.tmdb.runtime} min` : ""}
                    {item.tmdb.number_of_seasons
                      ? ` / ${item.tmdb.number_of_seasons} seasons`
                      : ""}
                  </>
                ) : (
                  "N/A"
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
              <p>{item.tmdb.tagline}</p>
              <p>{item.tmdb.overview}</p>

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
          {recommendations && !loading ? (
            <RecommendationList
              recommendations={recommendations}
              onRecommendationClick={onRecommendationClick}
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
        className="grey-modal"
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
    </>
  );
};

export default DetailModal;
