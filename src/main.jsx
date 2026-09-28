import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import "./styles.css";
const url = import.meta.env.VITE_CONVEX_URL;
class Boundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="recovery">
        <h1>Let’s reconnect.</h1>
        <p>Your session may have expired. Refresh to reconnect securely.</p>
        <button onClick={() => location.reload()}>Refresh portal</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Boundary>
      {url ? (
        <ConvexAuthProvider client={new ConvexReactClient(url)}>
          <App />
        </ConvexAuthProvider>
      ) : (
        <main className="recovery">
          <h1>Portal setup required</h1>
          <p>Configure VITE_CONVEX_URL to connect Amanah’s database.</p>
        </main>
      )}
    </Boundary>
  </React.StrictMode>,
);
