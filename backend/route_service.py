from backend.graph_builder import build_graph
from backend.dijkstra import dijkstra

# Load the road network once
graph, coordinates = build_graph()


def find_route(source, destination):
    path, distance = dijkstra(graph, source, destination)

    if not path:
        return {
            "path": [],
            "distance": None,
            "coordinates": []
        }

    route_coordinates = []

    for node in path:
        route_coordinates.append(coordinates[node])

    return {
        "path": path,
        "distance": distance,
        "coordinates": route_coordinates
    }
