
import osmnx as ox
from pathlib import Path

# Save the dataset beside this Python file
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

GRAPH_FILE = DATA_DIR / "mumbai_drive.graphml"

if GRAPH_FILE.exists():
    print("Road network already downloaded.")
    graph = ox.io.load_graphml(GRAPH_FILE)
else:
    print("Downloading road network around Mumbai...")

    # Central Mumbai coordinates; download roads within 10 km
    graph = ox.graph.graph_from_point(
        (19.0760, 72.8777),
        dist=10000,
        network_type="drive",
        simplify=True
    )

    ox.io.save_graphml(graph, GRAPH_FILE)
    print("Road network saved!")

print("Nodes:", len(graph.nodes))
print("Edges:", len(graph.edges))
print("File:", GRAPH_FILE)
