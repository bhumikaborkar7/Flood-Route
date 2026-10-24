
import heapq


def get_edge_cost(edge):
    """
    New edge format:
    (neighbor, distance, travel_time, risk, cost)

    Old edge format:
    (neighbor, distance)
    """
    if len(edge) >= 5:
        return float(edge[4])

    # Compatibility with the original distance-only graph.
    return float(edge[1])


def dijkstra(graph, source, destination):
    """Find the minimum-cost route."""

    distances = {
        node: float("inf")
        for node in graph
    }

    parent = {
        node: None
        for node in graph
    }

    priority_queue = []

    if source not in graph or destination not in graph:
        return [], float("inf")

    distances[source] = 0.0

    heapq.heappush(
        priority_queue,
        (0.0, source),
    )

    while priority_queue:
        current_cost, current_node = heapq.heappop(
            priority_queue
        )

        # Ignore outdated queue entries.
        if current_cost > distances[current_node]:
            continue

        if current_node == destination:
            break

        for edge in graph[current_node]:
            neighbor = edge[0]
            road_cost = get_edge_cost(edge)

            new_cost = current_cost + road_cost

            if new_cost < distances[neighbor]:
                distances[neighbor] = new_cost
                parent[neighbor] = current_node

                heapq.heappush(
                    priority_queue,
                    (new_cost, neighbor),
                )

    if distances[destination] == float("inf"):
        return [], float("inf")

    # Reconstruct the route.
    path = []
    current_node = destination

    while current_node is not None:
        path.append(current_node)
        current_node = parent[current_node]

    path.reverse()

    return path, distances[destination]
