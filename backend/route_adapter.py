
from backend.dijkstra import dijkstra


def convert_graph(graph):
    """Convert the edge-list graph to a weighted adjacency dictionary."""
    new_graph = {}

    for node, edges in graph.items():
        new_graph[node] = {}

        for edge in edges:
            neighbor = edge[0]

            if len(edge) >= 5:
                cost = float(edge[4])
            else:
                cost = float(edge[1])

            if neighbor not in new_graph[node] or cost < new_graph[node][neighbor]:
                new_graph[node][neighbor] = cost

    return new_graph


def shortest_path(graph, source, destination):
    """Reuse Person 1's Dijkstra with Yen's weighted dictionary graph."""
    adjacency_list = {}

    for node, neighbors in graph.items():
        adjacency_list[node] = [
            (neighbor, cost)
            for neighbor, cost in neighbors.items()
        ]

    path, _ = dijkstra(adjacency_list, source, destination)

    return path
