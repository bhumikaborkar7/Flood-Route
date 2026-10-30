
def find_critical_roads(graph, coordinates):
    """Find bridges in the undirected road network using Tarjan's algorithm."""

    # Convert the directed adjacency list into an undirected graph.
    adjacency = {node: set() for node in graph}

    for node, edges in graph.items():
        for edge in edges:
            neighbor = edge[0]
            adjacency[node].add(neighbor)
            adjacency[neighbor].add(node)

    discovery = {}
    low = {}
    parent = {}
    bridges = []
    timer = 0

    # Run DFS for every connected component.
    for start in adjacency:
        if start in discovery:
            continue

        timer += 1
        discovery[start] = timer
        low[start] = timer
        parent[start] = None

        # Each stack entry stores a node and its neighbor iterator.
        stack = [(start, iter(adjacency[start]))]

        while stack:
            node, neighbors = stack[-1]

            try:
                neighbor = next(neighbors)

                if neighbor not in discovery:
                    parent[neighbor] = node

                    timer += 1
                    discovery[neighbor] = timer
                    low[neighbor] = timer

                    stack.append(
                        (neighbor, iter(adjacency[neighbor]))
                    )

                elif neighbor != parent[node]:
                    low[node] = min(
                        low[node],
                        discovery[neighbor]
                    )

            except StopIteration:
                stack.pop()

                if parent[node] is not None:
                    p = parent[node]

                    low[p] = min(low[p], low[node])

                    # If no back edge reaches an ancestor,
                    # the edge (p, node) is a bridge.
                    if low[node] > discovery[p]:
                        bridges.append((p, node))

    return {
        "total_nodes": len(adjacency),
        "total_connections": sum(
            len(neighbors) for neighbors in adjacency.values()
        ) // 2,
        "total_bridges": len(bridges),
        "critical_roads": [
            {
                "source": u,
                "target": v,
                "coordinates": [
                    coordinates[u],
                    coordinates[v],
                ],
            }
           for u, v in bridges
        ],
    }
