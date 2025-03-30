//Written by Moses Pierre
import React, { useRef, useState, useEffect } from "react";
import "./MediaSlides.css";
import { FaArrowAltCircleLeft, FaArrowAltCircleRight } from "react-icons/fa";

function MediaSlides({ items, autoplay }) {
  const slideRef = useRef(null);

  const imageBaseUrl = "https://image.tmdb.org/t/p/w500";

  useEffect(() => {
    //Sets up the autoplay
    //Every 5 seconds the slides scrolls left 300pixels
    //If it reaches the end then it goes back to the beginning
    let interval;
    if (autoplay && items.length > 0) {
      interval = setInterval(() => {
        if (slideRef.current) {
          slideRef.current.scrollLeft += 300;

          if (
            slideRef.current.scrollLeft >=
            slideRef.current.scrollWidth - slideRef.current.clientWidth - 10
          ) {
            slideRef.current.scrollLeft = 0;
          }
        }
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoplay, items]);

  return (
    <div className="media-slide-container">
      <div className="media-slide" ref={slideRef}>
        {items.map((item) => (
          <div key={item.id} className="slide-item">
            <div className="slide-item-inner">
              <img
                src={`${imageBaseUrl}${item.poster_path}`}
                alt={item.title || item.name}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/Logo.png";
                }}
              />
              <div className="slide-item-overlay">
                <h3>{item.title || item.name}</h3>
                <div className="item-info">
                  <span className="year">
                    {(item.release_date || item.first_air_date)?.substring(
                      0,
                      4
                    ) || "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        className="slide-nav-prev"
        onClick={() => {
          slideRef.current.scrollLeft -= slideRef.current.offsetWidth / 2;
        }}
      >
        <FaArrowAltCircleLeft />
      </button>

      <button
        className="slide-nav-next"
        onClick={() => {
          slideRef.current.scrollLeft += slideRef.current.offsetWidth / 2;
        }}
      >
        <FaArrowAltCircleRight />
      </button>
    </div>
  );
}

export default MediaSlides;
