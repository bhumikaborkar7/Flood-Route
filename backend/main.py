
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from backend.route_service import find_route

app = FastAPI(title="FloodRoute API")


class RouteRequest(BaseModel):
    source: int
    destination: int


@app.get("/")
def home():
    return {"message": "FloodRoute API is running"}


@app.post("/route")
def get_route(request: RouteRequest):
    result = find_route(request.source, request.destination)

    if not result["path"]:
        raise HTTPException(
            status_code=404,
            detail="No route found between these nodes"
        )

    return result
