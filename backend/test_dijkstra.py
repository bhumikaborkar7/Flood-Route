
from graph_builder import build_graph
from dijkstra import dijkstra

graph, coordinates = build_graph()

# Pick a source node
source = next(iter(graph))

# Pick a node several road connections away
current = source
for i in range(5):
    if graph[current]:
        current = graph[current][0][0]

destination = current

path, distance = dijkstra(graph, source, destination)

print("\nSource:", source)
print("Destination:", destination)
print("Path:", path)
print("Number of nodes in route:", len(path))
print("Total distance:", distance, "metres")

if path:
    print("\nRoute coordinates:")
    for node in path:
        print(coordinates[node])
