// src/components/WatchlistCard.js
import React, { useState } from "react";
import { Card, Dropdown, Button } from "react-bootstrap";
import { FaStar, FaInfoCircle, FaTrash } from "react-icons/fa";
import "../styles/Watchlist.css";

const WatchlistCard = ({
  item,
  onUpdateStatus,
  onInfoClick,
  onRemoveClick,
}) => {
  const [hover, setHover] = useState(false);

  return (
    <Card
      className="wl-card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Card.Img
        variant="top"
        src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
        alt={item.title}
        onClick={() => onInfoClick(item)}
      />

      {hover && (
        <Card.ImgOverlay className="wl-overlay">
          <Dropdown className="wl-status-dropdown">
            <Dropdown.Toggle size="sm" variant="info">
              {item.status}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {[
                "Plan to watch",
                "Currently watching",
                "On hold",
                "Stopped watching",
                "Finished watching",
              ].map((s) => (
                <Dropdown.Item
                  key={s}
                  active={item.status === s}
                  onClick={() =>
                    onUpdateStatus(item.watchlist_id, item.media_id, s)
                  }
                >
                  {s}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Card.ImgOverlay>
      )}

      <Card.Body>
        <Card.Title>{item.title}</Card.Title>
        <div className="wl-footer">
          <FaStar className="wl-star" /> {(item.rating || 0).toFixed(1)}
        </div>
        <div className="wl-actions">
          <Button
            variant="danger"
            size="sm"
            onClick={() => onRemoveClick(item)}
          >
            <FaTrash /> Remove
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default WatchlistCard;
