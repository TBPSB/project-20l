import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";

const GOAL = 2000000;
const TABS = ["🏠 War Room", "📊 Analytics", "🎯 Goals", "💰 Finance", "🤝 Leads", "🎨 Creator Studio", "🤖 AI Assistant"];
const NICHES = ["Motivational / Quotes", "Fitness / Health", "Business / Money", "Entertainment / Memes", "Fashion / Lifestyle", "Food / Recipes", "Travel", "Technology", "Education", "Comedy / Memes"];

function fmt(n) {
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return "₹" + (n / 1000).toFixed(1) + "K";
  return "₹" + n;
}
function num(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

const defaultState = {
  finance: { earned: 0, paid: 0 },
  analytics: {
    accounts: [],
    linkedin: { followers: 0, reach: 0, views: 0 },
    facebook: { followers: 0, reach: 0, views: 0 },
  },
  leads: [],
  goals: { monthly: "", weekly: "" },
  tasks: [],
};

export default function Home() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState(0);
  const [state, setState] = useState(defaultState);
  const [newTask, setNewTask] = useState("");
  const [newLead, setNewLead] = useState({ name: "", value: "", status: "Contacted" });
  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", content: "Hey! I'm your anonymous AI assistant. Goal: ₹20 Lakh this year. Ask me anything — what to post, how to grow, what to do next. 💪" }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatRef = useRef(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("p20l");
      if (saved) setState(JSON.parse(saved));
    } catch {}
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem("p20l", JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [aiMessages]);

  const { finance, analytics, leads, goals, tasks } = state;
  const set = (key, val) => setState(s => ({ ...s, [key]: typeof val === "function" ? val(s[key]) : val }));
  const [newAccount, setNewAccount] = useState({ platform: "instagram", nickname: "" });

  const pct = Math.min((finance.earned / GOAL) * 100, 100).toFixed(1);
  const left = GOAL - finance.earned;
  const due = finance.earned - finance.paid;
  const monthsLeft = Math.max(1, 12 - new Date().getMonth());

  const accounts = analytics.accounts || [];
  const igAccounts = accounts.filter(a => a.platform === "instagram");
  const ytAccounts = accounts.filter(a => a.platform === "youtube");
  const totalFollowers = (p) => accounts.filter(a => a.platform === p).reduce((s, a) => s + (a.followers || a.subscribers || 0), 0);

  const [postIdeas, setPostIdeas] = useState({});
  const [generatingIdeas, setGeneratingIdeas] = useState({});
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [generatedPost, setGeneratedPost] = useState(null);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [lastIdeaDate, setLastIdeaDate] = useState({});

  // Auto-generate ideas on load for each IG account
  useEffect(() => {
    const today = new Date().toDateString();
    igAccounts && igAccounts.forEach(acc => {
      if (lastIdeaDate[acc.id] !== today && acc.niche) {
        generateIdeas(acc, true);
      }
    });
  }, [analytics.accounts]);

  async function generateIdeas(acc, auto = false) {
    if (!acc.niche) return;
    setGeneratingIdeas(g => ({ ...g, [acc.id]: true }));
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a viral Instagram content strategist. Generate exactly 3 unique, trending post ideas for today for a ${acc.niche} niche Instagram page. 
Return ONLY a JSON array with 3 objects, each having: "title" (5-7 words), "hook" (first line that stops scroll), "format" (Reel/Carousel/Quote/Infographic).
Example: [{"title":"...","hook":"...","format":"Reel"}]
No extra text, no markdown, just the JSON array.`,
          messages: [{ role: "user", content: `Generate 3 fresh Instagram post ideas for ${new Date().toDateString()} for a ${acc.niche} page called @${acc.nickname}.` }]
        })
      });
      const data = await res.json();
      const text = data.content?.map(c => c.text || "").join("") || "[]";
      const clean = text.replace(/```json|```/g, "").trim();
      const ideas = JSON.parse(clean);
      setPostIdeas(p => ({ ...p, [acc.id]: ideas }));
      if (auto) setLastIdeaDate(d => ({ ...d, [acc.id]: new Date().toDateString() }));
    } catch {
      setPostIdeas(p => ({ ...p, [acc.id]: [] }));
    }
    setGeneratingIdeas(g => ({ ...g, [acc.id]: false }));
  }

  async function generatePost(acc, idea) {
    setSelectedIdea({ acc, idea });
    setGeneratedPost(null);
    setGeneratingPost(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a viral Instagram content writer. Write a complete Instagram post for a ${acc.niche} page.
Return ONLY a JSON object with: "caption" (full caption with emojis, max 300 words), "hashtags" (30 relevant hashtags as a string), "cta" (call to action line).
No extra text, just JSON.`,
          messages: [{ role: "user", content: `Write a full Instagram post for this idea:\nTitle: ${idea.title}\nHook: ${idea.hook}\nFormat: ${idea.format}\nNiche: ${acc.niche}\nPage: @${acc.nickname}` }]
        })
      });
      const data = await res.json();
      const text = data.content?.map(c => c.text || "").join("") || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      const post = JSON.parse(clean);
      setGeneratedPost(post);
    } catch {
      setGeneratedPost({ caption: "Error generating post. Try again.", hashtags: "", cta: "" });
    }
    setGeneratingPost(false);
  }
  const [fetchError, setFetchError] = useState({});

  function addAccount() {
    if (!newAccount.nickname.trim()) return;
    const base = newAccount.platform === "youtube"
      ? { subscribers: 0, views: 0, watchHours: 0, channelId: "" }
      : { followers: 0, reach: 0, views: 0, profileUrl: "" };
    set("analytics", a => ({ ...a, accounts: [...(a.accounts || []), { ...base, ...newAccount, id: Date.now() }] }));
    setNewAccount(n => ({ ...n, nickname: "" }));
  }
  function updateAccount(id, field, value) {
    set("analytics", a => ({ ...a, accounts: a.accounts.map(x => x.id === id ? { ...x, [field]: value } : x) }));
  }
  function updateAccountNum(id, field, value) {
    set("analytics", a => ({ ...a, accounts: a.accounts.map(x => x.id === id ? { ...x, [field]: Number(value) || 0 } : x) }));
  }
  function deleteAccount(id) {
    set("analytics", a => ({ ...a, accounts: a.accounts.filter(x => x.id !== id) }));
  }

  async function fetchYouTube(acc) {
    if (!acc.channelId?.trim()) {
      setFetchError(e => ({ ...e, [acc.id]: "Enter a Channel ID first" }));
      return;
    }
    setFetchingId(acc.id);
    setFetchError(e => ({ ...e, [acc.id]: null }));
    try {
      const key = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${acc.channelId.trim()}&key=${key}`);
      const data = await res.json();
      const stats = data.items?.[0]?.statistics;
      if (!stats) throw new Error("Channel not found");
      set("analytics", a => ({
        ...a,
        accounts: a.accounts.map(x => x.id === acc.id ? {
          ...x,
          subscribers: Number(stats.subscriberCount) || 0,
          views: Number(stats.viewCount) || 0,
          watchHours: x.watchHours || 0,
          lastSynced: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        } : x)
      }));
    } catch (err) {
      setFetchError(e => ({ ...e, [acc.id]: "Failed to fetch. Check Channel ID." }));
    }
    setFetchingId(null);
  }

  async function sendAI() {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput("");
    const newMessages = [...aiMessages, { role: "user", content: userMsg }];
    setAiMessages(newMessages);
    setAiLoading(true);
    try {
      const context = `You are a private AI business assistant for an anonymous creator targeting ₹20 Lakh this year.
Stats: Earned ₹${finance.earned}, Paid ₹${finance.paid}, Left ₹${left}.
Instagram: ${analytics.instagram.followers} followers, ${analytics.instagram.reach} reach.
YouTube: ${analytics.youtube.subscribers} subs, ${analytics.youtube.views} views.
LinkedIn: ${analytics.linkedin.followers} followers. Facebook: ${analytics.facebook.followers} followers.
Active leads: ${leads.filter(l => l.status !== "Lost").length}. Tasks today: ${tasks.length}.
Be concise, actionable, and motivating. User is anonymous and wants to grow fast.`;
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          messages: newMessages.filter((_, i) => i > 0).map(m => ({ role: m.role, content: m.content }))
        }),
      });
      const data = await res.json();
      setAiMessages(m => [...m, { role: "assistant", content: data.reply || "Error. Try again." }]);
    } catch {
      setAiMessages(m => [...m, { role: "assistant", content: "Connection error. Try again." }]);
    }
    setAiLoading(false);
  }

  function addTask() {
    if (!newTask.trim()) return;
    set("tasks", t => [...t, { id: Date.now(), text: newTask.trim(), done: false }]);
    setNewTask("");
  }
  function toggleTask(id) {
    set("tasks", t => t.map(x => x.id === id ? { ...x, done: !x.done } : x));
  }
  function addLead() {
    if (!newLead.name.trim()) return;
    set("leads", l => [...l, { ...newLead, id: Date.now(), value: Number(newLead.value) || 0 }]);
    setNewLead({ name: "", value: "", status: "Contacted" });
  }
  function updateAnalytic(platform, field, value) {
    set("analytics", a => ({ ...a, [platform]: { ...a[platform], [field]: Number(value) || 0 } }));
  }


  const statuses = ["Contacted", "Negotiating", "Closed", "Lost"];
  const statusColor = { Contacted: "#3b82f6", Negotiating: "#f59e0b", Closed: "#10b981", Lost: "#ef4444" };

  const s = { // common input style
    bg: { background: "#1e1e3a", border: "1px solid #2d2d5a", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", outline: "none", width: "100%", boxSizing: "border-box" }
  };

  if (status === "loading") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", color: "#a78bfa", fontSize: 18 }}>Loading...</div>
  );

  if (!session) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0f" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#a78bfa", marginBottom: 8 }}>Project 20L</div>
      <div style={{ color: "#64748b", marginBottom: 32, fontSize: 14 }}>Your anonymous creator command center</div>
      <button onClick={() => signIn("google")} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
        🔐 Sign in with Google
      </button>
      <div style={{ color: "#334155", fontSize: 12, marginTop: 16 }}>Only your account can access this</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter',sans-serif", fontSize: 14 }}>
      {/* Header */}
      <div style={{ background: "#0f0f1a", borderBottom: "1px solid #1e1e3a", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#a78bfa" }}>⚡ Project 20L</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>Anonymous Mode • {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Goal Progress</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#a78bfa" }}>{pct}%</div>
          </div>
          <button onClick={() => signOut()} style={{ background: "#1e1e3a", border: "1px solid #2d2d5a", color: "#94a3b8", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Sign Out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", overflowX: "auto", background: "#0f0f1a", borderBottom: "1px solid #1e1e3a" }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding: "10px 16px", border: "none", background: "none", cursor: "pointer", whiteSpace: "nowrap",
            color: tab === i ? "#a78bfa" : "#64748b", borderBottom: tab === i ? "2px solid #a78bfa" : "2px solid transparent",
            fontWeight: tab === i ? 700 : 400, fontSize: 13
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>

        {/* WAR ROOM */}
        {tab === 0 && <>
          <div style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>₹20 Lakh Mission</span>
              <span style={{ color: "#a78bfa", fontWeight: 700 }}>{fmt(finance.earned)} / ₹20L</span>
            </div>
            <div style={{ background: "#1e1e3a", borderRadius: 99, height: 12, marginBottom: 8 }}>
              <div style={{ background: "linear-gradient(90deg,#7c3aed,#a78bfa)", width: pct + "%", height: "100%", borderRadius: 99, transition: "width 0.5s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
              <span>Left: {fmt(left)}</span><span>Due from clients: {fmt(due)}</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Instagram Followers", val: num(totalFollowers("instagram")), icon: "📸", color: "#e1306c" },
              { label: "YouTube Subs", val: num(totalFollowers("youtube")), icon: "▶️", color: "#ff0000" },
              { label: "LinkedIn", val: num(analytics.linkedin.followers), icon: "💼", color: "#0077b5" },
              { label: "Facebook", val: num(analytics.facebook.followers), icon: "📘", color: "#1877f2" },
              { label: "Total Earned", val: fmt(finance.earned), icon: "💰", color: "#10b981" },
              { label: "Active Leads", val: leads.filter(l => l.status !== "Lost").length, icon: "🤝", color: "#f59e0b" },
            ].map((s, i) => (
              <div key={i} style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 20 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: "#a78bfa" }}>📋 Today's Tasks</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Add a task..." style={{ ...s.bg, flex: 1 }} />
              <button onClick={addTask} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600 }}>Add</button>
            </div>
            {tasks.length === 0 && <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: 12 }}>No tasks yet!</div>}
            {tasks.map(t => (
              <div key={t.id} onClick={() => toggleTask(t.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", borderBottom: "1px solid #1a1a2e" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (t.done ? "#7c3aed" : "#475569"), background: t.done ? "#7c3aed" : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {t.done && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
                </div>
                <span style={{ color: t.done ? "#475569" : "#e2e8f0", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
              </div>
            ))}
          </div>
        </>}

        {/* ANALYTICS */}
        {tab === 1 && <>
          {/* Add Account */}
          <div style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>➕ Add Account</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Platform</div>
                <select value={newAccount.platform} onChange={e => setNewAccount(n => ({ ...n, platform: e.target.value }))} style={{ ...s.bg, width: "auto", minWidth: "100%" }}>
                  <option value="instagram">📸 Instagram</option>
                  <option value="youtube">▶️ YouTube</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Nickname / Handle</div>
                <input value={newAccount.nickname} onChange={e => setNewAccount(n => ({ ...n, nickname: e.target.value }))} onKeyDown={e => e.key === "Enter" && addAccount()} placeholder="e.g. Main Channel, Niche Page..." style={s.bg} />
              </div>
              <button onClick={addAccount} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 600 }}>Add</button>
            </div>
          </div>

          {/* Instagram Accounts */}
          {igAccounts.length > 0 && <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: "#e1306c", fontSize: 15 }}>📸 Instagram Accounts</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Total: <span style={{ color: "#e1306c", fontWeight: 700 }}>{num(totalFollowers("instagram"))}</span></div>
            </div>
            {igAccounts.map(acc => (
              <div key={acc.id} style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, color: "#e1306c" }}>@{acc.nickname}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a href={acc.profileUrl || "https://www.instagram.com/"} target="_blank" rel="noreferrer"
                      style={{ background: "#e1306c22", color: "#e1306c", border: "1px solid #e1306c44", borderRadius: 6, padding: "4px 10px", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
                      📊 Open Insights
                    </a>
                    <button onClick={() => deleteAccount(acc.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>🗑</button>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Profile URL (for quick access)</div>
                  <input value={acc.profileUrl || ""} onChange={e => updateAccount(acc.id, "profileUrl", e.target.value)}
                    placeholder="https://instagram.com/yourpage" style={s.bg} />
                </div>
                <div style={{ background: "#1e1e3a", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#94a3b8" }}>
                  💡 Open Insights → copy Followers, Reach, Views → paste below. Takes 10 seconds!
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {["followers", "reach", "views"].map(f => (
                    <div key={f}>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "capitalize" }}>{f}</div>
                      <input type="number" value={acc[f] || 0} onChange={e => updateAccountNum(acc.id, f, e.target.value)} style={s.bg} />
                      <div style={{ fontSize: 12, color: "#e1306c", marginTop: 2, fontWeight: 700 }}>{num(acc[f] || 0)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>}

          {/* YouTube Accounts */}
          {ytAccounts.length > 0 && <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, marginTop: igAccounts.length > 0 ? 16 : 0 }}>
              <div style={{ fontWeight: 700, color: "#ff0000", fontSize: 15 }}>▶️ YouTube Channels</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Total subs: <span style={{ color: "#ff0000", fontWeight: 700 }}>{num(totalFollowers("youtube"))}</span></div>
            </div>
            {ytAccounts.map(acc => (
              <div key={acc.id} style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, color: "#ff0000" }}>📺 {acc.nickname}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {acc.lastSynced && <span style={{ fontSize: 11, color: "#64748b" }}>Synced {acc.lastSynced}</span>}
                    <button onClick={() => fetchYouTube(acc)} disabled={fetchingId === acc.id}
                      style={{ background: "#ff000022", color: "#ff0000", border: "1px solid #ff000044", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600, opacity: fetchingId === acc.id ? 0.6 : 1 }}>
                      {fetchingId === acc.id ? "⏳ Fetching..." : "🔄 Auto Sync"}
                    </button>
                    <button onClick={() => deleteAccount(acc.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>🗑</button>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>YouTube Channel ID</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={acc.channelId || ""} onChange={e => updateAccount(acc.id, "channelId", e.target.value)}
                      placeholder="e.g. UCxxxxxxxxxxxxxxxxxxxxxx" style={{ ...s.bg, flex: 1 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                    Find it: YouTube Studio → Customization → Basic Info → Channel ID
                  </div>
                  {fetchError[acc.id] && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>⚠️ {fetchError[acc.id]}</div>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {[["subscribers","Subscribers"],["views","Total Views"],["watchHours","Watch Hours"]].map(([f, label]) => (
                    <div key={f}>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
                      <input type="number" value={acc[f] || 0} onChange={e => updateAccountNum(acc.id, f, e.target.value)} style={s.bg} />
                      <div style={{ fontSize: 12, color: "#ff0000", marginTop: 2, fontWeight: 700 }}>{num(acc[f] || 0)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>}

          {accounts.length === 0 && (
            <div style={{ color: "#475569", textAlign: "center", padding: 40, fontSize: 13 }}>No accounts yet. Add your Instagram pages and YouTube channels above!</div>
          )}

          {/* LinkedIn & Facebook — single accounts */}
          <div style={{ marginTop: 16 }}>
            {[
              { key: "linkedin", label: "LinkedIn", icon: "💼", color: "#0077b5", fields: ["followers", "reach", "views"] },
              { key: "facebook", label: "Facebook", icon: "📘", color: "#1877f2", fields: ["followers", "reach", "views"] },
            ].map(p => (
              <div key={p.key} style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, color: p.color, marginBottom: 12, fontSize: 15 }}>{p.icon} {p.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {p.fields.map(f => (
                    <div key={f}>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "capitalize" }}>{f}</div>
                      <input type="number" value={analytics[p.key]?.[f] || 0} onChange={e => updateAnalytic(p.key, f, e.target.value)} style={s.bg} />
                      <div style={{ fontSize: 12, color: p.color, marginTop: 2, fontWeight: 700 }}>{num(analytics[p.key]?.[f] || 0)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* GOALS */}
        {tab === 2 && <>
          <div style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 4 }}>🎯 Annual Goal</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#10b981" }}>₹20,00,000</div>
            <div style={{ marginTop: 8, fontSize: 13, color: "#94a3b8" }}>Monthly target: <span style={{ color: "#f59e0b", fontWeight: 700 }}>₹1,66,667</span> &nbsp;•&nbsp; Weekly: <span style={{ color: "#f59e0b", fontWeight: 700 }}>₹38,462</span></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[["monthly", "📅 This Month's Goal"], ["weekly", "📆 This Week's Goal"]].map(([key, label]) => (
              <div key={key} style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: "#a78bfa" }}>{label}</div>
                <textarea value={goals[key]} onChange={e => set("goals", g => ({ ...g, [key]: e.target.value }))}
                  placeholder="Write your goal..." rows={3}
                  style={{ ...s.bg, resize: "none" }} />
              </div>
            ))}
          </div>
          <div style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>📊 Quarterly Progress</div>
            {[["Q1 Jan–Mar", 500000], ["Q2 Apr–Jun", 1000000], ["Q3 Jul–Sep", 1500000], ["Q4 Oct–Dec", 2000000]].map(([label, target]) => {
              const p = Math.min((finance.earned / target) * 100, 100).toFixed(0);
              return (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                    <span>{label}</span><span>{p}% of {fmt(target)}</span>
                  </div>
                  <div style={{ background: "#1e1e3a", borderRadius: 99, height: 8 }}>
                    <div style={{ background: Number(p) >= 100 ? "#10b981" : "linear-gradient(90deg,#7c3aed,#a78bfa)", width: p + "%", height: "100%", borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>}

        {/* FINANCE */}
        {tab === 3 && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            {[["Total Earned", fmt(finance.earned), "#10b981"], ["Total Paid", fmt(finance.paid), "#3b82f6"], ["Still Due", fmt(due), due > 0 ? "#f59e0b" : "#64748b"]].map(([label, val, color]) => (
              <div key={label} style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>✏️ Update Financials</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[["Total Earned (₹)", "earned", "#10b981"], ["Total Paid Out (₹)", "paid", "#3b82f6"]].map(([label, key, color]) => (
                <div key={key}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{label}</div>
                  <input type="number" value={finance[key]} onChange={e => set("finance", f => ({ ...f, [key]: Number(e.target.value) || 0 }))}
                    style={{ ...s.bg, color, fontSize: 16, fontWeight: 700 }} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>📈 To Hit ₹20L</div>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 2 }}>
              Still need: <span style={{ color: "#f59e0b", fontWeight: 700 }}>{fmt(left)}</span><br />
              Months left: <span style={{ color: "#a78bfa", fontWeight: 700 }}>{monthsLeft}</span><br />
              Required/month: <span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(Math.ceil(left / monthsLeft))}</span>
            </div>
          </div>
        </>}

        {/* LEADS */}
        {tab === 4 && <>
          <div style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>➕ Add New Lead</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Name / Brand</div>
                <input value={newLead.name} onChange={e => setNewLead(l => ({ ...l, name: e.target.value }))} placeholder="Brand XYZ" style={s.bg} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Value (₹)</div>
                <input type="number" value={newLead.value} onChange={e => setNewLead(l => ({ ...l, value: e.target.value }))} placeholder="50000" style={{ ...s.bg, width: 100 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Status</div>
                <select value={newLead.status} onChange={e => setNewLead(l => ({ ...l, status: e.target.value }))} style={{ ...s.bg, width: "auto" }}>
                  {statuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addLead} style={{ marginTop: 10, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 600, width: "100%" }}>Add Lead</button>
          </div>
          {leads.length === 0 && <div style={{ color: "#475569", textAlign: "center", padding: 32 }}>No leads yet. Start adding!</div>}
          {leads.map(l => (
            <div key={l.id} style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 10, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{l.name}</div>
                <div style={{ fontSize: 12, color: "#10b981" }}>{fmt(l.value)}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={l.status} onChange={e => set("leads", ls => ls.map(x => x.id === l.id ? { ...x, status: e.target.value } : x))}
                  style={{ background: "#1e1e3a", border: "1px solid #2d2d5a", borderRadius: 6, padding: "5px 8px", color: statusColor[l.status], outline: "none", fontSize: 12 }}>
                  {statuses.map(s => <option key={s}>{s}</option>)}
                </select>
                <button onClick={() => set("leads", ls => ls.filter(x => x.id !== l.id))} style={{ background: "#1e1e3a", border: "none", color: "#ef4444", borderRadius: 6, padding: "5px 8px", cursor: "pointer" }}>✕</button>
              </div>
            </div>
          ))}
          {leads.length > 0 && (
            <div style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 14, marginTop: 8, fontSize: 13, color: "#94a3b8" }}>
              Pipeline: <span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(leads.filter(l => l.status !== "Lost").reduce((a, l) => a + l.value, 0))}</span>
              &nbsp;•&nbsp; Closed: <span style={{ color: "#a78bfa", fontWeight: 700 }}>{fmt(leads.filter(l => l.status === "Closed").reduce((a, l) => a + l.value, 0))}</span>
            </div>
          )}
        </>}

        {/* CREATOR STUDIO */}
        {tab === 5 && <>
          {igAccounts.length === 0 && (
            <div style={{ color: "#475569", textAlign: "center", padding: 40, fontSize: 13 }}>
              No Instagram accounts added yet. Go to 📊 Analytics → Add an Instagram account first!
            </div>
          )}

          {igAccounts.map(acc => (
            <div key={acc.id} style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              {/* Account Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, color: "#e1306c", fontSize: 15 }}>📸 @{acc.nickname}</div>
                <button onClick={() => generateIdeas(acc)} disabled={generatingIdeas[acc.id]}
                  style={{ background: "#e1306c22", color: "#e1306c", border: "1px solid #e1306c44", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 12, opacity: generatingIdeas[acc.id] ? 0.6 : 1 }}>
                  {generatingIdeas[acc.id] ? "⏳ Generating..." : "🔄 Generate New Ideas"}
                </button>
              </div>

              {/* Niche Selector */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Page Niche</div>
                <select value={acc.niche || ""} onChange={e => { updateAccount(acc.id, "niche", e.target.value); }}
                  style={{ ...s.bg, width: "auto", minWidth: 220 }}>
                  <option value="">-- Select Niche --</option>
                  {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              {/* Today's Ideas */}
              {generatingIdeas[acc.id] && (
                <div style={{ color: "#a78bfa", fontSize: 13, padding: 12, textAlign: "center" }}>🤖 AI is generating today's post ideas...</div>
              )}
              {!generatingIdeas[acc.id] && postIdeas[acc.id]?.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>📅 Today's 3 Post Ideas — {new Date().toDateString()}</div>
                  {postIdeas[acc.id].map((idea, i) => (
                    <div key={i} style={{ background: "#1a1a2e", border: "1px solid #2d2d5a", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                            <span style={{ background: "#7c3aed22", color: "#a78bfa", borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>#{i + 1}</span>
                            <span style={{ background: "#1e3a2a", color: "#10b981", borderRadius: 99, padding: "2px 8px", fontSize: 11 }}>{idea.format}</span>
                          </div>
                          <div style={{ fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>{idea.title}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>Hook: "{idea.hook}"</div>
                        </div>
                        <button onClick={() => generatePost(acc, idea)}
                          style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: 12, marginLeft: 10, whiteSpace: "nowrap" }}>
                          ✍️ Write Post
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {!generatingIdeas[acc.id] && !postIdeas[acc.id]?.length && acc.niche && (
                <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: 16 }}>
                  Click "🔄 Generate New Ideas" to get today's post ideas!
                </div>
              )}
              {!acc.niche && (
                <div style={{ color: "#f59e0b", fontSize: 13, padding: 8 }}>⚠️ Select a niche above to get AI post ideas!</div>
              )}
            </div>
          ))}

          {/* Generated Post Modal */}
          {selectedIdea && (
            <div style={{ background: "#0f0f1a", border: "1px solid #7c3aed", borderRadius: 12, padding: 20, marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, color: "#a78bfa" }}>✍️ Generated Post — {selectedIdea.idea.title}</div>
                <button onClick={() => { setSelectedIdea(null); setGeneratedPost(null); }} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>
              {generatingPost && <div style={{ color: "#a78bfa", textAlign: "center", padding: 20 }}>🤖 Writing your post...</div>}
              {generatedPost && !generatingPost && <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 700 }}>📝 CAPTION</div>
                  <div style={{ background: "#1a1a2e", borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.7, color: "#e2e8f0", whiteSpace: "pre-wrap" }}>{generatedPost.caption}</div>
                  <button onClick={() => navigator.clipboard.writeText(generatedPost.caption)}
                    style={{ marginTop: 6, background: "#1e1e3a", border: "1px solid #2d2d5a", color: "#94a3b8", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12 }}>📋 Copy Caption</button>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 700 }}>💬 CALL TO ACTION</div>
                  <div style={{ background: "#1a1a2e", borderRadius: 8, padding: 10, fontSize: 13, color: "#10b981" }}>{generatedPost.cta}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 700 }}>🏷️ HASHTAGS</div>
                  <div style={{ background: "#1a1a2e", borderRadius: 8, padding: 10, fontSize: 12, color: "#3b82f6", lineHeight: 1.8 }}>{generatedPost.hashtags}</div>
                  <button onClick={() => navigator.clipboard.writeText(generatedPost.hashtags)}
                    style={{ marginTop: 6, background: "#1e1e3a", border: "1px solid #2d2d5a", color: "#94a3b8", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12 }}>📋 Copy Hashtags</button>
                </div>
              </>}
            </div>
          )}
        </>}

        {/* AI ASSISTANT */}
        {tab === 6 && (
          <div style={{ display: "flex", flexDirection: "column", height: "62vh" }}>
            <div ref={chatRef} style={{ flex: 1, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {aiMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.6, background: m.role === "user" ? "#7c3aed" : "#0f0f1a", border: m.role === "user" ? "none" : "1px solid #1e1e3a" }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {aiLoading && <div style={{ display: "flex" }}><div style={{ background: "#0f0f1a", border: "1px solid #1e1e3a", borderRadius: 12, padding: "10px 14px", color: "#a78bfa", fontSize: 13 }}>Thinking... 🤔</div></div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendAI()}
                placeholder="What to post next? How to grow faster? Ask anything..."
                style={{ flex: 1, background: "#0f0f1a", border: "1px solid #2d2d5a", borderRadius: 10, padding: "12px 14px", color: "#e2e8f0", outline: "none", fontSize: 13 }} />
              <button onClick={sendAI} disabled={aiLoading} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", cursor: "pointer", fontWeight: 700, opacity: aiLoading ? 0.6 : 1 }}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
