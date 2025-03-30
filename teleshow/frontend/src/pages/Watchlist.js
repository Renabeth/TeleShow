import React from "react";
import "../styles/Dashboard.css";
import "../styles/Watchlist.css";
import GetAverageRating from "../scripts/GetAverageRating.js";

import StarRate from "../components/starRate";

// Credit to JustWatch as TMDB API watch providers data source

// Help from https://developer.themoviedb.org/reference/tv-series-details
// and https://developer.themoviedb.org/reference/movie-details
import axios from "axios";

import { useNavigate } from "react-router-dom";

// Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";

// Help from https://react-bootstrap.netlify.app/docs/components/modal/
import Modal from "react-bootstrap/Modal";

// Help from https://www.freecodecamp.org/news/how-to-use-the-firebase-database-in-react/
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Help from https://firebase.google.com/docs/firestore/query-data/queries
import { query, where } from "firebase/firestore";

// Help from https://dev.to/rajatamil/firebase-v9-firestore-delete-document-using-deletedoc-5bjh
import { doc, deleteDoc } from "firebase/firestore";

// Help from https://react-bootstrap.netlify.app/docs/components/buttons/
import Button from "react-bootstrap/Button";

// Help from https://react-bootstrap.netlify.app/docs/forms/select/
import Form from "react-bootstrap/Form";

// Help from https://www.geeksforgeeks.org/writing-and-reading-data-in-cloud-firestore/
import { updateDoc } from "firebase/firestore";

// Help from https://react-bootstrap.netlify.app/docs/components/button-group/
import ButtonGroup from "react-bootstrap/ButtonGroup";

// Help from https://www.youtube.com/watch?v=91LWShFZn40
import { getAggregateFromServer, average } from "firebase/firestore";

function Watchlist() {
  const [watchlists, setWatchlists] = useState([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState("all");
  const [filteredMedia, setFilteredMedia] = useState([]);
  const [allWatchlistMedia, setAllWatchlistMedia] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const [loggedIn, setLoggedIn] = useState(false);
  const [userID, setUserID] = useState("");

  // Copied from Dashboard.js
  const [modalTitle, setModalTitle] = useState("");
  const [modalPoster, setModalPoster] = useState("");
  const [modalOverview, setModalOverview] = useState("");
  const [modalLanguages, setModalLanguages] = useState("");

  const [modalProvidersBuy, setModalProvidersBuy] = useState("");
  const [modalProvidersFlatrate, setModalProvidersFlatrate] = useState("");
  const [modalProvidersRent, setModalProvidersRent] = useState("");

  // Help from https://www.geeksforgeeks.org/how-to-create-dark-light-theme-in-bootstrap-with-react/
  const [isLightMode, setIsLightMode] = useState(false);

  // Help from https://www.rowy.io/blog/firestore-react-query
  const [loading, setLoading] = useState(false);

  // Help from https://www.geeksforgeeks.org/how-to-create-dark-light-theme-in-bootstrap-with-react/
  const toggleLightMode = () => {
    setIsLightMode((prevMode) => !prevMode);
  };

  // Help from https://developer.themoviedb.org/docs/image-basics
  const imgPath = "https://image.tmdb.org/t/p/w500";

  // Help from https://react-bootstrap.netlify.app/docs/components/modal/
  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  //Updates filtered media when selection changes
  useEffect(() => {
    if (selectedWatchlistId === "all") {
      setFilteredMedia(allWatchlistMedia);
    } else {
      setFilteredMedia(
        allWatchlistMedia.filter(
          (media) => media.watchlist_id === selectedWatchlistId
        )
      ); // Only show the media in respective watchlist
    }
  }, [selectedWatchlistId, allWatchlistMedia]);

  // Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        const uid = user.uid;
        console.log("uid", uid);
        setLoggedIn(true);
        setUserID(uid);

        // Help from https://stackoverflow.com/questions/68260152/firebase-auth-currentuser-is-null-at-page-load/68260898#68260898
        fetchAllWatchlistMedia(uid);
      } else {
        console.log("You are currently logged out.");
        setLoggedIn(false);
        setUserID("");
        setAllWatchlistMedia([]);
        setFilteredMedia([]);
      }
    });

    // Help from https://www.rowy.io/blog/firestore-react-query
    //fetchWatchlist()

    // Help from https://stackoverflow.com/questions/53070970/infinite-loop-in-useeffect
  }, []);

  //Get all the users watchlists from the flask endpoint
  const fetchWatchlists = async (userId) => {
    setLoading(true);
    try {
      const response = await axios.get(
        "http://localhost:5000/interactions/get-watchlists",
        {
          params: { user_id: userId },
        }
      );
      return response.data.watchlists || [];
    } catch (error) {
      console.error("Error fetching watchlists", error);
      return [];
    } finally {
      setLoading(false);
    }
  };
  //Gets media in specific watchlist
  const fetchWatchlistMedia = async (userId, watchlistId, watchlistName) => {
    try {
      const response = await axios.get(
        "http://localhost:5000/interactions/get-watchlist-media",
        {
          params: {
            user_id: userId,
            watchlist_id: watchlistId,
          },
        }
      );

      const mediaWithWatchlistInfo = (response.data.media || []).map(
        (item) => ({
          ...item, //...Used to get all the items from the object instead of going through with dot operator
          watchlist_name: watchlistName,
          watchlist_id: watchlistId,
        })
      );

      return mediaWithWatchlistInfo;
    } catch (error) {
      console.error(
        `Error fetching media for watchlist ${watchlistId}:`,
        error
      );
      return [];
    }
  };
  //Gets all watchlist media to display in watchlist page
  const fetchAllWatchlistMedia = async (userId) => {
    setLoading(true);

    try {
      //Get all of the user's watchlists
      const watchlists = await fetchWatchlists(userId);
      const initializedItems = new Set();
      setWatchlists(watchlists);

      if (watchlists.length === 0) {
        setAllWatchlistMedia([]);
        setLoading(false);
        return;
      }
      //Get all the media and combine
      let allMedia = [];

      for (const watchlist of watchlists) {
        const media = await fetchWatchlistMedia(
          userId,
          watchlist.id,
          watchlist.name
        );
        allMedia = [...allMedia, ...media];
      }
      setAllWatchlistMedia(allMedia);

      for (const item of allMedia) {
        const key = `${item.media_id}-${item.media_type}`;
        if (!initializedItems.has(key)) {
          initializedItems.add(key);
          await initializeRating(userId, item.media_id, item.media_type);
        }
      }
    } catch (error) {
      console.error("Error fetch all watchlist media:", error);
    }
    setLoading(false);
  };

  const initializeRating = async (userId, mediaId, mediaType) => {
    try {
      await axios.post(
        "http://localhost:5000/interactions/initialize-ratings",
        {
          user_id: userId,
          media_id: mediaId,
          media_type: mediaType,
        }
      );
    } catch (error) {
      console.error("Error initializing rating:", error);
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
          "http://localhost:5000/interactions/delete-watchlist",
          {
            user_id: userID,
            watchlist_id: watchlistId,
          }
        );

        if (response.data.status === "success") {
          alert("Watchlist delete successfully.");
          setSelectedWatchlistId("all");
          fetchAllWatchlistMedia(userID);
        } else {
          alert("Failed to delte watchlist.");
        }
      } catch (error) {
        console.error("Error deleting watchlist:", error);
        alert("An error occurred while deleting the watchlist.");
      }
    }
  };

  const removeFromWatchlist = async (watchlistId, mediaId) => {
    try {
      const response = await axios.post(
        "http://localhost:5000/interactions/remove-from-watchlist",
        {
          user_id: userID,
          watchlist_id: watchlistId,
          media_id: mediaId,
        }
      );

      if (response.data.status === "success") {
        alert("Item removed from watchlist successfully.");
        fetchAllWatchlistMedia(userID);
      } else {
        alert("Failed to remove item from watchlist.");
      }
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      alert("An error occured while removing from watchlist");
    }
  };

  const displayInformation = async (id, type) => {
    try {
      console.log(type);
      const response = await axios.get("http://localhost:5000/search/details", {
        params: {
          id: id,
          type: type,
        },
      });
      const tmdbData = response.data.tmdb;
      setModalTitle(tmdbData.title || tmdbData.name);
      setModalOverview(tmdbData.overview);
      setModalPoster(`${imgPath}${tmdbData.poster_path}`);
      const languages = tmdbData?.spoken_languages
        .map((language) => language.name)
        .join(",");
      
      setModalLanguages(languages ? languages : "");
      
      setModalProvidersBuy("");
      setModalProvidersFlatrate("");
      setModalProvidersRent("");
      handleShow();
    } catch (error) {
      console.error("Error fetching media details:", error);
      alert("Failed to load media details. Please try again later.");
    }
  };

  const updateStatus = async (watchlistId, mediaId, watchStatus) => {
    try {
      const response = await axios.post(
        "http://localhost:5000/interactions/update-media-status",
        {
          user_id: userID,
          watchlist_id: watchlistId,
          media_id: mediaId,
          status: watchStatus,
        }
      );

      if (response.data.status === "success") {
        fetchAllWatchlistMedia(userID);
      } else {
        alert("Failed to update status.");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("An error occurred while updating the status.");
    }

    /*
        // Help from https://firebase.google.com/docs/firestore/manage-data/add-data
        // And https://www.geeksforgeeks.org/writing-and-reading-data-in-cloud-firestore/
        // And https://www.geeksforgeeks.org/react-bootstrap-select/
        */
  };

  const returnToDashboard = () => {
    navigate("/dashboard");
  };

  // From Dashboard.js
  const navigate = useNavigate();

  return (
    <div
      className={`container ${
        isLightMode ? "watchlistLight" : "watchlistDark"
      }`}
      id="watchlistContainer"
    >
      {/* Help from https://react-bootstrap.netlify.app/docs/components/modal/ */}
      {/* And https://github.com/react-bootstrap/react-bootstrap/issues/3794 */}
      {/* And https://www.geeksforgeeks.org/how-to-use-modal-component-in-reactjs/# */}
      {/* Copied from Dashboard.js */}
      <Modal
        show={show}
        onHide={handleClose}
        backdrop="static"
        keyboard={false}
        dialogClassName="modal-85w"
      >
        {/* Help from https://stackoverflow.com/questions/76810663/react-modals-or-dialogs-doesnt-inherit-the-dark-mode-styles-tailwind */}
        {/* And https://www.geeksforgeeks.org/how-to-create-dark-light-theme-in-bootstrap-with-react/# */}
        <Modal.Header
          className={`${isLightMode ? "head-light" : "head-dark"}`}
          closeButton
        >
          <Modal.Title>{modalTitle || "None"}</Modal.Title>
        </Modal.Header>

        {/* Help from https://stackoverflow.com/questions/76810663/react-modals-or-dialogs-doesnt-inherit-the-dark-mode-styles-tailwind */}
        {/* And https://www.geeksforgeeks.org/how-to-create-dark-light-theme-in-bootstrap-with-react/# */}
        <Modal.Body
          className={`modalBody ${isLightMode ? "body-light" : "body-dark"}`}
        >
          <div className="modalBox">
            <div className="modalLeft">
              <img
                className="modalPoster"
                id="modalPoster"
                src={modalPoster}
                alt="modal poster"
              />
            </div>
            <div className="modalRight">
              <h2>Overview</h2>
              <div id="overviewBox">{modalOverview || "None"}</div>
              <hr />
              <h3>Spoken Languages</h3>
              {modalLanguages || "None"}
              <hr />
              <h3>Watch Providers</h3>
              <h4>Buy</h4>
              {modalProvidersBuy || "None"}
              <h4>Flatrate</h4>
              {modalProvidersFlatrate || "None"}
              <h4>Rent</h4>
              {modalProvidersRent || "None"}
            </div>
          </div>
        </Modal.Body>
      </Modal>

      <div className="watchlistBox">
        <div className="watchlistLeft">
          {loggedIn ? "Logged in" : "Logged out"}
          <br />
          <br />

          {/* Help from https://react-bootstrap.netlify.app/docs/components/buttons/ */}
          {/* And https://www.geeksforgeeks.org/how-to-change-button-text-on-click-in-reactjs/# */}
          <Button
            variant={`${isLightMode ? "dark" : "light"}`}
            onClick={toggleLightMode}
          >
            {`Switch to ${isLightMode ? "Dark" : "Light"} Mode`}
          </Button>
          <br />
          <br />
          <Button variant="primary" onClick={returnToDashboard}>
            Return to Dashboard
          </Button>
        </div>
        <div className="watchlistRight">
          <h1
            className="watchlistHeader"
            style={{ textAlign: "center", cursor: "pointer" }}
          >
            Your Watchlist
          </h1>
          <br />
          <div id="watchlist" className="watchlist">
            {watchlists.length > 0 && (
              <div className="watchlist-filter">
                <label className="watchlist-select">
                  Filter by watchlist:{" "}
                </label>
                <Form.Select
                  id="watchlist-select"
                  value={selectedWatchlistId}
                  onChange={(e) => setSelectedWatchlistId(e.target.value)}
                >
                  <option value="all">All Watchlists</option>
                  {watchlists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </Form.Select>
                <div className="watchlist-management mt-3">
                  {selectedWatchlistId !== "all" && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => deleteWatchlist(selectedWatchlistId, e)}
                    >
                      {`Delete This Watchlist`}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {/* Help from https://www.rowy.io/blog/firestore-react-query */}
            {/* And https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key */}
            {loading && <p>Loading...</p>}
            {filteredMedia.length > 0 &&
              filteredMedia.map((item) => (
                <div
                  className={`watchlistItem ${
                    isLightMode ? "watchlistItemLight" : "watchlistItemDark"
                  }`}
                  key={item.id}
                >
                  <div className="watchlistPoster">
                    <img
                      src={`${imgPath}${item.poster_path}`}
                      className="watchlistPosterImg"
                      alt="watchlist item poster"
                    />
                  </div>
                  <div className="watchlistContent">
                    <h3>{item.title}</h3>
                    {/* Help from https://stackoverflow.com/questions/52247445/how-do-i-convert-a-firestore-date-timestamp-to-a-js-date */}
                    <p>
                      Date Added:{" "}
                      {item.added_at
                        ? item.added_at.seconds
                          ? new Date(
                              item.added_at.seconds * 1000
                            ).toDateString()
                          : new Date(item.added_at).toDateString()
                        : "Unknown Date"}
                    </p>
                    {/* Help from https://react.dev/reference/react-dom/components/select */}
                    {/* And https://react-bootstrap.netlify.app/docs/forms/select/ */}
                    {/* And https://www.geeksforgeeks.org/react-bootstrap-select/ */}
                    Status:
                    <Form.Select
                      data-bs-theme={`${isLightMode ? "light" : "dark"}`}
                      style={{ width: "90%" }}
                      defaultValue={item.status}
                      name="watchStatus"
                      // Help from https://stackoverflow.com/questions/61858177/how-can-i-get-the-value-from-react-bootstrap-form-select
                      onChange={(e) =>
                        updateStatus(
                          item.watchlist_id,
                          item.media_id,
                          e.target.value
                        )
                      }
                    >
                      <option value="Plan to watch">Plan to watch</option>
                      <option value="Currently watching">
                        Currently watching
                      </option>
                      <option value="On hold">On hold</option>
                      <option value="Stopped watching">Stopped watching</option>
                      <option value="Finished watching">
                        Finished watching
                      </option>
                    </Form.Select>
                    {/* Help from https://react-bootstrap.netlify.app/docs/components/button-group/ */}
                    <ButtonGroup>
                      <Button
                        dialogClassName="watchBtn"
                        variant="primary"
                        onClick={() =>
                          displayInformation(item.media_id, item.media_type)
                        }
                      >
                        View Information
                      </Button>
                      <Button
                        dialogClassName="watchBtn"
                        variant="success"
                        onClick={() =>
                          alert(
                            "Review functionality has not been implemented yet. We thank you for your patience."
                          )
                        }
                      >
                        Write a Review
                      </Button>
                      <Button
                        dialogClassName="watchBtn"
                        variant="danger"
                        onClick={() =>
                          removeFromWatchlist(item.watchlist_id, item.media_id)
                        }
                      >
                        Remove from Watchlist
                      </Button>
                    </ButtonGroup>
                    <br />
                    <p>Your rating:</p>
                    {/* Help from https://stackoverflow.com/questions/70344255/react-js-passing-one-components-variables-to-another-component-and-vice-versa */}
                    <StarRate
                      userID={userID}
                      currentMediaID={item.media_id}
                      currentMediaType={item.media_type}
                      initialRate={item.rating}
                      initialAvgRate={item.averageRating}
                    ></StarRate>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Watchlist;

/* 

Other Resources Used:
- https://www.geeksforgeeks.org/how-to-change-button-text-on-click-in-reactjs/#
- https://stackoverflow.com/questions/70636194/cant-make-firestore-to-get-only-docs-from-logged-user-id 
- https://stackoverflow.com/questions/72962388/fetched-firestore-data-not-displaying-on-first-page-load-with-react-useeffect 
- https://stackoverflow.com/questions/66752231/firebase-reactjs-useeffect-typeerror-cannot-read-property-uid-of-null 
- https://stackoverflow.com/questions/72962388/fetched-firestore-data-not-displaying-on-first-page-load-with-react-useeffect 
- https://stackoverflow.com/questions/71256127/how-can-i-retrieve-a-user-id-from-firestore-via-flask-backend-react-frontend/72785157 
- https://react-bootstrap.netlify.app/docs/getting-started/color-modes/ 

*/
