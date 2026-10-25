
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const ROUTE_COLORS = ["#0b7285", "#5b5bd6", "#b83280"];

const LEVEL_STYLE = {
  1: { color: "#d9a42b", fill: "#f2c94c", label: "Low" },
  2: { color: "#d9822b", fill: "#f2994a", label: "Medium" },
  3: { color: "#b8321f", fill: "#d9503b", label: "Closed" },
};

// Used only if the backend has no /scenarios endpoint yet.
const FALLBACK_SCENARIOS = [
  { id: "normal", label: "Normal day", description: "", zones: [] },
];

const startIcon = L.divIcon({
  className: "pin pin-start",
  html: "<span></span>",
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const endIcon = L.divIcon({
  className: "pin pin-end",
  html: "<span></span>",
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function formatMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return "–";
  if (value < 10) return `${value.toFixed(1)} min`;
  if (value < 60) return `${Math.round(value)} min`;
  return `${Math.floor(value / 60)} h ${Math.round(value % 60)} min`;
}

function formatKm(metres) {
  return `${(Number(metres) / 1000).toFixed(1)} km`;
}

function formatMetres(metres) {
  const value = Number(metres);
  return value >= 1000 ? formatKm(value) : `${Math.round(value)} m`;
}

async function request(path, options) {
  let response;

  try {
    response = await fetch(`${API}${path}`, options);
  } catch {
    throw new Error(
      "Can't reach the server. Start the FastAPI backend and try again."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => item.msg).join(". ")
      : data.detail;
    throw new Error(detail || "Something went wrong. Try again.");
  }

  return data;
}

function FitBounds({ routes }) {
  const map = useMap();

  useEffect(() => {
    const points = routes.flatMap((route) => route.coordinates);
    if (points.length > 0) {
      map.fitBounds(points, { padding: [60, 60] });
    }
  }, [map, routes]);

  return null;
}

function ScenarioControl({ scenarios, value, onChange, disabled }) {
  const active = scenarios.find((scenario) => scenario.id === value);

  return (
    <fieldset className="conditions" disabled={disabled}>
      <legend>Road conditions</legend>

      <div className="segmented" role="radiogroup">
        {scenarios.map((scenario) => (
          <label
            key={scenario.id}
            className={value === scenario.id ? "segment on" : "segment"}
          >
            <input
              type="radio"
              name="scenario"
              value={scenario.id}
              checked={value === scenario.id}
              onChange={() => onChange(scenario.id)}
            />
            <span className="segment-name">{scenario.label}</span>
            <span className="segment-count">
              {scenario.zones.length === 0
                ? "No flooding"
                : `${scenario.zones.length} flooded`}
            </span>
          </label>
        ))}
      </div>

      {active?.description && (
        <p className="conditions-note">{active.description}</p>
      )}
    </fieldset>
  );
}

function ExposureBar({ exposure, distance }) {
  const share = distance > 0 ? exposure / distance : 0;
  const width = exposure > 0 ? Math.max(share * 100, 4) : 0;

  return (
    <div className="exposure" aria-hidden="true">
      <div className="exposure-fill" style={{ width: `${width}%` }} />
    </div>
  );
}

function RouteCard({ route, index, badges, selected, dry, onSelect }) {
  const delay = Number(route.flood_delay_minutes) || 0;
  const exposure = Number(route.flood_exposure_m) || 0;

  return (
    <button
      type="button"
      className={selected ? "route-card selected" : "route-card"}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span
        className="route-swatch"
        style={{ backgroundColor: ROUTE_COLORS[index % ROUTE_COLORS.length] }}
      />

      <div className="route-main">
        <div className="route-title">
          <strong>Route {index + 1}</strong>
          {badges.map((badge) => (
            <span key={badge} className="badge">
              {badge}
            </span>
          ))}
        </div>

        <div className="route-figures">
          <span className="route-time">
            {formatMinutes(route.estimated_travel_time_minutes)}
          </span>
          <span className="route-distance">{formatKm(route.distance)}</span>
        </div>

        <ExposureBar exposure={exposure} distance={route.distance} />

        <p className="route-flood">
          {exposure > 0
            ? `${formatMetres(exposure)} through flooded roads`
            : dry
              ? "No flooding in this scenario"
              : "Avoids flooded roads"}
          {delay > 0.05 && ` · adds ${formatMinutes(delay)}`}
        </p>
      </div>
    </button>
  );
}

function Comparison({ best, baseline, scenario }) {
  if (!best || !baseline || scenario === "normal") return null;

  if (baseline.same_as_best) {
    const exposure = Number(baseline.flood_exposure_m) || 0;
    const delay = Number(best.flood_delay_minutes) || 0;

    if (exposure > 0) {
      return (
        <div className="compare warn">
          <strong>Still the best choice, despite some flooding.</strong>
          <p>
            It crosses {formatMetres(exposure)} of flooded roads
            {delay > 0.05 ? ` and adds ${formatMinutes(delay)}` : ""}, but
            every alternative takes longer overall.
          </p>
        </div>
      );
    }

    return (
      <div className="compare calm">
        <strong>The fastest dry route is also the best one here.</strong>
        <p>It doesn't cross any flooded road in this scenario.</p>
      </div>
    );
  }

  const blocked = baseline.blocked_segments || 0;
  const saved =
    Number(baseline.estimated_travel_time_minutes) -
    Number(best.estimated_travel_time_minutes);

  return (
    <div className="compare warn">
      <strong>Why not just take the fastest road?</strong>
      <p>
        On a dry day it would be{" "}
        {formatMinutes(baseline.dry_travel_time_minutes)}. In this scenario it
        crosses {formatMetres(baseline.flood_exposure_m)} of flooded roads
        {blocked > 0
          ? ` and ${blocked} closed ${blocked === 1 ? "road" : "roads"}, so it can't be driven.`
          : saved > 0.1
            ? `, which makes it ${formatMinutes(saved)} slower than Route 1.`
            : "."}
      </p>
    </div>
  );
}

function App() {
  const [locations, setLocations] = useState([]);
  const [scenarios, setScenarios] = useState(FALLBACK_SCENARIOS);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [scenario, setScenario] = useState("normal");
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(0);
  const [showBaseline, setShowBaseline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  useEffect(() => {
    async function boot() {
      try {
        const [locationData, scenarioData] = await Promise.all([
          request("/locations"),
          request("/scenarios").catch(() => null),
        ]);

        setLocations(locationData.locations);

        if (scenarioData?.scenarios?.length) {
          setScenarios(scenarioData.scenarios);
        }

        const start = locationData.locations.find((l) => l.name === "VJTI");
        const end = locationData.locations.find((l) => l.name === "CSMT");
        if (start) setSource(String(start.node_id));
        if (end) setDestination(String(end.node_id));
      } catch (err) {
        setError(err.message);
      } finally {
        setBooting(false);
      }
    }

    boot();
  }, []);

  async function findRoutes(scenarioId = scenario) {
    if (!source || !destination) {
      setError("Choose a start and a destination.");
      return;
    }

    if (source === destination) {
      setError("Start and destination are the same place. Pick two different ones.");
      return;
    }

    const requestId = ++latestRequest.current;
    setLoading(true);
    setError("");

    try {
      const data = await request("/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: Number(source),
          destination: Number(destination),
          k: 3,
          scenario: scenarioId,
        }),
      });

      if (requestId !== latestRequest.current) return;

      setResult(data);
      setSelected(0);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setResult(null);
      setError(err.message);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }

  function changeScenario(id) {
    setScenario(id);

    // Re-plan straight away so the route visibly reacts to the flooding.
    if (result) findRoutes(id);
  }

  function changePlace(setter) {
    return (event) => {
      latestRequest.current++;
      setter(event.target.value);
      setResult(null);
      setLoading(false);
      setError("");
    };
  }

  function swapPlaces() {
    latestRequest.current++;
    setSource(destination);
    setDestination(source);
    setResult(null);
    setLoading(false);
    setError("");
  }

  const routes = useMemo(
    () => (result?.routes || []).filter((r) => r.coordinates?.length > 0),
    [result]
  );

  const baseline = result?.baseline;
  const activeScenario = scenarios.find((s) => s.id === scenario);
  const zones = activeScenario?.zones || [];

  const badgesFor = useMemo(() => {
    const fastest = Math.min(
      ...routes.map((r) => Number(r.estimated_travel_time_minutes))
    );
    const exposures = routes.map((r) => Number(r.flood_exposure_m) || 0);
    const leastExposure = Math.min(...exposures);
    const exposureVaries = Math.max(...exposures) > leastExposure;

    return routes.map((route, index) => {
      const badges = [];
      if (index === 0) badges.push("Recommended");
      if (
        routes.length > 1 &&
        Number(route.estimated_travel_time_minutes) === fastest &&
        index !== 0
      ) {
        badges.push("Fastest");
      }
      if (exposureVaries && exposures[index] === leastExposure && index !== 0) {
        badges.push("Least flooded");
      }
      return badges;
    });
  }, [routes]);

  const sourceName = locations.find((l) => String(l.node_id) === source)?.name;
  const destinationName = locations.find(
    (l) => String(l.node_id) === destination
  )?.name;

  const current = routes[selected];
  const baselineDiffers = baseline && !baseline.same_as_best;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                d="M3 15c2.2 0 2.2-2 4.5-2s2.2 2 4.5 2 2.2-2 4.5-2 2.2 2 4.5 2M3 19.5c2.2 0 2.2-2 4.5-2s2.2 2 4.5 2 2.2-2 4.5-2 2.2 2 4.5 2M12 3C9 7 7 9.4 7 12a5 5 0 0 0 10 0c0-2.6-2-5-5-9z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <h1>FloodRoute</h1>
            <p>Flood-aware routes for Mumbai</p>
          </div>
        </div>

        <span className="sim-badge">Simulated flooding, not live data</span>
      </header>

      <main className="layout">
        <aside className="panel">
          <section className="trip">
            <h2>Plan a trip</h2>

            <div className="places">
              <div className="places-rail" aria-hidden="true">
                <span className="dot dot-start" />
                <span className="line" />
                <span className="dot dot-end" />
              </div>

              <div className="places-fields">
                <label className="field">
                  <span>From</span>
                  <select
                    value={source}
                    onChange={changePlace(setSource)}
                    disabled={booting}
                  >
                    <option value="">
                      {booting ? "Loading places…" : "Choose a start"}
                    </option>
                    {locations.map((l) => (
                      <option key={l.node_id} value={String(l.node_id)}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>To</span>
                  <select
                    value={destination}
                    onChange={changePlace(setDestination)}
                    disabled={booting}
                  >
                    <option value="">
                      {booting ? "Loading places…" : "Choose a destination"}
                    </option>
                    {locations.map((l) => (
                      <option key={l.node_id} value={String(l.node_id)}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                className="swap"
                onClick={swapPlaces}
                disabled={booting}
                aria-label="Swap start and destination"
                title="Swap start and destination"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    d="M8 4v14m0 0-3-3m3 3 3-3M16 20V6m0 0-3 3m3-3 3 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </section>

          <ScenarioControl
            scenarios={scenarios}
            value={scenario}
            onChange={changeScenario}
            disabled={booting}
          />

          <button
            type="button"
            className="primary"
            onClick={() => findRoutes()}
            disabled={booting || loading}
          >
            {loading ? "Finding routes…" : "Find routes"}
          </button>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {loading && !result && (
            <p className="hint">
              Searching for alternatives. Longer trips can take several seconds.
            </p>
          )}

          {routes.length > 0 && (
            <section
              className={loading ? "results updating" : "results"}
              aria-live="polite"
            >
              <div className="results-head">
                <h2>
                  {routes.length} {routes.length === 1 ? "route" : "routes"}
                </h2>
                <span className="timing">
                  {loading
                    ? "Updating…"
                    : `Found in ${(result.computation_ms / 1000).toFixed(1)} s`}
                </span>
              </div>

              <Comparison
                best={routes[0]}
                baseline={baseline}
                scenario={result.scenario}
              />

              <div className="route-list">
                {routes.map((route, index) => (
                  <RouteCard
                    key={route.path.join("-")}
                    route={route}
                    index={index}
                    badges={badgesFor[index] || []}
                    selected={selected === index}
                    dry={result.scenario === "normal"}
                    onSelect={() => setSelected(index)}
                  />
                ))}
              </div>
            </section>
          )}

          <details className="how">
            <summary>How routes are chosen</summary>
            <ol>
              <li>
                Each road costs its travel time, multiplied when it's flooded.
                Closed roads are removed.
              </li>
              <li>
                Dijkstra's algorithm with a min-heap finds the cheapest route in
                O((V + E) log V).
              </li>
              <li>
                Yen's method then finds alternatives, skipping any that share
                more than 80% of their roads with a route already chosen.
              </li>
              <li>Merge sort ranks the routes by total cost.</li>
            </ol>
          </details>
        </aside>

        <section className="map-wrap" aria-label="Map">
          <MapContainer
            center={[19.0, 72.84]}
            zoom={12}
            scrollWheelZoom
            className="map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {routes.length > 0 && <FitBounds routes={routes} />}

            {zones.map((zone) => {
              const style = LEVEL_STYLE[zone.level] || LEVEL_STYLE[1];
              return (
                <Circle
                  key={`${scenario}-${zone.id}`}
                  center={[zone.lat, zone.lon]}
                  radius={zone.radius_m}
                  pathOptions={{
                    color: style.color,
                    weight: zone.blocked ? 2 : 1.5,
                    dashArray: zone.blocked ? "5 4" : undefined,
                    fillColor: style.fill,
                    fillOpacity: zone.blocked ? 0.38 : 0.26,
                  }}
                >
                  <Tooltip direction="top" sticky>
                    <strong>{zone.name}</strong>
                    <br />
                    {zone.blocked ? "Closed to traffic" : `${style.label} flooding`}
                  </Tooltip>
                </Circle>
              );
            })}

            {showBaseline && baselineDiffers && !loading && (
              <Polyline
                positions={baseline.coordinates}
                pathOptions={{
                  color: "#51606b",
                  weight: 3,
                  opacity: 0.85,
                  dashArray: "2 8",
                  lineCap: "round",
                }}
                interactive={false}
              />
            )}

            {routes.map((route, index) => (
              <Polyline
                key={`casing-${route.path.join("-")}`}
                positions={route.coordinates}
                pathOptions={{
                  color: "#ffffff",
                  weight: selected === index ? 11 : 8,
                  opacity: loading ? 0.4 : 0.95,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                interactive={false}
              />
            ))}

            {routes.map((route, index) => (
              <Polyline
                key={route.path.join("-")}
                positions={route.coordinates}
                pathOptions={{
                  color: ROUTE_COLORS[index % ROUTE_COLORS.length],
                  weight: selected === index ? 6 : 4,
                  opacity: loading ? 0.35 : selected === index ? 1 : 0.75,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                eventHandlers={{ click: () => setSelected(index) }}
              />
            ))}

            {routes.length > 0 && (
              <>
                <Marker position={routes[0].coordinates[0]} icon={startIcon}>
                  <Popup>From {sourceName || "start"}</Popup>
                </Marker>
                <Marker
                  position={
                    routes[0].coordinates[routes[0].coordinates.length - 1]
                  }
                  icon={endIcon}
                >
                  <Popup>To {destinationName || "destination"}</Popup>
                </Marker>
              </>
            )}
          </MapContainer>

          {zones.length > 0 && (
            <div className="map-card legend">
              <strong>Flooded junctions</strong>
              <ul>
                {[1, 2, 3]
                  .filter((level) => zones.some((z) => z.level === level))
                  .map((level) => (
                    <li key={level}>
                      <span
                        className={level === 3 ? "swatch closed" : "swatch"}
                        style={{
                          backgroundColor: LEVEL_STYLE[level].fill,
                          borderColor: LEVEL_STYLE[level].color,
                        }}
                      />
                      {LEVEL_STYLE[level].label}
                      {level === 3 && " (no traffic)"}
                    </li>
                  ))}
              </ul>

              {baselineDiffers && (
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={showBaseline}
                    onChange={(e) => setShowBaseline(e.target.checked)}
                  />
                  <span className="toggle-line" aria-hidden="true" />
                  Fastest dry route
                </label>
              )}
            </div>
          )}

          {current && (
            <div className="map-card summary">
              <span
                className="summary-swatch"
                style={{
                  backgroundColor:
                    ROUTE_COLORS[selected % ROUTE_COLORS.length],
                }}
              />
              <div>
                <strong>
                  {sourceName} to {destinationName}
                </strong>
                <p>
                  Route {selected + 1}: {formatMinutes(current.estimated_travel_time_minutes)},{" "}
                  {formatKm(current.distance)}
                  {Number(current.flood_exposure_m) > 0
                    ? `, ${formatMetres(current.flood_exposure_m)} flooded`
                    : ", no flooded roads"}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="foot">
        Flood zones are approximate and based on commonly reported waterlogging
        spots. Prototype only. Don't use it to navigate.
      </footer>
    </div>
  );
}

export default App;
