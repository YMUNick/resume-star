/**
 * ============================================================
 *  Resume Star — AI Resume Optimizer
 * ============================================================
 *  Tech Stack: React + Tailwind CSS + Lucide React
 *  API:        Anthropic Claude API (client-side, user's key)
 *  Design:     Clean dark background, high-contrast light text
 * ============================================================
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  KeyRound, Upload, FileText, Sparkles, Download, Eye,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Loader2,
  Trash2, Settings, Star, Copy, Check, X, Info, Bot,
  Search, Briefcase, MapPin, Calendar, DollarSign, ExternalLink
} from "lucide-react";

/* ──────────────────────────────────────────────────────────
   CONSTANTS & CONFIG
   ────────────────────────────────────────────────────────── */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;
const LS_KEY = "ai_resume_optimizer_api_key";

const SYSTEM_PROMPT = `You are an expert career consultant and professional resume writer. Your task is to optimize a resume based on a specific job description (JD).

Instructions:
1. Analyze the JD carefully — extract key skills, qualifications, technologies, and soft skills required.
2. Rewrite and enhance the resume to strongly align with the JD requirements.
3. Strengthen relevant experiences by quantifying achievements where possible.
4. Maintain a professional, confident tone throughout.
5. Preserve the candidate's authentic background — do not fabricate experiences.
6. Use industry-standard formatting with clear sections.
7. Output the optimized resume in clean Markdown format.
8. At the end, add a brief "## Optimization Summary" section listing key changes made.

Respond ONLY with the optimized resume in Markdown. Do not include any preamble or explanation outside the Markdown content.`;

/* ──────────────────────────────────────────────────────────
   THEME — centralised color tokens
   ────────────────────────────────────────────────────────── */
const T = {
  bg:          "#0B0F1A",
  card:        "#111827",
  cardBorder:  "#1E293B",
  inputBg:     "#0F172A",
  accent:      "#38BDF8",       // sky-400
  accentDim:   "rgba(56,189,248,0.12)",
  accent2:     "#A78BFA",       // violet-400
  textPrimary: "#F1F5F9",       // slate-100
  textBody:    "#CBD5E1",       // slate-300
  textMuted:   "#94A3B8",       // slate-400
  textDim:     "#64748B",       // slate-500
  error:       "#F87171",
  errorBg:     "rgba(248,113,113,0.08)",
  success:     "#4ADE80",
};

/* ──────────────────────────────────────────────────────────
   UTILITY: Simple Markdown → HTML renderer
   ────────────────────────────────────────────────────────── */
function renderMarkdown(md) {
  if (!md) return "";
  let html = md
    .replace(/```(\w*)\n([\s\S]*?)```/g,
      `<pre style="background:${T.inputBg};padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;border:1px solid ${T.cardBorder}"><code>$2</code></pre>`)
    .replace(/`([^`]+)`/g,
      `<code style="background:${T.cardBorder};padding:2px 6px;border-radius:4px;font-size:13px">$1</code>`)
    .replace(/^#### (.+)$/gm, `<h4 style="font-size:14px;font-weight:700;margin:20px 0 8px;color:${T.textPrimary}">$1</h4>`)
    .replace(/^### (.+)$/gm,  `<h3 style="font-size:16px;font-weight:700;margin:24px 0 10px;color:${T.textPrimary}">$1</h3>`)
    .replace(/^## (.+)$/gm,   `<h2 style="font-size:20px;font-weight:700;margin:28px 0 12px;color:${T.accent};border-bottom:1px solid ${T.cardBorder};padding-bottom:8px">$1</h2>`)
    .replace(/^# (.+)$/gm,    `<h1 style="font-size:26px;font-weight:800;margin:0 0 16px;color:${T.textPrimary}">$1</h1>`)
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${T.textPrimary}">$1</strong>`)
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[\-\*] (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
    .replace(/^---$/gm, `<hr style="border:none;border-top:1px solid ${T.cardBorder};margin:24px 0"/>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="color:${T.accent};text-decoration:underline">$1</a>`)
    .replace(/^(?!<[hlpuoa]|<li|<pre|<hr|<code|<strong|<em)(.+)$/gm, '<p style="margin:6px 0;line-height:1.7">$1</p>');
  html = html.replace(/((?:<li[^>]*>.*<\/li>\s*)+)/g, '<ul style="list-style:disc;padding-left:24px;margin:8px 0">$1</ul>');
  return html;
}

/* ──────────────────────────────────────────────────────────
   UTILITY: Read uploaded file as text (PDF / MD / TXT)
   ────────────────────────────────────────────────────────── */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (file.name.endsWith(".pdf")) {
      reader.onload = (e) => {
        try {
          const bytes = new Uint8Array(e.target.result);
          const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
          const matches = raw.match(/\(([^)]{1,500})\)/g);
          let text = matches ? matches.map(m => m.slice(1, -1)).join(" ") : "";
          if (text.trim().length < 50) {
            text = raw.replace(/[^\x20-\x7E\n\r\t\u4e00-\u9fff\u3000-\u303f]/g, " ")
              .replace(/\s{3,}/g, "\n").trim();
          }
          resolve(text || "[PDF text extraction failed — please try pasting the content as plain text]");
        } catch { reject(new Error("Failed to read PDF file")); }
      };
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsText(file);
    }
  });
}

/* ──────────────────────────────────────────────────────────
   UTILITY: Download as PDF via print dialog
   ────────────────────────────────────────────────────────── */
function downloadAsPdf(htmlContent, filename = "optimized-resume.pdf") {
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow pop-ups to download the PDF"); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title>
<style>body{font-family:'Segoe UI',sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1a1a1a;line-height:1.7;font-size:14px}
h1{font-size:24px;border-bottom:2px solid #0891b2;padding-bottom:8px}h2{font-size:18px;color:#0e7490;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}
h3{font-size:15px;margin-top:16px}ul{padding-left:24px}li{margin:4px 0}strong{color:#111}
code{background:#f1f5f9;padding:2px 5px;border-radius:3px;font-size:13px}pre{background:#f1f5f9;padding:12px;border-radius:6px;font-size:13px;overflow-x:auto}
a{color:#0891b2}@media print{body{margin:20px}}</style></head><body>${htmlContent}</body></html>`);
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
    <div style={{ background: T.card, borderColor: T.cardBorder }} className="rounded-2xl border overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 transition-colors hover:brightness-110">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: saved ? T.accentDim : "rgba(251,146,60,0.12)" }}>
            {saved ? <KeyRound size={16} color={T.accent} /> : <Settings size={16} color="#fb923c" />}
          </div>
          <span className="font-semibold text-sm" style={{ color: T.textPrimary }}>
            API Settings
            {saved && <span className="ml-2 text-xs font-normal" style={{ color: T.accent }}> Connected</span>}
          </span>
        </div>
        {open ? <ChevronUp size={16} color={T.textMuted} /> : <ChevronDown size={16} color={T.textMuted} />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1">
          <p className="text-xs mb-3" style={{ color: T.textMuted }}>
            <Info size={12} className="inline mr-1 -mt-0.5" />
            Your API Key is stored only in your browser's LocalStorage and is never sent to any third-party server.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input type={showKey ? "text" : "password"} value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setSaved(false); }}
                placeholder="sk-ant-api03-..."
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-sky-400/50"
                style={{ background: T.inputBg, border: `1px solid ${T.cardBorder}`, color: T.textPrimary }} />
              <button onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: T.textMuted }}>
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            <button onClick={handleSave}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-95"
              style={{ background: T.accent, color: T.bg }}>Save</button>
            {apiKey && (
              <button onClick={handleClear} className="px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
                style={{ color: T.error }}><Trash2 size={16} /></button>
            )}
          </div>
          {saved && (
            <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: T.success }}>
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
    if (!["pdf", "md", "txt", "markdown"].includes(ext)) { setError("Only PDF / Markdown / TXT files are supported"); return; }
    setError(""); setFile(f); setReading(true);
    try { setResumeText(await readFileAsText(f)); } catch (err) { setError(err.message); }
    setReading(false);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold flex items-center gap-2" style={{ color: T.textPrimary }}>
        <Upload size={15} color={T.accent} /> Upload Resume
      </label>
      <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        className="relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all"
        style={{ borderColor: dragging ? T.accent : T.cardBorder, background: dragging ? T.accentDim : "transparent" }}>
        <input ref={inputRef} type="file" accept=".pdf,.md,.txt,.markdown" className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])} />
        {reading ? (
          <Loader2 size={28} className="mx-auto animate-spin" color={T.accent} />
        ) : file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText size={28} color={T.accent} />
            <p className="text-sm font-medium" style={{ color: T.textPrimary }}>{file.name}</p>
            <p className="text-xs" style={{ color: T.textMuted }}>{(file.size / 1024).toFixed(1)} KB · Click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} color={T.textDim} />
            <p className="text-sm" style={{ color: T.textBody }}>
              Drag & drop or <span style={{ color: T.accent }}>click to upload</span>
            </p>
            <p className="text-xs" style={{ color: T.textMuted }}>Supports PDF / Markdown / TXT</p>
          </div>
        )}
      </div>
      {error && <p className="text-xs flex items-center gap-1.5" style={{ color: T.error }}><AlertCircle size={13} /> {error}</p>}
      <details>
        <summary className="text-xs cursor-pointer select-none" style={{ color: T.textMuted }}>Or paste resume text directly ▾</summary>
        <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} rows={6}
          placeholder="Paste your resume content here..."
          className="mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none resize-y transition-all focus:ring-2 focus:ring-sky-400/50"
          style={{ background: T.inputBg, border: `1px solid ${T.cardBorder}`, color: T.textPrimary, minHeight: "120px" }} />
      </details>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   COMPONENT: Result Preview Panel
   ────────────────────────────────────────────────────────── */
function ResultPanel({ result, loading }) {
  const [copied, setCopied] = useState(false);
  const copyMd = () => { navigator.clipboard.writeText(result).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  if (loading) {
    return (
      <div className="rounded-2xl border p-10 flex flex-col items-center justify-center gap-4"
        style={{ borderColor: T.cardBorder, background: T.card, minHeight: "300px" }}>
        <div className="relative">
          <Loader2 size={36} className="animate-spin" color={T.accent} />
          <Sparkles size={14} className="absolute -top-1 -right-1 animate-pulse" color={T.accent2} />
        </div>
        <p className="text-sm font-medium" style={{ color: T.textBody }}>AI is optimizing your resume...</p>
        <p className="text-xs" style={{ color: T.textMuted }}>This usually takes 15–30 seconds</p>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="rounded-2xl border p-10 flex flex-col items-center justify-center gap-3"
        style={{ borderColor: T.cardBorder, background: T.card, minHeight: "300px" }}>
        <Bot size={40} color={T.cardBorder} />
        <p className="text-sm" style={{ color: T.textMuted }}>Your optimized resume will appear here</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: T.cardBorder, background: T.card }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: T.cardBorder }}>
        <div className="flex items-center gap-2">
          <Eye size={15} color={T.accent} />
          <span className="text-sm font-semibold" style={{ color: T.textPrimary }}>Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyMd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
            style={{ color: T.textMuted }}>
            {copied ? <Check size={13} color={T.success} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy Markdown"}
          </button>
          <button onClick={() => downloadAsPdf(renderMarkdown(result))}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110 active:scale-95"
            style={{ background: T.accentDim, color: T.accent }}>
            <Download size={13} /> Download PDF
          </button>
        </div>
      </div>
      <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: "600px", color: T.textBody }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   COMPONENT: LinkedIn Job Search Panel
   ────────────────────────────────────────────────────────── */
function LinkedInSearchPanel({ setJd }) {
  const [open, setOpen] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filledIdx, setFilledIdx] = useState(null);

  const handleSearch = async () => {
    if (!keywords.trim()) return;
    setError(""); setJobs([]); setLoading(true); setFilledIdx(null);
    try {
      const params = new URLSearchParams({ keywords: keywords.trim(), limit: "10" });
      if (location.trim()) params.set("location", location.trim());
      const res = await fetch(`http://localhost:8080/api/jobs?${params}`);
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setJobs(data);
      if (data.length === 0) setError("No jobs found. Try different keywords.");
    } catch (err) {
      if (err.name === "TypeError") {
        setError('Could not connect to the local job search server. Run: cd backend && python -m uvicorn main:app --reload --port 8080');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFillJd = (job, idx) => {
    setJd(job.description);
    setFilledIdx(idx);
  };

  return (
    <div style={{ background: T.card, borderColor: T.cardBorder }} className="rounded-2xl border overflow-hidden">
      {/* Header toggle */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 transition-colors hover:brightness-110">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(167,139,250,0.12)" }}>
            <Briefcase size={16} color={T.accent2} />
          </div>
          <span className="font-semibold text-sm" style={{ color: T.textPrimary }}>
            LinkedIn Job Search
            {jobs.length > 0 && (
              <span className="ml-2 text-xs font-normal" style={{ color: T.accent2 }}>
                {jobs.length} results
              </span>
            )}
          </span>
        </div>
        {open ? <ChevronUp size={16} color={T.textMuted} /> : <ChevronDown size={16} color={T.textMuted} />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-4">
          {/* Search inputs */}
          <div className="flex gap-2 flex-wrap">
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Job title or keywords (e.g. Senior React Engineer)"
              className="flex-1 min-w-[200px] rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-violet-400/50"
              style={{ background: T.inputBg, border: `1px solid ${T.cardBorder}`, color: T.textPrimary }}
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Location (optional)"
              className="w-44 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-violet-400/50"
              style={{ background: T.inputBg, border: `1px solid ${T.cardBorder}`, color: T.textPrimary }}
            />
            <button
              onClick={handleSearch}
              disabled={!keywords.trim() || loading}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ background: T.accent2, color: "#fff" }}>
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Searching...</>
                : <><Search size={15} /> Search Jobs</>}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 flex items-start gap-2.5 text-sm"
              style={{ background: T.errorBg, border: `1px solid rgba(248,113,113,0.2)`, color: "#fecaca" }}>
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" color={T.error} />
              <p style={{ color: T.error }}>{error}</p>
              <button onClick={() => setError("")} className="ml-auto"><X size={13} color={T.error} /></button>
            </div>
          )}

          {/* Results */}
          {jobs.length > 0 && (
            <div className="space-y-3">
              {jobs.map((job, idx) => (
                <div key={idx} className="rounded-xl border p-4 space-y-2"
                  style={{ borderColor: T.cardBorder, background: T.inputBg }}>
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: T.textPrimary }}>{job.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: T.textBody }}>{job.company}</p>
                    </div>
                    {job.job_type && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: T.accentDim, color: T.accent }}>{job.job_type}</span>
                    )}
                  </div>
                  {/* Meta row */}
                  <div className="flex flex-wrap gap-3 text-xs" style={{ color: T.textMuted }}>
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
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: T.textMuted }}>
                      "{job.description}"
                    </p>
                  )}
                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleFillJd(job, idx)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110 active:scale-95"
                      style={{ background: filledIdx === idx ? "rgba(74,222,128,0.12)" : T.accentDim, color: filledIdx === idx ? T.success : T.accent }}>
                      {filledIdx === idx ? <><Check size={12} /> Filled</> : <><FileText size={12} /> Fill JD</>}
                    </button>
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
                      style={{ color: T.textMuted, border: `1px solid ${T.cardBorder}` }}>
                      <ExternalLink size={12} /> View on LinkedIn
                    </a>
                  </div>
                </div>
              ))}
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
    const userMessage = `## Job Description\n\n${jd.trim()}\n\n---\n\n## Current Resume\n\n${resumeText.trim()}`;
    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || "";
        if (res.status === 401) throw new Error("Invalid or expired API Key. Please check and update it.");
        if (res.status === 429) throw new Error("Too many requests. Please try again later." + (msg ? ` (${msg})` : ""));
        if (res.status === 400 && msg.toLowerCase().includes("token")) throw new Error("Input is too long. Please shorten your resume or JD and try again.");
        throw new Error(`API error (${res.status}): ${msg || "Unknown error"}`);
      }
      const data = await res.json();
      const text = data.content?.map(b => b.type === "text" ? b.text : "").join("") || "";
      if (!text.trim()) throw new Error("AI returned an empty response. Please try again.");
      setResult(text);
    } catch (err) {
      setError(err.name === "TypeError" && err.message.includes("fetch")
        ? "Network error — the browser may be blocking the request due to CORS. Try running locally or use a proxy." : err.message);
    } finally { setLoading(false); }
  }, [apiKey, jd, resumeText]);

  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleOptimize(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [handleOptimize]);

  const canSubmit = apiKey.trim() && jd.trim() && resumeText.trim() && !loading;

  return (
    <div className="min-h-screen" style={{ background: T.bg, color: T.textBody }}>

      {/* Soft ambient glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: `radial-gradient(circle, ${T.accent} 0%, transparent 70%)`, opacity: 0.06, filter: "blur(140px)" }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full"
          style={{ background: `radial-gradient(circle, ${T.accent2} 0%, transparent 70%)`, opacity: 0.05, filter: "blur(140px)" }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b" style={{ borderColor: T.cardBorder }}>
        <div className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, #0284C7, ${T.accent2})` }}>
              <Star size={20} color="#fff" fill="#fff" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight"
                style={{ color: T.textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>
                Resume Star
              </h1>
              <p className="text-xs" style={{ color: T.textMuted }}>Powered by Claude · AI-driven JD keyword matching</p>
            </div>
          </div>
          <a href="https://docs.anthropic.com/en/api/getting-started" target="_blank" rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: T.textMuted, border: `1px solid ${T.cardBorder}` }}>
            API Docs ↗
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 max-w-6xl mx-auto px-5 py-8">
        <div className="mb-4"><ApiKeyPanel apiKey={apiKey} setApiKey={setApiKey} /></div>
        <div className="mb-8"><LinkedInSearchPanel setJd={setJd} /></div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — Inputs */}
          <div className="space-y-6">
            <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: T.cardBorder, background: T.card }}>
              <label className="text-sm font-semibold flex items-center gap-2" style={{ color: T.textPrimary }}>
                <FileText size={15} color={T.accent2} /> Job Description
              </label>
              <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={10}
                placeholder={"Paste the target job description here...\n\nExample:\nWe are looking for a Senior Frontend Engineer with 5+ years of experience in React, TypeScript..."}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-y transition-all focus:ring-2 focus:ring-violet-400/50"
                style={{ background: T.inputBg, border: `1px solid ${T.cardBorder}`, color: T.textPrimary, minHeight: "200px" }} />
              {jd.length > 0 && <p className="text-xs text-right" style={{ color: T.textMuted }}>{jd.length} chars</p>}
            </div>

            <div className="rounded-2xl border p-5" style={{ borderColor: T.cardBorder, background: T.card }}>
              <FileUploadArea file={file} setFile={setFile} resumeText={resumeText} setResumeText={setResumeText} />
              {resumeText && (
                <p className="mt-3 text-xs" style={{ color: T.textMuted }}>
                  <CheckCircle2 size={12} className="inline mr-1" color={T.success} /> {resumeText.length} characters extracted
                </p>
              )}
            </div>

            <button onClick={handleOptimize} disabled={!canSubmit}
              className="w-full py-4 rounded-2xl text-base font-bold transition-all flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99]"
              style={{
                background: canSubmit ? `linear-gradient(135deg, #0284C7, ${T.accent2})` : T.cardBorder,
                color: canSubmit ? "#fff" : T.textDim,
                boxShadow: canSubmit ? `0 4px 24px ${T.accentDim}` : "none",
              }}>
              {loading ? <><Loader2 size={18} className="animate-spin" /> Optimizing...</> : <><Sparkles size={18} /> Optimize with AI</>}
            </button>
            <p className="text-center text-xs" style={{ color: T.textDim }}>⌘ / Ctrl + Enter to submit</p>

            {error && (
              <div className="rounded-xl px-4 py-3 flex items-start gap-2.5 text-sm"
                style={{ background: T.errorBg, border: `1px solid rgba(248,113,113,0.2)`, color: "#fecaca" }}>
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" color={T.error} />
                <div>
                  <p className="font-medium" style={{ color: T.error }}>Error</p>
                  <p className="mt-0.5">{error}</p>
                </div>
                <button onClick={() => setError("")} className="ml-auto flex-shrink-0 mt-0.5"><X size={14} color={T.error} /></button>
              </div>
            )}
          </div>

          {/* Right — Output */}
          <div><ResultPanel result={result} loading={loading} /></div>
        </div>

        {/* Tips */}
        <div className="mt-12 rounded-2xl border p-6" style={{ borderColor: T.cardBorder, background: T.card }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: T.textMuted }}>
            <Sparkles size={14} /> Tips
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs" style={{ color: T.textMuted }}>
            <p><strong style={{ color: T.textBody }}>Precise Matching</strong> — Paste the full JD content; AI will automatically extract key skills and qualifications to align your resume.</p>
            <p><strong style={{ color: T.textBody }}>Quantify Achievements</strong> — If your resume includes metrics or data, AI will prioritize and strengthen those quantified accomplishments.</p>
            <p><strong style={{ color: T.textBody }}>Iterate Often</strong> — Reuse the same resume against different JDs to generate tailored versions for each application.</p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t mt-12 py-6 text-center text-xs"
        style={{ borderColor: T.cardBorder, color: T.textMuted }}>
        Resume Star · Your API Key is stored locally in your browser · No personal data is collected
      </footer>
    </div>
  );
}
