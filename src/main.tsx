import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { loadSettings } from "./lib/game/settings";
import { applyTheme } from "./lib/theme";
import "./styles.css";

// The chosen look's stylesheet goes in before the first paint, so a Mono
// player never sees a flash of Classic.
void applyTheme(loadSettings().theme).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
