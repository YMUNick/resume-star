from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

FAKE_JOB = {
    "title": "Senior Frontend Engineer",
    "company": "Acme Corp",
    "location": "Taipei, Taiwan",
    "date": "2 days ago",
    "job_type": "Full-time",
    "salary": "NT$100k–150k/mo",
    "description": "We are looking for a talented engineer...",
    "url": "https://www.linkedin.com/jobs/view/123456",
}


def test_get_jobs_returns_list():
    with patch("main.scrape_linkedin_jobs", return_value=[FAKE_JOB]):
        resp = client.get("/api/jobs?keywords=frontend+engineer&location=Taiwan&limit=5")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["title"] == "Senior Frontend Engineer"
    assert data[0]["company"] == "Acme Corp"
    assert data[0]["url"] == "https://www.linkedin.com/jobs/view/123456"


def test_get_jobs_missing_keywords_returns_422():
    resp = client.get("/api/jobs")
    assert resp.status_code == 422


def test_get_jobs_limit_enforced():
    many_jobs = [FAKE_JOB] * 20
    with patch("main.scrape_linkedin_jobs", return_value=many_jobs):
        resp = client.get("/api/jobs?keywords=engineer&limit=5")
    assert resp.status_code == 200
    assert len(resp.json()) == 5


def test_get_jobs_empty_result():
    with patch("main.scrape_linkedin_jobs", return_value=[]):
        resp = client.get("/api/jobs?keywords=xyznonexistent123")
    assert resp.status_code == 200
    assert resp.json() == []
