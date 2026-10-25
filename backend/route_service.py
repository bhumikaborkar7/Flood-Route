from backend.graph_builder import build_graph
from backend.dijkstra import dijkstra
from backend.route_adapter import convert_graph
from backend.alternative_routes import yen_k_shortest_paths
from backend.sorting import merge_sort
from backend.flood_scenarios import (
    DEFAULT_SCENARIO,
    SCENARIOS,
    find_scenario_routes,
    list_scenarios,
)


# Load the road network once.
graph, coordinates = build_graph()

# Convert the graph for Yen's K-shortest paths algorithm.
weighted_graph = convert_graph(graph)


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


def find_scenario_alternatives(source, destination, k=3, scenario=DEFAULT_SCENARIO):
    """Alternative routes for a flood scenario, plus the flood-unaware baseline."""

    return find_scenario_routes(graph, coordinates, source, destination, k, scenario)


def scenario_details():
    return list_scenarios()


def is_known_scenario(scenario):
    return scenario in SCENARIOS
