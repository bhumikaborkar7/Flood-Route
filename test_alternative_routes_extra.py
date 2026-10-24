
import heapq

from backend.alternative_routes import yen_k_shortest_paths


# Temporary shortest-path function for testing
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


# Test 1: k = 1 returns only the shortest path
graph = {
    "A": {"B": 1, "C": 2},
    "B": {"D": 2, "C": 1},
    "C": {"D": 2},
    "D": {}
}

routes = yen_k_shortest_paths(
    graph, "A", "D", 1, test_shortest_path
)

assert routes == [["A", "B", "D"]]
print("Test 1 passed: k = 1")


# Test 2: No route exists
no_route_graph = {
    "A": {"B": 2},
    "B": {},
    "D": {}
}

routes = yen_k_shortest_paths(
    no_route_graph, "A", "D", 3, test_shortest_path
)

assert routes == []
print("Test 2 passed: No possible route")


# Test 3: Fewer routes exist than requested
small_graph = {
    "A": {"B": 1},
    "B": {"D": 2},
    "D": {}
}

routes = yen_k_shortest_paths(
    small_graph, "A", "D", 5, test_shortest_path
)

assert routes == [["A", "B", "D"]]
print("Test 3 passed: Fewer routes than k")


# Test 4: Original graph remains unchanged
original_graph = {
    node: dict(neighbors)
    for node, neighbors in graph.items()
}

yen_k_shortest_paths(
    graph, "A", "D", 3, test_shortest_path
)

assert graph == original_graph
print("Test 4 passed: Original graph unchanged")


# Test 5: k = 0 returns an empty list
routes = yen_k_shortest_paths(
    graph, "A", "D", 0, test_shortest_path
)

assert routes == []
print("Test 5 passed: k = 0")
