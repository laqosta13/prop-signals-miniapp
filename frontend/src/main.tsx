import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WebApp from "@twa-dev/sdk";
import App from "./App";
import "./theme.css";
import "./punk-theme.css";
import "./index.css";
import { initTheme } from "./utils/theme";

initTheme();

WebApp.ready();
WebApp.expand();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
