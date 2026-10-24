
import heapq


def get_path_cost(graph, path):
    total_cost = 0

    for i in range(len(path) - 1):
        total_cost += graph[path[i]][path[i + 1]]

    return total_cost


def yen_k_shortest_paths(graph, source, destination, k, shortest_path_fn):
    if k <= 0:
        return []

    first_path = shortest_path_fn(graph, source, destination)

    if not first_path:
        return []

    accepted_paths = [first_path]
    accepted_set = {tuple(first_path)}

    candidates = []
    candidate_set = set()
    counter = 0

    while len(accepted_paths) < k:
        previous_path = accepted_paths[-1]

        for i in range(len(previous_path) - 1):
            spur_node = previous_path[i]
            root_path = previous_path[:i + 1]

            # Make a copy so the original graph stays unchanged
            temp_graph = {
                node: dict(neighbors)
                for node, neighbors in graph.items()
            }

            # Remove edges that would reproduce accepted paths
            for path in accepted_paths:
                if path[:i + 1] == root_path:
                    u = path[i]
                    v = path[i + 1]
                    temp_graph[u].pop(v, None)

            # Remove earlier root nodes to avoid loops
            for node in root_path[:-1]:
                temp_graph.pop(node, None)

                for neighbors in temp_graph.values():
                    neighbors.pop(node, None)

            spur_path = shortest_path_fn(
                temp_graph, spur_node, destination
            )

            if not spur_path:
                continue

            total_path = root_path[:-1] + spur_path
            path_key = tuple(total_path)

            if path_key in accepted_set or path_key in candidate_set:
                continue

            total_cost = get_path_cost(graph, total_path)

            heapq.heappush(
                candidates,
                (total_cost, counter, total_path)
            )

            candidate_set.add(path_key)
            counter += 1

        if not candidates:
            break

        cost, _, next_path = heapq.heappop(candidates)

        accepted_paths.append(next_path)
        accepted_set.add(tuple(next_path))
        candidate_set.discard(tuple(next_path))

    return accepted_paths
