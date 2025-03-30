//Written by Moses Pierre
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Card, Row, Col, Alert, Button } from "react-bootstrap";
import { FaSyncAlt } from "react-icons/fa";
import "./TVCalendar.css";

const TVCalendar = ({ isLoggedIn }) => {
  const [calendarItems, setCalendarItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const image_url = "https://image.tmdb.org/t/p/w185";
  const userId = sessionStorage.getItem("userId");

  //If the user is logged in the calendar information is fetched from firebase
  useEffect(() => {
    if (isLoggedIn) {
      fetchCalendar();
    }
  }, [isLoggedIn]);

  //Uses the /tv/calendar endpoints to get Calendar entries from firebase
  const fetchCalendar = async () => {
    setLoading(true);
    setError(null);
    if (!userId) {
      setError("Please log in to view your Calendar");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`http://localhost:5000/tv/calendar`, {
        params: { user_id: userId },
      });

      setCalendarItems(response.data.calendar || []);
    } catch (err) {
      console.error("Error fetching TV calendar:", err);
      setError("Failed to load your TV calendar. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  //Uses the /tv/update-calendar to update the calendar
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
        `http://localhost:5000/tv/update-calendar`,
        {
          user_id: userId,
        }
      );

      if (response.data.status === "success") {
        // Refresh calendar after update
        fetchCalendar();
      }
    } catch (err) {
      console.error("Error updating TV calendar:", err);
      setError("Failed to update your TV calendar. Please try again.");
      setLoading(false);
    }
  };

  //Groups the items in calendar by air date
  const groupByDate = (items) => {
    const groups = {};
    items.forEach((item) => {
      if (!groups[item.air_date]) {
        groups[item.air_date] = [];
      }
      groups[item.air_date].push(item);
    });

    return groups;
  };

  //Formats date in weekday,year,month,day format
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
          No upcoming episodes for your followed shows.
          <br />
          Follow TV shows to track their air dates!
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
    <div className="tv-calendar">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>TV Show Calendar</h2>
        <Button
          variant="outline-primary"
          onClick={updateCalendar}
          disabled={loading}
        >
          <FaSyncAlt className={loading ? "spin-icon" : ""} /> Refresh
        </Button>
      </div>

      {/*Object.keys uses the keys given in the groupByDate function to order shows  */}
      {Object.keys(dateGroups)
        .sort()
        .map((date) => (
          <div key={date} className="date-group mb-4">
            <h3 className="date-header">{formatDate(date)}</h3>
            <Row xs={1} md={2} lg={3} className="g-4">
              {dateGroups[date].map((item) => (
                <Col key={item.id}>
                  <Card className="tv-calendar-card h-100">
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
                        <div className="episode-info">
                          <div className="episode-number">
                            S{item.season}E{item.episode}
                          </div>
                          <div className="episode-name">
                            {item.episode_name}
                          </div>
                        </div>
                      </Card.Body>
                    </div>
                    {item.overview && (
                      <Card.Footer>
                        <small className="text-muted">{item.overview}</small>
                      </Card.Footer>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ))}
    </div>
  );
};

export default TVCalendar;
