import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx"
import "./index.css"

import { GoogleOAuthProvider } from "@react-oauth/google"


ReactDOM.createRoot(document.getElementById("root")).render(
  <GoogleOAuthProvider clientId="771999870087-il14aouajsabcfmmin80t1hbkl6dhvu6.apps.googleusercontent.com">
    <App />
  </GoogleOAuthProvider>
)