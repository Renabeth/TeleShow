import React, { useState, useEffect } from "react";
import axios from "axios";
import { Card, Row, Col, Alert, Button, Badge } from "react-bootstrap";
import { FaSyncAlt } from "react-icons/fa";
import "./MediaCalendar.css";

const MediaCalendar = ({ isLoggedIn }) => {
  const [calendarItems, setCalendarItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const image_url = "https://image.tmdb.org/t/p/w185";
  const userId = sessionStorage.getItem("userId");
  const host = process.env.REACT_APP_NETWORK_HOST;

  useEffect(() => {
    if (isLoggedIn) {
      fetchCalendar();
    }
  }, [isLoggedIn]);

  const fetchCalendar = async () => {
    setLoading(true);
    setError(null);
    if (!userId) {
      setError("Please log in to view your Calendar");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${host}interactions/media/calendar`, {
        params: { user_id: userId },
      });

      setCalendarItems(response.data.calendar || []);
    } catch (err) {
      console.error("Error fetching media calendar:", err);
      setError("Failed to load your calendar. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateCalendar = async () => {
    setLoading(true);
    setError(null);

    if (!userId) {
      setError("Please log in to update your Calendar");
      setLoading(false);
      return;
    }
    try {
      const response = await axios.post(
        `${host}interactions/media/update-calendar`,
        {
          user_id: userId,
        }
      );

      if (response.data.status === "success") {
        fetchCalendar();
      }
    } catch (err) {
      console.error("Error updating media calendar:", err);
      setError("Failed to update your calendar. Please try again.");
      setLoading(false);
    }
  };

  const groupByDate = (items) => {
    const groups = {};
    items.forEach((item) => {
      // Handle both TV air_date and movie release_date
      const dateField = item.release_date || item.air_date;
      if (!groups[dateField]) {
        groups[dateField] = [];
      }
      groups[dateField].push(item);
    });

    return groups;
  };

  const formatDate = (dateString) => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Date(dateString).toLocaleDateString("en-US", options);
  };

  if (!isLoggedIn) {
    return <Alert variant="info">Please log in to view your Calendar</Alert>;
  }

  if (loading && calendarItems.length === 0) {
    return (
      <div className="text-center p-5">
        <div className="spinner-border" role="status"></div>
      </div>
    );
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (calendarItems.length === 0) {
    return (
      <div className="text-center p-5">
        <Alert variant="info">
          No upcoming releases for your followed media.
          <br />
          Follow TV shows and Movies to track their release dates!
        </Alert>
        <Button variant="primary" onClick={updateCalendar} disabled={loading}>
          <FaSyncAlt className={loading ? "spin-icon" : ""} />
          Check for updates
        </Button>
      </div>
    );
  }

  const dateGroups = groupByDate(calendarItems);

  return (
    <div className="media-calendar">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Button
          variant="outline-primary"
          onClick={updateCalendar}
          disabled={loading}
        >
          <FaSyncAlt className={loading ? "spin-icon" : ""} /> Refresh
        </Button>
      </div>

      {Object.keys(dateGroups)
        .sort()
        .map((date) => (
          <div key={date} className="date-group mb-4">
            <h3 className="date-header">{formatDate(date)}</h3>
            <Row xs={1} md={2} lg={3} className="g-4">
              {dateGroups[date].map((item) => (
                <Col key={item.id}>
                  <Card className="media-calendar-card h-100">
                    <div className="d-flex">
                      {item.poster_path ? (
                        <Card.Img
                          variant="left"
                          src={`${image_url}${item.poster_path}`}
                          className="calendar-poster"
                        />
                      ) : (
                        <div className="calendar-poster no-poster">
                          No Poster
                        </div>
                      )}
                      <Card.Body>
                        <Card.Title>{item.title}</Card.Title>
                        <Badge
                          bg={item.media_type === "tv" ? "primary" : "success"}
                          className="mb-2"
                        >
                          {item.media_type === "tv" ? "TV Show" : "Movie"}
                        </Badge>
                        {item.media_type === "tv" ? (
                          <div className="episode-info">
                            <div className="episode-number">
                              S{item.season}E{item.episode}
                            </div>
                            <div className="episode-name">
                              {item.episode_name}
                            </div>
                          </div>
                        ) : (
                          <div className="movie-info">
                            <div className="release-info">Movie Release</div>
                          </div>
                        )}
                      </Card.Body>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ))}
    </div>
  );
};

export default MediaCalendar;
