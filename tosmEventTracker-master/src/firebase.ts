import { initializeApp } from "firebase/app"
import { getDatabase } from "firebase/database"

const firebaseConfig = {
  apiKey: "AIzaSyBkkZ0hwHmNkUE5XrsK5r_WM-b4biEChgU",
  authDomain: "tosm-boss-98b54.firebaseapp.com",
  databaseURL: "https://tosm-boss-98b54-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tosm-boss-98b54",
  storageBucket: "tosm-boss-98b54.firebasestorage.app",
  messagingSenderId: "962365830270",
  appId: "1:962365830270:web:8f4f038213a45507f2142f"
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)