import heapq

def get_path_cost(graph, path):
    total_cost = 0.0
    for i in range(len(path) - 1):
        total_cost += graph[path[i]][path[i + 1]]
    return total_cost

def get_edges(path):
    return set(zip(path, path[1:]))

def is_too_similar(new_path, accepted_paths, threshold=0.80):
    new_edges = get_edges(new_path)
    if not new_edges:
        return True
    for path in accepted_paths:
        existing_edges = get_edges(path)
        shared_edges = len(new_edges & existing_edges)
        overlap = shared_edges / len(new_edges)

        if overlap > threshold:
            return True
    return False

def yen_k_shortest_paths(
    graph,
    source,
    destination,
    k,
    shortest_path_fn,
    diversity_penalty=5.0,
):
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

        # Generate candidates from every spur node first.
        for i in range(len(previous_path) - 1):
            spur_node = previous_path[i]
            root_path = previous_path[:i + 1]
            temp_graph = {
                node: dict(neighbors)
                for node, neighbors in graph.items()
            }
            # Remove edges that would reproduce accepted paths.
            for path in accepted_paths:
                if (
                    len(path) > i + 1
                    and path[:i + 1] == root_path
                ):
                    u = path[i]
                    v = path[i + 1]
                    temp_graph[u].pop(v, None)

            # Prevent loops through earlier root nodes.
            for node in root_path[:-1]:
                temp_graph.pop(node, None)
                for neighbors in temp_graph.values():
                    neighbors.pop(node, None)

            # Discourage reusing edges from accepted routes
            # when calculating spur paths.
            for path in accepted_paths:
                for u, v in zip(path, path[1:]):
                    if u in temp_graph and v in temp_graph[u]:
                        temp_graph[u][v] += diversity_penalty
            spur_path = shortest_path_fn(
                temp_graph,
                spur_node,
                destination,
            )
            if not spur_path:
                continue
            total_path = root_path[:-1] + spur_path
            path_key = tuple(total_path)
            if (
                path_key in accepted_set
                or path_key in candidate_set
            ):
                continue
            if is_too_similar(total_path, accepted_paths):
                continue
            # Calculate cost using the original graph,
            # not the temporarily penalized graph.
            total_cost = get_path_cost(graph, total_path)
            # Use shared edges as a modest tie-breaker.
            new_edges = get_edges(total_path)
            shared_edges = sum(
                1
                for u, v in new_edges
                if any(
                    (u, v) in get_edges(path)
                    for path in accepted_paths
                )
            )
            ranking_cost = total_cost + 2.0 * shared_edges

            heapq.heappush(
                candidates,
                (
                    ranking_cost,
                    total_cost,
                    counter,
                    total_path,
                ),
            )
            candidate_set.add(path_key)
            counter += 1
        # Select a candidate only after all spur nodes
        # have been processed.
        next_path = None

        while candidates:
            _, _, _, candidate_path = heapq.heappop(candidates)
            candidate_set.discard(tuple(candidate_path))
            if tuple(candidate_path) in accepted_set:
                continue
            if is_too_similar(candidate_path, accepted_paths):
                continue
            next_path = candidate_path
            break
        if next_path is None:
            break
        accepted_paths.append(next_path)
        accepted_set.add(tuple(next_path))
    return accepted_paths
