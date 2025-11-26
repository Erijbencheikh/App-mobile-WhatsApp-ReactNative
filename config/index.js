// Import the functions you need from the SDKs you need
import app from "firebase/compat/app"; // compat pour version 9
import "firebase/compat/auth";
import "firebase/compat/database";
import "firebase/compat/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional


const firebaseConfig = {
  apiKey: "AIzaSyBkz5JaUPjlDp-cS0wHwfKauYX2GcYbWsM",
  authDomain: "whatsapp-react-native-634b6.firebaseapp.com",
  projectId: "whatsapp-react-native-634b6",
  databaseURL: "https://whatsapp-react-native-634b6-default-rtdb.europe-west1.firebasedatabase.app",
  storageBucket: "whatsapp-react-native-634b6.firebasestorage.app",
  messagingSenderId: "224480166392",
  appId: "1:224480166392:web:c4575a98920138972ed60d",
  measurementId: "G-Q1T75MFP6L"
};

// Initialize Firebase
const firebase = app.initializeApp(firebaseConfig);
export default firebase;


import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://zrjqwspxxvkcdihurwjr.supabase.co'
const supabaseKey = "sb_publishable__RcEyC5B8Kl74Yd3LszKEA_xLLZ1CqM"
const supabase = createClient(supabaseUrl, supabaseKey) 
export { supabase };