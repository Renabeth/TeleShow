import React, {useEffect, useState} from "react"
import {FaStar} from "react-icons/fa"
import {addDoc, collection, doc, getDocs, query, serverTimestamp, where} from "firebase/firestore";
import {setDoc, getDoc} from "firebase/firestore";
import {db} from "../firebase";

// Help from https://www.geeksforgeeks.org/writing-and-reading-data-in-cloud-firestore/
import { updateDoc } from "firebase/firestore";

// Help from https://www.youtube.com/watch?v=91LWShFZn40
import { getAggregateFromServer, average } from "firebase/firestore";

//help from https://www.youtube.com/watch?v=BmhU_MoxNqQ
// And https://stackoverflow.com/questions/70344255/react-js-passing-one-components-variables-to-another-component-and-vice-versa
export default function StarRate(props) {

    //from Dashboard.js
    const [userID] = useState("")
    const [currentMediaID] = useState(0)
    const [currentMediaType] = useState("")

    const [rating, setRating] = React.useState(null);
    const [avgRating, setAvgRating] = useState(0)
    const [rateColor] = React.useState(null);

    const [initialRatingFlag, setInitialRatingFlag] = useState(false);
    //alert("Rating = " + {rating});

    const ratingRef = collection(db, "Ratings");
    const [ratingDuplicate, setRatingDuplicate] = useState(true);
    const checkForDuplicates = query(ratingRef, where('user_id', '==', userID), where('media_id', '==', currentMediaID));
    const querySnapshot = getDocs(checkForDuplicates);

    const getAverageRating = async (mediaID, type) => {
        // Help from https://www.youtube.com/watch?v=91LWShFZn40
        const averageRatingQuery = query(collection(db, "Ratings"), where('media_id', '==', mediaID), where('media_type', '==', type))
        const averageRatingSnapshot = await getAggregateFromServer(averageRatingQuery, {
          averageRating: average('rating')
        })
        console.log("Average rating: ", averageRatingSnapshot.data().averageRating)
        if (averageRatingSnapshot.data().averageRating !== null) {
          setAvgRating(averageRatingSnapshot.data().averageRating)
        } else {
          setAvgRating(0)
        }
    }


    // Help from https://www.freecodecamp.org/news/how-to-use-the-firebase-database-in-react/
    // And https://firebase.google.com/docs/firestore/query-data/queries#node.js_2
    const handleRatingClick = async (currentRate) => {
        // Help from https://www.geeksforgeeks.org/writing-and-reading-data-in-cloud-firestore/
        const ratingRef = collection(db, "Ratings");
        const checkForRatingDuplicates = query(ratingRef, where('user_id', '==', props.userID), where('media_id', '==', props.currentMediaID), where('media_type', '==', props.currentMediaType));
        const ratingQuerySnapshot = await getDocs(checkForRatingDuplicates);
        let ratingDuplicates = 0;
        let docId = 0;
        ratingQuerySnapshot.forEach((doc) => {
            ratingDuplicates++;
            docId = doc.id;
        })

        console.log("Rating Duplicates:", ratingDuplicates)

        setRating(currentRate);
        //alert(`Rating of ${currentRate} saved successfully!`);

        if (ratingDuplicates > 0) {
            try {
                // Help from https://firebase.google.com/docs/firestore/manage-data/add-data
                // And https://www.geeksforgeeks.org/writing-and-reading-data-in-cloud-firestore/
                // And https://www.geeksforgeeks.org/react-bootstrap-select/
                await updateDoc(doc(db, "Ratings", docId), {
                    rating: currentRate
                });
                alert("Rating updated successfully.");
            } catch (error) {
                console.error("Error updating rating: ", error);
            }
        } else {
            // Serena's code
// Send the rating to Firestore
        try {
            await addDoc(collection(db, "Ratings"), {
                rating: currentRate,
                    user_id: props.userID,
                    media_id: props.currentMediaID,
                    media_type: props.currentMediaType,
                created_at: serverTimestamp(),
            });
            console.log("Rating successfully added to Firestore");
        } catch (error) {
            console.error("Error adding rating: ", error);
        }
        }

        await getAverageRating(props.currentMediaID, props.currentMediaType)

    };

    return (
        <>
            {[...Array(5)].map((star, index) => {
                const currentRate = index + 1;
                if(!initialRatingFlag) {
                    setRating(props.initialRate)
                    setAvgRating(props.initialAvgRate)
                    setInitialRatingFlag(true)
                }
                //console.log("Star: ", star);
                // Help from https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key
                return (
                    <label key={index}>
                        <input type="radio" name="rate" style={{display: "none"}}
                                   value={currentRate}
                                   onClick={() => handleRatingClick(currentRate)}
                            />
                            <FaStar size={50} style={{cursor: "pointer"}}
                                    color={currentRate <= (rateColor || rating) ? "yellow" : "black"}
                            />
                        </label>
                )
            })}
            <br />
            {/* Help from https://www.geeksforgeeks.org/floating-point-number-precision-in-javascript/# */}
            Average Rating: {avgRating.toPrecision(2)} / 5
        </>
    )

}