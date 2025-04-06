//Written by Moses Pierre
import React from "react";

const RecommendationList = ({ recommendations, onRecommendationClick }) => {
  const image_url = "https://image.tmdb.org/t/p/w342"; // Base URL for TMDB image paths

  if (!recommendations || recommendations.length === 0) {
    return <p className="text-muted">No recommendations available.</p>;
  }

  return (
    <div className="mt-4">
      <h4 className="mb-3">More Like This</h4>
      <div className="row row-cols-1 row-cols-md-3 row-cols-lg-4 g-4">
        {recommendations?.map((rec) => (
          <div key={rec.id} className="col">
            <div
              className="card h-100 shadow-sm hover-shadow-lg transition recommendation-item"
              onClick={() => onRecommendationClick(rec)}
              role="button"
            >
              {rec.poster_path && (
                <img
                  src={`${image_url}${rec.poster_path}`}
                  className="card-img-top"
                  alt={rec.title || rec.name}
                  loading="lazy"
                />
              )}
              <div className="card-body">
                <h5 className="card-title text-truncate recommendation-title">
                  {rec.title || rec.name}
                </h5>
                <div className="d-flex justify-content-between small mb-2">
                  <span className="badge bg-primary recommendation-details">
                    {rec.release_date?.split("-")[0] ||
                      rec.first_air_date?.split("-")[0]}
                  </span>
                  <span className="badge bg-success recommendation-details">
                    <i className="bi bi-star-fill me-1"></i>
                    {Math.round(rec.vote_average)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default RecommendationList;
