from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from backend.route_service import (
    find_route,
    find_alternative_routes,
    find_scenario_alternatives,
    compare_algorithms,
    is_known_scenario,
    scenario_details,
    coordinates,
    get_network_analysis,
    trace_search,
)


app = FastAPI(title="FloodRoute API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RouteRequest(BaseModel):
    source: int
    destination: int


class AlternativeRoutesRequest(BaseModel):
    source: int
    destination: int
    k: int = Field(default=3, ge=1, le=5)
    scenario: str = "normal"


class CompareRequest(BaseModel):
    source: int
    destination: int
    scenario: str = "normal"
    runs: int = Field(default=3, ge=1, le=10)


@app.get("/")
def home():
    return {"message": "FloodRoute API is running"}


LOCATIONS = {
    "VJTI": (19.0217, 72.8507),
    "CSMT": (18.9402, 72.8356),
    "Gateway of India": (18.9220, 72.8347),
    "Dadar Station": (19.0180, 72.8420),
    "Bandra Station": (19.0544, 72.8402),
    "Mahalaxmi Station": (18.9826, 72.8236),
    "Churchgate": (18.9322, 72.8264),
}


@app.get("/locations")
def get_locations():
    result = []

    for name, (latitude, longitude) in LOCATIONS.items():
        nearest_node, (node_lat, node_lon) = min(
            coordinates.items(),
            key=lambda item: (
                (item[1][0] - latitude) ** 2
                + (item[1][1] - longitude) ** 2
            ),
        )

        result.append({
            "name": name,
            "node_id": nearest_node,
            "coordinates": [node_lat, node_lon],
        })

    return {"locations": result}


@app.post("/route")
def get_route(request: RouteRequest):
    result = find_route(request.source, request.destination)

    if not result["path"]:
        raise HTTPException(
            status_code=404,
            detail="No route found between these nodes",
        )

    return result


@app.get("/network-analysis")
def network_analysis():
    return get_network_analysis()


@app.get("/scenarios")
def get_scenarios():
    return {"scenarios": scenario_details()}


@app.post("/routes")
def get_alternative_routes(request: AlternativeRoutesRequest):
    if not is_known_scenario(request.scenario):
        raise HTTPException(
            status_code=422,
            detail=f"Unknown scenario '{request.scenario}'",
        )

    result = find_scenario_alternatives(
        request.source,
        request.destination,
        request.k,
        request.scenario,
    )

    if not result["routes"]:
        raise HTTPException(
            status_code=404,
            detail=(
                "No route found between these locations in this scenario. "
                "One of them may be inside a closed flood zone."
            ),
        )

    return {
        "source": request.source,
        "destination": request.destination,
        "routes_found": len(result["routes"]),
        **result,
    }


@app.post("/compare-algorithms")
def compare_search_algorithms(request: CompareRequest):
    """Dijkstra vs A* on the same graph: cost, nodes expanded, time."""
    if not is_known_scenario(request.scenario):
        raise HTTPException(
            status_code=422,
            detail=f"Unknown scenario '{request.scenario}'",
        )

    result = compare_algorithms(
        request.source,
        request.destination,
        request.scenario,
        request.runs,
    )

    if not result["dijkstra"]["found"]:
        raise HTTPException(
            status_code=404,
            detail="No route found between these locations in this scenario.",
        )

    return {
        "source": request.source,
        "destination": request.destination,
        **result,
    }
class TraceRequest(BaseModel):
    source: int
    destination: int
    scenario: str = "normal"


@app.post("/search-trace")
def search_trace(request: TraceRequest):
    """Order in which Dijkstra and A* explored nodes, for the map replay."""
    if not is_known_scenario(request.scenario):
        raise HTTPException(
            status_code=422,
            detail=f"Unknown scenario '{request.scenario}'",
        )

    result = trace_search(
        request.source,
        request.destination,
        request.scenario,
    )

    if not result["dijkstra"]["found"]:
        raise HTTPException(
            status_code=404,
            detail="No route found between these locations in this scenario.",
        )

    return {
        "source": request.source,
        "destination": request.destination,
        **result,
    }