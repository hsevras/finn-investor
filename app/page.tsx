"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  ArrowLeft,
  Bell,
  BookOpen,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Command,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Volume2,
  X,
  Briefcase,
  Activity,
  Inbox,
  Download,
  Trash2,
  Info,
  Clock,
  Filter,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  COMPANIES,
  company,
  CATEGORY_LABELS,
  DEFAULT_SETTINGS,
} from "../lib/finn/universe";
import { quoteStats } from "../lib/finn/engine";
import type {
  Signal,
  Filing,
  Quote,
  Settings,
  Snapshot,
  ResearchPack,
  Evidence,
} from "../lib/finn/types";

type Tab = "briefing" | "research" | "portfolio" | "saved";
type Brief = {
  settings: Settings;
  savedItems: Signal[];
  snapshot: Snapshot;
  signals: Signal[];
  filings: Filing[];
  sourceStatus: string;
  start: string;
  end: string;
  coverage: {
    prices: number;
    companies: number;
    filings: number;
    routine: number;
  };
};
type Answer = {
  answer: string;
  evidence: Evidence[];
  question: string;
  mode: string;
  limitations: string[];
};
async function api(path: string, body?: unknown) {
  const r = await fetch("/api/finn/" + path, {
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = (await r.json()) as any;
  if (!r.ok)
    throw new Error(data.error ?? "The request could not be completed.");
  return data;
}
function shortDate(value: string, withTime = false) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
function price(n: number) {
  return (
    "₹" +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
function initials(s: string) {
  return s
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}
function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={"brand " + (small ? "brand-small" : "")}>
      <span className="brand-mark">
        <svg width="23" height="27" viewBox="0 0 24 28" fill="none">
          <path d="M3 3h18v6H9v5h9v6H9v7H3V3Z" fill="currentColor" />
          <path d="m15 2 7 7" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
      <span>
        finn<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
function Avatar({
  symbol,
  size = "normal",
}: {
  symbol: string;
  size?: string;
}) {
  const c = company(symbol);
  return (
    <span
      className={"avatar " + size}
      style={{ background: c.color + "16", color: c.color }}
    >
      {initials(symbol)}
    </span>
  );
}
function Sparkline({ quote }: { quote?: Quote }) {
  if (!quote || quote.bars.length < 2)
    return <span className="muted small">No data</span>;
  const b = quote.bars.slice(-25),
    min = Math.min(...b.map((x) => x.close)),
    max = Math.max(...b.map((x) => x.close)),
    d = b
      .map(
        (v, i) =>
          `${(i * 96) / (b.length - 1)},${30 - ((v.close - min) / (max - min || 1)) * 25}`,
      )
      .join(" "),
    positive = b.at(-1)!.close >= b[0].close;
  return (
    <svg
      className="sparkline"
      width="96"
      height="36"
      viewBox="0 0 96 36"
      aria-label="Last 25 trading sessions"
    >
      <polyline
        points={d}
        fill="none"
        stroke={positive ? "#3f8c73" : "#b96c5e"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SourceTag({ text = "Primary source" }: { text?: string }) {
  return (
    <span className="source-tag">
      <ShieldCheck size={12} />
      {text}
    </span>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <CheckCircle2 size={26} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function EvidenceCard({ e, index }: { e: Evidence; index: number }) {
  return (
    <article className="evidence">
      <div className="evidence-top">
        <span className="e-index">E{index + 1}</span>
        <span>
          {e.type === "annual_report"
            ? "Annual report"
            : e.type === "transcript"
              ? "Earnings call"
              : "Exchange filing"}
        </span>
        <a href={`${e.url}#page=${e.page}`} target="_blank" rel="noreferrer">
          Page {e.page}
          <ArrowUpRight size={13} />
        </a>
      </div>
      <p>{e.text}</p>
      <div className="evidence-bottom">
        <span>{e.title}</span>
        <SourceTag />
      </div>
    </article>
  );
}
export default function Finn() {
  const [tab, setTab] = useState<Tab>("briefing"),
    [brief, setBrief] = useState<Brief | null>(null),
    [hours, setHours] = useState(24),
    [loading, setLoading] = useState(true),
    [syncing, setSyncing] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [filter, setFilter] = useState("all"),
    [showRoutine, setShowRoutine] = useState(false),
    [showRules, setShowRules] = useState(false),
    [showSources, setShowSources] = useState(false),
    [showInbox, setShowInbox] = useState(false),
    [inbox, setInbox] = useState<(Signal & { readAt: number | null })[]>([]),
    [selected, setSelected] = useState<Signal | null>(null),
    [filingData, setFilingData] = useState<{
      evidence: Evidence[];
      document: { status: string; error?: string };
    } | null>(null),
    [filingBusy, setFilingBusy] = useState(false);
  const [symbol, setSymbol] = useState("INFY"),
    [tickerInput, setTickerInput] = useState(""),
    [pack, setPack] = useState<ResearchPack | null>(null),
    [packStatus, setPackStatus] = useState(""),
    [researchBusy, setResearchBusy] = useState(false),
    [researchError, setResearchError] = useState(""),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState<Answer | null>(null),
    [asking, setAsking] = useState(false),
    [researchView, setResearchView] = useState("overview"),
    [addInput, setAddInput] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [ruleDraft, setRuleDraft] = useState(DEFAULT_SETTINGS.rules);
  const researchSeq = useRef(0),
    filingSeq = useRef(0),
    inputRef = useRef<HTMLInputElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const d = await api(`briefing?hours=${hours}`);
        setBrief(d);
        setError("");
        const i = await api("inbox");
        setInbox(i.items);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [hours],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const mins = brief?.settings.rules.pollMinutes ?? 5;
    const id = setInterval(() => {
      if (document.visibilityState === "visible")
        void api("monitor", {})
          .then(() => load(true))
          .catch(() => {});
    }, mins * 60000);
    return () => clearInterval(id);
  }, [brief?.settings.rules.pollMinutes, load]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setSelected(null);
        setShowRules(false);
        setShowSources(false);
        setShowInbox(false);
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!showRules && !showSources && !showInbox && !selected && !searchOpen)
      return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector(
      "[role=dialog]",
    ) as HTMLElement | null;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, select, [tabindex="0"]',
        ) ?? [],
      ).filter((e) => e.offsetParent !== null);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (!first) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [showRules, showSources, showInbox, selected, searchOpen]);
  const openResearch = useCallback(async (next: string, refresh = false) => {
    const seq = ++researchSeq.current;
    setTab("research");
    setSymbol(next.toUpperCase().replace(/\.NS$/, ""));
    setResearchBusy(true);
    setAsking(false);
    setResearchError("");
    setPack(null);
    setAnswer(null);
    setResearchView("overview");
    try {
      const r = await api(
        `research?symbol=${encodeURIComponent(next)}${refresh ? "&refresh=1" : ""}`,
      );
      if (seq === researchSeq.current) {
        setPack(r.pack);
        setPackStatus(r.status);
      }
    } catch (e) {
      if (seq === researchSeq.current) setResearchError((e as Error).message);
    } finally {
      if (seq === researchSeq.current) setResearchBusy(false);
    }
  }, []);
  async function saveSettings(settings: Settings, message?: string) {
    setSaving(true);
    try {
      await api("settings", settings);
      await load(true);
      if (message) notify(message);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function sync() {
    setSyncing(true);
    try {
      const r = await api("sync", {});
      await load(true);
      notify(
        r.errors.length
          ? `${r.livePrices} price series refreshed; ${r.errors.length} source requests unavailable. View data status.`
          : "Prices and exchange filings refreshed.",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }
  async function saveSignal(s: Signal) {
    if (!brief) return;
    const saved = brief.settings.saved.includes(s.id)
      ? brief.settings.saved.filter((id) => id !== s.id)
      : [...brief.settings.saved, s.id];
    await saveSettings(
      { ...brief.settings, saved },
      saved.includes(s.id)
        ? "Saved to your reading list."
        : "Removed from saved.",
    );
  }
  async function inspect(s: Signal) {
    const seq = ++filingSeq.current;
    setSelected(s);
    setFilingBusy(false);
    setFilingData(null);
    if (s.filing) {
      setFilingBusy(true);
      try {
        const data = await api("filing?id=" + s.filing.id);
        if (seq === filingSeq.current) setFilingData(data);
      } catch (e) {
        notify((e as Error).message);
      } finally {
        if (seq === filingSeq.current) setFilingBusy(false);
      }
    }
  }
  async function ask(q = question) {
    if (q.trim().length < 3) return;
    const seq = researchSeq.current;
    setQuestion(q);
    setAsking(true);
    setAnswer(null);
    try {
      const data = await api("ask", { symbol, question: q });
      if (seq !== researchSeq.current) return;
      setAnswer(data);
      setResearchView("answer");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      if (seq === researchSeq.current) setAsking(false);
    }
  }
  async function addCompany(ticker = addInput) {
    if (!brief || !ticker.trim()) return;
    const s = ticker.trim().toUpperCase().replace(/\.NS$/, "");
    if (brief.settings.symbols.includes(s)) {
      notify("That company is already in your portfolio.");
      return;
    }
    const ok = await saveSettings(
      { ...brief.settings, symbols: [...brief.settings.symbols, s] },
      `${s} added. Refresh sources to collect its EOD data.`,
    );
    if (ok) setAddInput("");
  }
  const signals = brief?.signals ?? [],
    settings = brief?.settings ?? DEFAULT_SETTINGS;
  const visible = signals.filter(
    (s) =>
      filter === "all" ||
      (filter === "filings"
        ? s.kind === "filing"
        : filter === "market"
          ? s.kind !== "filing"
          : s.filing?.category === filter),
  );
  const savedSignals = signals.filter((s) => settings.saved.includes(s.id));
  const allSaved = brief?.savedItems ?? [];
  const routine = brief?.filings.filter((f) => f.score < 40) ?? [];
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });
  const unread = inbox.filter((i) => !i.readAt).length;
  const navs: { key: Tab; label: string; icon: typeof Activity }[] = [
    { key: "briefing", label: "The briefing", icon: LayoutDashboard },
    { key: "research", label: "Research", icon: Search },
    { key: "portfolio", label: "My portfolio", icon: Briefcase },
    { key: "saved", label: "Saved for later", icon: Bookmark },
  ];
  function goTab(t: Tab) {
    if (t === "research" && !pack && !researchBusy) void openResearch(symbol);
    else setTab(t);
  }
  function SignalCard({ s, lead = false }: { s: Signal; lead?: boolean }) {
    return (
      <article className={"signal-card " + (lead ? "lead" : "")}>
        <div className="signal-card-top">
          <div className="company-line">
            <Avatar symbol={s.symbol} />
            <span>
              <strong>{company(s.symbol).name}</strong>
              <small>{s.symbol} · NSE</small>
            </span>
          </div>
          <button
            className={
              "icon-button save " +
              (settings.saved.includes(s.id) ? "active" : "")
            }
            disabled={saving}
            onClick={() => saveSignal(s)}
            aria-label={
              settings.saved.includes(s.id) ? "Unsave signal" : "Save signal"
            }
          >
            <Bookmark
              size={17}
              fill={settings.saved.includes(s.id) ? "currentColor" : "none"}
            />
          </button>
        </div>
        <div className="signal-meta">
          <span
            className={
              "pill " +
              (s.score >= 88 ? "amber" : s.kind === "filing" ? "sage" : "blue")
            }
          >
            {s.filing
              ? CATEGORY_LABELS[s.filing.category]
              : s.kind === "price"
                ? "Price move"
                : "Volume spike"}
          </span>
          <span>{shortDate(s.date, true)}</span>
        </div>
        <button className="signal-title" onClick={() => inspect(s)}>
          <h3>{s.title}</h3>
        </button>
        <p className="signal-summary">{s.detail}</p>
        <div className="why">
          <span className="why-label">
            <Sparkles size={12} />
            WHY IT MATTERS
          </span>
          <p>
            {s.kind === "filing"
              ? s.reason
              : s.kind === "volume"
                ? "Activity is above your usual baseline. Check for a fresh disclosure before drawing a conclusion."
                : "The move crossed your watch threshold. Read the filings; price alone doesn’t explain why."}
          </p>
        </div>
        <div className="signal-footer">
          <SourceTag
            text={s.kind === "filing" ? "NSE disclosure" : "EOD market data"}
          />
          <button className="text-button" onClick={() => inspect(s)}>
            Take a closer look
            <ArrowUpRight size={15} />
          </button>
        </div>
      </article>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <div className="workspace-label">YOUR INVESTMENT WORKSPACE</div>
        <nav>
          {navs.map((n) => (
            <button
              key={n.key}
              className={tab === n.key ? "nav-item active" : "nav-item"}
              onClick={() => goTab(n.key)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.key === "briefing" && signals.length > 0 && (
                <span className="nav-count">{signals.length}</span>
              )}
              {n.key === "saved" && settings.saved.length > 0 && (
                <span className="nav-count muted-count">
                  {settings.saved.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-section">
          <span>YOUR WATCHLIST</span>
          <button
            aria-label="Manage watchlist"
            onClick={() => setTab("portfolio")}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="watchlist-mini">
          {settings.symbols.slice(0, 6).map((s) => {
            const st = brief?.snapshot.quotes[s]
              ? quoteStats(brief.snapshot.quotes[s])
              : null;
            return (
              <button key={s} onClick={() => openResearch(s)}>
                <span>
                  <i style={{ background: company(s).color }} />
                  {s}
                </span>
                <small
                  className={(st?.change ?? 0) >= 0 ? "positive" : "negative"}
                >
                  {st?.change !== null && st?.change !== undefined
                    ? `${st.change > 0 ? "+" : ""}${st.change.toFixed(1)}%`
                    : "—"}
                </small>
              </button>
            );
          })}
        </div>
        <button className="all-companies" onClick={() => setTab("portfolio")}>
          View all {settings.symbols.length} companies
          <ArrowRight size={13} />
        </button>
        <div className="sidebar-bottom">
          <div className="quiet-card">
            <span className="small-spark">
              <Sparkles size={16} />
            </span>
            <strong>
              Less noise.
              <br />
              More conviction.
            </strong>
            <p>Built around what deserves your attention.</p>
          </div>
          <button className="profile" onClick={() => setShowSources(true)}>
            <span className="profile-avatar">S</span>
            <span>
              <strong>My workspace</strong>
              <small>Personal portfolio</small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <Logo small />
          </div>
          <div className="breadcrumb">
            Workspace
            <ChevronRight size={13} />
            <strong>{navs.find((n) => n.key === tab)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={15} />
              <span>Research any company</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button bell"
              onClick={async () => {
                setShowInbox(true);
                try {
                  await api("inbox/read", {});
                  setInbox(inbox.map((i) => ({ ...i, readAt: Date.now() })));
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
              aria-label="Open alerts"
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </button>
            <span className="top-avatar">S</span>
          </div>
        </header>
        <main>
          {error && (
            <div className="error-banner">
              <AlertCircle size={17} />
              <span>{error}</span>
              <button onClick={() => load()}>Retry</button>
            </div>
          )}
          {tab === "briefing" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">{today.toUpperCase()}</div>
                  <h1>
                    Your portfolio, in focus<span className="sage-dot">.</span>
                  </h1>
                  <p>
                    The changes worth your time. The context to act with
                    clarity.
                  </p>
                </div>
                <button
                  className="outline-button"
                  onClick={sync}
                  disabled={syncing || loading}
                >
                  <RefreshCw size={15} className={syncing ? "spin" : ""} />
                  {syncing ? "Refreshing sources…" : "Refresh sources"}
                </button>
              </div>
              <div className="brief-controls">
                <div className="control-left">
                  <span className="live-indicator">
                    <i />
                    {loading ? "Connecting…" : "Monitoring active"}
                  </span>
                  <span className="divider-v" />
                  <button
                    className="source-status"
                    onClick={() => setShowSources(true)}
                  >
                    {brief
                      ? `Source cache · ${shortDate(brief.snapshot.fetchedAt, true)} IST`
                      : "Loading sources"}
                    <Info size={12} />
                  </button>
                </div>
                <div className="control-right">
                  <select
                    aria-label="Digest time window"
                    value={hours}
                    onChange={(e) => setHours(+e.target.value)}
                  >
                    <option value={24}>Last 24 hours</option>
                    <option value={72}>Last 3 days</option>
                    <option value={168}>Last 7 days</option>
                    <option value={720}>Last 30 days</option>
                  </select>
                  <button
                    className="outline-button compact"
                    onClick={() => {
                      setRuleDraft(structuredClone(settings.rules));
                      setShowRules(true);
                    }}
                  >
                    <SlidersHorizontal size={14} />
                    Your rules
                  </button>
                </div>
              </div>
              <section className="focus-banner">
                <div className="focus-illustration">
                  <svg
                    viewBox="0 0 200 130"
                    width="200"
                    height="130"
                    aria-hidden="true"
                  >
                    <path
                      d="M15 100h170M45 22v87M82 22v87M119 22v87M156 22v87"
                      stroke="#aac8b8"
                      strokeWidth=".6"
                    />
                    <path
                      d="m16 92 30-12 29 8 24-32 26 10 25-35 31-7"
                      fill="none"
                      stroke="#6b987d"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M83 112V72m15 40V48m15 64V62m15 50V38m15 74V20"
                      stroke="#9bbda8"
                      strokeWidth="10"
                    />
                    <circle
                      cx="150"
                      cy="31"
                      r="17"
                      fill="#e6efe4"
                      stroke="#adc6b2"
                    />
                    <path
                      d="m142 33 5 5 10-12"
                      fill="none"
                      stroke="#335f45"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <div className="focus-content">
                  <div className="eyebrow">
                    <Sparkles size={14} />
                    THE ATTENTION BRIEF
                  </div>
                  <h2>
                    {loading
                      ? "Finding the signal…"
                      : signals.length
                        ? `${signals.length} signals. A quieter way to stay ahead.`
                        : "Nothing crossed your thresholds."}
                  </h2>
                  <p>
                    {loading
                      ? "Checking your portfolio against your rules."
                      : `${brief?.coverage.companies ?? 18} companies watched. ${brief?.coverage.filings ?? 0} disclosures reviewed. ${brief?.coverage.routine ?? 0} routine updates kept out of your way.`}
                  </p>
                </div>
                <button
                  className="banner-action"
                  onClick={() =>
                    document
                      .getElementById("signals")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  See what changed
                  <ArrowDownRight size={16} />
                </button>
              </section>
              <section id="signals" className="signals-section">
                <div className="section-title-row">
                  <h2>
                    Worth your attention
                    <span className="count">{signals.length}</span>
                  </h2>
                  <div className="filter-tabs">
                    {[
                      ["all", "All signals"],
                      ["filings", "Filings"],
                      ["market", "Price & volume"],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        className={filter === v ? "active" : ""}
                        onClick={() => setFilter(v)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {loading && !brief ? (
                  <div className="signal-grid">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="skeleton" />
                    ))}
                  </div>
                ) : visible.length ? (
                  <div className="signal-grid">
                    {visible.slice(0, 6).map((s, i) => (
                      <SignalCard key={s.id} s={s} lead={i === 0} />
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="All quiet in this window"
                    detail="No disclosure or completed-session move crossed your current rules. Try a longer window to explore the portfolio."
                    action={
                      <button
                        className="outline-button"
                        onClick={() => setHours(168)}
                      >
                        View the last 7 days
                        <ArrowRight size={14} />
                      </button>
                    }
                  />
                )}
                {visible.length > 6 && (
                  <details className="more-signals">
                    <summary>
                      See {visible.length - 6} more signals
                      <ChevronDown size={16} />
                    </summary>
                    <div className="signal-grid">
                      {visible.slice(6).map((s) => (
                        <SignalCard key={s.id} s={s} />
                      ))}
                    </div>
                  </details>
                )}
              </section>
              <div className="below-grid">
                <section className="filing-log">
                  <div className="section-title-row">
                    <h2>
                      The filing desk
                      <span className="count">
                        {brief?.filings.length ?? 0}
                      </span>
                    </h2>
                    <span className="small muted">
                      Every disclosure. Nothing lost.
                    </span>
                  </div>
                  <div className="filing-list">
                    {brief?.filings
                      .filter((f) => f.score >= 40)
                      .slice(0, 5)
                      .map((f) => (
                        <button
                          className="filing-row"
                          key={f.id}
                          onClick={() =>
                            inspect({
                              id: "filing:" + f.id,
                              symbol: f.symbol,
                              kind: "filing",
                              title: f.subject,
                              detail: f.summary,
                              date: f.publishedAt,
                              score: f.score,
                              reason: f.reason,
                              filing: f,
                              url: f.url,
                            })
                          }
                        >
                          <Avatar symbol={f.symbol} size="mini" />
                          <span className="filing-text">
                            <strong>
                              {f.symbol}
                              <span className="category-small">
                                {CATEGORY_LABELS[f.category]}
                              </span>
                            </strong>
                            <span>{f.summary || f.subject}</span>
                          </span>
                          <span className="filing-date">
                            {shortDate(f.publishedAt)}
                          </span>
                          <ArrowUpRight size={15} />
                        </button>
                      ))}
                    {!brief?.filings.length && !loading && (
                      <p className="no-filings">
                        No portfolio filings in the selected window.
                      </p>
                    )}
                  </div>
                  {(brief?.filings.filter((f) => f.score >= 40).length ?? 0) >
                    5 && (
                    <details className="more-filings">
                      <summary>
                        See all{" "}
                        {brief?.filings.filter((f) => f.score >= 40).length}{" "}
                        prioritised filings
                      </summary>
                      {brief?.filings
                        .filter((f) => f.score >= 40)
                        .slice(5)
                        .map((f) => (
                          <a
                            className="routine-row"
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            key={f.id}
                          >
                            <span>{f.symbol}</span>
                            <span>{f.summary || f.subject}</span>
                            <ArrowUpRight size={13} />
                          </a>
                        ))}
                    </details>
                  )}
                  <button
                    className="routine-toggle"
                    onClick={() => setShowRoutine(!showRoutine)}
                  >
                    <FileText size={14} />
                    {showRoutine ? "Hide" : "Show"} {routine.length} routine
                    disclosures
                    <ChevronDown
                      size={14}
                      className={showRoutine ? "rotated" : ""}
                    />
                  </button>
                  {showRoutine &&
                    routine.map((f) => (
                      <a
                        className="routine-row"
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        key={f.id}
                      >
                        <span>{f.symbol}</span>
                        <span>{f.subject}</span>
                        <ArrowUpRight size={13} />
                      </a>
                    ))}
                </section>
                <aside className="research-prompt">
                  <span className="research-icon">
                    <BookOpen size={23} />
                  </span>
                  <div className="eyebrow">GO ONE LEVEL DEEPER</div>
                  <h2>
                    A question worth
                    <br />
                    asking.
                  </h2>
                  <p>
                    What did management say—and what does the primary evidence
                    actually show?
                  </p>
                  <button
                    onClick={() => {
                      void openResearch("INFY");
                    }}
                  >
                    Open the research desk
                    <ArrowRight size={16} />
                  </button>
                  <div className="source-icons">
                    <span>AR</span>
                    <span>CC</span>
                    <p>
                      Annual reports.
                      <br />
                      Earnings calls. Original sources.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {tab === "research" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">THE RESEARCH DESK</div>
                  <h1>
                    Conviction starts with evidence
                    <span className="sage-dot">.</span>
                  </h1>
                  <p>
                    Ask better questions. Follow the answer back to the source.
                  </p>
                </div>
                <SourceTag text="Primary sources only" />
              </div>
              <form
                className="research-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (tickerInput.trim()) void openResearch(tickerInput);
                }}
              >
                <Search size={19} />
                <input
                  aria-label="NSE ticker for research"
                  value={tickerInput}
                  onChange={(e) => setTickerInput(e.target.value)}
                  placeholder="Enter any NSE ticker — INFY, M&M, KPITTECH…"
                />
                <button
                  className="solid-button"
                  type="submit"
                  disabled={researchBusy}
                >
                  Research
                  <ArrowRight size={15} />
                </button>
              </form>
              <div className="suggested-tickers">
                <span>Try a company</span>
                {["INFY", "KPITTECH", "TRENT", "PERSISTENT"].map((s) => (
                  <button
                    className={s === symbol ? "active" : ""}
                    onClick={() => openResearch(s)}
                    key={s}
                  >
                    {s}
                    {s !== "INFY" && <small>outside portfolio</small>}
                  </button>
                ))}
              </div>
              {researchBusy ? (
                <div className="research-loading">
                  <Loader2 className="spin" size={28} />
                  <h3>Opening the primary evidence</h3>
                  <p>
                    Discovering reports and extracting readable text. A new
                    ticker may take a little longer.
                  </p>
                </div>
              ) : researchError ? (
                <Empty
                  title="This company needs another source route"
                  detail={researchError}
                  action={
                    <button
                      className="outline-button"
                      onClick={() => openResearch(symbol, true)}
                    >
                      Retry document discovery
                    </button>
                  }
                />
              ) : (
                pack && (
                  <>
                    <div className="company-research-header">
                      <Avatar symbol={symbol} size="large" />
                      <div>
                        <div className="eyebrow">{symbol} · NSE</div>
                        <h2>{pack.name || company(symbol).name}</h2>
                        <div className="small muted">
                          {
                            pack.documents.filter((d) => d.status === "ready")
                              .length
                          }{" "}
                          documents readable · source cache{" "}
                          {shortDate(pack.fetchedAt)} ·{" "}
                          {packStatus === "live"
                            ? "freshly retrieved"
                            : "dated evidence cache"}
                        </div>
                      </div>
                      <button
                        className="outline-button"
                        onClick={() =>
                          brief && !settings.symbols.includes(symbol)
                            ? addCompany(symbol)
                            : setTab("portfolio")
                        }
                      >
                        <Plus size={14} />
                        {settings.symbols.includes(symbol)
                          ? "In your portfolio"
                          : "Watch company"}
                      </button>
                    </div>
                    <div className="research-tabs">
                      {[
                        ["overview", "Evidence overview"],
                        ["sources", "Source library"],
                        ["answer", "Your research"],
                      ].map(([v, l]) => (
                        <button
                          className={researchView === v ? "active" : ""}
                          onClick={() => setResearchView(v)}
                          key={v}
                        >
                          {l}
                          {v === "sources" && (
                            <span>{pack.documents.length}</span>
                          )}
                        </button>
                      ))}
                      <button
                        className="refresh-docs"
                        onClick={() => openResearch(symbol, true)}
                      >
                        <RefreshCw size={13} />
                        Refresh documents
                      </button>
                    </div>
                    {researchView === "overview" && (
                      <>
                        <section className="research-hero">
                          <div className="eyebrow">
                            <ShieldCheck size={14} />
                            EVIDENCE, BEFORE OPINION
                          </div>
                          <h2>
                            Start with the question
                            <br />
                            behind the numbers.
                          </h2>
                          <p>
                            Search the company’s own reports and earnings calls.
                            Every passage keeps its document, page and original
                            link.
                          </p>
                          <div className="research-chips">
                            {[
                              "How does the business make money?",
                              "Is profit turning into cash?",
                              "What has management guided?",
                              "What are the key risks?",
                            ].map((q) => (
                              <button
                                key={q}
                                onClick={() => ask(q)}
                                disabled={asking}
                              >
                                {q}
                                <ArrowUpRight size={14} />
                              </button>
                            ))}
                          </div>
                        </section>
                        <div className="evidence-topics">
                          {[
                            {
                              icon: Briefcase,
                              label: "Business & trajectory",
                              q: "business segments products revenue growth",
                            },
                            {
                              icon: Activity,
                              label: "Cash & balance sheet",
                              q: "cash flow debt receivables working capital",
                            },
                            {
                              icon: TrendingUp,
                              label: "Guidance & expectations",
                              q: "management guidance outlook revenue margin expectations",
                            },
                          ].map((t) => (
                            <button
                              key={t.label}
                              onClick={() => ask(t.q)}
                              disabled={asking}
                            >
                              <t.icon size={19} />
                              <strong>{t.label}</strong>
                              <p>
                                {t.q ===
                                "business segments products revenue growth"
                                  ? "What drives the business and its direction."
                                  : t.label.startsWith("Cash")
                                    ? "Follow the money behind reported profit."
                                    : "Read what management put on the record."}
                              </p>
                              <span>
                                Explore evidence
                                <ArrowRight size={14} />
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {researchView === "sources" && (
                      <div className="source-library">
                        <div className="source-library-head">
                          <h2>The source of truth</h2>
                          <p>
                            Screener is used to discover links. Analysis uses
                            only the underlying issuer or exchange documents.
                          </p>
                          <a
                            href={pack.discoveryUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open document index
                            <ExternalLink size={14} />
                          </a>
                        </div>
                        {pack.documents.map((d) => (
                          <div className="document-row" key={d.id}>
                            <span className="document-icon">
                              <FileText size={23} />
                            </span>
                            <div>
                              <strong>{d.title}</strong>
                              <span>
                                {d.type === "annual_report"
                                  ? "Annual report"
                                  : "Management transcript"}{" "}
                                ·{" "}
                                {d.status === "ready"
                                  ? `${d.pages} pages extracted`
                                  : d.status === "failed"
                                    ? d.error
                                    : "Discovered; not loaded yet"}
                              </span>
                            </div>
                            <span className={"doc-status " + d.status}>
                              {d.status === "ready"
                                ? "Readable"
                                : d.status === "failed"
                                  ? "Unavailable"
                                  : "Not loaded"}
                            </span>
                            {d.status !== "ready" && (
                              <button
                                className="outline-button compact"
                                disabled={researchBusy}
                                onClick={async () => {
                                  setResearchBusy(true);
                                  try {
                                    const r = await api("document", {
                                      symbol,
                                      id: d.id,
                                    });
                                    setPack(r.pack);
                                    notify(
                                      r.pack.documents.find(
                                        (x: { id: string }) => x.id === d.id,
                                      )?.status === "ready"
                                        ? "Document loaded."
                                        : "The source could not be read. Its status has been updated.",
                                    );
                                  } catch (e) {
                                    notify((e as Error).message);
                                  } finally {
                                    setResearchBusy(false);
                                  }
                                }}
                              >
                                Load
                              </button>
                            )}
                            <a
                              className="icon-button"
                              href={d.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={"Open " + d.title}
                            >
                              <ArrowUpRight size={18} />
                            </a>
                          </div>
                        ))}
                        <div className="research-limits">
                          <Info size={16} />
                          <div>
                            {pack.warnings.map((w, i) => (
                              <p key={i}>{w}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {researchView === "answer" &&
                      (answer ? (
                        <div className="answer-view">
                          <div className="answer-question">
                            <span className="eyebrow">YOUR QUESTION</span>
                            <h2>{answer.question}</h2>
                          </div>
                          <div className="answer-summary">
                            <div className="eyebrow">
                              <Sparkles size={14} />
                              {answer.mode === "synthesised"
                                ? "GROUNDED SYNTHESIS"
                                : answer.mode === "abstained"
                                  ? "EVIDENCE GAP"
                                  : "EVIDENCE RETRIEVAL"}
                            </div>
                            <p>{answer.answer}</p>
                            <div className="small muted">
                              {answer.mode === "extractive"
                                ? "No model key needed. Original passages, ranked by relevance."
                                : answer.mode === "synthesised"
                                  ? "AI synthesis — review against the passages below."
                                  : ""}
                            </div>
                          </div>
                          <div className="section-title-row">
                            <h2>
                              Follow the evidence
                              <span className="count">
                                {answer.evidence.length}
                              </span>
                            </h2>
                            <button
                              className="text-button"
                              onClick={() => {
                                const text =
                                  `# ${symbol}: ${answer.question}\n\n${answer.answer}\n\n` +
                                  answer.evidence
                                    .map(
                                      (e, i) =>
                                        `[E${i + 1}] ${e.title}, p.${e.page}\n${e.text}\n${e.url}#page=${e.page}\n`,
                                    )
                                    .join("\n");
                                const blob = new Blob([text], {
                                  type: "text/markdown",
                                });
                                const url = URL.createObjectURL(blob),
                                  a = document.createElement("a");
                                a.href = url;
                                a.download = `FINN-${symbol}-evidence.md`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                            >
                              Export note
                              <Download size={14} />
                            </button>
                          </div>
                          <div className="evidence-grid">
                            {answer.evidence.map((e, i) => (
                              <EvidenceCard key={e.id} e={e} index={i} />
                            ))}
                          </div>
                          <p className="small muted limitations">
                            {answer.limitations.join(" ")}
                          </p>
                        </div>
                      ) : (
                        <Empty
                          title="Your next question starts here"
                          detail="Ask about the business, cash quality, balance sheet or management guidance. The answer will stay attached to its evidence."
                        />
                      ))}
                    <form
                      className="ask-bar"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void ask();
                      }}
                    >
                      <span className="ask-icon">
                        <Sparkles size={18} />
                      </span>
                      <input
                        aria-label="Research question"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        maxLength={600}
                        placeholder={`Ask the primary sources about ${symbol}…`}
                      />
                      <button
                        type="submit"
                        className="solid-button"
                        disabled={asking || question.trim().length < 3}
                      >
                        {asking ? (
                          <Loader2 size={17} className="spin" />
                        ) : (
                          <ArrowUpRight size={19} />
                        )}
                        <span>{asking ? "Searching…" : "Ask FINN"}</span>
                      </button>
                    </form>
                  </>
                )
              )}
            </>
          )}
          {tab === "portfolio" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR CIRCLE OF ATTENTION</div>
                  <h1>
                    A portfolio worth knowing<span className="sage-dot">.</span>
                  </h1>
                  <p>
                    {settings.symbols.length} companies across sectors. Every
                    company has a place in the briefing.
                  </p>
                </div>
                <button
                  className="outline-button"
                  onClick={() => {
                    setRuleDraft(structuredClone(settings.rules));
                    setShowRules(true);
                  }}
                >
                  <Settings2 size={15} />
                  Alert rules
                </button>
              </div>
              <div className="portfolio-stats">
                <div>
                  <span>Companies watched</span>
                  <strong>
                    {settings.symbols.length}
                    <small>/ 30 max</small>
                  </strong>
                </div>
                <div>
                  <span>EOD data available</span>
                  <strong>
                    {brief?.coverage.prices ?? 0}
                    <small>companies</small>
                  </strong>
                </div>
                <div>
                  <span>Price move alert</span>
                  <strong>
                    ±{settings.rules.pricePercent}
                    <small>% in a session</small>
                  </strong>
                </div>
                <div>
                  <span>Volume alert</span>
                  <strong>
                    {settings.rules.volumeMultiple}
                    <small>× prior 20-day mean</small>
                  </strong>
                </div>
              </div>
              <form
                className="add-company"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addCompany();
                }}
              >
                <Plus size={17} />
                <input
                  aria-label="Add NSE ticker"
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value)}
                  placeholder="Add any NSE ticker, e.g. M&M"
                />
                <button
                  className="solid-button"
                  disabled={saving || settings.symbols.length >= 30}
                >
                  Add company
                </button>
              </form>
              <div className="portfolio-table">
                <div className="portfolio-table-head">
                  <span>COMPANY</span>
                  <span>25 SESSIONS</span>
                  <span>LAST CLOSE</span>
                  <span>1D CHANGE</span>
                  <span>VOLUME</span>
                  <span />
                </div>
                {settings.symbols.map((s) => {
                  const q = brief?.snapshot.quotes[s],
                    st = q ? quoteStats(q) : null;
                  return (
                    <div className="portfolio-row" key={s}>
                      <button
                        className="company-line"
                        onClick={() => openResearch(s)}
                      >
                        <Avatar symbol={s} />
                        <span>
                          <strong>{company(s).name}</strong>
                          <small>
                            {s} · {company(s).sector}
                          </small>
                        </span>
                      </button>
                      <Sparkline quote={q} />
                      <div className="table-price">
                        {st?.last ? price(st.last.close) : "—"}
                        <small>
                          {st?.last
                            ? shortDate(st.last.date)
                            : "Refresh to collect"}
                        </small>
                      </div>
                      <div
                        className={
                          (st?.change ?? 0) >= 0 ? "positive" : "negative"
                        }
                      >
                        {st?.change !== null && st?.change !== undefined
                          ? `${st.change >= 0 ? "+" : ""}${st.change.toFixed(2)}%`
                          : "—"}
                      </div>
                      <div>
                        {st?.volumeRatio
                          ? st.volumeRatio.toFixed(2) + "×"
                          : "—"}
                      </div>
                      <button
                        className="icon-button remove"
                        disabled={saving || settings.symbols.length === 1}
                        aria-label={"Remove " + s}
                        onClick={() =>
                          saveSettings(
                            {
                              ...settings,
                              symbols: settings.symbols.filter((x) => x !== s),
                            },
                            s + " removed.",
                          )
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="small muted footnote">
                Quotes are end-of-day, not live trading prices. Volume compares
                the latest complete session with the previous 20 sessions. Last
                close uses the adjusted historical series.
              </p>
            </>
          )}
          {tab === "saved" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">A LITTLE SPACE TO THINK</div>
                  <h1>
                    Come back with fresh eyes<span className="sage-dot">.</span>
                  </h1>
                  <p>Your saved disclosures stay here for a closer read.</p>
                </div>
              </div>
              {allSaved.length ? (
                <div className="signal-grid">
                  {allSaved.map((s) => (
                    <SignalCard key={s.id} s={s} />
                  ))}
                </div>
              ) : (
                <Empty
                  title="Keep what deserves another look"
                  detail="Tap the bookmark on a signal to add it to your reading list. Saved items appear here while their source is retained."
                  action={
                    <button
                      className="outline-button"
                      onClick={() => setTab("briefing")}
                    >
                      Back to the briefing
                      <ArrowRight size={14} />
                    </button>
                  }
                />
              )}
            </>
          )}
          <footer className="footer">
            <span>
              <span className="footer-logo">finn.</span> A little less noise. A
              little more perspective.
            </span>
            <button onClick={() => setShowSources(true)}>
              <ShieldCheck size={13} />
              Data & methodology
            </button>
          </footer>
        </main>
        <nav className="mobile-nav">
          {navs.map((n) => (
            <button
              key={n.key}
              className={tab === n.key ? "active" : ""}
              onClick={() => goTab(n.key)}
            >
              <n.icon size={20} />
              <span>
                {n.key === "briefing"
                  ? "Briefing"
                  : n.key === "portfolio"
                    ? "Portfolio"
                    : n.key === "saved"
                      ? "Saved"
                      : "Research"}
              </span>
            </button>
          ))}
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Close notification">
            <X size={14} />
          </button>
        </div>
      )}
      {showRules && (
        <div className="modal-backdrop" onClick={() => setShowRules(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Alert rules"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">MAKE IT YOURS</div>
                <h2>Your definition of unusual.</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowRules(false)}
                aria-label="Close alert rules"
              >
                <X size={20} />
              </button>
            </div>
            <p className="modal-intro">
              FINN watches the portfolio. You decide what gets through.
            </p>
            <label className="rule-slider">
              <span>
                <strong>Daily price move</strong>
                <b>±{ruleDraft.pricePercent}%</b>
              </span>
              <input
                type="range"
                min="0.5"
                max="15"
                step="0.5"
                value={ruleDraft.pricePercent}
                onChange={(e) =>
                  setRuleDraft({ ...ruleDraft, pricePercent: +e.target.value })
                }
              />
              <small>Absolute change between completed trading sessions.</small>
            </label>
            <label className="rule-slider">
              <span>
                <strong>Unusual volume</strong>
                <b>{ruleDraft.volumeMultiple}×</b>
              </span>
              <input
                type="range"
                min="1.1"
                max="5"
                step="0.1"
                value={ruleDraft.volumeMultiple}
                onChange={(e) =>
                  setRuleDraft({
                    ...ruleDraft,
                    volumeMultiple: +e.target.value,
                  })
                }
              />
              <small>
                Latest session ÷ average of the previous 20 sessions.
              </small>
            </label>
            <div className="rule-categories">
              <h3>Announcements that deserve a tap</h3>
              <div>
                {Object.entries(CATEGORY_LABELS)
                  .filter(([key]) => key !== "unclassified")
                  .map(([key, label]) => (
                    <button
                      key={key}
                      className={
                        ruleDraft.categories.includes(key as never)
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        setRuleDraft({
                          ...ruleDraft,
                          categories: ruleDraft.categories.includes(
                            key as never,
                          )
                            ? ruleDraft.categories.filter((c) => c !== key)
                            : [...ruleDraft.categories, key as never],
                        })
                      }
                    >
                      {ruleDraft.categories.includes(key as never) && (
                        <Check size={12} />
                      )}{" "}
                      {label}
                    </button>
                  ))}
              </div>
            </div>
            <div className="poll-rule">
              <Clock size={16} />
              <span>Check while this app is open</span>
              <select
                aria-label="Polling interval"
                value={ruleDraft.pollMinutes}
                onChange={(e) =>
                  setRuleDraft({ ...ruleDraft, pollMinutes: +e.target.value })
                }
              >
                <option value="1">Every minute</option>
                <option value="5">Every 5 minutes</option>
                <option value="15">Every 15 minutes</option>
              </select>
            </div>
            <div className="rule-note">
              An in-app inbox collects matched events once per company and
              session. Closed-app background checks require the scheduler
              described in the deployment guide.
            </div>
            <button
              className="solid-button full"
              disabled={saving}
              onClick={async () => {
                if (
                  await saveSettings(
                    { ...settings, rules: ruleDraft },
                    "Your rules are saved. The briefing has been recalculated.",
                  )
                )
                  setShowRules(false);
              }}
            >
              {saving ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Save my rules
            </button>
          </section>
        </div>
      )}
      {showSources && (
        <div className="modal-backdrop" onClick={() => setShowSources(false)}>
          <section
            className="modal data-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Data and methodology"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">SHOW YOUR WORK</div>
                <h2>Know what you’re looking at.</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowSources(false)}
                aria-label="Close data status"
              >
                <X size={20} />
              </button>
            </div>
            <div className="data-status-row">
              <Activity size={20} />
              <div>
                <strong>Prices & volume · Yahoo Finance</strong>
                <p>
                  {brief?.coverage.prices ?? 0}/{settings.symbols.length}{" "}
                  portfolio series. Completed sessions only; adjusted historical
                  close. Each company retains its own source timestamp.
                </p>
              </div>
              <span className="pill sage">EOD</span>
            </div>
            <div className="data-status-row">
              <FileText size={20} />
              <div>
                <strong>Corporate disclosures · NSE</strong>
                <p>
                  Latest successful coverage:{" "}
                  {brief ? shortDate(brief.snapshot.windowStart) : "—"} to{" "}
                  {brief ? shortDate(brief.snapshot.windowEnd, true) : "—"} IST.
                  Original exchange IDs and publication times are retained.
                </p>
              </div>
              <span className="pill sage">Primary</span>
            </div>
            <div className="data-status-row">
              <BookOpen size={20} />
              <div>
                <strong>Research · annual reports & calls</strong>
                <p>
                  Screener discovers links. Only underlying issuer or exchange
                  PDFs enter retrieval. No broker notes or news are used for
                  pull research.
                </p>
              </div>
              <span className="pill sage">Primary</span>
            </div>
            <div className="methodology">
              <h3>How the briefing earns its order</h3>
              <p>
                Deterministic category rules put regulatory events, financial
                results and leadership changes first. Routine paperwork stays
                accessible in the filing desk. Market alerts use your
                thresholds. Scores are triage rules, not investment
                recommendations.
              </p>
              <h3>Honest about the gaps</h3>
              <p>
                The initial view uses a real, dated cache, not synthetic
                financials. Refresh attempts live sources; unavailable providers
                retain dated data and report errors. Primary PDF text can be
                unavailable or scanned. Research abstains when evidence is
                absent. A free-tier Groq key optionally adds cited synthesis;
                default research ranks original evidence.
              </p>
              <h3>Monitoring</h3>
              <p>
                While open, the app checks for new filings at your interval and
                generates a persistent, deduplicated inbox. Prices refresh on
                demand. Unattended monitoring needs the supplied Worker
                scheduler configuration. This private prototype stores your
                watchlist and rules on the server.
              </p>
            </div>
            {!!brief?.snapshot.errors.length && (
              <div className="source-errors">
                <strong>Latest collection issues</strong>
                {brief.snapshot.errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      {selected && (
        <div
          className="modal-backdrop drawer-backdrop"
          onClick={() => setSelected(null)}
        >
          <section
            className="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Signal details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-top">
              <button className="text-button" onClick={() => setSelected(null)}>
                <ArrowLeft size={16} />
                Back to the briefing
              </button>
              <button
                className="icon-button"
                onClick={() => saveSignal(selected)}
                aria-label="Save this signal"
              >
                <Bookmark size={18} />
              </button>
            </div>
            <div className="company-line">
              <Avatar symbol={selected.symbol} />
              <span>
                <strong>{company(selected.symbol).name}</strong>
                <small>{selected.symbol} · NSE</small>
              </span>
            </div>
            <div className="signal-meta">
              <span className="pill sage">
                {selected.filing
                  ? CATEGORY_LABELS[selected.filing.category]
                  : "EOD market signal"}
              </span>
              <span>{shortDate(selected.date, true)} IST</span>
            </div>
            <h2>{selected.title}</h2>
            <p className="drawer-summary">{selected.detail}</p>
            <div className="why">
              <span className="why-label">
                <Sparkles size={12} />
                WHY THIS SURFACED
              </span>
              <p>{selected.reason}</p>
            </div>
            <a
              className="solid-button full"
              href={selected.url}
              target="_blank"
              rel="noreferrer"
            >
              Open original source
              <ExternalLink size={15} />
            </a>
            {selected.filing && (
              <div className="drawer-evidence">
                <h3>Inside the filing</h3>
                <p className="small muted">
                  Source excerpts, with page links. Financial tables retain
                  their original context.
                </p>
                {filingBusy ? (
                  <div className="inline-loading">
                    <Loader2 className="spin" size={19} />
                    Reading the primary filing…
                  </div>
                ) : filingData?.evidence.length ? (
                  filingData.evidence.map((e, i) => (
                    <EvidenceCard key={e.id} e={e} index={i} />
                  ))
                ) : (
                  <div className="unavailable">
                    <Info size={17} />
                    <p>
                      {filingData?.document.error ??
                        "No readable evidence is available. Open the original filing to inspect its contents."}{" "}
                      No numbers have been inferred.
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="drawer-actions">
              <button
                className="outline-button"
                onClick={() => {
                  setSelected(null);
                  void openResearch(selected.symbol);
                }}
              >
                Research this company
                <ArrowRight size={14} />
              </button>
              <button
                className="text-button muted"
                onClick={async () => {
                  await saveSettings(
                    {
                      ...settings,
                      dismissed: [...settings.dismissed, selected.id],
                    },
                    "Signal marked as reviewed.",
                  );
                  setSelected(null);
                }}
              >
                <CheckCheck size={15} />
                Mark reviewed
              </button>
            </div>
          </section>
        </div>
      )}
      {showInbox && (
        <div
          className="modal-backdrop drawer-backdrop"
          onClick={() => setShowInbox(false)}
        >
          <section
            className="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Alerts inbox"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">FINN IS KEEPING WATCH</div>
                <h2>Your alert inbox.</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowInbox(false)}
                aria-label="Close inbox"
              >
                <X size={20} />
              </button>
            </div>
            <p className="muted">
              Threshold matches from the last day are delivered once, then
              retained here.
            </p>
            {inbox.length ? (
              inbox.map((s) => (
                <button
                  className="inbox-row"
                  key={s.id}
                  onClick={() => {
                    setShowInbox(false);
                    void inspect(s);
                  }}
                >
                  <Avatar symbol={s.symbol} />
                  <span>
                    <strong>
                      {s.symbol} · {s.title}
                    </strong>
                    <small>{shortDate(s.date, true)} IST</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))
            ) : (
              <Empty
                title="No new alerts"
                detail="Your inbox fills when a watched disclosure or completed-session move crosses your rules."
              />
            )}
          </section>
        </div>
      )}
      {searchOpen && (
        <div
          className="modal-backdrop search-backdrop"
          onClick={() => setSearchOpen(false)}
        >
          <section
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Research any company"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (tickerInput.trim()) {
                  setSearchOpen(false);
                  void openResearch(tickerInput);
                }
              }}
            >
              <Search size={21} />
              <input
                autoFocus
                ref={inputRef}
                aria-label="Search NSE ticker"
                placeholder="Enter any NSE ticker…"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
              >
                <X size={18} />
              </button>
            </form>
            <div className="search-suggestions">
              <span className="eyebrow">
                {tickerInput ? "MATCHING COMPANIES" : "A GOOD PLACE TO START"}
              </span>
              {COMPANIES.filter(
                (c) =>
                  !tickerInput ||
                  c.symbol.includes(tickerInput.toUpperCase()) ||
                  c.name.toLowerCase().includes(tickerInput.toLowerCase()),
              )
                .slice(0, 6)
                .map((c) => (
                  <button
                    key={c.symbol}
                    onClick={() => {
                      setSearchOpen(false);
                      void openResearch(c.symbol);
                    }}
                  >
                    <Avatar symbol={c.symbol} />
                    <span>
                      <strong>{c.name}</strong>
                      <small>
                        {c.symbol} · {c.sector}
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              {tickerInput && (
                <button
                  className="search-any"
                  onClick={() => {
                    setSearchOpen(false);
                    void openResearch(tickerInput);
                  }}
                >
                  Research “{tickerInput.toUpperCase()}” beyond the demo set
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
