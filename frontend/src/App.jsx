
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const routeColors = ["#16a34a", "#eab308", "#dc2626"];

function FitRoutes({ routes }) {
  const map = useMap();

  useEffect(() => {
    const points = routes.flatMap((route) => route.coordinates);

    if (points.length > 0) {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [map, routes]);

  return null;
}

function App() {
  const [locations, setLocations] = useState([]);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLocations() {
      try {
        const response = await fetch("http://127.0.0.1:8000/locations");
        const data = await response.json();

        if (!response.ok) {
          throw new Error("Could not load locations.");
        }

        setLocations(data.locations);

        const start = data.locations.find(
          (location) => location.name === "VJTI"
        );
        const end = data.locations.find(
          (location) => location.name === "CSMT"
        );

        if (start) setSource(String(start.node_id));
        if (end) setDestination(String(end.node_id));
      } catch (err) {
        setError(
          err.message === "Failed to fetch"
            ? "Cannot connect to the backend. Check that FastAPI is running."
            : err.message
        );
      } finally {
        setLoadingLocations(false);
      }
    }

    loadLocations();
  }, []);

  async function findRoutes() {
    if (!source || !destination) {
      setError("Please select both a starting point and a destination.");
      return;
    }

    if (source === destination) {
      setError("Choose two different locations.");
      return;
    }

    setLoading(true);
    setError("");
    setRoutes([]);

    try {
      const response = await fetch("http://127.0.0.1:8000/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: Number(source),
          destination: Number(destination),
          k: 3,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not find routes.");
      }

      setRoutes(data.routes);
      setSelectedRoute(0);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the backend. Check that FastAPI is running and CORS is enabled."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  const displayedRoutes = routes.filter(
    (route) => route.coordinates?.length > 0
  );

  const selectedSource = locations.find(
    (location) => String(location.node_id) === source
  );

  const selectedDestination = locations.find(
    (location) => String(location.node_id) === destination
  );

  const mapCenter = [19.0217, 72.8507];

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
            Compare alternative road-network routes using risk-adjusted costs.
          </p>

          <label htmlFor="start-location">Starting point</label>
          <div className="location-box">
            <span className="green-dot"></span>
            <select
              id="start-location"
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setRoutes([]);
                setError("");
              }}
              disabled={loadingLocations}
            >
              <option value="">
                {loadingLocations
                  ? "Loading locations..."
                  : "Select starting point"}
              </option>
              {locations.map((location) => (
                <option
                  key={location.node_id}
                  value={String(location.node_id)}
                >
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <label htmlFor="end-location">Destination</label>
          <div className="location-box">
            <span className="red-dot"></span>
            <select
              id="end-location"
              value={destination}
              onChange={(event) => {
                setDestination(event.target.value);
                setRoutes([]);
                setError("");
              }}
              disabled={loadingLocations}
            >
              <option value="">
                {loadingLocations
                  ? "Loading locations..."
                  : "Select destination"}
              </option>
              {locations.map((location) => (
                <option
                  key={location.node_id}
                  value={String(location.node_id)}
                >
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="find-button"
            onClick={findRoutes}
            disabled={loading || loadingLocations}
          >
            {loading ? "Calculating routes..." : "Find alternative routes"}
            <span>→</span>
          </button>

          {error && <p className="route-error">{error}</p>}

          <div className="divider"></div>

          <div className="section-heading">
            <h3>Map legend</h3>
            <span>ROUTES</span>
          </div>

          {displayedRoutes.map((route, index) => (
            <button
              key={route.path.join("-")}
              className={`legend-item route-choice ${
                selectedRoute === index ? "active-route" : ""
              }`}
              onClick={() => setSelectedRoute(index)}
              aria-pressed={selectedRoute === index}
            >
              <span
                className="legend-line"
                style={{
                  backgroundColor: routeColors[index % routeColors.length],
                }}
              ></span>
              <span>
                Route {index + 1} · {Number(route.total_cost).toFixed(2)} cost
              </span>
            </button>
          ))}

          {routes.length > 0 && (
            <div className="route-result">
              <p className="eyebrow">ROUTE OPTIONS</p>
              <h3>{displayedRoutes.length} routes found</h3>

              <div className="route-cards">
                {displayedRoutes.map((route, index) => (
                  <button
                    type="button"
                    className={`route-card ${
                      selectedRoute === index ? "selected" : ""
                    }`}
                    key={route.path.join("-")}
                    onClick={() => setSelectedRoute(index)}
                    aria-pressed={selectedRoute === index}
                  >
                    <div className="route-card-heading">
                      <span
                        className="route-color-dot"
                        style={{
                          backgroundColor:
                            routeColors[index % routeColors.length],
                        }}
                      ></span>
                      <strong>Route {index + 1}</strong>
                      {index === 0 && (
                        <span className="shortest-label">Lowest cost</span>
                      )}
                    </div>

                    <div className="route-stats">
                      <div>
                        <span>Distance</span>
                        <strong>
                          {(Number(route.distance) / 1000).toFixed(2)} km
                        </strong>
                      </div>
                      <div>
                        <span>Est. time</span>
                        <strong>
                          {Number(
                            route.estimated_travel_time_minutes
                          ).toFixed(1)}{" "}
                          min
                        </strong>
                      </div>
                      <div>
                        <span>Risk score</span>
                        <strong>
                          {Number(route.flood_risk_score).toFixed(2)}
                        </strong>
                      </div>
                      <div>
                        <span>Model cost</span>
                        <strong>
                          {Number(route.total_cost).toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <small>
                Flood risk is assumed where real risk data is unavailable.
                This prototype does not use live flood or traffic data.
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
              center={mapCenter}
              zoom={13}
              scrollWheelZoom={true}
              className="leaflet-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {displayedRoutes.length > 0 && (
                <FitRoutes routes={displayedRoutes} />
              )}

              {displayedRoutes.length > 0 && (
                <>
                  <Marker position={displayedRoutes[0].coordinates[0]}>
                    <Popup>
                      Starting point: {selectedSource?.name || "Road node"}
                    </Popup>
                  </Marker>

                  <Marker
                    position={
                      displayedRoutes[0].coordinates[
                        displayedRoutes[0].coordinates.length - 1
                      ]
                    }
                  >
                    <Popup>
                      Destination: {selectedDestination?.name || "Road node"}
                    </Popup>
                  </Marker>
                </>
              )}

              {displayedRoutes.map((route, index) => (
                <Polyline
                  key={`outline-${route.path.join("-")}`}
                  positions={route.coordinates}
                  pathOptions={{
                    color: "#ffffff",
                    weight: selectedRoute === index ? 11 : 8,
                    opacity: 0.95,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                  interactive={false}
                />
              ))}

              {displayedRoutes.map((route, index) => (
                <Polyline
                  key={route.path.join("-")}
                  positions={route.coordinates}
                  pathOptions={{
                    color: routeColors[index % routeColors.length],
                    weight: selectedRoute === index ? 6 : 4,
                    opacity: selectedRoute === index ? 1 : 0.8,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                  eventHandlers={{
                    click: () => setSelectedRoute(index),
                  }}
                />
              ))}
            </MapContainer>
          </div>

          <div className="map-footer">
            <span>
              {selectedSource?.name || "Starting point"} →{" "}
              {selectedDestination?.name || "Destination"}
            </span>
            <span>Prototype · Not for real-world navigation</span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
