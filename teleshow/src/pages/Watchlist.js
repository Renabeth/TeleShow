// src/pages/Watchlist.js
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Navbar,
  Nav,
  Button,
  Spinner,
  Card,
  Badge,
  ToggleButtonGroup,
  ToggleButton,
  Modal,
  Form,
} from "react-bootstrap";
import {
  FaBars,
  FaTimes,
  FaPlus,
  FaTrash,
  FaMoon,
  FaSun,
  FaArrowLeft,
} from "react-icons/fa";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Watchlist.css";
import DetailModal from "../components/DetailModal";
import GetAverageRating from "../scripts/GetAverageRating.js";
import WatchlistCard from "../components/WatchlistCard";

const Watchlist = () => {
  const host = process.env.REACT_APP_NETWORK_HOST;
  const userID = sessionStorage.getItem("userId") || "";
  const [watchlists, setWatchlists] = useState([]);
  const [selectedList, setSelectedList] = useState("all");
  const [allMedia, setAllMedia] = useState([]);
  const [filteredMedia, setFilteredMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState(null);
  const [tabOpen, setTabOpen] = useState("overview");
  const [showListSelect, setShowListSelect] = useState(false);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [chosenList, setChosenList] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [userMedia, setUserMedia] = useState([]);
  const [trendingMedia, setTrendingMedia] = useState([]);
  const [selectedStarters, setSelectedStarters] = useState(new Set());
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [watchlistsWithMedia, setWatchlistsWithMedia] = useState([]);

  useEffect(() => {
    if (!userID) return;
    fetchWatchlists();
  }, [userID]);

  useEffect(() => {
    axios
      .get(`${host}interactions/get_followed`, { params: { user_id: userID } })
      .then((response) => {
        const tv = response.data.followed_tv || [];
        const movie = response.data.followed_movies || [];
        const all = [...tv, ...movie];
        if (all.length) setUserMedia(all);
        else {
          axios
            .get(`${host}trending`)
            .then((response) => setTrendingMedia(response.data.results || []))
            .catch(() => setTrendingMedia([]));
        }
      })
      .catch(() => {
        axios
          .get(`${host}trending`)
          .then((response) => setTrendingMedia(response.data.results || []))
          .catch(() => setTrendingMedia([]));
      });
  }, [showCreateModal]);

  useEffect(() => {
    // filter media whenever list changes
    if (selectedList === "all") {
      setFilteredMedia(allMedia);
    } else {
      setFilteredMedia(allMedia.filter((m) => m.watchlist_id === selectedList));
    }
  }, [selectedList, allMedia]);

  const fetchWatchlists = async () => {
    setLoading(true);
    try {
      const resp = await axios.get(`${host}interactions/get-watchlists`, {
        params: { user_id: userID },
      });
      const lists = resp.data.watchlists || [];
      setWatchlists(lists);
      const ids = lists.map((l) => l.id);
      await fetchMedia(ids);
    } catch (err) {
      console.error("Error loading watchlists", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMedia = async (ids) => {
    if (!ids.length) {
      setAllMedia([]);
      return;
    }
    try {
      const resp = await axios.post(
        `${host}interactions/get-multiple-watchlist-media`,
        { user_id: userID, watchlist_ids: ids }
      );

      const allMedia = resp.data.media || [];

      //Create a list of ids and media types to pass to ratings endpoint
      const mediaItems = allMedia.map((item) => ({
        media_id: item.media_id,
        media_type: item.media_type,
      }));

      //Get all ratings in a single request
      const ratingsResponse = await fetchRatings(mediaItems);

      // Update media with ratings and fetch average ratings
      if (ratingsResponse && ratingsResponse.ratings) {
        for (const item of allMedia) {
          const ratingKey = `${item.media_type}_${item.media_id}`;
          item.rating = ratingsResponse.ratings[ratingKey] || 0;
          item.averageRating = await GetAverageRating(
            item.media_id,
            item.media_type
          );
        }
      }
      setAllMedia(allMedia || []);
    } catch (err) {
      console.error("Error loading media", err);
    }
  };

  const removeMedia = async (media, watchlistID) => {
    try {
      await axios.post(`${host}interactions/remove-from-watchlist`, {
        user_id: userID,
        watchlist_id: watchlistID,
        media_id: media.media_id,
      });
      fetchWatchlists();
    } catch (err) {
      console.error("Remove failed", err);
    }
  };

  const fetchRatings = async (mediaItems) => {
    try {
      const response = await axios.post(
        `${host}interactions/get-multiple-ratings`,
        {
          user_id: userID,
          media_items: mediaItems,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error getting rating:", error);
    }
  };

  const handleRemoveClick = (media) => {
    if (selectedList === "all") {
      setPendingMedia(media);
      setChosenList("");
      // Filters watchlists to only include those containing the media
      const relevantWatchlists = watchlists.filter((wl) =>
        allMedia.some(
          (item) =>
            item.watchlist_id === wl.id &&
            item.media_id === media.media_id &&
            item.media_type === media.media_type
        )
      );
      if (relevantWatchlists.length < 2) {
        removeMedia(media, media.watchlist_id);
        return;
      }
      setWatchlistsWithMedia(relevantWatchlists);
      setShowListSelect(true);
    } else {
      removeMedia(media, selectedList);
    }
  };

  const deleteWatchlist = async (watchlistId, event) => {
    event.stopPropagation(); //Prevents further interaction with watchlist before deleting or canceling

    if (
      window.confirm(
        "are you sure you want to delete this watchlist? This action can not be undone."
      )
    ) {
      try {
        const response = await axios.post(
          `${host}interactions/delete-watchlist`,
          {
            user_id: userID,
            watchlist_id: watchlistId,
          }
        );

        if (response.data.status === "success") {
          alert("Watchlist deleted successfully.");
          fetchWatchlists(userID);
        } else {
          alert("Failed to delete watchlist.");
        }
      } catch (error) {
        console.error("Error deleting watchlist:", error);
        alert("An error occurred while deleting the watchlist.");
      }
    }
  };

  const updateStatus = async (watchlistId, mediaId, watchStatus) => {
    try {
      const response = await axios.post(
        `${host}interactions/update-media-status`,
        {
          user_id: userID,
          watchlist_id: watchlistId,
          media_id: mediaId,
          status: watchStatus,
        }
      );

      if (response.data.status === "success") {
        await fetchWatchlists(userID);
        alert("Status updated successfully.");
      } else {
        alert("Failed to update status.");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("An error occurred while updating the status.");
    }
  };

  const handleItemClick = (item, tab) => {
    console.log("item clicked", item);
    setSelectedItem(item);
    setTabOpen(tab);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    setShowModal(false);
    fetchWatchlists();
  };

  return (
    <div className={lightMode ? "watchlist light" : "watchlist dark"}>
      <Navbar className="wl-header" expand="md" sticky="top">
        <Container>
          <div className="d-flex align-items-center">
            <Button
              variant="secondary"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <FaTimes /> : <FaBars />} Watchlists
            </Button>
            <Button variant="success" onClick={() => setShowCreateModal(true)}>
              <FaPlus /> New Watchlist
            </Button>
          </div>

          <Nav className="ms-auto align-items-center">
            <Button variant="link" onClick={() => navigate(-1)}>
              <FaArrowLeft /> Go Back
            </Button>
            <ToggleButtonGroup
              type="radio"
              name="theme"
              value={lightMode ? "light" : "dark"}
              onChange={(val) => setLightMode(val === "light")}
            >
              <ToggleButton id="t-dark" value="dark" variant="outline-light">
                <FaMoon />
              </ToggleButton>
              <ToggleButton id="t-light" value="light" variant="outline-light">
                <FaSun />
              </ToggleButton>
            </ToggleButtonGroup>
          </Nav>
        </Container>
      </Navbar>

      <Container className="wl-body">
        <Row>
          {sidebarOpen && (
            <Col md={2} className="wl-sidebar">
              <Nav className="flex-column wl-list-nav">
                <Nav.Link
                  active={selectedList === "all"}
                  onClick={() => setSelectedList("all")}
                >
                  All Media
                </Nav.Link>
                {watchlists.map((list) => (
                  <Nav.Link
                    key={list.id}
                    active={selectedList === list.id}
                    onClick={() => setSelectedList(list.id)}
                  >
                    {list.name}{" "}
                    <FaTrash
                      className="wl-trash"
                      onClick={(e) => {
                        deleteWatchlist(list.id, e);
                      }}
                    />
                  </Nav.Link>
                ))}
              </Nav>
            </Col>
          )}

          <Col md={sidebarOpen ? 10 : 12} className="wl-content">
            <Badge bg="secondary" className="me-2 wl-count">
              {filteredMedia.length} items
            </Badge>
            <Row className="wl-grid">
              {/*...Converts to array
                Converts the media ids to dictionary keys so they are unique
                prevents duplicates
                */}
              {loading
                ? Array(8)
                    .fill()
                    .map((_, index) => (
                      <Col
                        key={`skeleton-${index}`}
                        xs={6}
                        sm={4}
                        lg={3}
                        className="mb-4"
                      >
                        <WatchlistCard loading={true} />
                      </Col>
                    ))
                : filteredMedia.length > 0 &&
                  [
                    ...new Map(
                      filteredMedia.map((item) => [item.media_id, item])
                    ).values(),
                  ].map((item) => (
                    <Col key={item.id} xs={6} sm={4} lg={3} className="mb-4">
                      <WatchlistCard
                        item={item}
                        onUpdateStatus={updateStatus}
                        onInfoClick={handleItemClick}
                        onRemoveClick={handleRemoveClick}
                        loading={loading}
                      />
                    </Col>
                  ))}
            </Row>
          </Col>
        </Row>
      </Container>

      <Modal
        show={showListSelect}
        onHide={() => setShowListSelect(false)}
        centered
        className="delete-watchlist-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Select a Watchlist to Remove From</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Label>Watchlist</Form.Label>
            <Form.Select
              value={chosenList}
              onChange={(e) => setChosenList(e.target.value)}
            >
              <option value="" disabled>
                - select a watchlist -
              </option>
              {watchlistsWithMedia.map((wl) => (
                <option key={wl.id} value={wl.id}>
                  {wl.name}
                </option>
              ))}
            </Form.Select>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowListSelect(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!chosenList}
            onClick={() => {
              removeMedia(pendingMedia, chosenList);
              setShowListSelect(false);
            }}
          >
            Remove
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        size="lg"
        centered
        className="create-watchlist-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Create New Watchlist</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Watchlist Name</Form.Label>
            <Form.Control
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Enter a name for your watchlist"
            />
          </Form.Group>
          <hr />
          <p>Select items to start your watchlist</p>
          <div className="d-flex flex-wrap">
            {(userMedia.length > 0 ? userMedia : trendingMedia).map((item) => {
              const key = `${item.media_type}_${item.media_id}`;
              const selected = selectedStarters.has(key);
              return (
                <Card
                  key={key}
                  style={{ width: "120px", margin: "4px", cursor: "pointer" }}
                  className={selected ? "border border-info border-5" : " "}
                  onClick={() => {
                    const next = new Set(selectedStarters);
                    selected ? next.delete(key) : next.add(key);
                    setSelectedStarters(next);
                  }}
                >
                  <Card.Img
                    variant="top"
                    src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
                  />
                </Card>
              );
            })}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!newListName.trim() || loadingCreate}
            onClick={async () => {
              if (!newListName.trim()) return;
              setLoadingCreate(true);
              try {
                const items = [...selectedStarters];
                if (items.length === 0) {
                  await axios.post(`${host}interactions/add-watchlist`, {
                    user_id: userID,
                    watchlist_name: newListName,
                    media_info: {
                      id: 2912,
                      media_name: "Jeopardy",
                      overview:
                        "America's favorite quiz show where contestants are presented with general knowledge clues in the form of answers, and must phrase their responses in question form.",
                      release_date: "1984-09-10",
                      media_type: "tv",
                      poster_path: "/11rWvQOEZBouD7wet0sWHwu7NDs.jpg",
                    },
                  });
                } else {
                  for (let key of items) {
                    const m = (
                      userMedia.length ? userMedia : trendingMedia
                    ).find((x) => `${x.media_type}_${x.media_id}` === key);

                    await axios.post(`${host}interactions/add-watchlist`, {
                      user_id: userID,
                      watchlist_name: newListName,
                      media_info: {
                        id: m.media_id,
                        media_name: m.title || m.name,
                        overview: m.overview || "",
                        release_date: m.release_date,
                        media_type: m.media_type,
                        poster_path: m.poster_path,
                      },
                    });
                  }
                }
                //Refreshes the watchlists and closes
                await fetchWatchlists();
                setShowCreateModal(false);
                setNewListName("");
                setSelectedStarters(new Set());
              } catch (err) {
                console.error(err);
                alert("Failed to create watchlist");
              } finally {
                setLoadingCreate(false);
              }
            }}
          >
            {loadingCreate ? <Spinner size="sm" /> : "Create"}
          </Button>
        </Modal.Footer>
      </Modal>

      {selectedItem && showModal && (
        <DetailModal
          mediaId={selectedItem.media_id}
          mediaType={selectedItem.media_type}
          show={showModal}
          onHide={handleCloseModal}
          initialTab={tabOpen}
        />
      )}
    </div>
  );
};

export default Watchlist;
