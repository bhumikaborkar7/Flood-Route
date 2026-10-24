
from backend.graph_builder import build_graph
from backend.dijkstra import dijkstra

# Load the road network once.
graph, coordinates = build_graph()


def find_route(source, destination):
    path, total_cost = dijkstra(
        graph,
        source,
        destination,
    )

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
    ]

    total_distance = 0.0
    total_time = 0.0
    total_risk = 0.0
    edge_count = 0

    for current_node, next_node in zip(
        path,
        path[1:],
    ):
        matching_edges = [
            edge
            for edge in graph[current_node]
            if edge[0] == next_node
        ]

        if not matching_edges:
            continue

        edge = min(
            matching_edges,
            key=lambda item: (
                float(item[4])
                if len(item) >= 5
                else float(item[1])
            ),
        )

        total_distance += float(edge[1])

        if len(edge) >= 5:
            total_time += float(edge[2])
            total_risk += float(edge[3])
        else:
            # Fallback for the original graph format.
            total_time += (
                (float(edge[1]) / 1000.0)
                / 20.0
                * 60.0
            )
            total_risk += 0.5

        edge_count += 1

    average_risk = (
        total_risk / edge_count
        if edge_count
        else 0.0
    )

    return {
        "path": path,
        "distance": round(total_distance, 2),
        "estimated_travel_time_minutes": round(
            total_time, 2
        ),
        "flood_risk_score": round(
            average_risk, 3
        ),
        "total_cost": round(float(total_cost), 2),
        "coordinates": route_coordinates,
        "risk_data_note": (
            "Flood risk is assumed where the road dataset "
            "has no flood_risk attribute; it is not a live "
            "flood measurement."
        ),
    }
