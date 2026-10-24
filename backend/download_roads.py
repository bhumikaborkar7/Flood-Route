
import osmnx as ox
from pathlib import Path

print("Downloading road network covering central Mumbai...")

# Approximate coordinates of VJTI, Mumbai
latitude = 19.0217
longitude = 72.8507

# Download a larger driving network covering the target locations.
G = ox.graph_from_point(
    (latitude, longitude),
    dist=12000,
    network_type="drive",
    simplify=True,
)

# Add road speed and travel-time attributes where possible.
G = ox.routing.add_edge_speeds(G)
G = ox.routing.add_edge_travel_times(G)

# Save to the dataset path used first by graph_builder.py.
project_dir = Path(__file__).resolve().parent.parent
output_path = project_dir / "data" / "mumbai_roads.graphml"
output_path.parent.mkdir(parents=True, exist_ok=True)

ox.io.save_graphml(G, output_path)

print("Download successful!")
print("Number of intersections:", len(G.nodes))
print("Number of road connections:", len(G.edges))
print("Saved to:", output_path)
