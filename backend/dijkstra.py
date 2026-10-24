
import heapq


def dijkstra(graph, source, destination):
    # Store the shortest distance found so far
    distances = {}

    # Store the previous node in the shortest path
    parent = {}

    # Min-heap stores (distance, node)
    priority_queue = []

    for node in graph:
        distances[node] = float("inf")
        parent[node] = None

    if source not in graph or destination not in graph:
        return [], float("inf")

    distances[source] = 0
    heapq.heappush(priority_queue, (0, source))

    while priority_queue:
        current_distance, current_node = heapq.heappop(priority_queue)

        # Ignore outdated heap entries
        if current_distance > distances[current_node]:
            continue

        # Destination reached
        if current_node == destination:
            break

        # Explore connected road nodes
        for neighbor, road_distance in graph[current_node]:
            new_distance = current_distance + road_distance

            if new_distance < distances[neighbor]:
                distances[neighbor] = new_distance
                parent[neighbor] = current_node

                heapq.heappush(
                    priority_queue,
                    (new_distance, neighbor)
                )

    # Destination is unreachable
    if distances[destination] == float("inf"):
        return [], float("inf")

    # Reconstruct the path from destination to source
    path = []
    current_node = destination

    while current_node is not None:
        path.append(current_node)
        current_node = parent[current_node]

    path.reverse()

    return path, distances[destination]
