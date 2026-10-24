
import osmnx as ox
from pathlib import Path


# Find the saved dataset
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


def build_graph():
    dataset_path = find_dataset()

    print("Loading road network:", dataset_path)

    road_graph = ox.io.load_graphml(dataset_path)

    # Our own adjacency list:
    # node_id -> [(neighbor_id, road_distance), ...]
    adjacency_list = {}

    # Save coordinates of each road node
    coordinates = {}

    for node_id, data in road_graph.nodes(data=True):
        adjacency_list[node_id] = []

        coordinates[node_id] = (
            float(data["y"]),  # latitude
            float(data["x"]),  # longitude
        )

    # Store the shortest direct road segment for each pair
    # of connected nodes, preserving road direction.
    best_edges = {}

    for u, v, data in road_graph.edges(data=True):
        distance = float(data.get("length", 1))

        if distance < 0:
            continue

        edge = (u, v)

        if edge not in best_edges or distance < best_edges[edge]:
            best_edges[edge] = distance

    for (u, v), distance in best_edges.items():
        adjacency_list[u].append((v, distance))

    print("Graph built successfully!")
    print("Nodes:", len(adjacency_list))
    print("Directed connections:", sum(
        len(neighbors) for neighbors in adjacency_list.values()
    ))

    return adjacency_list, coordinates


if __name__ == "__main__":
    graph, coordinates = build_graph()

    # Display a small sample
    first_node = next(iter(graph))

    print("\nSample node:", first_node)
    print("Coordinates:", coordinates[first_node])
    print("Connected roads:", graph[first_node][:5])
