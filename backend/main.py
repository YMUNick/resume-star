from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import requests
import httpx
import asyncio
from bs4 import BeautifulSoup

app = FastAPI(title="Resume Star Job Search", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


class JobResult(BaseModel):
    title: str
    company: str
    location: str
    date: str
    job_type: str
    salary: str
    description: str
    url: str


def _parse_job_cards(html: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    cards = soup.find_all("div", class_="base-card")
    jobs = []
    for card in cards:
        title_el  = card.find("h3", class_="base-search-card__title")
        company_el = card.find("h4", class_="base-search-card__subtitle")
        location_el = card.find("span", class_="job-search-card__location")
        date_el = card.find("time")
        link_el = card.find("a", class_="base-card__full-link")
        entity_urn = card.get("data-entity-urn", "")
        job_id = entity_urn.split(":")[-1] if entity_urn else ""

        jobs.append({
            "title":    title_el.get_text(strip=True)    if title_el    else "",
            "company":  company_el.get_text(strip=True)  if company_el  else "",
            "location": location_el.get_text(strip=True) if location_el else "",
            "date":     date_el.get_text(strip=True)     if date_el     else "",
            "job_type": "",
            "salary":   "",
            "url":      link_el["href"].split("?")[0]    if link_el     else "",
            "job_id":   job_id,
        })
    return jobs


async def _fetch_description(client: httpx.AsyncClient, job_id: str) -> str:
    if not job_id:
        return ""
    try:
        url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
        resp = await client.get(url, headers=REQUEST_HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "lxml")
        desc = soup.find("div", class_="description__text")
        return desc.get_text(strip=True)[:1500] if desc else ""
    except Exception:
        return ""


async def _fetch_all_descriptions(job_ids: List[str]) -> List[str]:
    async with httpx.AsyncClient() as client:
        return list(await asyncio.gather(*[
            _fetch_description(client, jid) for jid in job_ids
        ]))


def scrape_linkedin_jobs(keywords: str, location: str, limit: int) -> List[Dict[str, Any]]:
    # 1. Fetch job listing
    resp = requests.get(
        "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
        params={"keywords": keywords, "location": location, "start": 0, "count": limit},
        headers=REQUEST_HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    jobs = _parse_job_cards(resp.text)[:limit]

    # 2. Fetch all descriptions in parallel (asyncio.run is safe here — called from a thread)
    descriptions = asyncio.run(_fetch_all_descriptions([j["job_id"] for j in jobs]))

    return [
        {
            "title":       j["title"],
            "company":     j["company"],
            "location":    j["location"],
            "date":        j["date"],
            "job_type":    j["job_type"],
            "salary":      j["salary"],
            "description": desc,
            "url":         j["url"],
        }
        for j, desc in zip(jobs, descriptions)
    ]


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
