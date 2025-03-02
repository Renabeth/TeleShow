import React from "react";
import '../styles/Dashboard.css'
import {getFirestore, collection, addDoc} from "firebase/firestore";

// Help from https://www.w3schools.com/react/showreact.asp?filename=demo2_react_conditionals_if
//import ReactDOM from 'react-dom/client'

import { useNavigate } from "react-router-dom";

// Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
import { useState, useEffect, useRef } from 'react'
import { onAuthStateChanged, signOut } from "firebase/auth"
import firebase, {auth, db} from '../firebase'

// Help from https://www.geeksforgeeks.org/how-to-use-modal-component-in-reactjs/#
import Modal from "../components/Modal"

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
          console.log(json)
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
  const rateButtonRef = useRef()


  // Help from https://www.geeksforgeeks.org/how-to-use-modal-component-in-reactjs/#
  const [open, setOpen] = useState(false)

  const handleClose = () => {
    setOpen(false)
  }

  const handleOpen = () => {
    setOpen(true)
  }

  // Help from https://www.geeksforgeeks.org/how-to-keep-a-mutable-variable-in-react-useref-hook/

  // Help from https://www.w3schools.com/react/react_render.asp
  
  // Help from https://stackoverflow.com/questions/76990183/how-to-display-the-current-user-display-name-in-firebase-using-react
  
  let authFlag = true // Help from https://stackoverflow.com/questions/49873223/why-does-my-firebase-onauthstatechanged-trigger-multiple-times-react-native

  // Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (authFlag) { // Help from https://stackoverflow.com/questions/49873223/why-does-my-firebase-onauthstatechanged-trigger-multiple-times-react-native
        if (user) {
          const uid = user.uid;
          //console.log(user)
          //console.log(user.displayName)
          //console.log("uid", uid)
          console.log("You appear to be signed in.")
          setDisplayName(user.displayName)
        } else {
          console.log("You appear to be signed out.")
        }
      }
      authFlag = false // Help from https://stackoverflow.com/questions/49873223/why-does-my-firebase-onauthstatechanged-trigger-multiple-times-react-native
    })
    showMedia(1396, 939243); // Shows media upon loading the page (1396 Breaking Bad ID; 939243 Sonic 3)
  })

  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${process.env.REACT_APP_TMDB_READ_ACCESS_TOKEN}`
    }
  };

  const navigate = useNavigate();

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

  const languages = document.getElementById('languages')
  const providers = document.getElementById('providers')


  /*const showLanguages = () => {
    // Help from https://developer.themoviedb.org/reference/tv-series-details
    // 1396 Breaking Bad ID
    // 67676 Saiki K ID
    const url = 'https://api.themoviedb.org/3/tv/1396?language=en-US'

    fetch(url, options)
      .then(res => res.json())
      .then(json => {
        console.log(json)
        let languagesLength = json["spoken_languages"].length
        let languagesContent = `<h3>Spoken Languages</h3> <ul>`
        for(let i = 0; i < languagesLength; i++) {
          languagesContent += "<li>" + json.spoken_languages[i].english_name + " / " + json.spoken_languages[i].name + "</li>"
        }
        languagesContent += "</ul>"

        console.log(languagesContent)
      })
      .catch(err => console.error(err))
  }

  const showProviders = () => {
    // Help from https://developer.themoviedb.org/reference/tv-series-watch-providers
    const url = 'https://api.themoviedb.org/3/tv/1396/watch/providers'

    // Help from https://www.freecodecamp.org/news/javascript-fetch-api-for-beginners/

    fetch(url, options)
      .then(res => res.json())
      .then(json => {
        let buyLength = json.results.US.buy.length
        let flatrateLength = json.results.US.flatrate.length 
        console.log(json.results.US.buy)
        console.log(json.results.US.flatrate)

        let providersContent = `<h3>Buy</h3> <ul>`
        for (let i = 0; i < buyLength; i++) {
          providersContent += "<li>" + json.results.US.buy[i].provider_name + "</li>"
        }
        providersContent += "</ul>"

        providersContent += `<h3>Flatrate</h3> <ul>`
        for (let i = 0; i < flatrateLength; i++) {
          providersContent += "<li>" + json.results.US.flatrate[i].provider_name + "</li>"
        }
        providersContent += "</ul>"

        console.log(providersContent)
      })
      .catch(err => console.error(err))
  }*/


  const showDetails = async (id, status) => {
    let url = ""
    let providerUrl = ""
    if (status === "tv") {
      // Help from https://developer.themoviedb.org/reference/tv-series-details
      url = `https://api.themoviedb.org/3/tv/${id}?language=en-US`

      // Help from https://developer.themoviedb.org/reference/tv-series-watch-providers
      providerUrl = `https://api.themoviedb.org/3/tv/${id}/watch/providers`
    } else {
      // Help from https://developer.themoviedb.org/reference/movie-details
      url = `https://api.themoviedb.org/3/movie/${id}?language=en-US`

      // Help from https://developer.themoviedb.org/reference/movie-watch-providers
      providerUrl = `https://api.themoviedb.org/3/movie/${id}/watch/providers`
    }
    
    await fetch(url, options)
      .then(res => res.json())
      .then(json => {
        console.log(json)
        if (status === "tv") {
          setModalTitle(json.name)
        } else {
          setModalTitle(json.title)
        }
        setModalOverview(json.overview)
        setModalPoster(imgPath + json.poster_path)

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

      // Help from https://www.geeksforgeeks.org/how-to-use-modal-component-in-reactjs/#
      handleOpen()
  }

  //Detect selected rating and sends to firebase
  //Help from https://firebase.google.com/docs/firestore/manage-data/add-data?hl=en#add_a_document
  document.querySelectorAll('input[name="ratingChoice"]').forEach(radio => {

    radio.addEventListener("change", async (event) => {
      try {
        const docRef = await addDoc(collection(db, "Ratings"), {
          rating: event.target.value, // Get the selected rating value
          timestamp: new Date() // Optional: Add timestamp
         // need to add show
        });
        console.log("Document written with ID: ", docRef.id);
      } catch (e) {
        console.error("Error adding rating: ", e);
        alert("Error adding rating");
      }
    })

    })

    return (
    // Help from https://www.geeksforgeeks.org/using-the-useref-hook-to-change-an-elements-style-in-react/#
    <div className="container" id="dashboard" ref={displayModeRef}>
      <h2>Dashboard in Progress Stay Tuned</h2>
      <div>
        {/* Help from https://stackoverflow.com/questions/76990183/how-to-display-the-current-user-display-name-in-firebase-using-react */}
        <p>Welcome, {displayName || "none"}!</p>


        {/* Help from https://www.geeksforgeeks.org/how-to-use-modal-component-in-reactjs/# */}
        <Modal isOpen={open} onClose={handleClose}>
          <>
            <div className="modalBox">
              <div className="modalLeft">
                <h1>{modalTitle || "None"}</h1>
                <img className="modalPoster" id="modalPoster" src={modalPoster} alt="modal poster"/>
                <button className="watchlist-button primary">
                  Add to Watchlist
                </button>
               <button className="watchlist-button secondary" id="rateBtn">Rate</button>

                <label>
                <input type="radio"  name="ratingChoice" value="1" id="ratingBtnOne"/>
                  <img src="rating_empty_star.png" alt="rating_empty_star" width="60" height="60" />
                </label>

                <label>
                <input  type="radio"  name="ratingChoice" value="2" id="ratingBtnTwo"/>
                <img src="rating_empty_star.png" alt="rating_empty_star" width="60" height="60" />
              </label>

                <label>
                <input type="radio" name="ratingChoice" value="3" id="ratingBtnThree"/>
                <img src="rating_empty_star.png" alt="rating_empty_star" width="60" height="60" />
              </label>

                <label>
                <input type="radio" name="ratingChoice" value="4" id="ratingBtnFour"/>
                <img src="rating_empty_star.png" alt="rating_empty_star" width="60" height="60" />
              </label>

                <label>
                <input type="radio" name="ratingChoice" value="5" id="ratingBtnFive"/>
                <img src="rating_empty_star.png" alt="rating_empty_star" width="60" height="60" />
               </label>

              </div>
              <div className="modalRight">
                <h2>Overview</h2>
                <div id="overviewBox">
                  { modalOverview || "None" }
                </div>
                <h3>Spoken Languages</h3>
                {modalLanguages || "None"}
                <h3>Watch Providers</h3>
                <h4>Buy</h4>
                {modalProvidersBuy || "None"}
                <h4>Flatrate</h4>
                {modalProvidersFlatrate || "None"}
                <h4>Rent</h4>
                {modalProvidersRent || "None"}
              </div>
            </div>
          </>
        </Modal>

        {/* Help from https://www.w3schools.com/css/tryit.asp?filename=trycss3_flexbox_responsive2 */}
        <h4>Recommended TV (Based on Breaking Bad):</h4>
        <div className="mediaBox">
          <div id="tvCell1" className="mediaCell">
            {/* Help from https://stackoverflow.com/questions/29810914/react-js-onclick-cant-pass-value-to-method and https://upmostly.com/tutorials/pass-a-parameter-through-onclick-in-react */}
            <img className="mediaPoster" src={tvImg1} alt="media" onClick={() => showDetails(tvId1, "tv")} />
            <p>{tvTitle1}</p>
          </div>
          <div id="tvCell2" className="mediaCell">
            <img className="mediaPoster" src={tvImg2} alt="media" onClick={() => showDetails(tvId2, "tv")} />
            <p>{tvTitle2}</p>
          </div>
          <div id="tvCell3" className="mediaCell">
            <img className="mediaPoster" src={tvImg3} alt="media" onClick={() => showDetails(tvId3, "tv")} />
            <p>{tvTitle3}</p>
          </div>
          <div id="tvCell4" className="mediaCell">
            <img className="mediaPoster" src={tvImg4} alt="media" onClick={() => showDetails(tvId4, "tv")} />
            <p>{tvTitle4}</p>
          </div>
        </div>

        <h4>Recommended Movies (Based on Sonic 3):</h4>
        <div className="mediaBox">
          <div id="movieCell1" className="mediaCell">
            <img className="mediaPoster" src={movieImg1} alt="media" onClick={() => showDetails(movieId1, "movie")} />
            <p>{movieTitle1}</p>
          </div>
          <div id="movieCell2" className="mediaCell">
            <img className="mediaPoster" src={movieImg2} alt="media" onClick={() => showDetails(movieId2, "movie")} />
            <p>{movieTitle2}</p>
          </div>
          <div id="movieCell3" className="mediaCell">
            <img className="mediaPoster" src={movieImg3} alt="media" onClick={() => showDetails(movieId3, "movie")} />
            <p>{movieTitle3}</p>
          </div>
          <div id="movieCell4" className="mediaCell">
            <img className="mediaPoster" src={movieImg4} alt="media" onClick={() => showDetails(movieId4, "movie")} />
            <p>{movieTitle4}</p>
          </div>
        </div>

        {/* Help from https://www.geeksforgeeks.org/using-the-useref-hook-to-change-an-elements-style-in-react/# */}
        <button onClick={changeDisplayMode} ref={displayModeButtonRef}>Toggle Light/Dark Mode</button>

        <button onClick={handleLogout} ref={logoutButtonRef}>Logout</button>
      </div>
    </div>
  );



}

export default Dashboard;