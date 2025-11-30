import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyADs8f7lUN_XyoYmnErEdc9uHA6zMxTAK0",
    authDomain: "nurbolai-9f787.firebaseapp.com",
    projectId: "nurbolai-9f787",
    storageBucket: "nurbolai-9f787.firebasestorage.app",
    messagingSenderId: "961472197884",
    appId: "1:961472197884:web:3afa7ae81c1207bb271379",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

