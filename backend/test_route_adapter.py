
from backend.route_service import graph
from backend.route_adapter import convert_graph, shortest_path
from backend.alternative_routes import yen_k_shortest_paths
from backend.sorting import merge_sort

weighted_graph = convert_graph(graph)

source = 245659990
destination = 13686749225

paths = yen_k_shortest_paths(
    weighted_graph,
    source,
    destination,
    3,
    shortest_path,
)

routes = []

for path in paths:
    total_cost = sum(
        weighted_graph[path[i]][path[i + 1]]
        for i in range(len(path) - 1)
    )

    routes.append({
        "path": path,
        "total_cost": round(total_cost, 2),
    })

routes = merge_sort(routes)

print("\nAlternative routes found:", len(routes))

for i, route in enumerate(routes, 1):
    print(f"\nRoute {i}")
    print("Path:", route["path"])
    print("Total cost:", route["total_cost"])
