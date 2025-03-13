//Written by Moses Pierre
import React from "react";
import { Dropdown } from "react-bootstrap";

const SearchResultItem = ({ item, onClick }) => {
  const image_url = `https://image.tmdb.org/t/p/w92${item.poster_path}`; // Base URL for TMDB image paths

  return (
    <Dropdown.Item
      className="py-3 d-flex align-items-center"
      onClick={() => onClick(item)}
    >
      <img
        src={image_url}
        alt={`${item.title || item.name} Poster`}
        className="me-3 rounded"
        style={{ width: "45px", height: "67px", objectFit: "cover" }}
      />
      <div>
        <div className="fw-bold">{item.title || item.name}</div>
        <div className="text-muted small">
          {item.release_date?.substring(0, 4) ||
            item.first_air_date?.substring(0, 4) ||
            "Unknown Year"}
        </div>
        <span className="badge bg-primary rounded-pill">
          {"\u2605"} {Math.round(item.vote_average)}{" "}
          {/*Unicode for star symbol*/}
        </span>
      </div>
    </Dropdown.Item>
  );
};

export default SearchResultItem;
