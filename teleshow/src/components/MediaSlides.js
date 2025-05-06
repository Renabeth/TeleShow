//Written by Moses Pierre
import React, { useRef, useState, useEffect } from "react";
import "./MediaSlides.css";
import { FaArrowAltCircleLeft, FaArrowAltCircleRight } from "react-icons/fa";
import DetailModal from "./DetailModal";

function MediaSlides({ items, autoplay = true, loading = false }) {
  const slideRef = useRef(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const imageBaseUrl = "https://image.tmdb.org/t/p/w500";

  useEffect(() => {
    //Sets up the autoplay
    //Every 4 seconds the slides scrolls left 300pixels
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
      }, 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoplay, items]);

  const handleItemClick = (item) => {
    console.log("item clicked", item);
    //Media type has to be set since it doesn't give it automatically.
    if (item.title) {
      item.media_type = "movie";
    } else {
      item.media_type = "tv";
    }
    setSelectedItem(item);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    setShowModal(false);
  };

  const renderSkeletonItems = () => {
    return Array(6)
      .fill()
      .map((_, index) => (
        <div key={index} className="slide-item skeleton-item">
          <div className="slide-item-inner">
            <div className="skeleton-image"></div>
            <div className="slide-item-overlay skeleton-overlay">
              <div className="skeleton-title"></div>
              <div className="item-info">
                <div className="skeleton-year"></div>
              </div>
            </div>
          </div>
        </div>
      ));
  };

  return (
    <div className="media-slide-container">
      <div className="media-slide" ref={slideRef}>
        {loading
          ? renderSkeletonItems()
          : items.map((item, index) => (
              <div
                key={index}
                className="slide-item"
                onClick={() => handleItemClick(item)}
              >
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
      {!loading && items.length > 0 && (
        <>
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
        </>
      )}
      {selectedItem && showModal && (
        <DetailModal
          mediaId={selectedItem.id}
          mediaType={selectedItem.media_type}
          show={showModal}
          onHide={handleCloseModal}
        />
      )}
    </div>
  );
}

export default MediaSlides;
