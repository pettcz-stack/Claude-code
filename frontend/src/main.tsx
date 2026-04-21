/**
 * Viktor čistič — dashboard UI.
 * Copyright © 2026 Sinsu Platform s.r.o. All rights reserved.
 * Proprietary software — licensed to ALBIXON a.s. per separate agreement.
 * See LICENSE file at repository root for full terms.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
