import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "@/App";
import "@/styles/global.css";
import "@/styles/brand.css";
import "@/styles/retailer-brand.css";
import "@/styles/customer-surface-lighting.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
