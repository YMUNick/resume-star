from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from linkedin_jobs_scraper import LinkedinScraper
from linkedin_jobs_scraper.events import Events, EventData
from linkedin_jobs_scraper.query import Query as LiQuery, QueryOptions
import asyncio

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


def scrape_linkedin_jobs(keywords: str, location: str, limit: int) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []

    scraper = LinkedinScraper(
        chrome_options=None,
        headless=True,
        max_workers=1,
        slow_mo=1.0,
        page_load_timeout=40,
    )

    def on_data(data: EventData):
        # insights may contain job type info; salary not available in this package version
        insights = data.insights or []
        job_type = insights[0] if insights else ""

        results.append({
            "title": data.title or "",
            "company": data.company or "",
            "location": data.place or "",
            "date": str(data.date.strftime("%b %d, %Y") if data.date else ""),
            "job_type": job_type,
            "salary": "",
            "description": (data.description or "")[:300],
            "url": data.link or "",
        })

    def on_error(error):
        print(f"[linkedin-scraper] error: {error}")

    scraper.on(Events.DATA, on_data)
    scraper.on(Events.ERROR, on_error)

    scraper.run([
        LiQuery(
            query=keywords,
            options=QueryOptions(
                locations=[location] if location else [],
                limit=limit,
            ),
        )
    ])

    return results[:limit]


@app.get("/api/jobs", response_model=list[JobResult])
async def get_jobs(
    keywords: str = Query(..., min_length=1),
    location: Optional[str] = Query(default=""),
    limit: int = Query(default=10, ge=1, le=25),
):
    try:
        loop = asyncio.get_running_loop()
        jobs = await loop.run_in_executor(
            None, scrape_linkedin_jobs, keywords, location or "", limit
        )
        return jobs[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
