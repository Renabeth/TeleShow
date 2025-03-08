import React from "react";
import '../styles/Dashboard.css'

// Credit to JustWatch as TMDB API watch providers data source

import { useNavigate } from "react-router-dom";

// Help from https://developer.themoviedb.org/reference/trending-movies
import axios from 'axios'

// Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
import { useState, useEffect, useRef } from 'react'
import { onAuthStateChanged, signOut } from "firebase/auth"
import { auth } from '../firebase'

// Help from https://react-bootstrap.netlify.app/docs/components/modal/
import Modal from 'react-bootstrap/Modal'

// Help from https://www.freecodecamp.org/news/how-to-use-the-firebase-database-in-react/
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Help from https://firebase.google.com/docs/firestore/query-data/queries
import { query, where, limit } from "firebase/firestore";

// Help from https://www.rowy.io/blog/firestore-timestamp
import { serverTimestamp } from 'firebase/firestore'

// Help from https://dev.to/rajatamil/firebase-v9-firestore-delete-document-using-deletedoc-5bjh
import { doc, deleteDoc } from "firebase/firestore";

// Help from https://react-bootstrap.netlify.app/docs/components/buttons/
import Button from 'react-bootstrap/Button';

function Dashboard() {

  const showMedia = async (tvId, movieId) => {
    // Help from https://developer.themoviedb.org/reference/tv-series-recommendations
    // 1396 - Breaking Bad ID
    const tvUrl = `https://api.themoviedb.org/3/tv/${tvId}/recommendations?language=en-US&page=1`

    // Help from https://developer.themoviedb.org/reference/movie-recommendations
    // 939243 - Sonic 3 ID
    const movieUrl = `https://api.themoviedb.org/3/movie/${movieId}/recommendations?language=en-US&page=1`

    await fetch(tvUrl, options)
      .then(res => res.json())
      .then(json => {
        console.log(json)
        let tvLength = 0;
        if (json.results.length > 4) {
          tvLength = 4
        } else {
          tvLength = json.results.length
        }

        for(let i = 0; i < tvLength; i++) {
          switch (i) {
            case 0: {
              setTvImg1(imgPath + json.results[i].poster_path)
              setTvTitle1(json.results[i].name)
              setTvId1(json.results[i].id)
              break;
            }
            case 1: {
              setTvImg2(imgPath + json.results[i].poster_path)
              setTvTitle2(json.results[i].name)
              setTvId2(json.results[i].id)
              break;
            }
            case 2: {
              setTvImg3(imgPath + json.results[i].poster_path)
              setTvTitle3(json.results[i].name)
              setTvId3(json.results[i].id)
              break;
            }
            case 3: {
              setTvImg4(imgPath + json.results[i].poster_path)
              setTvTitle4(json.results[i].name)
              setTvId4(json.results[i].id)
              break;
            }
            default: {
              break;
            }
          }
        }
      })
      .catch(err => console.error(err))

      await fetch(movieUrl, options)
        .then(res => res.json())
        .then(json => {
          //console.log(json)
          let movieLength = 0;
          if(json.results.length > 4) {
            movieLength = 4
          } else {
            movieLength = json.results.length
          }

          for(let i = 0; i < movieLength; i++) {
            switch (i) {
              case 0: {
                setMovieImg1(imgPath + json.results[i].poster_path)
                setMovieTitle1(json.results[i].title)
                setMovieId1(json.results[i].id)
                break;
              }
              case 1: {
                setMovieImg2(imgPath + json.results[i].poster_path)
                setMovieTitle2(json.results[i].title)
                setMovieId2(json.results[i].id)
                break;
              }
              case 2: {
                setMovieImg3(imgPath + json.results[i].poster_path)
                setMovieTitle3(json.results[i].title)
                setMovieId3(json.results[i].id)
                break;
              }
              case 3: {
                setMovieImg4(imgPath + json.results[i].poster_path)
                setMovieTitle4(json.results[i].title)
                setMovieId4(json.results[i].id)
                break;
              }
              default: {
                break;
              }
            }
          }
        })
        .catch(err => console.error(err))
  }

  const [userID, setUserID] = useState("")
  const [currentMediaID, setCurrentMediaID] = useState(0)
  const [currentMediaType, setCurrentMediaType] = useState("")

  const [displayName, setDisplayName] = useState("")

  const [darkMode, setDarkMode] = useState(true)

  const [tvImg1, setTvImg1] = useState("../../Logo.png")
  const [tvImg2, setTvImg2] = useState("../../Logo.png")
  const [tvImg3, setTvImg3] = useState("../../Logo.png")
  const [tvImg4, setTvImg4] = useState("../../Logo.png")

  const [movieImg1, setMovieImg1] = useState("../../Logo.png")
  const [movieImg2, setMovieImg2] = useState("../../Logo.png")
  const [movieImg3, setMovieImg3] = useState("../../Logo.png")
  const [movieImg4, setMovieImg4] = useState("../../Logo.png")

  const [tvTitle1, setTvTitle1] = useState("")
  const [tvTitle2, setTvTitle2] = useState("")
  const [tvTitle3, setTvTitle3] = useState("")
  const [tvTitle4, setTvTitle4] = useState("")

  const [movieTitle1, setMovieTitle1] = useState("")
  const [movieTitle2, setMovieTitle2] = useState("")
  const [movieTitle3, setMovieTitle3] = useState("")
  const [movieTitle4, setMovieTitle4] = useState("")

  const [tvId1, setTvId1] = useState(0)
  const [tvId2, setTvId2] = useState(0)
  const [tvId3, setTvId3] = useState(0)
  const [tvId4, setTvId4] = useState(0)

  const [movieId1, setMovieId1] = useState(0)
  const [movieId2, setMovieId2] = useState(0)
  const [movieId3, setMovieId3] = useState(0)
  const [movieId4, setMovieId4] = useState(0)

  const [modalTitle, setModalTitle] = useState("")
  const [modalPoster, setModalPoster] = useState("")
  const [modalOverview, setModalOverview] = useState("")
  const [modalLanguages, setModalLanguages] = useState("")

  const [modalProvidersBuy, setModalProvidersBuy] = useState("")
  const [modalProvidersFlatrate, setModalProvidersFlatrate] = useState("")
  const [modalProvidersRent, setModalProvidersRent] = useState("")

  // Help from https://developer.themoviedb.org/docs/image-basics
  const imgPath = "https://image.tmdb.org/t/p/w500"

  // Help from https://www.geeksforgeeks.org/using-the-useref-hook-to-change-an-elements-style-in-react/#
  const displayModeRef = useRef()
  const displayModeButtonRef = useRef()
  const logoutButtonRef = useRef()

  
  // Help from https://react-bootstrap.netlify.app/docs/components/modal/
  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const [watchlistDuplicate, setWatchListDuplicate] = useState(true);
  
  let authFlag = true // Help from https://stackoverflow.com/questions/49873223/why-does-my-firebase-onauthstatechanged-trigger-multiple-times-react-native

  // Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (authFlag) { // Help from https://stackoverflow.com/questions/49873223/why-does-my-firebase-onauthstatechanged-trigger-multiple-times-react-native
        if (user) {
          const uid = user.uid;
          //console.log(user)
          //console.log(user.displayName)
          console.log("uid", uid)
          console.log("You appear to be signed in.")
          setDisplayName(user.displayName)
          setUserID(uid)

          // Help from https://stackoverflow.com/questions/68260152/firebase-auth-currentuser-is-null-at-page-load/68260898#68260898
          // Recommendation call would be here
        } else {
          console.log("You appear to be signed out.")
        }
      }
      authFlag = false // Help from https://stackoverflow.com/questions/49873223/why-does-my-firebase-onauthstatechanged-trigger-multiple-times-react-native
    })
    showMedia(1396, 939243); // Shows media upon loading the page (1396 Breaking Bad ID; 939243 Sonic 3)

    // Help from https://stackoverflow.com/questions/53070970/infinite-loop-in-useeffect
  }, [])

  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${process.env.REACT_APP_TMDB_READ_ACCESS_TOKEN}`
    }
  };

  const navigate = useNavigate();

  const goToWatchlist = async () => {
    navigate("/watchlist")
  }

  const handleLogout = () => {

    // Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
    signOut(auth).then(() => {
      navigate("/"); // Go back to login after logging out
      alert("You have logged out successfully.")
    }).catch((error) => {
      alert(error)
    })

  };

  // Help from https://www.geeksforgeeks.org/using-the-useref-hook-to-change-an-elements-style-in-react/#
  const changeDisplayMode = () => {
    console.log(darkMode)
    if (darkMode) { // Change to dark mode
      displayModeRef.current.style.backgroundColor = "white"
      displayModeRef.current.style.color = "black"

      displayModeButtonRef.current.style.backgroundColor = "cyan"
      displayModeButtonRef.current.style.color = "black"

      logoutButtonRef.current.style.backgroundColor = "cyan"
      logoutButtonRef.current.style.color = "black"

      setDarkMode(false)
    } else { // Change to light mode
      displayModeRef.current.style.backgroundColor = "rgb(50, 50, 50)"
      displayModeRef.current.style.color = "white"

      displayModeButtonRef.current.style.backgroundColor = "white"
      displayModeButtonRef.current.style.color = "black"

      logoutButtonRef.current.style.backgroundColor = "white"
      logoutButtonRef.current.style.color = "black"

      setDarkMode(true)
    }
  }



    // Help from https://www.freecodecamp.org/news/javascript-fetch-api-for-beginners/

  const showDetails = async (id, type) => {
    let url = ""
    let providerUrl = ""

    /*
    Help from:
    - https://developer.themoviedb.org/reference/tv-series-details
    - https://developer.themoviedb.org/reference/tv-series-watch-providers
    - https://developer.themoviedb.org/reference/movie-details
    - https://developer.themoviedb.org/reference/movie-watch-providers
    (Watch provider data provided by JustWatch)
    */

    url = `https://api.themoviedb.org/3/${type}/${id}?language=en-US`
    providerUrl = `https://api.themoviedb.org/3/${type}/${id}/watch/providers`

    let mediaID = 0;
    
    await fetch(url, options)
      .then(res => res.json())
      .then(json => {
        console.log(json)
        if (type === "tv") {
          setModalTitle(json.name)
        } else {
          setModalTitle(json.title)
        }
        setModalOverview(json.overview)
        setModalPoster(imgPath + json.poster_path)

        mediaID = json.id;

        // Help from https://www.w3schools.com/jsref/jsref_join.asp
        let languageArray = []
        for(let i = 0; i < json.spoken_languages.length; i++) {
          languageArray.push(json.spoken_languages[i].name)
        }
        setModalLanguages(languageArray.join(", "))

      })
      .catch((err) => console.error(err))

      await fetch(providerUrl, options)
        .then(res => res.json())
        .then(json => {
          console.log(json)

          if (json.results.US.buy) {
            let buyArray = []
            for (let i = 0; i < json.results.US.buy.length; i++) {
              buyArray.push(json.results.US.buy[i].provider_name)
            }
            setModalProvidersBuy(buyArray.join(", "))
          } else {
            setModalProvidersBuy("")
          }

          if (json.results.US.flatrate) {
            let flatArray = []
            for (let j = 0; j < json.results.US.flatrate.length; j++) {
              flatArray.push(json.results.US.flatrate[j].provider_name)
            }
            setModalProvidersFlatrate(flatArray.join(", "))
          } else {
            setModalProvidersFlatrate("")
          }

          if (json.results.US.rent) {
            let rentArray = []
            for (let j = 0; j < json.results.US.rent.length; j++) {
              rentArray.push(json.results.US.rent[j].provider_name)
            }
            setModalProvidersRent(rentArray.join(", "))
          } else {
            setModalProvidersRent("")
          }

        })
        .catch((err) => console.error(err))


      setCurrentMediaType(type)

      setCurrentMediaID(mediaID)


      // Help from https://www.geeksforgeeks.org/writing-and-reading-data-in-cloud-firestore/
      const watchlistRef = collection(db, "Watchlist");
      const checkForDuplicates = query(watchlistRef, where('user_id', '==', userID), where('media_id', '==', mediaID));
      const querySnapshot = await getDocs(checkForDuplicates);
      let duplicates = 0; // This will check for duplicate userID / media ID combinations
      querySnapshot.forEach((doc) => {
        duplicates++;
      })
      //console.log(currentMediaID)
      console.log(duplicates)
      if (duplicates > 0) {
        setWatchListDuplicate(true)
      } else {
        setWatchListDuplicate(false)
      }



      // Help from https://www.geeksforgeeks.org/how-to-use-modal-component-in-reactjs/#
      // And https://react-bootstrap.netlify.app/docs/components/modal/
      handleShow()
  }

  // Help from https://www.freecodecamp.org/news/how-to-use-the-firebase-database-in-react/
  // And https://firebase.google.com/docs/firestore/query-data/queries#node.js_2
  // Adding media to watchlist
  const addToWatchlist = async (e) => {
    e.preventDefault();

    
    // Help from https://www.geeksforgeeks.org/writing-and-reading-data-in-cloud-firestore/
    const watchlistRef = collection(db, "Watchlist");
    const checkForDuplicates = query(watchlistRef, where('user_id', '==', userID), where('media_id', '==', currentMediaID));
    const querySnapshot = await getDocs(checkForDuplicates);
    let duplicates = 0; // This will check for duplicate userID / media ID combinations
    querySnapshot.forEach((doc) => {
      duplicates++;
    })
    if (duplicates > 0) {
      alert("You already have this in your watchlist.")
    } else {
      try {
        const docRef = await addDoc(collection(db, "Watchlist"), {
          user_id: userID,
          title: modalTitle,
          type: currentMediaType,
          media_id: currentMediaID,
          status: "Plan to watch",

          // Help from https://www.rowy.io/blog/firestore-timestamp
          date_added: serverTimestamp(),

          poster_path: modalPoster,
        });
        console.log("Wrote document with ID: ", docRef.id);
        alert("Item added to watchlist successfully.");
        setWatchListDuplicate(true)
      } catch (e) {
        console.error("Error adding document: ", e);
      }
    }
  }

  const removeFromWatchlist = async (e) => {
    e.preventDefault();

    let idToDelete = 0;

    // Help from https://www.geeksforgeeks.org/writing-and-reading-data-in-cloud-firestore/
    const watchlistRef = collection(db, "Watchlist");
    const q = query(watchlistRef, where('user_id', '==', userID), where('media_id', '==', currentMediaID));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      console.log(doc.data())
      console.log(doc.data().title);
      console.log(doc.id)
      idToDelete = doc.id
    })

    // Help from https://dev.to/rajatamil/firebase-v9-firestore-delete-document-using-deletedoc-5bjh
    await deleteDoc(doc(db, "Watchlist", idToDelete))
    .then(() => {
      console.log("Document deleted successfully.")
      alert("Item removed from watchlist successfully.");
      setWatchListDuplicate(false)
    })
    .catch(error => {
      console.log(error);
      alert(error);
    })
  }

  return (
    // Help from https://www.geeksforgeeks.org/using-the-useref-hook-to-change-an-elements-style-in-react/#
    <div className="container" id="dashboard" ref={displayModeRef}>
      <h2>Dashboard in Progress Stay Tuned</h2>
      <div>
        {/* Help from https://stackoverflow.com/questions/76990183/how-to-display-the-current-user-display-name-in-firebase-using-react */}
        <p>Welcome, {displayName || "none"}!</p>
        <p>User ID: {userID || "none"}</p>
        
        <button onClick={goToWatchlist}>Go to Watchlist</button>



        {/* Help from https://react-bootstrap.netlify.app/docs/components/modal/ */}
        {/* And https://github.com/react-bootstrap/react-bootstrap/issues/3794 */}
        {/* And https://www.geeksforgeeks.org/how-to-use-modal-component-in-reactjs/# */}
        <Modal show={show} onHide={handleClose} dialogClassName="modal-85w" backdrop="static" keyboard={false}>


          {/* Help from https://stackoverflow.com/questions/76810663/react-modals-or-dialogs-doesnt-inherit-the-dark-mode-styles-tailwind */}
          {/* And https://www.geeksforgeeks.org/how-to-create-dark-light-theme-in-bootstrap-with-react/# */}
          <Modal.Header closeButton className={`${darkMode ? 'head-dark' : 'head-light'}`}>
            <Modal.Title>
              { modalTitle || "None" }
            </Modal.Title>
          </Modal.Header>

          {/* Help from https://stackoverflow.com/questions/76810663/react-modals-or-dialogs-doesnt-inherit-the-dark-mode-styles-tailwind */}
          {/* And https://www.geeksforgeeks.org/how-to-create-dark-light-theme-in-bootstrap-with-react/# */}
          <Modal.Body className={`modalBody ${darkMode ? 'body-dark' : 'body-light'}`}>
            <div className="modalBox">
              <div className="modalLeft">
                <img className="modalPoster" id="modalPoster" src={modalPoster} alt="modal poster" />
                { !watchlistDuplicate ? 
                  <button className="watchlist-button primary" onClick={addToWatchlist}>
                    Add to Watchlist
                  </button>
                  : 
                  <button className="watchlist-button primary" onClick={removeFromWatchlist}>
                    Remove from Watchlist
                  </button>
                }
                <button className="watchlist-button secondary">Rate</button>
              </div>
              <div className="modalRight">
                <h2>Overview</h2>
                <div id="overviewBox">
                  { modalOverview || "None" }
                </div>
                <h3>Spoken Languages</h3>
                  { modalLanguages || "None" }
                <h3>Watch Providers</h3>
                <h4>Buy</h4>
                  { modalProvidersBuy || "None" }
                <h4>Flatrate</h4>
                  { modalProvidersFlatrate || "None" }
                <h4>Rent</h4>
                  { modalProvidersRent || "None" }
              </div>
            </div>
          </Modal.Body>
        </Modal>




        <h1 style={{textAlign: "center"}}>Recommendations</h1><br />

        {/* Help from https://www.w3schools.com/css/tryit.asp?filename=trycss3_flexbox_responsive2 */}
        <h4>Recommended TV (Based on Breaking Bad):</h4>

        {/* Help from https://www.rowy.io/blog/firestore-react-query */}
        {/* And https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key */}
        { /* Loading could go here */ }

        <div className="mediaBox">
          <div id="tvCell1" className="mediaCell">
            {/* Help from https://stackoverflow.com/questions/29810914/react-js-onclick-cant-pass-value-to-method and https://upmostly.com/tutorials/pass-a-parameter-through-onclick-in-react */}
            <img className="mediaPoster" src={tvImg1} alt="media" onClick={async () => await showDetails(tvId1, "tv")} />
            <p>{tvTitle1}</p>
          </div>
          <div id="tvCell2" className="mediaCell">
            <img className="mediaPoster" src={tvImg2} alt="media" onClick={async () => await showDetails(tvId2, "tv")} />
            <p>{tvTitle2}</p>
          </div>
          <div id="tvCell3" className="mediaCell">
            <img className="mediaPoster" src={tvImg3} alt="media" onClick={async () => await showDetails(tvId3, "tv")} />
            <p>{tvTitle3}</p>
          </div>
          <div id="tvCell4" className="mediaCell">
            <img className="mediaPoster" src={tvImg4} alt="media" onClick={async () => await showDetails(tvId4, "tv")} />
            <p>{tvTitle4}</p>
          </div>
        </div>

        <h4>Recommended Movies (Based on Sonic 3):</h4>
        <div className="mediaBox">
          <div id="movieCell1" className="mediaCell">
            <img className="mediaPoster" src={movieImg1} alt="media" onClick={async () => await showDetails(movieId1, "movie")} />
            <p>{movieTitle1}</p>
          </div>
          <div id="movieCell2" className="mediaCell">
            <img className="mediaPoster" src={movieImg2} alt="media" onClick={async () => await showDetails(movieId2, "movie")} />
            <p>{movieTitle2}</p>
          </div>
          <div id="movieCell3" className="mediaCell">
            <img className="mediaPoster" src={movieImg3} alt="media" onClick={async () => await showDetails(movieId3, "movie")} />
            <p>{movieTitle3}</p>
          </div>
          <div id="movieCell4" className="mediaCell">
            <img className="mediaPoster" src={movieImg4} alt="media" onClick={async () => await showDetails(movieId4, "movie")} />
            <p>{movieTitle4}</p>
          </div>
        </div>

        {/* Help from https://www.geeksforgeeks.org/using-the-useref-hook-to-change-an-elements-style-in-react/# */}
        <button onClick={changeDisplayMode} ref={displayModeButtonRef}>Change display mode</button>

        <button onClick={handleLogout} ref={logoutButtonRef}>Logout</button>
      </div>
    </div>
  );
}

export default Dashboard;

/*

Other Resources used:
- https://www.freecodecamp.org/news/javascript-fetch-api-for-beginners/
- https://www.geeksforgeeks.org/how-to-keep-a-mutable-variable-in-react-useref-hook/
- https://www.w3schools.com/react/react_render.asp
- https://stackoverflow.com/questions/76990183/how-to-display-the-current-user-display-name-in-firebase-using-react
- https://www.geeksforgeeks.org/writing-and-reading-data-in-cloud-firestore/
- https://www.rowy.io/blog/firestore-react-query

*/