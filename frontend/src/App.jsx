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
  ZoomControl,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import AlgorithmComparison from "./AlgorithmComparison";
import { playSearch } from "./searchReplay";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Recommended route is solid teal; alternatives are dashed.
const ROUTE_COLORS = ["#1fd1b5", "#3b9cff", "#9b6bff"];
const CRITICAL_COLOR = "#ffd43b";

const IDLE_REPLAY = { status: "idle", algorithm: null, label: "", done: 0, total: 0 };

const LEVEL_STYLE = {
  1: { color: "#f2c94c", label: "Low" },
  2: { color: "#f2994a", label: "Medium" },
  3: { color: "#ef4444", label: "Closed" },
};

const FALLBACK_SCENARIOS = [
  { id: "normal", label: "Normal day", description: "", zones: [] },
];

const ALGORITHMS = [
  { id: "astar", label: "A* (heuristic search)" },
  { id: "dijkstra", label: "Dijkstra" },
];

const SORTS = [
  { key: "total_cost", label: "Total cost" },
  { key: "distance", label: "Distance" },
  { key: "estimated_travel_time_minutes", label: "Time" },
  { key: "flood_exposure_m", label: "Flood exposure" },
];

const NAV = [
  { id: "planner", label: "Route planner", icon: "route" },
  { id: "network", label: "Network analysis", icon: "network" },
  { id: "scenario-field", label: "Flood scenarios", icon: "drop" },
  { id: "about", label: "About", icon: "info" },
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

/* ---------- helpers ---------- */

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

// Share of the route that runs through flooded roads -> a label for the UI.
function exposureOf(route) {
  const distance = Number(route.distance) || 0;
  const exposure = Number(route.flood_exposure_m) || 0;
  const share = distance > 0 ? exposure / distance : 0;

  if (exposure <= 0) return { text: "None", tone: "good" };
  if (share < 0.1) return { text: "Low", tone: "good" };
  if (share < 0.3) return { text: "Medium", tone: "warn" };
  return { text: "High", tone: "bad" };
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

/* ---------- small UI pieces ---------- */

const ICONS = {
  pin: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  drop: "M12 3C9 7 7 9.4 7 12a5 5 0 0 0 10 0c0-2.6-2-5-5-9z",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm5-2 5 5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  shield: "M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z",
  gauge: "M4 17a8 8 0 1 1 16 0M12 17l4-5",
  route:
    "M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 18h6a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h6",
  chevron: "m6 9 6 6 6-6",
  swap: "M8 4v14m0 0-3-3m3 3 3-3M16 20V6m0 0-3 3m3-3 3 3",
  network:
    "M6 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7.5 7.5l3.5 9M16.5 7.5 13 16.5M8 6h8",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8v.01",
  ruler: "M3 16 16 3l5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2",
  play: "M8 5v14l11-7z",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z",
};

function Icon({ name, size = 18, className = "" }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path
        d={ICONS[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardHead({ icon, title, aside }) {
  return (
    <div className="card-head">
      <Icon name={icon} />
      <h2>{title}</h2>
      {aside}
    </div>
  );
}

function Field({ id, label, icon, children }) {
  return (
    <label className="fld" id={id}>
      <span className="fld-label">{label}</span>
      <span className="fld-box">
        <Icon name={icon} />
        {children}
        <Icon name="chevron" size={16} className="fld-chev" />
      </span>
    </label>
  );
}

function Switch({ label, checked, onChange, disabled }) {
  return (
    <label className={disabled ? "switch-row disabled" : "switch-row"}>
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="switch" aria-hidden="true" />
    </label>
  );
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

// Hands the Leaflet map instance up to App so the search replay can draw on it.
function MapBridge({ onMap }) {
  const map = useMap();

  useEffect(() => {
    onMap(map);
  }, [map, onMap]);

  return null;
}

function Comparison({ best, baseline, scenario }) {
  if (!best || !baseline || scenario === "normal") {
    return (
      <p className="hint">
        {scenario === "normal"
          ? "Roads are dry in this scenario, so there is no flood impact to compare."
          : "Find routes to see how flooding changes the best choice."}
      </p>
    );
  }

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
            ? `, which makes it ${formatMinutes(saved)} slower than the recommended route.`
            : "."}
      </p>
    </div>
  );
}

/* ---------- app ---------- */

function App() {
  const [locations, setLocations] = useState([]);
  const [scenarios, setScenarios] = useState(FALLBACK_SCENARIOS);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [scenario, setScenario] = useState("normal");
  const [k, setK] = useState(3);
  const [algorithm, setAlgorithm] = useState("astar");
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  const [networkAnalysis, setNetworkAnalysis] = useState(null);
  const [networkLoading, setNetworkLoading] = useState(true);
  const [networkError, setNetworkError] = useState("");

  const [mapInstance, setMapInstance] = useState(null);
  const [replay, setReplay] = useState(IDLE_REPLAY);
  const [replayError, setReplayError] = useState("");
  const cancelReplay = useRef(null);
  const latestReplay = useRef(0);
  const [backendOnline, setBackendOnline] = useState(null);

  // Layers and options
  const [showCriticalRoads, setShowCriticalRoads] = useState(false);
  const [showFloodZones, setShowFloodZones] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [autoCompare, setAutoCompare] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [tab, setTab] = useState("details");
  const [sortBy, setSortBy] = useState("total_cost");

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

  useEffect(() => {
    async function fetchNetworkAnalysis() {
      try {
        setNetworkAnalysis(await request("/network-analysis"));
      } catch (err) {
        setNetworkError(err.message);
      } finally {
        setNetworkLoading(false);
      }
    }

    fetchNetworkAnalysis();
  }, []);

  useEffect(() => {
    let active = true;

    async function checkBackend() {
      try {
        const response = await fetch(`${API}/`);
        if (active) setBackendOnline(response.ok);
      } catch {
        if (active) setBackendOnline(false);
      }
    }

    checkBackend();
    const timer = setInterval(checkBackend, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function findRoutes(scenarioId = scenario, kValue = k, algo = algorithm) {
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
          k: kValue,
          scenario: scenarioId,
          algorithm: algo,
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
    stopReplay();
    if (result) findRoutes(id);
  }

  function changeK(value) {
    setK(value);
    if (result) findRoutes(scenario, value);
  }

  function changeAlgorithm(value) {
    setAlgorithm(value);
    if (result) findRoutes(scenario, k, value);
  }

  function changePlace(setter) {
    return (event) => {
      latestRequest.current++;
      stopReplay();
      setter(event.target.value);
      setResult(null);
      setLoading(false);
      setError("");
    };
  }

  function swapPlaces() {
    latestRequest.current++;
    stopReplay();
    setSource(destination);
    setDestination(source);
    setResult(null);
    setLoading(false);
    setError("");
  }

  function stopReplay() {
    latestReplay.current++;
    cancelReplay.current?.();
    cancelReplay.current = null;
    setReplay(IDLE_REPLAY);
    setReplayError("");
  }

  async function watchSearch() {
    if (!source || !destination) {
      setReplayError("Choose a start and a destination.");
      return;
    }

    if (source === destination) {
      setReplayError("Start and destination are the same place. Pick two different ones.");
      return;
    }

    if (!mapInstance) return;

    stopReplay();
    const replayId = latestReplay.current;
    setReplay({ ...IDLE_REPLAY, status: "loading" });

    try {
      const data = await request("/search-trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: Number(source),
          destination: Number(destination),
          scenario,
        }),
      });

      if (replayId !== latestReplay.current) return;

      if (data.dijkstra.explored.length > 0) {
        mapInstance.fitBounds(data.dijkstra.explored, { padding: [40, 40] });
      }

      setReplay({ ...IDLE_REPLAY, status: "playing" });

      cancelReplay.current = playSearch(L, mapInstance, data, {
        onProgress: (progress) => {
          if (replayId !== latestReplay.current) return;
          setReplay({ status: "playing", ...progress });
        },
        onDone: () => {
          if (replayId !== latestReplay.current) return;
          setReplay((previous) => ({ ...previous, status: "done" }));
        },
      });
    } catch (err) {
      if (replayId !== latestReplay.current) return;
      setReplay(IDLE_REPLAY);
      setReplayError(err.message);
    }
  }

  function jumpTo(id) {
    if (id === "network") setShowCriticalRoads(true);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const routes = useMemo(
    () => (result?.routes || []).filter((r) => r.coordinates?.length > 0),
    [result]
  );

  const baseline = result?.baseline;
  const baselineDiffers = baseline && !baseline.same_as_best;
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

  const sortedRows = useMemo(
    () =>
      routes
        .map((route, index) => ({ route, index }))
        .sort(
          (a, b) =>
            (Number(a.route[sortBy]) || 0) - (Number(b.route[sortBy]) || 0)
        ),
    [routes, sortBy]
  );

  const sourceName = locations.find((l) => String(l.node_id) === source)?.name;
  const destinationName = locations.find(
    (l) => String(l.node_id) === destination
  )?.name;

  const current = routes[selected];
  const currentExposure = current ? exposureOf(current) : null;

  const statusClass =
    backendOnline === null ? "checking" : backendOnline ? "online" : "offline";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24">
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
            <p>Safer routes. Stronger cities.</p>
          </div>
        </div>

        <nav className="nav" aria-label="Sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === "planner" ? "nav-item active" : "nav-item"}
              onClick={() => jumpTo(item.id)}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </button>
          ))}
        </nav>

        <span className={`status-badge ${statusClass}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {backendOnline === null
            ? "Checking backend…"
            : backendOnline
              ? "Backend online"
              : "Backend offline"}
        </span>
      </header>

      <main className="dash">
        {/* ---------------- left column ---------------- */}
        <aside className="col col-left">
          <section className="card" id="planner">
            <CardHead icon="pin" title="Plan your route" />
            <p className="sub">
              Find the safest and most efficient route in Mumbai with flood
              awareness.
            </p>

            <div className="swap-wrap">
              <Field label="From" icon="pin">
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
              </Field>

              <button
                type="button"
                className="swap"
                onClick={swapPlaces}
                disabled={booting}
                aria-label="Swap start and destination"
                title="Swap start and destination"
              >
                <Icon name="swap" size={16} />
              </button>

              <Field label="To" icon="pin">
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
              </Field>
            </div>

            <Field id="scenario-field" label="Flood scenario" icon="drop">
              <select
                value={scenario}
                onChange={(e) => changeScenario(e.target.value)}
                disabled={booting}
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {s.zones.length ? ` (${s.zones.length} flooded)` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {activeScenario?.description && (
              <p className="note">{activeScenario.description}</p>
            )}

            <Field label="Algorithm" icon="settings">
              <select
                value={algorithm}
                onChange={(e) => changeAlgorithm(e.target.value)}
                disabled={booting}
              >
                {ALGORITHMS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Number of alternative routes (K)" icon="route">
              <select
                value={k}
                onChange={(e) => changeK(Number(e.target.value))}
                disabled={booting}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>

            <button
              type="button"
              className="primary"
              onClick={() => findRoutes()}
              disabled={booting || loading}
            >
              <Icon name="search" size={18} />
              {loading ? "Finding routes…" : "Find routes"}
            </button>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {loading && !result && (
              <p className="hint">
                Searching for alternatives. Longer trips can take several
                seconds.
              </p>
            )}
          </section>

          <section className="card">
            <button
              type="button"
              className="card-head toggle-head"
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
            >
              <Icon name="settings" />
              <h2>Advanced options</h2>
              <Icon
                name="chevron"
                size={16}
                className={advancedOpen ? "chev open" : "chev"}
              />
            </button>

            {advancedOpen && (
              <div className="switches">
                <Switch
                  label="Show critical roads (Tarjan's algorithm)"
                  checked={showCriticalRoads}
                  onChange={setShowCriticalRoads}
                />
                <Switch
                  label="Compare with Dijkstra automatically"
                  checked={autoCompare}
                  onChange={setAutoCompare}
                />
                <Switch
                  label="Show flood zones"
                  checked={showFloodZones}
                  onChange={setShowFloodZones}
                />
                <Switch
                  label="Show fastest dry route"
                  checked={showBaseline}
                  onChange={setShowBaseline}
                  disabled={!baselineDiffers}
                />
              </div>
            )}
          </section>

          <section className="card">
            <CardHead
              icon="play"
              title="Live search replay"
              aside={<span className="tag">Map animation</span>}
            />
            <button
              type="button"
              className={
                replay.status === "playing" || replay.status === "done"
                  ? "secondary stop"
                  : "secondary"
              }
              onClick={replay.status === "idle" ? watchSearch : stopReplay}
              disabled={
                booting ||
                replay.status === "loading" ||
                !source ||
                !destination
              }
            >
              {replay.status === "loading"
                ? "Loading search…"
                : replay.status === "playing"
                  ? "Stop replay"
                  : replay.status === "done"
                    ? "Clear replay"
                    : "Watch search on map"}
            </button>

            {replay.status === "playing" && replay.label && (
              <p className="replay-progress" aria-live="polite">
                <span className={`replay-dot ${replay.algorithm}`} />
                {replay.label}: {replay.done.toLocaleString()} /{" "}
                {replay.total.toLocaleString()} nodes
              </p>
            )}
            {replay.status === "done" && (
              <p className="replay-progress">Replay finished.</p>
            )}
            {replayError && (
              <p className="error" role="alert">
                {replayError}
              </p>
            )}

            <p className="note">
              Dijkstra plays first (violet), then A* (teal). Each dot is a
              junction the algorithm examined; the white line is its final
              route.
            </p>
          </section>

          <section className="card about" id="about">
            <CardHead icon="info" title="About FloodRoute" />
            <p className="note">
              FloodRoute combines Dijkstra, A*, Yen's K-shortest paths and
              Tarjan's bridge detection with simulated flood zones to find
              safer routes across Mumbai. Prototype only: flood zones are
              approximate, so don't use it to navigate.
            </p>
            <ol className="how">
              <li>Each road costs its travel time, multiplied when flooded. Closed roads are removed.</li>
              <li>Yen's method finds alternatives that share under 80% of their roads.</li>
              <li>Merge sort ranks the routes by total cost.</li>
            </ol>
          </section>
        </aside>

        {/* ---------------- centre column ---------------- */}
        <section className="col col-center">
          <div className="map-wrap" aria-label="Map">
            <MapContainer
              center={[19.0, 72.84]}
              zoom={12}
              scrollWheelZoom
              zoomControl={false}
              preferCanvas
              className="map"
            >
              <TileLayer
                attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={16}
                maxZoom={18}
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={16}
                maxZoom={18}
              />
              <ZoomControl position="bottomright" />
              <MapBridge onMap={setMapInstance} />
              {routes.length > 0 && <FitBounds routes={routes} />}

              {/* Flood zones drawn as layered glows */}
              {showFloodZones &&
                zones.map((zone) => {
                  const style = LEVEL_STYLE[zone.level] || LEVEL_STYLE[1];
                  return [1.5, 1.1, 0.75, 0.4].map((scale, i) => (
                    <Circle
                      key={`${scenario}-${zone.id}-${i}`}
                      center={[zone.lat, zone.lon]}
                      radius={zone.radius_m * scale}
                      interactive={i === 0}
                      pathOptions={{
                        stroke: i === 0 && zone.blocked,
                        color: style.color,
                        weight: 1.5,
                        dashArray: "5 4",
                        fillColor: style.color,
                        fillOpacity: 0.12 + i * 0.07,
                      }}
                    >
                      {i === 0 && (
                        <Tooltip direction="top" sticky>
                          <strong>{zone.name}</strong>
                          <br />
                          {zone.blocked
                            ? "Closed to traffic"
                            : `${style.label} flooding`}
                        </Tooltip>
                      )}
                    </Circle>
                  ));
                })}

              {showCriticalRoads &&
                replay.status === "idle" &&
                networkAnalysis?.critical_roads?.map((road) =>
                  road.coordinates?.length === 2 ? (
                    <Polyline
                      key={`critical-${road.source}-${road.target}`}
                      positions={road.coordinates}
                      pathOptions={{
                        color: CRITICAL_COLOR,
                        weight: 2,
                        opacity: 0.8,
                        dashArray: "4 4",
                      }}
                      interactive={false}
                    />
                  ) : null
                )}

              {showBaseline && baselineDiffers && baseline.coordinates && (
                <Polyline
                  positions={baseline.coordinates}
                  pathOptions={{
                    color: "#e6f1f5",
                    weight: 3,
                    opacity: 0.8,
                    dashArray: "1 8",
                    lineCap: "round",
                  }}
                  interactive={false}
                />
              )}

              {/* Soft glow under every route */}
              {routes.map((route, index) => (
                <Polyline
                  key={`glow-${route.path.join("-")}`}
                  positions={route.coordinates}
                  pathOptions={{
                    color: ROUTE_COLORS[index % ROUTE_COLORS.length],
                    weight: selected === index ? 14 : 9,
                    opacity: loading ? 0.05 : selected === index ? 0.28 : 0.12,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                  interactive={false}
                />
              ))}

              {/* Draw the selected route last so it sits on top */}
              {routes
                .map((route, index) => ({ route, index }))
                .sort((a, b) => (a.index === selected) - (b.index === selected))
                .map(({ route, index }) => (
                  <Polyline
                    key={route.path.join("-")}
                    positions={route.coordinates}
                    pathOptions={{
                      color: ROUTE_COLORS[index % ROUTE_COLORS.length],
                      weight: selected === index ? 5 : 3.5,
                      opacity: loading ? 0.35 : selected === index ? 1 : 0.8,
                      dashArray: index === 0 ? undefined : "9 7",
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

            <div className="map-card legend-routes">
              <span className="lg">
                <i className="lg-line" style={{ background: ROUTE_COLORS[0] }} />
                Recommended route
              </span>
              <span className="lg">
                <i className="lg-line dashed" style={{ color: ROUTE_COLORS[1] }} />
                Alternative route
              </span>
              <span className="lg">
                <i className="lg-line dashed" style={{ color: CRITICAL_COLOR }} />
                Critical road
              </span>
              {baselineDiffers && (
                <span className="lg">
                  <i className="lg-line dotted" />
                  Fastest dry route
                </span>
              )}
            </div>

            <div className="map-card legend-impact">
              <strong>Flood impact</strong>
              <ul>
                {[1, 2, 3].map((level) => (
                  <li key={level}>
                    <span
                      className="swatch"
                      style={{ background: LEVEL_STYLE[level].color }}
                    />
                    {LEVEL_STYLE[level].label}
                    {level === 3 && " (no traffic)"}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section className="card details">
            <div className="tabs" role="tablist">
              {[
                ["details", "Route details"],
                ["impact", "Flood impact"],
                ["layers", "Map layers"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? "tab on" : "tab"}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "details" &&
              (current ? (
                <div className="stat-row">
                  <div className="stat">
                    <Icon name="ruler" size={26} />
                    <div>
                      <span>Total distance</span>
                      <strong>{formatKm(current.distance)}</strong>
                    </div>
                  </div>
                  <div className="stat">
                    <Icon name="clock" size={26} />
                    <div>
                      <span>Estimated travel time</span>
                      <strong>
                        {formatMinutes(current.estimated_travel_time_minutes)}
                      </strong>
                    </div>
                  </div>
                  <div className="stat">
                    <Icon name="drop" size={26} />
                    <div>
                      <span>Flood exposure</span>
                      <strong className={`tone-${currentExposure.tone}`}>
                        {currentExposure.text}
                        {Number(current.flood_exposure_m) > 0 &&
                          ` · ${formatMetres(current.flood_exposure_m)}`}
                      </strong>
                    </div>
                  </div>
                  <div className="stat">
                    <Icon name="gauge" size={26} />
                    <div>
                      <span>Total cost</span>
                      <strong>{Number(current.total_cost).toFixed(1)} min</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="hint">
                  Choose a start, a destination and a scenario, then select
                  Find routes.
                </p>
              ))}

            {tab === "impact" && (
              <Comparison
                best={routes[0]}
                baseline={baseline}
                scenario={result?.scenario ?? scenario}
              />
            )}

            {tab === "layers" && (
              <div className="switches layers-grid">
                <Switch
                  label="Flood zones"
                  checked={showFloodZones}
                  onChange={setShowFloodZones}
                />
                <Switch
                  label="Critical roads"
                  checked={showCriticalRoads}
                  onChange={setShowCriticalRoads}
                />
                <Switch
                  label="Fastest dry route"
                  checked={showBaseline}
                  onChange={setShowBaseline}
                  disabled={!baselineDiffers}
                />
              </div>
            )}
          </section>
        </section>

        {/* ---------------- right column ---------------- */}
        <aside className="col col-right">
          <section
            className={loading ? "card updating" : "card"}
            aria-live="polite"
          >
            <CardHead
              icon="route"
              title="Route comparison"
              aside={
                result && (
                  <span className="timing">
                    {loading
                      ? "Updating…"
                      : `${result.algorithm === "astar" ? "A*" : "Dijkstra"} · ${(result.computation_ms / 1000).toFixed(1)} s`}
                  </span>
                )
              }
            />

            {routes.length === 0 ? (
              <p className="hint">
                Your recommended route and alternatives will appear here.
              </p>
            ) : (
              <div className="rc-list">
                {routes.map((route, index) => {
                  const exposure = exposureOf(route);
                  const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
                  return (
                    <button
                      key={route.path.join("-")}
                      type="button"
                      className={selected === index ? "rc on" : "rc"}
                      style={{ "--accent": color }}
                      onClick={() => setSelected(index)}
                      aria-pressed={selected === index}
                    >
                      <span className="rc-title">
                        <strong>
                          {index === 0
                            ? "Recommended route"
                            : `Alternative route ${index}`}
                        </strong>
                        {index === 0 && <span className="chip best">Best</span>}
                        {(badgesFor[index] || []).map((b) => (
                          <span key={b} className="chip">
                            {b}
                          </span>
                        ))}
                      </span>
                      <span className="rc-metrics">
                        <span>
                          <Icon name="ruler" size={15} />
                          {formatKm(route.distance)}
                        </span>
                        <span>
                          <Icon name="clock" size={15} />
                          {formatMinutes(route.estimated_travel_time_minutes)}
                        </span>
                        <span className={`tone-${exposure.tone}`}>
                          <Icon name="shield" size={15} />
                          {exposure.text}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <AlgorithmComparison
            source={Number(source) || null}
            destination={Number(destination) || null}
            scenario={scenario}
            auto={autoCompare}
            trigger={result}
          />

          <section className="card">
            <CardHead
              icon="route"
              title="Alternative routes"
              aside={
                <label className="sort">
                  Sort by
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    {SORTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              }
            />

            {routes.length === 0 ? (
              <p className="hint">No routes yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Distance</th>
                    <th>Time</th>
                    <th>Flood exposure</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map(({ route, index }) => {
                    const exposure = exposureOf(route);
                    return (
                      <tr
                        key={route.path.join("-")}
                        className={selected === index ? "on" : ""}
                        onClick={() => setSelected(index)}
                      >
                        <td>
                          <span
                            className="row-dot"
                            style={{
                              background:
                                ROUTE_COLORS[index % ROUTE_COLORS.length],
                            }}
                          />
                          {index + 1}
                        </td>
                        <td>{formatKm(route.distance)}</td>
                        <td>{formatMinutes(route.estimated_travel_time_minutes)}</td>
                        <td className={`tone-${exposure.tone}`}>{exposure.text}</td>
                        <td>{Number(route.total_cost).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="card" id="network">
            <CardHead
              icon="network"
              title="Network analysis"
              aside={<span className="tag">Tarjan's algorithm</span>}
            />

            {networkLoading ? (
              <p className="hint">Loading network analysis…</p>
            ) : networkError ? (
              <p className="error">{networkError}</p>
            ) : networkAnalysis ? (
              <>
                <div className="net-stats">
                  <div>
                    <span>Total nodes</span>
                    <strong>{networkAnalysis.total_nodes.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Connections</span>
                    <strong>
                      {networkAnalysis.total_connections.toLocaleString()}
                    </strong>
                  </div>
                  <div className="crit">
                    <span>Critical roads</span>
                    <strong>{networkAnalysis.total_bridges.toLocaleString()}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  className="outline"
                  onClick={() => setShowCriticalRoads((on) => !on)}
                >
                  {showCriticalRoads ? "Hide critical roads" : "View critical roads"}
                </button>
                <p className="note">
                  Critical roads are bridges: removing one would disconnect part
                  of the road network.
                </p>
              </>
            ) : null}
          </section>
        </aside>
      </main>
    </div>
  );
}

export default App;