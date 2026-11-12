import "@fontsource-variable/space-grotesk/wght.css";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/geist-mono/wght.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import "./theme/tokens.css";
import "./theme/global.css";
import "./theme/art.css";
import "./theme/primitives.css";
import "./theme/chrome.css";

// Deterministic screenshot mode: ?shot=1 disables motion so captures
// are stable (the playbook's pattern, also used by the e2e suite).
if (new URLSearchParams(window.location.search).get("shot") === "1") {
  document.documentElement.classList.add("shot");
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
