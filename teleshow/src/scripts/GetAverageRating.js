// Help from https://www.freecodecamp.org/news/how-to-use-the-firebase-database-in-react/
import { collection } from "firebase/firestore";
import { db } from "../firebase";

// Help from https://firebase.google.com/docs/firestore/query-data/queries
import { query, where } from "firebase/firestore";

// Help from https://www.youtube.com/watch?v=91LWShFZn40
import { getAggregateFromServer, average } from "firebase/firestore";

const GetAverageRating = async (mediaID, type) => {
    // Help from https://www.youtube.com/watch?v=91LWShFZn40
    const averageRatingQuery = query(collection(db, "Ratings"), where('media_id', '==', mediaID), where('media_type', '==', type))
    const averageRatingSnapshot = await getAggregateFromServer(averageRatingQuery, {
        averageRating: average('rating')
    })
    console.log("Average rating: ", averageRatingSnapshot.data().averageRating)
    if (averageRatingSnapshot.data().averageRating !== null) {
        return averageRatingSnapshot.data().averageRating
    } else {
        return 0
    }
}

export default GetAverageRating;