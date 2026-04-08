/**
 * ============================================================
 *  Resume Star — AI Resume Optimizer
 * ============================================================
 *  Tech Stack: React + Tailwind CSS + Lucide React
 *  API:        Anthropic Claude API (client-side, user's key)
 *  Design:     Apple design system — SF Pro, #f5f5f7, #0071e3
 * ============================================================
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  KeyRound, Upload, FileText, Sparkles, Download, Eye,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Loader2,
  Trash2, Settings, Star, Copy, Check, X, Info, Bot,
  Search, Briefcase, MapPin, Calendar, DollarSign, ExternalLink
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/* ──────────────────────────────────────────────────────────
   CONSTANTS & CONFIG
   ────────────────────────────────────────────────────────── */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;
const LS_KEY = "ai_resume_optimizer_api_key";

const SYSTEM_PROMPT = `You are a resume keyword editor. You make the smallest possible edits to an existing resume to improve its JD alignment. The resume you receive is ground truth — treat it as nearly untouchable.

ABSOLUTE PROHIBITIONS (zero exceptions):
- Name, email, phone, LinkedIn, GitHub, and all personal details → copy verbatim, never alter.
- Job titles, company names, employment dates, school names, degree names → copy verbatim, never alter.
- Never add a job, project, skill, tool, technology, certification, or achievement that does not already appear in the original resume.
- Never add or remove a section. Keep every section that exists; add no new ones (except a Summary if the original has none — see below).
- Output must be ONE PAGE or shorter. Never make it longer than the original.

THE ONLY EDITS YOU MAY MAKE:
1. Keyword substitution: swap a word/phrase in an existing bullet for a JD synonym (same meaning, JD language). Example: "built" → "developed" if JD uses "developed".
2. Keyword insertion: add 1–2 JD keywords into an existing bullet only when they accurately describe what is already written there.
3. Bullet reordering: within a single section, reorder bullets to put the most JD-relevant ones first. Do not move content between sections.
4. Minor grammar/clarity: fix typos or awkward phrasing. Do not change meaning.
5. Summary (only if original has none): write a 2-sentence summary using exclusively facts already present in the resume.

PROCESS:
- Start from the original resume text. Make the minimum edits needed. When in doubt, leave the original wording unchanged.
- If the original exceeds one page, trim the least relevant bullets (do not fabricate replacements).

OUTPUT:
- The edited resume in clean Markdown.
- Then a "## Optimization Notes" section: list each changed line as "Original: … → Revised: …" (max 6 items).

Respond ONLY with the Markdown resume + notes. No other text.`;

/* ──────────────────────────────────────────────────────────
   THEME — Apple design system tokens
   ────────────────────────────────────────────────────────── */
const T = {
  bg:          "#f5f5f7",                              // Apple light gray page
  card:        "#ffffff",                              // White cards
  cardShadow:  "rgba(0,0,0,0.10) 0px 2px 20px 0px",  // Soft diffused shadow
  inputBg:     "#ffffff",
  inputBorder: "rgba(0,0,0,0.14)",
  sectionBg:   "rgba(0,0,0,0.04)",                    // Subtle inner backgrounds
  accent:      "#0071e3",                              // Apple Blue — only accent
  accentHover: "#0077ed",
  accentDim:   "rgba(0,113,227,0.08)",
  textPrimary: "#1d1d1f",
  textBody:    "rgba(0,0,0,0.80)",
  textMuted:   "rgba(0,0,0,0.48)",
  textDim:     "rgba(0,0,0,0.28)",
  divider:     "rgba(0,0,0,0.08)",
  error:       "#ff3b30",
  errorBg:     "rgba(255,59,48,0.06)",
  success:     "#34c759",
  navBg:       "rgba(22,22,23,0.82)",
  font:        "-apple-system, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

/* ──────────────────────────────────────────────────────────
   UTILITY: Simple Markdown → HTML renderer
   ────────────────────────────────────────────────────────── */
function renderMarkdown(md) {
  if (!md) return "";
  let html = md
    .replace(/```(\w*)\n([\s\S]*?)```/g,
      `<pre style="background:#f5f5f7;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;border:1px solid rgba(0,0,0,0.08)"><code>$2</code></pre>`)
    .replace(/`([^`]+)`/g,
      `<code style="background:#f5f5f7;padding:2px 6px;border-radius:4px;font-size:13px;color:#1d1d1f">$1</code>`)
    .replace(/^#### (.+)$/gm, `<h4 style="font-size:14px;font-weight:600;margin:20px 0 8px;color:#1d1d1f;letter-spacing:-0.224px">$1</h4>`)
    .replace(/^### (.+)$/gm,  `<h3 style="font-size:17px;font-weight:600;margin:24px 0 10px;color:#1d1d1f;letter-spacing:-0.374px">$1</h3>`)
    .replace(/^## (.+)$/gm,   `<h2 style="font-size:21px;font-weight:600;margin:28px 0 12px;color:#1d1d1f;letter-spacing:0.231px;border-bottom:1px solid rgba(0,0,0,0.08);padding-bottom:8px">$1</h2>`)
    .replace(/^# (.+)$/gm,    `<h1 style="font-size:28px;font-weight:600;margin:0 0 16px;color:#1d1d1f;letter-spacing:0.196px;line-height:1.14">$1</h1>`)
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:#1d1d1f;font-weight:600">$1</strong>`)
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[\-\*] (.+)$/gm, '<li style="margin:4px 0;padding-left:4px;color:rgba(0,0,0,0.80)">$1</li>')
    .replace(/^---$/gm, `<hr style="border:none;border-top:1px solid rgba(0,0,0,0.08);margin:24px 0"/>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="color:#0066cc;text-decoration:underline">$1</a>`)
    .replace(/^(?!<[hlpuoa]|<li|<pre|<hr|<code|<strong|<em)(.+)$/gm,
      '<p style="margin:6px 0;line-height:1.47;color:rgba(0,0,0,0.80);letter-spacing:-0.374px;font-size:17px">$1</p>');
  html = html.replace(/((?:<li[^>]*>.*<\/li>\s*)+)/g, '<ul style="list-style:disc;padding-left:24px;margin:8px 0">$1</ul>');
  return html;
}

/* ──────────────────────────────────────────────────────────
   UTILITY: Read uploaded file as text (PDF / MD / TXT)
   ────────────────────────────────────────────────────────── */
async function readFileAsText(file) {
  if (file.name.endsWith(".pdf")) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      pages.push(pageText);
    }
    const text = pages.join("\n").trim();
    return text || "[PDF text extraction failed — please try pasting the content as plain text]";
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsText(file);
  });
}

/* ──────────────────────────────────────────────────────────
   UTILITY: Download as PDF via print dialog
   ────────────────────────────────────────────────────────── */
function downloadAsPdf(htmlContent, filename = "optimized-resume.pdf") {
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow pop-ups to download the PDF"); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title>
<style>body{font-family:-apple-system,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1d1d1f;line-height:1.47;font-size:17px;letter-spacing:-0.374px}
h1{font-size:28px;font-weight:600;letter-spacing:0.196px;line-height:1.14}h2{font-size:21px;font-weight:600;color:#1d1d1f;margin-top:24px;border-bottom:1px solid rgba(0,0,0,0.08);padding-bottom:4px}
h3{font-size:17px;font-weight:600;margin-top:16px}ul{padding-left:24px}li{margin:4px 0}strong{color:#1d1d1f;font-weight:600}
code{background:#f5f5f7;padding:2px 5px;border-radius:3px;font-size:13px}pre{background:#f5f5f7;padding:12px;border-radius:6px;font-size:13px;overflow-x:auto}
a{color:#0066cc}@media print{body{margin:20px}}</style></head><body>${htmlContent}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

/* ──────────────────────────────────────────────────────────
   COMPONENT: API Key Settings Panel
   ────────────────────────────────────────────────────────── */
function ApiKeyPanel({ apiKey, setApiKey }) {
  const [open, setOpen] = useState(!apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(!!apiKey);

  const handleSave = () => {
    if (apiKey.trim()) {
      try { localStorage.setItem(LS_KEY, apiKey.trim()); } catch {}
      setSaved(true);
      setTimeout(() => setOpen(false), 600);
    }
  };
  const handleClear = () => {
    setApiKey(""); setSaved(false);
    try { localStorage.removeItem(LS_KEY); } catch {}
  };

  return (
    <div style={{ background: T.card, boxShadow: T.cardShadow, fontFamily: T.font }}
      className="rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 transition-opacity"
        style={{ background: T.card }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: saved ? T.accentDim : T.sectionBg }}>
            {saved ? <KeyRound size={16} color={T.accent} /> : <Settings size={16} color={T.textMuted} />}
          </div>
          <span className="font-semibold text-sm" style={{ color: T.textPrimary, letterSpacing: "-0.374px" }}>
            API Settings
            {saved && <span className="ml-2 text-xs font-normal" style={{ color: T.accent }}>Connected</span>}
          </span>
        </div>
        {open ? <ChevronUp size={16} color={T.textMuted} /> : <ChevronDown size={16} color={T.textMuted} />}
      </button>

      {open && (
        <div className="px-6 pb-6">
          <div style={{ height: "1px", background: T.divider, marginBottom: "20px" }} />
          <p className="text-xs mb-4" style={{ color: T.textMuted, letterSpacing: "-0.12px", lineHeight: "1.47" }}>
            <Info size={12} className="inline mr-1 -mt-0.5" />
            Your API Key is stored only in your browser's LocalStorage and never sent to any third-party server.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input type={showKey ? "text" : "password"} value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setSaved(false); }}
                placeholder="sk-ant-api03-..."
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                style={{ background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                  color: T.textPrimary, letterSpacing: "-0.224px", fontFamily: T.font }} />
              <button onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                style={{ color: T.accent }}>{showKey ? "Hide" : "Show"}</button>
            </div>
            <button onClick={handleSave}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
              style={{ background: T.accent, color: "#fff", letterSpacing: "-0.374px" }}>Save</button>
            {apiKey && (
              <button onClick={handleClear} className="px-3 py-2.5 rounded-xl transition-all"
                style={{ color: T.error, background: T.errorBg }}><Trash2 size={16} /></button>
            )}
          </div>
          {saved && (
            <p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: T.success, letterSpacing: "-0.12px" }}>
              <CheckCircle2 size={13} /> API Key saved
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   COMPONENT: File Upload Area
   ────────────────────────────────────────────────────────── */
function FileUploadArea({ file, setFile, resumeText, setResumeText }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (f) => {
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["pdf", "md", "txt", "markdown"].includes(ext)) {
      setError("Only PDF / Markdown / TXT files are supported"); return;
    }
    setError(""); setFile(f); setReading(true);
    try { setResumeText(await readFileAsText(f)); } catch (err) { setError(err.message); }
    setReading(false);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold flex items-center gap-2"
        style={{ color: T.textPrimary, letterSpacing: "-0.374px" }}>
        <Upload size={15} color={T.accent} /> Upload Resume
      </label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        className="relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all"
        style={{
          borderColor: dragging ? T.accent : T.inputBorder,
          background: dragging ? T.accentDim : T.sectionBg,
        }}>
        <input ref={inputRef} type="file" accept=".pdf,.md,.txt,.markdown" className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])} />
        {reading ? (
          <Loader2 size={28} className="mx-auto animate-spin" color={T.accent} />
        ) : file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText size={28} color={T.accent} />
            <p className="text-sm font-medium" style={{ color: T.textPrimary, letterSpacing: "-0.374px" }}>{file.name}</p>
            <p className="text-xs" style={{ color: T.textMuted, letterSpacing: "-0.12px" }}>
              {(file.size / 1024).toFixed(1)} KB · Click to replace
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} color={T.textDim} />
            <p className="text-sm" style={{ color: T.textBody, letterSpacing: "-0.374px" }}>
              Drag & drop or <span style={{ color: T.accent }}>click to upload</span>
            </p>
            <p className="text-xs" style={{ color: T.textMuted, letterSpacing: "-0.12px" }}>
              Supports PDF / Markdown / TXT
            </p>
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: T.error, letterSpacing: "-0.12px" }}>
          <AlertCircle size={13} /> {error}
        </p>
      )}
      <details>
        <summary className="text-xs cursor-pointer select-none"
          style={{ color: T.textMuted, letterSpacing: "-0.12px" }}>
          Or paste resume text directly ▾
        </summary>
        <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} rows={6}
          placeholder="Paste your resume content here..."
          className="mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none resize-y transition-all"
          style={{ background: T.inputBg, border: `1px solid ${T.inputBorder}`,
            color: T.textPrimary, minHeight: "120px", fontFamily: T.font, letterSpacing: "-0.224px" }} />
      </details>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   COMPONENT: Result Preview Panel
   ────────────────────────────────────────────────────────── */
function ResultPanel({ result, loading }) {
  const [copied, setCopied] = useState(false);
  const copyMd = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-10 flex flex-col items-center justify-center gap-4"
        style={{ background: T.card, boxShadow: T.cardShadow, minHeight: "300px" }}>
        <Loader2 size={36} className="animate-spin" color={T.accent} />
        <p className="text-sm font-medium" style={{ color: T.textBody, letterSpacing: "-0.374px" }}>
          AI is optimizing your resume…
        </p>
        <p className="text-xs" style={{ color: T.textMuted, letterSpacing: "-0.224px" }}>
          This usually takes 15–30 seconds
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3"
        style={{ background: T.card, boxShadow: T.cardShadow, minHeight: "300px" }}>
        <Bot size={40} color={T.textDim} />
        <p className="text-sm" style={{ color: T.textMuted, letterSpacing: "-0.374px" }}>
          Your optimized resume will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: T.card, boxShadow: T.cardShadow }}>
      <div className="flex items-center justify-between px-6 py-3.5"
        style={{ borderBottom: `1px solid ${T.divider}` }}>
        <div className="flex items-center gap-2">
          <Eye size={15} color={T.accent} />
          <span className="text-sm font-semibold" style={{ color: T.textPrimary, letterSpacing: "-0.374px" }}>
            Preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyMd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ color: T.textMuted, background: T.sectionBg, letterSpacing: "-0.12px" }}>
            {copied ? <Check size={13} color={T.success} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy Markdown"}
          </button>
          <button onClick={() => downloadAsPdf(renderMarkdown(result))}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95"
            style={{ background: T.accent, color: "#fff", letterSpacing: "-0.12px" }}>
            <Download size={13} /> Download PDF
          </button>
        </div>
      </div>
      <div className="px-6 py-5 overflow-y-auto"
        style={{ maxHeight: "600px", color: T.textBody, fontFamily: T.font }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   UTILITY: LinkedIn guest API via CORS proxy (pure frontend)
   ────────────────────────────────────────────────────────── */
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];
const jobSearchCache = new Map();

async function proxyFetch(url, signal) {
  let lastError;
  for (const proxy of CORS_PROXIES) {
    try {
      const resp = await fetch(proxy(url), { signal });
      if (resp.ok) return resp;
      lastError = new Error(`Proxy error (${resp.status})`);
    } catch (err) {
      if (err.name === "AbortError") throw err;
      lastError = err;
    }
  }
  throw lastError ?? new Error("All CORS proxies failed");
}

const PAGE_SIZE = 10;

async function fetchLinkedInJobs(keywords, location, start, signal) {
  const cacheKey = `${keywords}|${location}|${start}`;
  if (jobSearchCache.has(cacheKey)) return jobSearchCache.get(cacheKey);

  const parser = new DOMParser();

  const searchUrl = new URL(
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
  );
  searchUrl.searchParams.set("keywords", keywords);
  if (location) searchUrl.searchParams.set("location", location);
  searchUrl.searchParams.set("start", String(start));
  searchUrl.searchParams.set("count", String(PAGE_SIZE));

  const listResp = await proxyFetch(searchUrl.toString(), signal);
  if (!listResp.ok) throw new Error(`Proxy error (${listResp.status})`);
  const listHtml = await listResp.text();

  const doc = parser.parseFromString(listHtml, "text/html");
  const cards = Array.from(doc.querySelectorAll(".base-card")).slice(0, PAGE_SIZE);

  const jobIds = cards.map((card) => (card.dataset.entityUrn || "").split(":").pop());
  const jobs = cards.map((card) => {
    const link = card.querySelector("a.base-card__full-link");
    return {
      title:       card.querySelector(".base-search-card__title")?.textContent?.trim()    || "",
      company:     card.querySelector(".base-search-card__subtitle")?.textContent?.trim() || "",
      location:    card.querySelector(".job-search-card__location")?.textContent?.trim()  || "",
      date:        card.querySelector("time")?.textContent?.trim()                        || "",
      job_type:    "",
      salary:      "",
      description: "",
      url:         link ? link.href.split("?")[0] : "",
    };
  });

  const descriptions = await Promise.all(
    jobIds.map(async (jobId) => {
      if (!jobId) return "";
      try {
        const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
        const resp = await proxyFetch(detailUrl, signal);
        if (!resp.ok) return "";
        const html = await resp.text();
        const detail = parser.parseFromString(html, "text/html");
        return detail.querySelector(".description__text")?.textContent?.trim() || "";
      } catch { return ""; }
    })
  );

  const results = jobs.map((job, i) => ({ ...job, description: descriptions[i] }));
  jobSearchCache.set(cacheKey, results);
  return results;
}

/* ──────────────────────────────────────────────────────────
   UTILITY: Batch-score jobs against resume via Claude
   ────────────────────────────────────────────────────────── */
async function scoreJobsAgainstResume(jobs, resumeText, apiKey) {
  const jobList = jobs.map((j, i) =>
    `${i + 1}. Title: ${j.title} | Company: ${j.company}\nDescription: ${j.description?.slice(0, 400) || "(no description)"}`
  ).join("\n\n");

  const prompt = `Resume (excerpt):\n${resumeText.slice(0, 2000)}\n\n---\n\nJob Postings:\n${jobList}\n\n---\n\nScore each job's fit to this resume on a scale of 1–10. For each job consider:\n1. Domain/field alignment (industry, tech stack, role type)\n2. Years of experience match (JD requirement vs. resume work history)\n\nReturn ONLY a JSON array of integers, one per job, in the same order. Example: [7,4,9,3,8]`;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 150,
      messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = data.content?.map(b => b.type === "text" ? b.text : "").join("") || "";
  const match = text.match(/\[[\d,\s]+\]/);
  if (!match) return null;
  return JSON.parse(match[0]);
}

/* ──────────────────────────────────────────────────────────
   COMPONENT: Match Score Badge
   ────────────────────────────────────────────────────────── */
function ScoreBadge({ score }) {
  if (score == null) return null;
  const color = score >= 8 ? "#34c759" : score >= 5 ? "#ff9f0a" : "#ff3b30";
  const bg    = score >= 8 ? "rgba(52,199,89,0.10)" : score >= 5 ? "rgba(255,159,10,0.10)" : "rgba(255,59,48,0.10)";
  return (
    <span title={`Match score: ${score}/10`}
      className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: bg, color, letterSpacing: "-0.12px" }}>
      {score}<span className="font-normal opacity-60">/10</span>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────
   COMPONENT: LinkedIn Job Search Panel
   ────────────────────────────────────────────────────────── */
function LinkedInSearchPanel({ setJd, apiKey, resumeText }) {
  const [open, setOpen] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [filledIdx, setFilledIdx] = useState(null);
  const [scores, setScores] = useState([]);
  const [scoring, setScoring] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextStart, setNextStart] = useState(0);
  const abortRef = useRef(null);

  const handleSearch = async () => {
    if (!keywords.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(""); setJobs([]); setScores([]); setHasMore(false); setLoading(true); setFilledIdx(null);
    try {
      const data = await fetchLinkedInJobs(keywords.trim(), location.trim(), 0, controller.signal);
      setJobs(data);
      if (data.length === 0) { setError("No jobs found. Try different keywords."); return; }
      setHasMore(data.length === PAGE_SIZE);
      setNextStart(PAGE_SIZE);
      if (resumeText?.trim() && apiKey?.trim()) {
        setScoring(true);
        scoreJobsAgainstResume(data, resumeText, apiKey)
          .then((s) => { if (s) setScores(s); })
          .catch(() => {})
          .finally(() => setScoring(false));
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(`Search failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingMore(true);
    try {
      const data = await fetchLinkedInJobs(keywords.trim(), location.trim(), nextStart, controller.signal);
      if (data.length === 0) { setHasMore(false); return; }
      setJobs((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setNextStart((prev) => prev + PAGE_SIZE);
      if (resumeText?.trim() && apiKey?.trim()) {
        setScoring(true);
        scoreJobsAgainstResume(data, resumeText, apiKey)
          .then((s) => { if (s) setScores((prev) => [...prev, ...s]); })
          .catch(() => {})
          .finally(() => setScoring(false));
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(`Load more failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFillJd = (job, idx) => {
    setFilledIdx(idx);
    setJd(job.description);
  };

  return (
    <div style={{ background: T.card, boxShadow: T.cardShadow, fontFamily: T.font }}
      className="rounded-2xl overflow-hidden">
      {/* Header */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4"
        style={{ background: T.card }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: T.sectionBg }}>
            <Briefcase size={16} color={T.accent} />
          </div>
          <span className="font-semibold text-sm" style={{ color: T.textPrimary, letterSpacing: "-0.374px" }}>
            LinkedIn Job Search
            {jobs.length > 0 && (
              <span className="ml-2 text-xs font-normal" style={{ color: T.textMuted }}>
                {jobs.length} results
              </span>
            )}
          </span>
        </div>
        {open ? <ChevronUp size={16} color={T.textMuted} /> : <ChevronDown size={16} color={T.textMuted} />}
      </button>

      {open && (
        <div className="px-6 pb-6">
          <div style={{ height: "1px", background: T.divider, marginBottom: "20px" }} />

          {/* Search inputs */}
          <div className="flex gap-2 flex-wrap mb-4">
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Job title or keywords (e.g. Senior React Engineer)"
              className="flex-1 min-w-[200px] rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              style={{ background: T.sectionBg, border: `1px solid ${T.inputBorder}`,
                color: T.textPrimary, fontFamily: T.font, letterSpacing: "-0.224px" }}
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Location (optional)"
              className="w-44 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              style={{ background: T.sectionBg, border: `1px solid ${T.inputBorder}`,
                color: T.textPrimary, fontFamily: T.font, letterSpacing: "-0.224px" }}
            />
            <button
              onClick={handleSearch}
              disabled={!keywords.trim() || loading}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ background: T.accent, color: "#fff", letterSpacing: "-0.374px" }}>
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Searching…</>
                : <><Search size={15} /> Search Jobs</>}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 flex items-start gap-2.5 text-sm mb-4"
              style={{ background: T.errorBg, color: T.error }}>
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <p style={{ letterSpacing: "-0.224px" }}>{error}</p>
              <button onClick={() => setError("")} className="ml-auto"><X size={13} /></button>
            </div>
          )}

          {/* Scoring indicator */}
          {scoring && (
            <p className="text-xs flex items-center gap-1.5 mb-3"
              style={{ color: T.textMuted, letterSpacing: "-0.12px" }}>
              <Loader2 size={12} className="animate-spin" /> Calculating match scores…
            </p>
          )}

          {/* Results */}
          {jobs.length > 0 && (
            <div className="space-y-3">
              {jobs.map((job, idx) => (
                <div key={idx} className="rounded-2xl p-5 transition-all"
                  style={{
                    background: filledIdx === idx ? "rgba(52,199,89,0.05)" : T.sectionBg,
                    border: `1.5px solid ${filledIdx === idx ? T.success : "transparent"}`,
                  }}>
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm"
                          style={{ color: T.textPrimary, letterSpacing: "-0.374px" }}>
                          {job.title}
                        </p>
                        <ScoreBadge score={scores[idx]} />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: T.textMuted, letterSpacing: "-0.12px" }}>
                        {job.company}
                      </p>
                    </div>
                    {job.job_type && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: T.accentDim, color: T.accent, letterSpacing: "-0.12px" }}>
                        {job.job_type}
                      </span>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-3 text-xs mb-2"
                    style={{ color: T.textMuted, letterSpacing: "-0.12px" }}>
                    {job.location && (
                      <span className="flex items-center gap-1"><MapPin size={11} />{job.location}</span>
                    )}
                    {job.date && (
                      <span className="flex items-center gap-1"><Calendar size={11} />{job.date}</span>
                    )}
                    {job.salary && (
                      <span className="flex items-center gap-1"><DollarSign size={11} />{job.salary}</span>
                    )}
                  </div>

                  {/* Description snippet */}
                  {job.description && (
                    <p className="text-xs leading-relaxed line-clamp-2 mb-3"
                      style={{ color: T.textMuted, letterSpacing: "-0.12px" }}>
                      "{job.description}"
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFillJd(job, idx)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
                      style={{
                        background: filledIdx === idx ? "rgba(52,199,89,0.12)" : T.accentDim,
                        color: filledIdx === idx ? T.success : T.accent,
                        letterSpacing: "-0.12px",
                      }}>
                      {filledIdx === idx ? <><Check size={12} /> Filled</> : <><FileText size={12} /> Fill JD</>}
                    </button>
                    <a href={job.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{ color: "#0066cc", border: "1px solid rgba(0,102,204,0.3)", letterSpacing: "-0.12px" }}>
                      <ExternalLink size={12} /> View on LinkedIn
                    </a>
                  </div>
                </div>
              ))}

              {/* Load More */}
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: T.sectionBg, color: T.accent, letterSpacing: "-0.374px",
                    border: `1px solid ${T.inputBorder}` }}>
                  {loadingMore
                    ? <><Loader2 size={15} className="animate-spin" /> Loading more…</>
                    : <>Load More</>}
                </button>
              )}
              {!hasMore && jobs.length > 0 && !loading && (
                <p className="text-center text-xs py-2" style={{ color: T.textDim, letterSpacing: "-0.12px" }}>
                  No more results
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   MAIN APP
   ────────────────────────────────────────────────────────── */
export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [jd, setJd] = useState("");
  const [file, setFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { try { const s = localStorage.getItem(LS_KEY); if (s) setApiKey(s); } catch {} }, []);

  const handleOptimize = useCallback(async () => {
    if (!apiKey.trim()) { setError("Please set your API Key first"); return; }
    if (!jd.trim())     { setError("Please paste a Job Description"); return; }
    if (!resumeText.trim()) { setError("Please upload or paste your resume content"); return; }
    setError(""); setLoading(true); setResult("");
    const userMessage = `## Target Job Description\n\n${jd.trim()}\n\n---\n\n## Original Resume (do not change personal info, titles, companies, dates, or add anything not present here)\n\n${resumeText.trim()}`;
    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }] }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody?.error?.message || "";
        if (res.status === 401) throw new Error("Invalid or expired API Key — please check and update it.");
        if (res.status === 429) throw new Error("Rate limit reached. Please wait 30–60 seconds and try again.");
        if (res.status === 529) throw new Error("Claude API is overloaded right now. Please wait a moment and try again.");
        if (res.status === 400 && msg.toLowerCase().includes("token"))
          throw new Error("Input is too long. Please shorten your resume or job description.");
        throw new Error(`API error (${res.status})${msg ? `: ${msg}` : ""}`);
      }
      const data = await res.json();
      const text = data.content?.map(b => b.type === "text" ? b.text : "").join("") || "";
      if (!text.trim()) throw new Error("AI returned an empty response. Please try again.");
      setResult(text);
    } catch (err) {
      const message = err?.message || String(err) || "Unknown error";
      setError(err.name === "TypeError" && message.includes("fetch")
        ? "Network error — the browser may be blocking the request due to CORS."
        : message);
    } finally { setLoading(false); }
  }, [apiKey, jd, resumeText]);

  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleOptimize(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [handleOptimize]);

  const canSubmit = apiKey.trim() && jd.trim() && resumeText.trim() && !loading;

  return (
    <div className="min-h-screen" style={{ background: T.bg, color: T.textBody, fontFamily: T.font }}>

      {/* Navigation — Apple glass nav */}
      <header className="sticky top-0 z-50"
        style={{ background: T.navBg, backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="max-w-[980px] mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Star size={17} color="#fff" fill="#fff" />
            <span className="text-sm font-medium text-white" style={{ letterSpacing: "-0.374px" }}>
              Resume Star
            </span>
          </div>
          <a href="https://docs.anthropic.com/en/api/getting-started" target="_blank" rel="noopener noreferrer"
            className="text-xs transition-opacity opacity-80 hover:opacity-100"
            style={{ color: "#2997ff", letterSpacing: "-0.12px" }}>
            API Docs ↗
          </a>
        </div>
      </header>

      {/* Hero section — dark */}
      <section style={{ background: "#000000" }}>
        <div className="max-w-[980px] mx-auto px-5 py-16 text-center">
          <h1 style={{
            fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 600, color: "#ffffff",
            lineHeight: 1.07, letterSpacing: "-0.28px", margin: "0 0 12px"
          }}>
            Resume Star.
          </h1>
          <p style={{
            fontSize: "21px", fontWeight: 400, color: "rgba(255,255,255,0.72)",
            lineHeight: 1.19, letterSpacing: "0.231px", margin: "0 auto 28px", maxWidth: "520px"
          }}>
            AI-powered resume optimization. Matched to the job description. True to your story.
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.32)", letterSpacing: "-0.12px" }}>
            Powered by Claude · Your data never leaves your browser
          </p>
        </div>
      </section>

      {/* Main content */}
      <main className="max-w-[980px] mx-auto px-5 py-10 space-y-5">

        <ApiKeyPanel apiKey={apiKey} setApiKey={setApiKey} />
        <LinkedInSearchPanel setJd={setJd} apiKey={apiKey} resumeText={resumeText} />

        {/* Inputs row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl p-6 space-y-3"
            style={{ background: T.card, boxShadow: T.cardShadow }}>
            <label className="text-sm font-semibold flex items-center gap-2"
              style={{ color: T.textPrimary, letterSpacing: "-0.374px" }}>
              <FileText size={15} color={T.accent} /> Job Description
            </label>
            <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={10}
              placeholder={"Paste the target job description here…\n\nExample:\nWe are looking for a Senior Frontend Engineer with 5+ years of experience in React, TypeScript…"}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-y transition-all"
              style={{ background: T.sectionBg, border: `1px solid ${T.inputBorder}`,
                color: T.textPrimary, minHeight: "200px", fontFamily: T.font, letterSpacing: "-0.224px",
                lineHeight: "1.47" }} />
            {jd.length > 0 && (
              <p className="text-xs text-right" style={{ color: T.textMuted, letterSpacing: "-0.12px" }}>
                {jd.length} chars
              </p>
            )}
          </div>

          <div className="rounded-2xl p-6" style={{ background: T.card, boxShadow: T.cardShadow }}>
            <FileUploadArea file={file} setFile={setFile} resumeText={resumeText} setResumeText={setResumeText} />
            {resumeText && (
              <p className="mt-3 text-xs flex items-center gap-1"
                style={{ color: T.success, letterSpacing: "-0.12px" }}>
                <CheckCircle2 size={12} /> {resumeText.length} characters extracted
              </p>
            )}
          </div>
        </div>

        {/* Optimize button */}
        <button onClick={handleOptimize} disabled={!canSubmit}
          className="w-full py-4 rounded-2xl text-base font-medium transition-all flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          style={{
            background: canSubmit ? T.accent : "rgba(0,0,0,0.10)",
            color: canSubmit ? "#fff" : T.textDim,
            letterSpacing: "-0.374px",
          }}>
          {loading
            ? <><Loader2 size={18} className="animate-spin" /> Optimizing…</>
            : <><Sparkles size={18} /> Optimize with AI</>}
        </button>
        <p className="text-center text-xs" style={{ color: T.textDim, letterSpacing: "-0.12px" }}>
          ⌘ / Ctrl + Enter to submit
        </p>

        {error && (
          <div className="rounded-xl px-5 py-4 flex items-start gap-3"
            style={{ background: T.errorBg }}>
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" color={T.error} />
            <div>
              <p className="font-semibold text-sm" style={{ color: T.error, letterSpacing: "-0.374px" }}>
                Error
              </p>
              <p className="mt-0.5 text-sm" style={{ color: T.error, letterSpacing: "-0.224px", opacity: 0.85 }}>
                {error}
              </p>
            </div>
            <button onClick={() => setError("")} className="ml-auto flex-shrink-0 mt-0.5">
              <X size={14} color={T.error} />
            </button>
          </div>
        )}

        {/* Result */}
        <div><ResultPanel result={result} loading={loading} /></div>

        {/* Tips */}
        <div className="rounded-2xl p-6" style={{ background: T.card, boxShadow: T.cardShadow }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: T.textPrimary, letterSpacing: "-0.374px" }}>
            <Sparkles size={14} color={T.accent} /> Tips for best results
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm"
            style={{ color: T.textBody }}>
            <p style={{ letterSpacing: "-0.224px", lineHeight: "1.47" }}>
              <strong style={{ color: T.textPrimary, fontWeight: 600 }}>Precise Matching</strong><br />
              Paste the full JD content; AI will extract key skills to align your resume.
            </p>
            <p style={{ letterSpacing: "-0.224px", lineHeight: "1.47" }}>
              <strong style={{ color: T.textPrimary, fontWeight: 600 }}>Quantify Achievements</strong><br />
              If your resume includes metrics, AI will prioritize and strengthen them.
            </p>
            <p style={{ letterSpacing: "-0.224px", lineHeight: "1.47" }}>
              <strong style={{ color: T.textPrimary, fontWeight: 600 }}>Iterate Often</strong><br />
              Reuse the same resume against different JDs to generate tailored versions.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t mt-12 py-8 text-center"
        style={{ borderColor: T.divider }}>
        <p className="text-xs" style={{ color: T.textMuted, letterSpacing: "-0.12px" }}>
          Copyright © 2026 Resume Star · Your API Key is stored locally · No personal data is collected
        </p>
      </footer>
    </div>
  );
}
