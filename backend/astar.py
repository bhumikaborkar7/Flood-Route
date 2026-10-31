import heapq
import math

from backend.dijkstra import get_edge_cost

EARTH_RADIUS_M = 6371000.0


def haversine_m(a, b):
    """Straight-line distance in metres between two (lat, lon) points."""
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )

    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def min_minutes_per_meter(graph):
    """Fastest travel rate (minutes per metre) found on any road.

    Multiplying straight-line distance by this value gives a lower bound
    on the travel time, so the A* heuristic never overestimates.
    """
    best = float("inf")

    for edges in graph.values():
        for edge in edges:
            if len(edge) < 3:
                continue

            distance = float(edge[1])
            travel_time = float(edge[2])

            if distance > 0 and travel_time > 0:
                best = min(best, travel_time / distance)

    return 0.0 if best == float("inf") else best


def _neighbors(graph, node):
    """Yield (neighbor, cost) for either graph format.

    - dict format:  {node: {neighbor: cost}}   (scenario / Yen graphs)
    - list format:  {node: [(neighbor, ..., cost)]}   (graph_builder)
    """
    row = graph[node]

    if isinstance(row, dict):
        yield from row.items()
    else:
        for edge in row:
            yield edge[0], get_edge_cost(edge)


def astar(graph, source, destination, coordinates, min_min_per_m, stats=None):
    """A* search. Returns (path, cost), or ([], inf) if unreachable.

    If a dict is passed as `stats`, it is filled with "nodes_expanded".
    If stats also contains a list under "trace", every expanded node is
    appended to it in order (used for the live map replay).
    """
    if source not in graph or destination not in graph:
        return [], float("inf")

    trace = stats.get("trace") if stats is not None else None

    goal = coordinates[destination]

    def heuristic(node):
        return haversine_m(coordinates[node], goal) * min_min_per_m

    best_cost = {source: 0.0}
    parent = {source: None}
    closed = set()
    expanded = 0

    heap = [(heuristic(source), 0.0, source)]

    while heap:
        _, cost_so_far, node = heapq.heappop(heap)

        if node in closed:
            continue

        closed.add(node)
        expanded += 1

        if trace is not None:
            trace.append(node)

        if node == destination:
            break

        for neighbor, road_cost in _neighbors(graph, node):
            new_cost = cost_so_far + road_cost

            if new_cost < best_cost.get(neighbor, float("inf")):
                best_cost[neighbor] = new_cost
                parent[neighbor] = node

                heapq.heappush(
                    heap,
                    (new_cost + heuristic(neighbor), new_cost, neighbor),
                )

    if stats is not None:
        stats["nodes_expanded"] = expanded

    if destination not in closed:
        return [], float("inf")

    path = []
    current = destination

    while current is not None:
        path.append(current)
        current = parent[current]

    path.reverse()

    return path, best_cost[destination]