import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyAppearanceTheme, loadAppearanceSettings } from "./lib/appearance";
import "./styles/global.css";

applyAppearanceTheme(loadAppearanceSettings().theme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);