import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { logFrontend } from "./api/client";
import "./index.css";

window.addEventListener("error", (event) => {
  logFrontend("error", event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  logFrontend("error", reason?.message || "Unhandled promise rejection", {
    stack: reason?.stack,
    reason: String(reason),
  });
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
