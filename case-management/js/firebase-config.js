// Firebase configuration for Authentication only
const firebaseConfig = {
  apiKey: "AIzaSyDv0bKeF_WWTPcXUG3z2mTFiIT5epP0FK4",
  authDomain: "case-dc6f3.firebaseapp.com",
  projectId: "case-dc6f3",
  messagingSenderId: "222092038790",
  appId: "1:222092038790:web:f9d9ab138bb2b8363d3707"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export auth for convenience
const auth = firebase.auth();
