/*
Provides fucntionality for searcing movies and tv shows via Flask built API
*/
import React, { useState } from "react";
import axios from "axios";
import { Modal, Button, Spinner, Form, InputGroup } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import LZString from "lz-string";

function SearchPage() {
  const [query, setQuery] = useState(""); // Stores the search query input by user
  const [filter_type, setFilterType] = useState("all"); //Filters output
  const [results, setResults] = useState({ tmdb_movie: [], tmdb_tv: [] }); // Stores search results categorized by media type
  const [loading, setLoading] = useState(false); // Tracks loading state during API requests
  const [selectedItem, setSelectedItem] = useState(null); // Stores detailed information about a selected item
  const image_url = "https://image.tmdb.org/t/p/w500"; // Base URL for TMDB image paths
  const SEARCH_TTL = 24 * 60 * 60 * 1000; //Sets the localStorage variables TTL to 24hours

  // Handles the search form submission. Makes an API request to fetch search results based on the query
  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    console.log("Search triggered"); //Debugging (REMOVE FROM FINAL)
    // Sets cache key for using filter filter type and normalized query
    const SEARCH_CACHE_KEY = (query, filter_type) =>
      `search-${filter_type}-${query.toLowerCase().trim()}`;
    const cacheKey = SEARCH_CACHE_KEY(query, filter_type);
    const cache = localStorage.getItem(cacheKey);

    if (cache) {
      //If in the cache, data is decompressed and set to results
      const { compressed, data, timestamp } = JSON.parse(cache);
      if (Date.now() - timestamp < SEARCH_TTL) {
        //Check if whats in cache isn't past its time-to-live
        const decompressed = compressed
          ? JSON.parse(LZString.decompress(data))
          : JSON.parse(data);
        setResults(decompressed);
        setLoading(false);
        return;
      } else {
        localStorage.removeItem(cacheKey);
      }
    }
    try {
      // Makes request to Flask API search endpoint with query and filter type
      const response = await axios.get(`http://localhost:5000/search`, {
        params: { query, filter_type },
      });
      //Sets response to cache to limit API calls. Compresses for storage optimization
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          compressed: true,
          data: LZString.compress(JSON.stringify(response.data)),
          timestamp: Date.now(),
        })
      );
      setResults(response.data); // Update results state with API response
      console.log(response.data); //Debugging (REMOVE FROM FINAL)
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
    setLoading(false);
  };

  // Handles click on a search result item /Fetches detailed information about the selected item

  const handleResultClick = async (item) => {
    setLoading(true);
    console.log("Type parameter:", item.media_type); //Debugging (REMOVE FROM FINAL)
    const DETAILS_CACHE_KEY = (id, type) => `details-${type}-${id}`;
    const cacheKey = DETAILS_CACHE_KEY(item.id, item.media_type);
    const cache = localStorage.getItem(cacheKey);

    if (cache) {
      const { compressed, data, timestamp } = JSON.parse(cache);
      if (Date.now() - timestamp < SEARCH_TTL) {
        const decompressed = compressed
          ? JSON.parse(LZString.decompress(data))
          : JSON.parse(data);
        setSelectedItem(decompressed);
        setLoading(false);
        return;
      } else {
        localStorage.removeItem(cacheKey);
      }
    }

    try {
      // Makes request to Flask API details endpoint with item ID and media type
      const response = await axios.get(`http://localhost:5000/search/details`, {
        params: { id: item.id, type: item.media_type },
      });

      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          compressed: true,
          data: LZString.compress(JSON.stringify(response.data)),
          timestamp: Date.now(),
        })
      );

      setSelectedItem(response.data); // Store detailed item information
      console.log("Selected Item Details:", response.data); //Debugging (REMOVE FROM FINAL)
    } catch (error) {
      console.error("error fetching details: ", error);
    }
    setLoading(false);
  };

  // Clears the selected item state. Used to close the details modal
  const clearSelection = () => {
    setSelectedItem(null);
  };
  //Clears the localStorage cache and sessionStorage cache (sessionStorage is not used yet by search)
  // May cause issues with user auth if not used carefully
  const clearCaches = () => {
    const userConfirmed = window.confirm(
      //User must confirm cache clearing
      "Are you sure you want to erase all cached data? This action cannot be undone."
    );
    if (userConfirmed) {
      sessionStorage.clear();
      localStorage.clear();
      setResults({ tmdb_movie: [], tmdb_tv: [] }); // Call your clearCaches function if the user confirms
    }
  };

  return (
    <div className="container mt-5">
      {/*Search Bar and Dropdown Menu*/}
      <InputGroup className="mb-3">
        <Form.Control
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for Movies or TV Shows"
        />
        <Form.Select
          value={filter_type}
          onChange={(e) => setFilterType(e.target.value)}
          placeholder="Search for Movies or TV shows"
        >
          <option value="all">All</option>
          <option value="movie">Movies</option>
          <option value="tv">TV Shows</option>
        </Form.Select>
        <Button variant="primary" type="submit" onClick={handleSearch}>
          Search
        </Button>
        <Button variant="warning" onClick={clearCaches}>
          Refresh All Data
        </Button>
      </InputGroup>

      {/*Loading Spinner styled with React-bootstrap*/}
      {/*Spinner is based on the loading state variable*/}
      {loading && (
        <Modal
          show={loading}
          backdrop="static"
          centered
          keyboard={false}
          size="sm"
        >
          <Modal.Body className="text-center py-4">
            <Spinner animation="border" role="status" variant="primary" />
            <span className="visually-hidden">Loading...</span>
          </Modal.Body>
        </Modal>
      )}

      {/* Movie Results Section */}
      {results.tmdb_movie.length > 0 && (
        <div className="container mt-4">
          <h2>Movie Results</h2>
          <div className="row">
            {results.tmdb_movie?.map((movie) => (
              // Individual Movie card, clickable to show details
              <div
                className="col-md-4 mb-4"
                key={movie.id}
                onClick={() => handleResultClick(movie)}
              >
                <div className="card h-100">
                  {movie.poster_url && (
                    // Movie poster
                    <img
                      src={movie.poster_url}
                      className="card-img-top"
                      alt={movie.title}
                    />
                  )}
                  {/* Movie Card Quick Details */}
                  <div className="card-body">
                    <h5 className="card-title">{movie.title}</h5>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TV Shows Results Section */}
      {results.tmdb_tv.length > 0 && (
        <div className="container mt-4">
          <h2>Tv Results</h2>
          <div className="row">
            {results.tmdb_tv?.map((tv) => (
              // Individual TV show card, clickable to show details
              <div
                className="col-md-4 mb-4"
                key={tv.id}
                onClick={() => handleResultClick(tv)}
              >
                <div className="card h-100">
                  {tv.poster_url && (
                    // TV poster
                    <img
                      src={tv.poster_url}
                      className="card-img-top"
                      alt={tv.title}
                    />
                  )}
                  {/* TV Shows Card Quick Details */}
                  <div className="card-body">
                    <h5 className="card-title">{tv.name}</h5>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Displays the extra details of Movie or TV show on click*/}
      {selectedItem && (
        <Modal show={!!selectedItem} onHide={clearSelection} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {selectedItem?.tmdb?.title || selectedItem?.tmdb?.name}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="row">
              <div className="col-md-4">
                {selectedItem.tmdb.poster_path ? (
                  <img
                    src={`${image_url}${selectedItem.tmdb.poster_path}`}
                    alt={selectedItem.tmdb.title || selectedItem.tmdb.name}
                    className="img-fluid rounded"
                  />
                ) : (
                  <div className="text-center p-5 bg-light rounded">
                    No Image Available
                  </div>
                )}
              </div>

              {/* Displays release dates for movies or first air date for tv */}
              <div className="col-md-8">
                <p>
                  <strong>Release Date: </strong>{" "}
                  {selectedItem.tmdb.release_date ||
                  selectedItem.tmdb.first_air_date ? (
                    <>
                      {selectedItem.tmdb.release_date ||
                        selectedItem.tmdb.first_air_date}
                    </>
                  ) : (
                    "N/A"
                  )}
                </p>
                {/* Displays rounded rating out of 10 */}
                <p>
                  <strong>Rating: </strong>{" "}
                  {Math.round(selectedItem.tmdb.vote_average)}/10
                </p>
                <p>
                  {/* Displays runtime for movies or number of seasons for TV shows */}
                  <strong>Runtime/Seasons: </strong>{" "}
                  {selectedItem.tmdb.runtime ||
                  selectedItem.tmdb.number_of_seasons ? (
                    <>
                      {selectedItem.tmdb.runtime
                        ? `${selectedItem.tmdb.runtime} min`
                        : ""}
                      {selectedItem.tmdb.number_of_seasons
                        ? ` / ${selectedItem.tmdb.number_of_seasons} seasons`
                        : ""}
                    </>
                  ) : (
                    "N/A"
                  )}
                </p>
                {/* Displays overview of the content */}
                <p>{selectedItem.tmdb.overview}</p>

                {/*Cast information section*/}
                <div className="mt-3">
                  <h5>Cast</h5>
                  {selectedItem.cast.length > 0 ? (
                    <div className="row row-cols-2 row-cols-md-4 row-col-lg-5 g-2">
                      {selectedItem.cast.map((actor) => (
                        <div key={actor.id} className="col">
                          <div className="card h-100 border-0">
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
                              <div
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
            </div>

            {/* Displays streaming availability in a table format */}
            {/* Table shows platform name, price information, and region availability */}
            <div className="mt-4">
              <h3>Where to Watch</h3>
              {selectedItem.watchmode?.length > 0 ? (
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
                      {selectedItem.watchmode
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
                                rel="noreferrer"
                                style={{
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
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
                <p>no streaming information is currently available</p>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button varient="secondary" onClick={clearSelection}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}

export default SearchPage;
