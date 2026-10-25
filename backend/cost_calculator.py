"""Edge cost model for flood-aware routing.

Flood level of a road:
    0  dry      normal speed
    1  low      puddles, traffic slows a little
    2  medium   standing water, traffic crawls
    3  closed   impassable, the road is removed from the graph

Costs are measured in minutes, the same unit as the graph's travel times.
"""

BLOCKED_LEVEL = 3

RISK_LABELS = {
    0: "Dry",
    1: "Low",
    2: "Medium",
    3: "Closed",
}

# How many times longer a road takes to drive at each flood level.
TRAVEL_TIME_MULTIPLIER = {
    0: 1.0,
    1: 1.6,
    2: 3.5,
}


def risk_multiplier(flood_level):
    """Travel-time multiplier for a flood level (0-2)."""
    return TRAVEL_TIME_MULTIPLIER.get(int(flood_level), 1.0)


def calculate_edge_cost(travel_time, flood_risk=0, blocked=False):
    """Cost of driving one road, or None if the road cannot be used."""
    if blocked:
        return None

    return travel_time * risk_multiplier(flood_risk)