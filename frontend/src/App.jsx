
import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

function App() {
  const [destination, setDestination] = useState("CSMT");
  const [showRoutes, setShowRoutes] = useState(false);

  const vjti = [19.0217, 72.8507];
  const csmt = [18.9402, 72.8356];

  const safeRoute = [
    vjti,
    [19.015, 72.848],
    [19.000, 72.843],
    [18.975, 72.840],
    [18.955, 72.838],
    csmt,
  ];

  const alternateRoute = [
    vjti,
    [19.018, 72.860],
    [18.995, 72.865],
    [18.970, 72.858],
    [18.950, 72.850],
    csmt,
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">F</div>
          <div>
            <h1>FloodRoute</h1>
            <p>SMART FLOOD-AWARE NAVIGATION</p>
          </div>
        </div>

        <div className="status">
          <span className="status-dot"></span>
          Prototype · Simulated flood data
        </div>
      </header>

      <main className="dashboard">
        <section className="sidebar">
          <p className="eyebrow">PLAN YOUR JOURNEY</p>
          <h2>Find a safer way.</h2>
          <p className="intro">
            Explore alternative routes while accounting for
            simulated waterlogging risks.
          </p>

          <label htmlFor="source">Starting point</label>
          <div className="location-box">
            <span className="green-dot"></span>
            <input id="source" value="VJTI, Mumbai" readOnly />
          </div>

          <label htmlFor="destination">Destination</label>
          <div className="location-box">
            <span className="red-dot"></span>
            <select
              id="destination"
              value={destination}
              onChange={(event) => {
                setDestination(event.target.value);
                setShowRoutes(false);
              }}
            >
              <option value="CSMT">CSMT, Mumbai</option>
              <option value="Gateway">Gateway of India</option>
              <option value="Dadar">Dadar Station</option>
            </select>
          </div>

          <button
            className="find-button"
            onClick={() => setShowRoutes(true)}
          >
            Find alternative routes <span>→</span>
          </button>

          <div className="divider"></div>

          <div className="section-heading">
            <h3>Map legend</h3>
            <span>FLOOD RISK</span>
          </div>

          <div className="legend-item">
            <span className="legend-line safe"></span>
            <span>Lower risk</span>
          </div>
          <div className="legend-item">
            <span className="legend-line risky"></span>
            <span>Elevated risk</span>
          </div>
          <div className="legend-item">
            <span className="legend-line blocked"></span>
            <span>Blocked road</span>
          </div>

          {showRoutes && (
            <div className="route-result">
              <p className="eyebrow">DEMO ROUTE OPTIONS</p>
              <h3>Routes to {destination}</h3>
              <p>Route 1 · Illustrative lower-risk route</p>
              <p>Route 2 · Illustrative alternative</p>
              <small>
                Sample paths only — not yet calculated by the backend.
              </small>
            </div>
          )}
        </section>

        <section className="map-panel">
          <div className="map-heading">
            <div>
              <h2>Road network</h2>
              <p>Mumbai · OpenStreetMap</p>
            </div>
            <span className="map-tag">LIVE MAP TILES</span>
          </div>

          <div className="map-container">
            <MapContainer
              center={[18.985, 72.848]}
              zoom={12}
              scrollWheelZoom={true}
              className="leaflet-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Marker position={vjti}>
                <Popup>Starting point: VJTI, Mumbai</Popup>
              </Marker>

              <Marker position={csmt}>
                <Popup>Demo destination: CSMT, Mumbai</Popup>
              </Marker>

              {showRoutes && (
                <>
                  <Polyline
                    positions={safeRoute}
                    pathOptions={{ color: "#16a34a", weight: 5 }}
                  />
                  <Polyline
                    positions={alternateRoute}
                    pathOptions={{
                      color: "#eab308",
                      weight: 4,
                      dashArray: "8 8",
                    }}
                  />
                </>
              )}
            </MapContainer>
          </div>

          <div className="map-footer">
            <span>⌖ VJTI → {destination}</span>
            <span>Illustrative routes · Not for real-world navigation</span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
