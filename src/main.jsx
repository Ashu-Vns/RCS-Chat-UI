import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import ChatWidget from "./ChatWidget";

const rootEl = document.getElementById("rcsChatdiv");
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(<ChatWidget />);
}
