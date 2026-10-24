
import osmnx as ox

print("Downloading road network around VJTI...")

# Approximate coordinates of VJTI, Mumbai
latitude = 19.0217
longitude = 72.8507

G = ox.graph_from_point(
    (latitude, longitude),
    dist=1500,
    network_type="drive"
)

G = ox.routing.add_edge_speeds(G)
G = ox.routing.add_edge_travel_times(G)

ox.io.save_graphml(G, "backend/mumbai_roads.graphml")

print("Download successful!")
print("Number of intersections:", len(G.nodes))
print("Number of road connections:", len(G.edges))
print("Saved to backend/mumbai_roads.graphml")

