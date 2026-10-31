from backend.route_service import compare_algorithms, coordinates

LOCATIONS = {
    "VJTI": (19.0217, 72.8507),
    "CSMT": (18.9402, 72.8356),
    "Churchgate": (18.9322, 72.8264),
    "Bandra Station": (19.0544, 72.8402),
}


def nearest_node(lat, lon):
    return min(
        coordinates,
        key=lambda n: (coordinates[n][0] - lat) ** 2
        + (coordinates[n][1] - lon) ** 2,
    )


PAIRS = [
    ("VJTI", "CSMT"),
    ("VJTI", "Churchgate"),
    ("Bandra Station", "CSMT"),
]

for start, end in PAIRS:
    source = nearest_node(*LOCATIONS[start])
    destination = nearest_node(*LOCATIONS[end])

    for scenario in ("normal", "moderate", "severe"):
        result = compare_algorithms(source, destination, scenario)
        d, a = result["dijkstra"], result["astar"]

        print(f"\n=== {start} -> {end} | {scenario} ===")
        print("Dijkstra nodes:", d["nodes_expanded"], "| cost:", d["total_cost"])
        print("A* nodes      :", a["nodes_expanded"], "| cost:", a["total_cost"])
        print("Same cost:", result["same_cost"])
        print("Nodes saved:", result["nodes_saved_percent"], "%")