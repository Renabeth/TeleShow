/* Help from https://css-tricks.com/user-registration-authentication-firebase-react/ */
// And https://console.firebase.google.com/u/0/project/teleshowfirestore/settings/general/web:OTA2M2M0NmItM2M3ZS00ZmVlLTg3ODAtNDY0Y2NkZDZkNjA0?fb_gclid=CjwKCAiAk8G9BhA0EiwAOQxmfjS8qlT_hPX_SgOvOah508cL_oSFq6yUSlBXF1SfSVzeqfLbszAaghoCTlAQAvD_BwE

import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

// Help from https://www.youtube.com/watch?v=IbHfZSiQdqU
import { getStorage } from "firebase/storage"

// https://firebase.google.com/docs/firestore/quickstart 
import { getFirestore} from "firebase/firestore"

const firebaseConfig = {
    apiKey: process.env.REACT_APP_API_KEY,
    authDomain: process.env.REACT_AUTH_DOMAIN,
    databaseURL: process.env.REACT_APP_DATABASE_URL,
    projectId: process.env.REACT_APP_PROJECT_ID,
    storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_ID
}

const app = initializeApp(firebaseConfig)

// Help from https://www.freecodecamp.org/news/use-firebase-authentication-in-a-react-app/
export const auth = getAuth(app)

// Help from https://firebase.google.com/docs/firestore/quickstart
// And https://www.freecodecamp.org/news/how-to-use-the-firebase-database-in-react/
export const db = getFirestore(app)

// Help from https://www.youtube.com/watch?v=IbHfZSiQdqU
export const storage = getStorage()

export default app