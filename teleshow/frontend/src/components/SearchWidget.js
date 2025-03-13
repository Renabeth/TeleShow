/*
Written by Moses Pierre
Provides functionality for searching movies and tv shows via Flask built API
*/
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import axiosRetry from "axios-retry";
import { Form, InputGroup, Dropdown } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import LZString from "lz-string";
import SearchResultItem from "./SearchResultItem";
import DetailModal from "./DetailModal";
import "./SearchWidget.css";
import { FiTv } from "react-icons/fi";

const SearchWidget = () => {
  const [query, setQuery] = useState(""); // Stores the search query input by user
  const [filter_type, setFilterType] = useState("all"); //Filters output
  const [results, setResults] = useState({ tmdb_movie: [], tmdb_tv: [] }); // Stores search results categorized by media type
  const [loading, setLoading] = useState(false); // Tracks loading state during API requests
  const [selectedItem, setSelectedItem] = useState(null); // Stores detailed information about a selected item
  const SEARCH_TTL = 24 * 60 * 60 * 1000; //Sets the localStorage variables TTL to 24hours
  const [recommendations, setRecommendations] = useState([]); //Sets recommendation list
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loginStatus, setLoginStatus] = useState(false);
  const handleExpand = () => setIsExpanded(true); //Logic for expanding search bar
  const handleCollapse = () => {
    //Logic for collapsing search bar
    if (!query) setIsExpanded(false);
  };
  const searchContainerRef = useRef(null);
  //Able to track when user clicks outside of search box and close components
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        handleCollapse();
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleCollapse]);

  const checkLogin = () => {
    const userId = sessionStorage.getItem("userId");
    if (userId) {
      setLoginStatus(true);
      console.log("user is logged in");
    }
  };

  const handleKeyPress = (event) => {
    // Check if Enter key is pressed and query meets minimum length
    if (event.key === "Enter" && query.trim().length > 2) {
      handleSearch();
      checkLogin();
      event.preventDefault();
    }
  };

  const handleFilterSelect = (filterType) => {
    setFilterType(filterType);
    setShowDropdown(false);
  };

  const hashObject = (obj) => {
    //For caching POST requests
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  };
  // Handles the search form submission. Makes an API request to fetch search results based on the query
  const handleSearch = async (e) => {
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
        setQuery(""); //Clears search bar on successfull search
        setShowDropdown(true);
        setLoading(false);
        return;
      } else {
        localStorage.removeItem(cacheKey);
      }
    }
    try {
      axiosRetry(axios, {
        retries: 2,
        retryDelay: axiosRetry.exponentialDelay,
      }); //Handle server unreachable
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
      setResults(response.data || []); // Update results state with API response
      setQuery(""); //Clears search bar on successfull search
      setShowDropdown(true);
      console.log(response.data); //Debugging (REMOVE FROM FINAL)
    } catch (error) {
      console.error("Error searching data: ", error);
      alert("Unable to connect to the server. Please try again later.");
      setQuery("");
    }
    setLoading(false);
  };

  const handleResultClick = async (item) => {
    setShowDropdown(false);
    setLoading(true);
    setIsExpanded(false);
    console.log("Fetching details for:", item.id, item.media_type);
    const DETAILS_CACHE_KEY = (id, type) => `details-${type}-${id}`;
    const cacheKey = DETAILS_CACHE_KEY(item.id, item.media_type);
    const cache = localStorage.getItem(cacheKey);

    if (cache) {
      const { compressed, data, timestamp } = JSON.parse(cache);
      if (Date.now() - timestamp < SEARCH_TTL) {
        const decompressed = compressed
          ? JSON.parse(LZString.decompress(data))
          : JSON.parse(data);
        console.log("Cache hit for details:", decompressed);
        setSelectedItem(decompressed);
        setLoading(false);
        handleRecommendations(decompressed); // Cached data needs to be passed so recommendation handler still runs
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

      console.log("API response for details:", response.data); //Debugging

      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          compressed: true,
          data: LZString.compress(JSON.stringify(response.data)),
          timestamp: Date.now(),
        })
      );

      setSelectedItem(response.data || []); // Store detailed item information
      handleRecommendations(response.data);
    } catch (error) {
      console.error("error fetching details: ", error);
    }
    setLoading(false);
  };

  //Recommendation Handling
  const handleRecommendations = async (item) => {
    setLoading(true);
    setRecommendations(null); //Remove shown recommendations from modal
    console.log(
      //Debugging
      "Fetching recommendations for:",
      item.tmdb.id,
      item.tmdb.media_type
    );
    const genre_ids = item.tmdb.genres?.map((genre) => genre.id).join(",");
    const producer_ids =
      item.tmdb.production_companies?.map((company) => company.id).join(",") ||
      "Unknown";
    const cast =
      item.cast?.map((person) => person.name).join(",") ||
      "No cast information";
    const cast_ids =
      item.cast?.map((person) => person.id).join(",") || "No cast information";
    const keyword_ids =
      item.tmdb.keywords?.map((keyword) => keyword.id).join(",") || "None";
    const region =
      item.tmdb.origin_country?.map((c, index) => c[index]).join(",") || "None";

    const payload = {
      //Recommendation factors passed
      id: item.tmdb.id,
      type: item.tmdb.media_type,
      overview: item.tmdb.overview,
      tagline: item.tmdb.tagline || "",
      language: item.tmdb.original_language,
      region,
      genre_ids,
      producer_ids,
      cast,
      cast_ids,
      keyword_ids,
    };

    const payloadHash = hashObject(payload);

    const REC_CACHE_KEY = (id, type, hash) =>
      `recommendations-${type}-${id}-${hash}`;
    const cacheKey = REC_CACHE_KEY(
      item.tmdb.id,
      item.tmdb.media_type,
      payloadHash
    );
    const cache = localStorage.getItem(cacheKey);
    console.log("Generated cacheKey:", cacheKey);

    if (cache) {
      const { compressed, data, timestamp } = JSON.parse(cache);
      if (Date.now() - timestamp < SEARCH_TTL) {
        const decompressed = compressed
          ? JSON.parse(LZString.decompress(data))
          : JSON.parse(data);
        console.log("Cache hit for recommendations");
        setRecommendations(decompressed.recommendations); //Recommendations are in an array within data
        setLoading(false);
        return;
      } else {
        localStorage.removeItem(cacheKey);
      }
    }
    try {
      const response = await axios.post(
        `http://localhost:5000/recommendations`,
        payload
      );

      console.log(
        "API response for recommendations:",
        item.tmdb.id,
        item.tmdb.media_type
      ); // debugging

      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          compressed: true,
          data: LZString.compress(JSON.stringify(response.data)),
          timestamp: Date.now(),
        })
      );
      setRecommendations(response.data.recommendations || []);
      console.log(response.data.recommendations);
    } catch (error) {
      console.error("error fetching details: ", error);
    }
    setLoading(false);
  };

  const clearCache = () => {
    const userConfirmed = window.confirm(
      //User must confirm cache clearing
      "Are you sure you want to erase all cached data? This action cannot be undone."
    );
    if (userConfirmed) {
      // Get all keys from localStorage
      const keys = Object.keys(localStorage);

      // Filter keys that belong to your app's cache
      const cacheKeys = keys.filter(
        (key) =>
          key.startsWith("search-") ||
          key.startsWith("details-") ||
          key.startsWith("recommendations-")
      );

      // Remove all cache items
      cacheKeys.forEach((key) => localStorage.removeItem(key));

      // Provide feedback to user
      alert("Cache cleared successfully!");
    }
  };

  return (
    <div ref={searchContainerRef} className="position-relative">
      <div onSubmit={(e) => e.preventDefault()}>
        <InputGroup
          className={`search-container ${isExpanded ? "expanded" : ""}`} //Changes class depending on state
        >
          {!isExpanded ? (
            <InputGroup.Text className="search-trigger" onClick={handleExpand}>
              <FiTv className="search-icon" />
            </InputGroup.Text>
          ) : (
            <Form.Control
              type="search"
              placeholder="Search movies and TV shows..."
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
              onKeyDown={handleKeyPress}
            />
          )}
          <div className="filter-area">
            {isExpanded && (
              <Dropdown>
                <Dropdown.Toggle className="filter-dropdown-btn">
                  <FiTv className="me-2" />
                  {filter_type === "all"
                    ? "All"
                    : filter_type === "movie"
                    ? "Movies"
                    : "TV"}
                </Dropdown.Toggle>
                <Dropdown.Menu className="filter-dropdown-menu">
                  <Dropdown.Item onClick={() => handleFilterSelect("all")}>
                    All
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => handleFilterSelect("movie")}>
                    Movies
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => handleFilterSelect("tv")}>
                    TV Shows
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => clearCache()}>
                    Clear Cache
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            )}
          </div>
        </InputGroup>
      </div>

      {/*Results Dropdown*/}
      {showDropdown && results && (
        <Dropdown.Menu
          show={true}
          className="w-100 mt-2 shadow-lg rounded-3 overflow-auto"
          style={{ maxHeight: "400px", maxWidth: "500px" }}
        >
          {/* Movies Section */}
          {results.tmdb_movie.length > 0 && (
            <>
              <h6 className="px-3 mt-2">Movies</h6>
              {results.tmdb_movie.map((movie) => (
                <SearchResultItem
                  key={movie.id}
                  item={movie}
                  onClick={handleResultClick}
                />
              ))}
            </>
          )}
          {/* TV Shows Section */}
          {results.tmdb_tv.length > 0 && (
            <>
              <h6 className="px-3 mt-2">TV Shows</h6>
              {results.tmdb_tv.map((tv) => (
                <SearchResultItem
                  key={tv.id}
                  item={tv}
                  onClick={handleResultClick}
                />
              ))}
            </>
          )}
        </Dropdown.Menu>
      )}

      {/*Detail Modal*/}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          show={!!selectedItem}
          onHide={() => setSelectedItem(null)}
          recommendations={recommendations}
          onRecommendationClick={handleResultClick}
          loading={loading}
          isLoggedIn={loginStatus}
        />
      )}
    </div>
  );
};

export default SearchWidget;
