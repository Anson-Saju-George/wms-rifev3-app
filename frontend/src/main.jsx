import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";

import App from "./App.jsx";
import "./index.css";

function normalizeBasePath(value) {
  if (!value || value === "/") return "/";
  return value.replace(/\/+$/, "");
}

const basePath = normalizeBasePath(window.__BASE_PATH__ || "/");
const googleClientId = window.__GOOGLE_CLIENT_ID__ || "";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter basename={basePath}>
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  </BrowserRouter>,
);