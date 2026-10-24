
import heapq

from backend.alternative_routes import yen_k_shortest_paths


# Temporary shortest-path function for testing only
def test_shortest_path(graph, source, destination):
    pq = [(0, source, [source])]
    best_cost = {}

    while pq:
        cost, node, path = heapq.heappop(pq)

        if node in best_cost and best_cost[node] <= cost:
            continue

        best_cost[node] = cost

        if node == destination:
            return path

        for neighbor, weight in graph.get(node, {}).items():
            if neighbor not in path:
                heapq.heappush(
                    pq,
                    (cost + weight, neighbor, path + [neighbor])
                )

    return None


graph = {
    "A": {"B": 1, "C": 2},
    "B": {"D": 2, "C": 1},
    "C": {"D": 2},
    "D": {}
}

routes = yen_k_shortest_paths(
    graph, "A", "D", 3, test_shortest_path
)

for route in routes:
    print(route, "Cost:", sum(
        graph[route[i]][route[i + 1]]
        for i in range(len(route) - 1)
    ))
