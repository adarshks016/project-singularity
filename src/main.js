/**
 * Project Singularity — entry point.
 *
 * Styles are imported here so Vite can hash and inline them at build time.
 * All application behaviour lives in app.js; data seeds live in src/data.
 */
import "./styles/base.css";
import "./styles/scene.css";
import "./styles/components.css";
import "./styles/features.css";

import { boot } from "./app.js";

boot();

// Offline support. Registered only in production so dev reloads stay honest.
if (navigator.serviceWorker && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
