
def calculate_edge_cost(travel_time, flood_risk=0, blocked=False):
    # A blocked road cannot be used
    if blocked:
        return None

    # Flood risk ranges from 0 (safe) to 3 (severe)
    risk_penalty = flood_risk * 300

    # Total cost is measured in seconds
    total_cost = travel_time + risk_penalty

    return total_cost



# Flood risk	Penalty added
# 0 — Safe	        0 seconds
# 1 — Low	      300 seconds
# 2 — Medium	  600 seconds
# 3 — High	      900 seconds
# Blocked	    Road excluded