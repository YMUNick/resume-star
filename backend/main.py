from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/jobs")
async def get_jobs(
    keywords: str = Query(..., min_length=1),
    location: Optional[str] = Query(default=""),
    limit: int = Query(default=10, ge=1, le=25),
):
    return []
