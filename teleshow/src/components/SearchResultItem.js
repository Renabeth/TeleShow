//Written by Moses Pierre
import React from "react";
import { Dropdown } from "react-bootstrap";
import { FiTv } from "react-icons/fi";
import { BiMovie } from "react-icons/bi";

const SearchResultItem = ({ item, onClick, loading = false }) => {
  if (loading) {
    return (
      <Dropdown.Item className="py-3 d-flex align-items-center skeleton-search-item">
        <div className="skeleton-poster me-3 rounded"></div>
        <div className="search-item-details">
          <div className="skeleton-title"></div>
          <div className="skeleton-year"></div>
        </div>
      </Dropdown.Item>
    );
  }
  const image_url = `https://image.tmdb.org/t/p/w500${item.poster_path}`; // Base URL for TMDB image paths
  const hasValidPoster = item.poster_path != null;
  return (
    <Dropdown.Item
      className="py-3 d-flex align-items-center"
      onClick={() => onClick(item)}
    >
      {hasValidPoster ? (
        <img
          src={image_url}
          alt={`${item.title || item.name} Poster`}
          className="me-3 rounded"
          style={{ width: "45px", height: "67px", objectFit: "cover" }}
        />
      ) : (
        <div className={`poster-placeholder ${item.media_type}`}>
          {/* Uses icons as placeholders */}
          {item.media_type === "tv" ? (
            <FiTv size={55} />
          ) : (
            <BiMovie size={55} />
          )}
        </div>
      )}
      <div className="fw-bold">
        {item.title || item.name}
        <br></br>
        <p className="text-muted">
          {item.release_date?.substring(0, 4) ||
            item.first_air_date?.substring(0, 4) ||
            "Unknown Year"}
        </p>
      </div>
    </Dropdown.Item>
  );
};

export default SearchResultItem;
