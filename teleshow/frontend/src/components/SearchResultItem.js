//Written by Moses Pierre
import React from "react";
import { Dropdown } from "react-bootstrap";
import { FiTv } from "react-icons/fi";
import { BiMovie } from "react-icons/bi";

const SearchResultItem = ({ item, onClick }) => {
  const image_url = `https://image.tmdb.org/t/p/w92${item.poster_path}`; // Base URL for TMDB image paths
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
          {/* You can use your existing FiTv icon for TV shows */}
          {item.media_type === "tv" ? (
            <FiTv size={55} />
          ) : (
            <BiMovie size={55} />
          )}
        </div>
      )}
      <div className="fw-bold">{item.title || item.name} </div>
      <div className="text-muted small">
        {item.release_date?.substring(0, 4) ||
          item.first_air_date?.substring(0, 4) ||
          "Unknown Year"}
      </div>
    </Dropdown.Item>
  );
};

export default SearchResultItem;
