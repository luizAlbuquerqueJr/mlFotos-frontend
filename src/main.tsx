import { createRoot } from "react-dom/client";
import Tracker from "@openreplay/tracker";
import App from "./App.tsx";
import "./index.css";

const isLocalhost = window.location.hostname === "localhost";

const tracker = new Tracker({
  projectKey: "40KpiqKHMe1kWB1vrE34",
  respectDoNotTrack: false,
  __DISABLE_SECURE_MODE: isLocalhost,
  inlineCss: isLocalhost ? 3 : 0,
  __debug__: isLocalhost ? 4 : 0,
});

tracker
  .start()
  .then((res) => {
    if (res && typeof res === "object" && "sessionID" in res) {
      console.log("OpenReplay started:", (res as { sessionID: string }).sessionID);
      return;
    }

    console.warn("OpenReplay did not start:", res);
  })
  .catch((err: unknown) => console.error("OpenReplay failed to start:", err));

createRoot(document.getElementById("root")!).render(<App />);
