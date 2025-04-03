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
import { GoSearch, GoClock } from "react-icons/go";
import { getDetails } from "../API/Flask_API";

const SearchWidget = () => {
  axiosRetry(axios, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
  });
  const SEARCH_TTL = 24 * 60 * 60 * 1000;
  const [query, setQuery] = useState(""); // Stores the search query input by user
  const searchInputRef = useRef(null);
  const [filter_type, setFilterType] = useState("all"); //Filters output
  const [results, setResults] = useState({}); // Stores search results categorized by media type
  const [selectedItem, setSelectedItem] = useState(null); // Stores detailed information about a selected item
  const [isExpanded, setIsExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [queryHistory, setQueryHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const host = process.env.REACT_APP_NETWORK_HOST;
  const handleExpand = () => {
    setIsExpanded(true);
    // Focus the input box when expanded
    if (searchInputRef.current) searchInputRef.current.focus();
  };
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

  const handleKeyPress = (event) => {
    // Check if Enter key is pressed and query meets minimum length
    if (event.key === "Enter" && query.trim().length > 2) {
      handleSearch();
      event.preventDefault();
    }
  };

  const handleFilterSelect = (filterType) => {
    setFilterType(filterType);
    //If theres a query it will be re-searched with the new filter
    if (query.trim()) {
      handleSearch(query, filterType);
    } else if (queryHistory.length > 0) {
      //If there is no query then the most recent search will be re-searched
      const historyQuery = queryHistory[0];
      setQuery(historyQuery);
      handleSearch(historyQuery, filterType);
    }
  };

  // Handles the search form submission. Makes an API request to fetch search results based on the query
  const handleSearch = async (searchQuery, filterType) => {
    setLoading(true);
    const currentQuery = searchQuery || query;
    const currentFilterType = filterType || filter_type;
    if (currentQuery.trim().length > 2) {
      //React functional state update. As I understand. this is how u get previous states of vaiables
      setQueryHistory((prev) => {
        if (!prev.includes(currentQuery)) {
          return [currentQuery, ...prev].slice(0, 10);
        }
        return prev;
      });
    }
    console.log("Search triggered"); //Debugging (REMOVE FROM FINAL)
    // Sets cache key for using filter filter type and normalized query
    const SEARCH_CACHE_KEY = (query, filter_type) =>
      `search-${filter_type}-${query.toLowerCase().trim()}`;
    const cacheKey = SEARCH_CACHE_KEY(currentQuery, currentFilterType);
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
        if (decompressed.results) {
          setResults({
            unified: true,
            allResults: decompressed.results,
          });
        } else if (decompressed.tmdb_movie) {
          setResults({
            unified: false,
            tmdb_movie: decompressed.tmdb_movie || [],
          });
        } else {
          setResults({ unified: false, tmdb_tv: decompressed.tmdb_tv || [] });
        }
        setQuery(""); //Clears search bar on successfull search
        setShowDropdown(true);
        setLoading(false);
        return;
      } else {
        localStorage.removeItem(cacheKey);
      }
    }
    try {
      //Handle server unreachable
      // Makes request to Flask API search endpoint with query and filter type
      const response = await axios.get(`${host}search`, {
        params: { query: currentQuery, filter_type: currentFilterType },
      });

      // Update results state with API response
      if (response.data.results) {
        setResults({
          unified: true,
          allResults: response.data.results,
        });
      } else if (response.data.tmdb_movie) {
        setResults({
          unified: false,
          tmdb_movie: response.data.tmdb_movie || [],
        });
      } else {
        setResults({ unified: false, tmdb_tv: response.data.tmdb_tv || [] });
      }

      setShowDropdown(true);
      setQuery("");

      //Sets response to cache to limit API calls. Compresses for storage optimization
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          compressed: true,
          data: LZString.compress(JSON.stringify(response.data)),
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error("Error searching data: ", error);
      alert("Unable to connect to the server. Please try again later.");
      setQuery("");
      setIsExpanded(true);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
    setLoading(false);
  };

  const handleResultClick = async (item) => {
    setShowDropdown(false);
    setLoading(true);
    setIsExpanded(false);

    try {
      const detailData = await getDetails(item.id, item.media_type);
      setSelectedItem(detailData);
    } catch (error) {
      console.error("Error fetching details: ", error);
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

      // Filter keys that match cache
      const cacheKeys = keys.filter(
        (key) =>
          key.startsWith("search-") ||
          key.startsWith("details-") ||
          key.startsWith("recommendations-")
      );

      // Remove all cache items
      cacheKeys.forEach((key) => localStorage.removeItem(key));

      alert("Cache cleared successfully!");
    }
  };

  const handleHistoryItemClick = (historyItem) => {
    handleSearch(historyItem, "all");
  };
  return (
    <div ref={searchContainerRef} className="position-relative">
      <div onSubmit={(e) => e.preventDefault()}>
        <InputGroup
          className={`search-container ${isExpanded ? "expanded" : ""} ${
            showDropdown ? "results-visible" : ""
          }`} //Changes class depending on state
        >
          {!isExpanded ? (
            <InputGroup.Text className="search-trigger" onClick={handleExpand}>
              <GoSearch className="search-icon" />
            </InputGroup.Text>
          ) : (
            <Form.Control
              ref={searchInputRef}
              type="search"
              placeholder="Search Movies and TV shows..."
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (queryHistory.length > 0) {
                  setShowHistory(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowHistory(false);
                }, 200);
              }}
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
      {isExpanded && showHistory && queryHistory.length > 0 && (
        <div className="search-history-container">
          <div className="search-history-header">Recent Searches</div>
          {queryHistory.map((historyItem, index) => (
            <div
              key={index}
              className="search-history-item"
              onClick={() => handleHistoryItemClick(historyItem)}
            >
              <GoClock className="search-history-icon" />
              <span className="search-history-text">{historyItem}</span>
            </div>
          ))}
          <div
            className="search-history-clear"
            onClick={() => setQueryHistory([])}
          >
            Clear History
          </div>
        </div>
      )}

      {/*Results Dropdown*/}
      {showDropdown && results && (
        <Dropdown.Menu show={true} className="search-results-container show">
          {results.unified ? (
            results.allResults && results.allResults.length > 0 ? (
              <div className="search-result-item">
                {results.allResults.map((item) => (
                  <SearchResultItem
                    key={`${item.media_type}-${item.id}`}
                    item={item}
                    onClick={handleResultClick}
                  />
                ))}
              </div>
            ) : (
              <div className="no-results">No results found</div>
            )
          ) : results.tmdb_movie || results.tmdb_tv ? (
            <>
              {/* Movies Section */}
              <div className="search-result-item">
                {results.tmdb_movie && (
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
              </div>
              {/* TV Shows Section */}
              <div className="search-result-item">
                {results.tmdb_tv && (
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
              </div>
            </>
          ) : (
            <div className="no-results">No results found</div>
          )}
        </Dropdown.Menu>
      )}

      {/*Detail Modal*/}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          show={!!selectedItem}
          onHide={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

export default SearchWidget;
