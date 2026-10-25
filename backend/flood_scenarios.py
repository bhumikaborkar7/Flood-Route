"""Simulated flood scenarios and scenario-aware route search.

The flood zones below are chronic waterlogging junctions that are widely
reported for Mumbai. Their coordinates and radii are approximate: they are
a simulation, NOT a live flood feed. Check them on the map and adjust the
radii so that your demo route (for example VJTI -> CSMT) crosses a few.

A scenario assigns a flood level (0-3, see cost_calculator.py) to some of
these zones. Every road whose midpoint lies inside a zone takes that
level. Level 3 roads are closed and removed from the graph.
"""

import math
import time

from backend.alternative_routes import yen_k_shortest_paths
from backend.cost_calculator import (
    BLOCKED_LEVEL,
    RISK_LABELS,
    calculate_edge_cost,
    risk_multiplier,
)
from backend.route_adapter import shortest_path
from backend.sorting import merge_sort


ZONES = {
    "dadar_tt": {"name": "Dadar TT", "lat": 19.0185, "lon": 72.8480, "radius_m": 300},
    "hindmata": {"name": "Hindmata", "lat": 19.0050, "lon": 72.8420, "radius_m": 350},
    "lalbaug": {"name": "Lalbaug", "lat": 18.9965, "lon": 72.8380, "radius_m": 300},
    "kings_circle": {"name": "King's Circle", "lat": 19.0280, "lon": 72.8553, "radius_m": 350},
    "sion": {"name": "Sion Circle", "lat": 19.0390, "lon": 72.8619, "radius_m": 400},
    "mahim": {"name": "Mahim Causeway", "lat": 19.0400, "lon": 72.8400, "radius_m": 300},
    "kurla": {"name": "Kurla LBS Marg", "lat": 19.0650, "lon": 72.8795, "radius_m": 400},
    "milan_subway": {"name": "Milan Subway", "lat": 19.0785, "lon": 72.8445, "radius_m": 300},
    "andheri_subway": {"name": "Andheri Subway", "lat": 19.1195, "lon": 72.8466, "radius_m": 350},
}

SCENARIOS = {
    "normal": {
        "label": "Normal day",
        "description": "Roads are dry. Routes follow travel time only.",
        "zones": {},
    },
    "moderate": {
        "label": "Heavy rain",
        "description": "Low-lying junctions are waterlogged and traffic slows down.",
        "zones": {
            "hindmata": 2,
            "kings_circle": 2,
            "sion": 2,
            "milan_subway": 2,
            "dadar_tt": 1,
            "lalbaug": 1,
            "mahim": 1,
            "kurla": 1,
        },
    },
    "severe": {
        "label": "Severe flooding",
        "description": "Major junctions are under water and closed to traffic.",
        "zones": {
            "hindmata": 3,
            "dadar_tt": 3,
            "kings_circle": 3,
            "sion": 3,
            "milan_subway": 3,
            "andheri_subway": 3,
            "lalbaug": 2,
            "mahim": 2,
            "kurla": 2,
        },
    },
}

DEFAULT_SCENARIO = "normal"

RISK_NOTE = (
    "Simulated flood scenario based on commonly reported waterlogging "
    "junctions. It is not a live flood measurement."
)

# Rough metres per degree near Mumbai's latitude.
_M_PER_DEG_LAT = 110574.0
_M_PER_DEG_LON = 111320.0

_cache = {}


def list_scenarios():
    """Scenario details, including the zones the map should draw."""
    result = []

    for scenario_id, scenario in SCENARIOS.items():
        zones = []

        for zone_id, level in scenario["zones"].items():
            zone = ZONES[zone_id]
            zones.append({
                "id": zone_id,
                "name": zone["name"],
                "lat": zone["lat"],
                "lon": zone["lon"],
                "radius_m": zone["radius_m"],
                "level": level,
                "label": RISK_LABELS[level],
                "blocked": level >= BLOCKED_LEVEL,
            })

        result.append({
            "id": scenario_id,
            "label": scenario["label"],
            "description": scenario["description"],
            "zones": zones,
        })

    return result


def _inside(lat, lon, zone):
    dy = (lat - zone["lat"]) * _M_PER_DEG_LAT
    dx = (lon - zone["lon"]) * _M_PER_DEG_LON * math.cos(math.radians(zone["lat"]))
    return dx * dx + dy * dy <= zone["radius_m"] ** 2


def _edge_levels(graph, coordinates, scenario_id):
    """Flood level of every road that lies inside a flood zone."""
    active = [
        (ZONES[zone_id], level)
        for zone_id, level in SCENARIOS[scenario_id]["zones"].items()
    ]

    levels = {}

    if not active:
        return levels

    for u, edges in graph.items():
        u_lat, u_lon = coordinates[u]

        for edge in edges:
            v = edge[0]
            v_lat, v_lon = coordinates[v]

            mid_lat = (u_lat + v_lat) / 2.0
            mid_lon = (u_lon + v_lon) / 2.0

            level = 0

            for zone, zone_level in active:
                if zone_level > level and _inside(mid_lat, mid_lon, zone):
                    level = zone_level

            if level:
                levels[(u, v)] = level

    return levels


def _edge_lookup(graph):
    """(u, v) -> (distance_m, dry_travel_time_min)."""
    key = ("lookup", id(graph))

    if key not in _cache:
        _cache[key] = {
            (u, edge[0]): (float(edge[1]), float(edge[2]))
            for u, edges in graph.items()
            for edge in edges
        }

    return _cache[key]


def build_scenario_graph(graph, coordinates, scenario_id):
    """Weighted adjacency dict for one scenario, closed roads removed."""
    key = ("scenario", id(graph), scenario_id)

    if key in _cache:
        return _cache[key]

    levels = _edge_levels(graph, coordinates, scenario_id)
    weighted = {}

    for u, edges in graph.items():
        row = {}

        for edge in edges:
            v = edge[0]
            travel_time = float(edge[2])
            level = levels.get((u, v), 0)

            cost = calculate_edge_cost(
                travel_time,
                level,
                blocked=level >= BLOCKED_LEVEL,
            )

            if cost is None:
                continue

            if v not in row or cost < row[v]:
                row[v] = cost

        weighted[u] = row

    _cache[key] = (weighted, levels)
    return _cache[key]


def describe_route(path, graph, coordinates, levels):
    """Distance, time, flood exposure and cost of one path."""
    lookup = _edge_lookup(graph)

    distance = 0.0
    dry_time = 0.0
    adjusted_time = 0.0
    risk_distance = 0.0
    exposure = 0.0
    blocked = 0

    for u, v in zip(path, path[1:]):
        edge_distance, edge_time = lookup[(u, v)]
        level = levels.get((u, v), 0)

        distance += edge_distance
        dry_time += edge_time
        adjusted_time += edge_time * risk_multiplier(level)
        risk_distance += edge_distance * level / BLOCKED_LEVEL

        if level > 0:
            exposure += edge_distance

        if level >= BLOCKED_LEVEL:
            blocked += 1

    return {
        "path": path,
        "distance": round(distance, 2),
        "estimated_travel_time_minutes": round(adjusted_time, 2),
        "dry_travel_time_minutes": round(dry_time, 2),
        "flood_delay_minutes": round(adjusted_time - dry_time, 2),
        "flood_risk_score": round(risk_distance / distance, 3) if distance else 0.0,
        "flood_exposure_m": round(exposure, 1),
        "blocked_segments": blocked,
        "total_cost": round(adjusted_time, 2),
        "coordinates": [coordinates[node] for node in path],
        "risk_data_note": RISK_NOTE,
    }


def find_scenario_routes(graph, coordinates, source, destination, k=3,
                         scenario_id=DEFAULT_SCENARIO):
    """Rank up to k routes for a scenario and compare with the fastest route.

    The "baseline" is the route a flood-unaware planner would choose: the
    fastest route on dry roads. It is then driven through the scenario so
    that its delay and closed roads can be compared with the best route.
    """
    started = time.perf_counter()

    weighted, levels = build_scenario_graph(graph, coordinates, scenario_id)

    paths = yen_k_shortest_paths(
        weighted, source, destination, k, shortest_path,
    )

    routes = merge_sort([
        describe_route(path, graph, coordinates, levels)
        for path in paths
    ])

    baseline = None

    if routes:
        dry_weighted, _ = build_scenario_graph(graph, coordinates, DEFAULT_SCENARIO)
        baseline_path = shortest_path(dry_weighted, source, destination)

        if baseline_path:
            baseline = describe_route(baseline_path, graph, coordinates, levels)
            baseline["same_as_best"] = baseline_path == routes[0]["path"]

    return {
        "scenario": scenario_id,
        "routes": routes,
        "baseline": baseline,
        "computation_ms": round((time.perf_counter() - started) * 1000),
    }