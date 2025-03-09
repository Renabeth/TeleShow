import React, {useEffect, useState} from "react"
import {FaStar} from "react-icons/fa"
import {addDoc, collection, doc, getDocs, query, serverTimestamp, where} from "firebase/firestore";
import {setDoc, getDoc} from "firebase/firestore";
import {db} from "../firebase";

//help from https://www.youtube.com/watch?v=BmhU_MoxNqQ
export default function StarRate() {

    //from Dashboard.js
    const [userID] = useState("")
    const [currentMediaID] = useState(0)
    const [currentMediaType] = useState("")

    const [rating, setRating] = React.useState(null);
    const [rateColor] = React.useState(null);
    //alert("Rating = " + {rating});

    const ratingRef = collection(db, "Ratings");
    const [ratingDuplicate, setRatingDuplicate] = useState(true);
    const checkForDuplicates = query(ratingRef, where('user_id', '==', userID), where('media_id', '==', currentMediaID));
    const querySnapshot = getDocs(checkForDuplicates);




    const handleRatingClick = async (currentRate) => {
        setRating(currentRate);
        alert(`Rating of ${currentRate} saved successfully!`);

// Send the rating to Firestore
        try {
            await addDoc(collection(db, "Ratings"), {
                rating: currentRate,
                user_id: userID,
                media_id: currentMediaID,
                media_type: currentMediaType,
                created_at: serverTimestamp(),
            });
            console.log("Rating successfully added to Firestore");
        } catch (error) {
            console.error("Error adding rating: ", error);
        }

    };

    return (
        <>
            {[...Array(5)].map((star, index) => {
                const currentRate = index + 1;
                return (
                    <>
                        <label>
                            <input type="radio" name="rate"
                                   value={currentRate}
                                   onClick={() => handleRatingClick(currentRate)}
                            />
                            <FaStar size={50}
                                    color={currentRate <= (rateColor || rating) ? "yellow" : "black"}
                            />
                        </label>

                    </>

                )
            })}
        </>
    )

}