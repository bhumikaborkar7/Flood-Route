
import osmnx as ox
from pathlib import Path

# Assumptions used when the dataset lacks these values.
DEFAULT_SPEED_KPH = 20.0
DEFAULT_FLOOD_RISK = 0.5

# Maximum extra cost for a road with flood risk 1.0.
FLOOD_RISK_PENALTY_MINUTES = 10.0

PROJECT_DIR = Path(__file__).resolve().parent.parent

DATASET_PATHS = [
    PROJECT_DIR / "data" / "mumbai_roads.graphml",
    PROJECT_DIR / "mumbai_roads.graphml",
]


def find_dataset():
    for path in DATASET_PATHS:
        if path.exists():
            return path

    raise FileNotFoundError(
        "Could not find mumbai_roads.graphml. "
        "Place it in the project's data folder or root folder."
    )


def positive_float(value, default):
    """Convert a value to a positive number."""
    if isinstance(value, (list, tuple)):
        value = value[0] if value else None

    try:
        number = float(value)
        if number > 0:
            return number
    except (TypeError, ValueError):
        pass

    return default


def get_flood_risk(value):
    """Return a flood-risk score between 0 and 1."""
    if isinstance(value, (list, tuple)):
        value = value[0] if value else None

    try:
        score = float(value)
        if 0.0 <= score <= 1.0:
            return score
    except (TypeError, ValueError):
        pass

    return DEFAULT_FLOOD_RISK


def build_graph():
    dataset_path = find_dataset()

    print("Loading road network:", dataset_path)
    road_graph = ox.io.load_graphml(dataset_path)

    # Each edge stores:
    # (neighbor, distance_m, travel_time_min, flood_risk, cost)
    adjacency_list = {}
    coordinates = {}

    for node_id, data in road_graph.nodes(data=True):
        adjacency_list[node_id] = []

        coordinates[node_id] = (
            float(data["y"]),
            float(data["x"]),
        )

    # Keep the lowest-cost road when multiple edges connect
    # the same ordered pair of nodes.
    best_edges = {}

    for u, v, data in road_graph.edges(data=True):
        distance = positive_float(data.get("length"), 1.0)

        speed_kph = positive_float(
            data.get("speed_kph"),
            DEFAULT_SPEED_KPH,
        )

        # Estimate travel time in minutes.
        travel_time = (distance / 1000.0) / speed_kph * 60.0

        # Use existing risk data if available.
        # Otherwise, this is only a placeholder assumption.
        risk = get_flood_risk(data.get("flood_risk"))

        # Combined cost, expressed in equivalent minutes.
        cost = (
            travel_time
            + FLOOD_RISK_PENALTY_MINUTES * risk
        )

        edge_info = (
            distance,
            travel_time,
            risk,
            cost,
        )

        edge = (u, v)

        if (
            edge not in best_edges
            or cost < best_edges[edge][3]
        ):
            best_edges[edge] = edge_info

    for (u, v), info in best_edges.items():
        distance, travel_time, risk, cost = info

        adjacency_list[u].append(
            (v, distance, travel_time, risk, cost)
        )

    print("Graph built successfully!")
    print("Nodes:", len(adjacency_list))
    print(
        "Directed connections:",
        sum(len(neighbors) for neighbors in adjacency_list.values()),
    )
    print("Default speed:", DEFAULT_SPEED_KPH, "km/h")
    print("Default flood risk:", DEFAULT_FLOOD_RISK)

    return adjacency_list, coordinates


if __name__ == "__main__":
    graph, coordinates = build_graph()

    first_node = next(iter(graph))

    print("\nSample node:", first_node)
    print("Coordinates:", coordinates[first_node])
    print("Connected roads:", graph[first_node][:5])
