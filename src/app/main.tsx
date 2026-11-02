import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "./index.css";
import { AppRouter } from "@/app/router";
import { logCaught } from "@/api/log";
import { installCatchAll } from "@/lib/logging/catchAll";

installCatchAll((entry) => void logCaught(entry));

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
