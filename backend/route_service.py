import time

from backend.network_analysis import find_critical_roads
from backend.graph_builder import build_graph
from backend.dijkstra import dijkstra
from backend.astar import astar, min_minutes_per_meter
from backend.route_adapter import convert_graph, shortest_path
from backend.alternative_routes import yen_k_shortest_paths
from backend.sorting import merge_sort
from backend.flood_scenarios import (
    DEFAULT_SCENARIO,
    SCENARIOS,
    build_scenario_graph,
    find_scenario_routes,
    list_scenarios,
)


# Load the road network once.
graph, coordinates = build_graph()

# Convert the graph for Yen's K-shortest paths algorithm.
weighted_graph = convert_graph(graph)

# Lower bound on minutes per metre, used by the A* heuristic.
MIN_MIN_PER_M = min_minutes_per_meter(graph)

# scenario_id -> {node: [(neighbor, cost), ...]} for Dijkstra.
_dijkstra_graphs = {}


def route_details_for_path(path):
    """Calculate distance, time, risk and cost for a given path."""

    if not path:
        return {
            "path": [],
            "distance": None,
            "estimated_travel_time_minutes": None,
            "flood_risk_score": None,
            "total_cost": None,
            "coordinates": [],
        }

    route_coordinates = [
        coordinates[node]
        for node in path
        if node in coordinates
    ]

    total_distance = 0.0
    total_time = 0.0
    total_risk = 0.0
    edge_count = 0

    for current_node, next_node in zip(path, path[1:]):
        matching_edges = [
            edge for edge in graph[current_node]
            if edge[0] == next_node
        ]

        if not matching_edges:
            continue

        edge = min(
            matching_edges,
            key=lambda item: (
                float(item[4]) if len(item) >= 5
                else float(item[1])
            ),
        )

        total_distance += float(edge[1])

        if len(edge) >= 5:
            total_time += float(edge[2])
            total_risk += float(edge[3])
        else:
            total_time += (float(edge[1]) / 1000.0) / 20.0 * 60.0
            total_risk += 0.5

        edge_count += 1

    average_risk = total_risk / edge_count if edge_count else 0.0

    # Use the same risk-adjusted edge costs used by Yen's algorithm.
    total_cost = sum(
        weighted_graph[current_node][next_node]
        for current_node, next_node in zip(path, path[1:])
    )

    return {
        "path": path,
        "distance": round(total_distance, 2),
        "estimated_travel_time_minutes": round(total_time, 2),
        "flood_risk_score": round(average_risk, 3),
        "total_cost": round(total_cost, 2),
        "coordinates": route_coordinates,
        "risk_data_note": (
            "Flood risk is assumed where the road dataset has no "
            "flood_risk attribute; it is not a live flood measurement."
        ),
    }


def find_route(source, destination):
    """Find and describe the shortest route using Dijkstra."""

    path, _ = dijkstra(graph, source, destination)

    if not path:
        return route_details_for_path([])

    return route_details_for_path(path)


def find_alternative_routes(source, destination, k=3):
    """Find and rank up to k routes using Yen's algorithm and Merge Sort."""

    paths = yen_k_shortest_paths(
        weighted_graph,
        source,
        destination,
        k,
        lambda current_graph, start, end: _shortest_path(
            current_graph, start, end
        ),
    )

    routes = [route_details_for_path(path) for path in paths[:k]]
    return merge_sort(routes)


def _shortest_path(current_graph, source, destination):
    """Adapt the modified graph to Person 1's Dijkstra."""

    adjacency_list = {
        node: [
            (neighbor, cost)
            for neighbor, cost in neighbors.items()
        ]
        for node, neighbors in current_graph.items()
    }

    path, _ = dijkstra(adjacency_list, source, destination)
    return path


def _astar_path(current_graph, source, destination):
    """A* shortest path on a weighted dict graph, for Yen's algorithm."""

    path, _ = astar(
        current_graph, source, destination, coordinates, MIN_MIN_PER_M
    )
    return path


def find_scenario_alternatives(source, destination, k=3,
                               scenario=DEFAULT_SCENARIO, algorithm="dijkstra"):
    """Alternative routes for a flood scenario, plus the flood-unaware baseline.

    `algorithm` picks the shortest-path search used inside Yen's method:
    "dijkstra" or "astar". Both return the same optimal costs.
    """

    path_fn = _astar_path if algorithm == "astar" else shortest_path

    result = find_scenario_routes(
        graph, coordinates, source, destination, k, scenario, path_fn
    )
    result["algorithm"] = algorithm

    return result


def scenario_details():
    return list_scenarios()


def is_known_scenario(scenario):
    return scenario in SCENARIOS


def get_network_analysis():
    """Return critical road connections identified by Tarjan's algorithm."""

    return find_critical_roads(graph, coordinates)


def _dijkstra_graph_for(scenario, weighted):
    """List-format graph for Dijkstra, built once per scenario.

    Built outside the timed section so the comparison measures the search
    itself and not the graph conversion.
    """
    if scenario not in _dijkstra_graphs:
        _dijkstra_graphs[scenario] = {
            node: list(neighbors.items())
            for node, neighbors in weighted.items()
        }

    return _dijkstra_graphs[scenario]


def compare_algorithms(source, destination, scenario=DEFAULT_SCENARIO, runs=3):
    """Run Dijkstra and A* on the same scenario graph and compare them."""

    weighted, _ = build_scenario_graph(graph, coordinates, scenario)
    dijkstra_graph = _dijkstra_graph_for(scenario, weighted)

    def timed(search):
        best_ms = float("inf")
        result = None
        stats = {}

        for _ in range(max(1, runs)):
            stats = {}
            started = time.perf_counter()
            result = search(stats)
            elapsed = (time.perf_counter() - started) * 1000
            best_ms = min(best_ms, elapsed)

        path, cost = result

        return {
            "path": path,
            "found": bool(path),
            "total_cost": round(cost, 2) if path else None,
            "nodes_expanded": stats.get("nodes_expanded", 0),
            "time_ms": round(best_ms, 3),
        }

    dijkstra_result = timed(
        lambda stats: dijkstra(dijkstra_graph, source, destination, stats)
    )

    astar_result = timed(
        lambda stats: astar(
            weighted, source, destination, coordinates, MIN_MIN_PER_M, stats
        )
    )

    same_cost = (
        dijkstra_result["total_cost"] is not None
        and astar_result["total_cost"] is not None
        and abs(dijkstra_result["total_cost"] - astar_result["total_cost"]) < 0.01
    )

    d_nodes = dijkstra_result["nodes_expanded"]
    a_nodes = astar_result["nodes_expanded"]
    d_time = dijkstra_result["time_ms"]
    a_time = astar_result["time_ms"]

    return {
        "scenario": scenario,
        "dijkstra": dijkstra_result,
        "astar": astar_result,
        "same_cost": same_cost,
        "same_path": dijkstra_result["path"] == astar_result["path"],
        "nodes_saved_percent": (
            round((1 - a_nodes / d_nodes) * 100, 1) if d_nodes else 0.0
        ),
        "speedup": round(d_time / a_time, 2) if a_time else None,
    }
def trace_search(source, destination, scenario=DEFAULT_SCENARIO):
    """Run both algorithms once and record the order nodes were expanded."""

    weighted, _ = build_scenario_graph(graph, coordinates, scenario)
    dijkstra_graph = _dijkstra_graph_for(scenario, weighted)

    def point(node):
        lat, lon = coordinates[node]
        return [round(lat, 5), round(lon, 5)]

    def package(path, cost, stats):
        return {
            "found": bool(path),
            "total_cost": round(cost, 2) if path else None,
            "nodes_expanded": len(stats["trace"]),
            "explored": [point(n) for n in stats["trace"]],
            "path": [point(n) for n in path],
        }

    d_stats = {"trace": []}
    d_path, d_cost = dijkstra(dijkstra_graph, source, destination, d_stats)

    a_stats = {"trace": []}
    a_path, a_cost = astar(
        weighted, source, destination, coordinates, MIN_MIN_PER_M, a_stats
    )

    return {
        "scenario": scenario,
        "dijkstra": package(d_path, d_cost, d_stats),
        "astar": package(a_path, a_cost, a_stats),
    }