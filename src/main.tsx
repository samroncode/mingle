import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element in index.html");
}

createRoot(rootElement).render(<StrictMode />);
