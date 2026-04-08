from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Resume Star Job Search", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


class JobResult(BaseModel):
    title: str
    company: str
    location: str
    date: str
    job_type: str
    salary: str
    description: str
    url: str


@app.get("/api/jobs", response_model=list[JobResult])
async def get_jobs(
    keywords: str = Query(..., min_length=1),
    location: Optional[str] = Query(default=""),
    limit: int = Query(default=10, ge=1, le=25),
):
    return []
