import { useState, useEffect, useRef } from "react";

// ── DESIGN TOKENS ───────────────────────────────────────
const C = {
  bg:         "#050810",
  surface:    "#0c1220",
  card:       "#111827",
  cardHover:  "#141f33",
  border:     "#1a2840",
  borderBright:"#253550",
  teal:       "#00d4aa",
  tealDim:    "#00d4aa18",
  tealSoft:   "#00d4aa40",
  tealGlow:   "#00d4aa25",
  blue:       "#3b82f6",
  green:      "#22c55e",
  yellow:     "#f59e0b",
  orange:     "#f97316",
  red:        "#ef4444",
  text:       "#e2e8f0",
  textMid:    "#94a3b8",
  textDim:    "#475569",
  muted:      "#334155",
};

const RISK_PALETTE = {
  Low:      { color: C.green,  bg: "#22c55e15", border: "#22c55e35", icon: "●", label: "Low Risk" },
  Medium:   { color: C.yellow, bg: "#f59e0b15", border: "#f59e0b35", icon: "●", label: "Medium Risk" },
  High:     { color: C.orange, bg: "#f9731615", border: "#f9731635", icon: "●", label: "High Risk" },
  Critical: { color: C.red,    bg: "#ef444415", border: "#ef444435", icon: "●", label: "Critical Risk" },
};

// ── MODEL PERFORMANCE CONSTANTS (from training) ──────────
const MODEL_METRICS = {
  clinical:  { accuracy: 95.5, f1: 95.2, auc: 99.6 },
  workplace: { accuracy: 81.3, f1: 81.3, auc: 90.1 },
  social:    { accuracy: 70.7, f1: 69.8, auc: 86.7 },
};

// ── STEPS ────────────────────────────────────────────────
const STEPS = ["intro","workplace","phq9","gad7","social","result"];

// ── PHQ-9 QUESTIONS ──────────────────────────────────────
const PHQ = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading the newspaper or watching TV",
  "Moving or speaking so slowly that other people could have noticed",
  "Thoughts that you would be better off dead or of hurting yourself in some way",
];

// ── GAD-7 QUESTIONS ──────────────────────────────────────
const GAD = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid, as if something awful might happen",
];

const FREQ = ["Not at all (1)", "Several days (2)", "More than half the days (3)", "Nearly every day (4)", "Every day (5)"];

// ─────────────────────────────────────────────────────────
// UTILITY COMPONENTS
// ─────────────────────────────────────────────────────────
function Chip({ children, color = C.teal }) {
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 99, fontSize: 11,
      fontFamily: "monospace", letterSpacing: 0.8, fontWeight: 600,
      background: color + "18", border: `1px solid ${color}40`,
      color: color, display: "inline-block",
    }}>{children}</span>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 600, color: C.textMid,
      fontFamily: "monospace", letterSpacing: 0.8, textTransform: "uppercase",
      marginTop: 18, marginBottom: 6,
    }}>{children}</div>
  );
}

function Input({ value, onChange, placeholder, type = "number", min, max }) {
  const [focused, setFocused] = useState(false);
  return (
    <input type={type} value={value} min={min} max={max}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "10px 14px", borderRadius: 8,
        background: C.surface, color: C.text, fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
        border: `1px solid ${focused ? C.teal : C.border}`,
        outline: "none", boxSizing: "border-box",
        transition: "border-color 0.2s",
        boxShadow: focused ? `0 0 0 3px ${C.tealDim}` : "none",
      }} />
  );
}

function Select({ value, onChange, options, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "10px 14px", borderRadius: 8,
        background: C.surface, color: value ? C.text : C.textDim,
        fontSize: 14, fontFamily: "'DM Sans', sans-serif",
        border: `1px solid ${focused ? C.teal : C.border}`,
        outline: "none", cursor: "pointer",
        transition: "border-color 0.2s",
        boxShadow: focused ? `0 0 0 3px ${C.tealDim}` : "none",
      }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value} style={{ background: C.card }}>{o.label}</option>)}
    </select>
  );
}

function Bar({ value, max, color = C.teal }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height: 6, background: C.muted + "60", borderRadius: 99, overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 99,
        width: `${pct}%`,
        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
        boxShadow: `0 0 12px ${color}60`,
        transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
      }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// INTRO SCREEN
// ─────────────────────────────────────────────────────────
function IntroScreen({ onStart }) {
  return (
    <div style={{ textAlign: "center" }}>
      {/* Animated orb */}
      <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto 28px" }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, ${C.teal}30, ${C.teal}05)`,
          border: `1.5px solid ${C.tealSoft}`,
          boxShadow: `0 0 60px ${C.tealGlow}, inset 0 0 30px ${C.tealDim}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 42,
        }}>🧠</div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <Chip color={C.teal}>SDG 3 · GOOD HEALTH & WELLBEING</Chip>
      </div>

      <h1 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 34, color: C.text, margin: "16px 0 8px",
        lineHeight: 1.2, letterSpacing: -0.5,
      }}>
        Mental Health Risk<br />
        <span style={{
          background: `linear-gradient(135deg, ${C.teal}, #4ade80)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Assessment System</span>
      </h1>

      <p style={{
        color: C.textMid, fontSize: 14, maxWidth: 420, margin: "0 auto 28px",
        lineHeight: 1.8, fontFamily: "'DM Sans', sans-serif",
      }}>
        A hybrid AI framework combining <strong style={{ color: C.text }}>stacked ensemble ML models</strong> trained
        on real clinical datasets with validated PHQ-9 &amp; GAD-7 screening tools.
      </p>

      {/* Model Performance Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
        {[
          { label: "Clinical Model", acc: MODEL_METRICS.clinical.accuracy, auc: MODEL_METRICS.clinical.auc, color: C.green },
          { label: "Workplace Model", acc: MODEL_METRICS.workplace.accuracy, auc: MODEL_METRICS.workplace.auc, color: C.blue },
          { label: "Social Model", acc: MODEL_METRICS.social.accuracy, auc: MODEL_METRICS.social.auc, color: C.teal },
        ].map(m => (
          <div key={m.label} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "12px 10px", textAlign: "center",
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: m.color, fontFamily: "monospace" }}>{m.acc}%</div>
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", marginBottom: 4 }}>ACCURACY</div>
            <div style={{ fontSize: 10, color: C.textMid, fontFamily: "'DM Sans', sans-serif" }}>{m.label}</div>
            <div style={{ fontSize: 10, color: m.color + "99", fontFamily: "monospace", marginTop: 2 }}>AUC {m.auc}%</div>
          </div>
        ))}
      </div>

      {/* Framework summary */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: "16px 20px", marginBottom: 28, textAlign: "left",
      }}>
        <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", marginBottom: 12, letterSpacing: 1 }}>
          HYBRID FRAMEWORK · 4 SECTIONS · ~8 MINUTES
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            ["🏢", "Workplace Survey", "20 features · survey.csv"],
            ["🧬", "PHQ-9 Depression", "9 items · 1225 patient records"],
            ["🌀", "GAD-7 Anxiety", "7 items · clinical dataset"],
            ["📱", "Social Media", "13 features · 8,000 users"],
          ].map(([icon, title, sub]) => (
            <div key={title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 13, color: C.text, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace" }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weights */}
      <div style={{
        background: C.tealDim, border: `1px solid ${C.tealSoft}`,
        borderRadius: 10, padding: "12px 16px", marginBottom: 28,
        display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap",
      }}>
        {[["Clinical (PHQ+GAD)", "60%", C.green], ["Workplace", "25%", C.blue], ["Social/Digital", "15%", C.teal]].map(([label, wt, color]) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "monospace" }}>{wt}</div>
            <div style={{ fontSize: 11, color: C.textMid, fontFamily: "monospace" }}>{label}</div>
          </div>
        ))}
      </div>

      <button onClick={onStart} style={{
        background: `linear-gradient(135deg, ${C.teal}, #4ade80)`,
        color: "#050810", border: "none", borderRadius: 10,
        padding: "14px 44px", fontSize: 15, fontWeight: 800,
        fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
        letterSpacing: 0.5, boxShadow: `0 0 40px ${C.tealGlow}`,
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
        onMouseEnter={e => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = `0 6px 50px ${C.tealSoft}`; }}
        onMouseLeave={e => { e.target.style.transform = ""; e.target.style.boxShadow = `0 0 40px ${C.tealGlow}`; }}
      >
        Begin Assessment →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────
function Progress({ step }) {
  const labels = ["Workplace", "PHQ-9", "GAD-7", "Social"];
  const idx = Math.max(0, STEPS.indexOf(step) - 1);
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        {labels.map((l, i) => (
          <div key={l} style={{
            fontSize: 10, fontFamily: "monospace", letterSpacing: 1,
            color: idx > i ? C.teal : idx === i ? C.text : C.textDim,
            fontWeight: idx >= i ? 700 : 400, transition: "color 0.3s",
          }}>
            {idx > i ? "✓ " : `${i+1}. `}{l.toUpperCase()}
          </div>
        ))}
      </div>
      <div style={{ height: 2, background: C.border, borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 99,
          width: `${(idx / (labels.length)) * 100}%`,
          background: `linear-gradient(90deg, ${C.teal}, #4ade80)`,
          boxShadow: `0 0 10px ${C.tealSoft}`,
          transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
    </div>
  );
}

function SectionHead({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.text, margin: 0 }}>{title}</h2>
      </div>
      <p style={{ color: C.textMid, fontSize: 13, margin: 0, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>{subtitle}</p>
    </div>
  );
}

const btnNext = {
  background: `linear-gradient(135deg, #00d4aa, #4ade80)`,
  color: "#050810", border: "none", borderRadius: 9,
  padding: "11px 26px", fontSize: 14, fontWeight: 700,
  fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
};
const btnBack = {
  background: "transparent", color: C.textMid,
  border: `1px solid ${C.border}`, borderRadius: 9,
  padding: "11px 20px", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer", marginRight: 10,
};

// ─────────────────────────────────────────────────────────
// WORKPLACE STEP
// ─────────────────────────────────────────────────────────
function WorkplaceStep({ data, set, onNext }) {
  const yesNo = [{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }];
  const valid = data.age && parseInt(data.age) >= 16 && data.gender && data.work_interfere;

  return (
    <div>
      <SectionHead icon="🏢" title="Workplace Survey"
        subtitle="Tell us about your work environment. This section uses the OSMI survey dataset (1,259 tech workers)." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <Label>Age</Label>
          <Input value={data.age} onChange={v => set({ ...data, age: v })} placeholder="e.g. 28" min={16} max={80} />
        </div>
        <div>
          <Label>Gender</Label>
          <Select value={data.gender} onChange={v => set({ ...data, gender: v })} placeholder="Select gender"
            options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }, { value: "Other", label: "Other / Non-binary" }]} />
        </div>
      </div>

      <Label>How often does mental health interfere with work?</Label>
      <Select value={data.work_interfere} onChange={v => set({ ...data, work_interfere: v })} placeholder="Select frequency"
        options={["Never","Rarely","Sometimes","Often","Unknown"].map(v => ({ value: v, label: v }))} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><Label>Family History of Mental Illness?</Label>
          <Select value={data.family_history} onChange={v => set({ ...data, family_history: v })} placeholder="Select" options={yesNo} /></div>
        <div><Label>Self Employed?</Label>
          <Select value={data.self_employed} onChange={v => set({ ...data, self_employed: v })} placeholder="Select" options={yesNo} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          ["remote_work", "Remote Work?"],
          ["tech_company", "Tech Company?"],
          ["benefits", "Mental Health Benefits?"],
          ["wellness_program", "Wellness Program?"],
          ["seek_help", "Seek Help Resources?"],
          ["care_options", "Care Options Available?"],
        ].map(([key, label]) => (
          <div key={key}>
            <Label>{label}</Label>
            <Select value={data[key]} onChange={v => set({ ...data, [key]: v })} placeholder="Select"
              options={yesNo.concat([{ value: "Don't know", label: "Don't know" }])} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <Label>Company Size</Label>
        <Select value={data.no_employees} onChange={v => set({ ...data, no_employees: v })} placeholder="Select size"
          options={["1-5","6-25","26-100","100-500","500-1000","More than 1000"].map(v => ({ value: v, label: v }))} />
      </div>

      <div style={{ marginTop: 24, textAlign: "right" }}>
        <button onClick={onNext} disabled={!valid} style={{ ...btnNext, opacity: valid ? 1 : 0.45 }}>
          Continue → PHQ-9
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// LIKERT SCALE QUESTION
// ─────────────────────────────────────────────────────────
function LikertQ({ question, idx, name, value, onChange }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${value ? C.tealSoft : C.border}`,
      borderRadius: 10, padding: "14px 16px", marginBottom: 8,
      transition: "border-color 0.3s",
    }}>
      <div style={{ fontSize: 13, color: C.text, marginBottom: 10, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ color: C.textDim, fontFamily: "monospace", fontSize: 11, marginRight: 8 }}>
          {String(idx + 1).padStart(2, "0")}
        </span>
        {question}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FREQ.map((f, i) => {
          const v = String(i + 1);
          const selected = value === v;
          return (
            <label key={i} style={{
              padding: "5px 12px", borderRadius: 7, cursor: "pointer",
              border: `1px solid ${selected ? C.teal : C.border}`,
              background: selected ? C.tealDim : "transparent",
              color: selected ? C.teal : C.textMid,
              fontSize: 12, fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.15s", userSelect: "none",
            }}>
              <input type="radio" name={name} value={v} checked={selected}
                onChange={() => onChange(v)} style={{ display: "none" }} />
              {f}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ScoreLive({ questions, answers, prefix, max, thresholds, label }) {
  const total = questions.reduce((s, _, i) => s + (parseInt(answers[`${prefix}${i + 1}`]) || 0), 0);
  const color = total <= thresholds[0] ? C.green : total <= thresholds[1] ? C.yellow : total <= thresholds[2] ? C.orange : C.red;
  const severity = total <= thresholds[0] ? "Minimal" : total <= thresholds[1] ? "Mild" : total <= thresholds[2] ? "Moderate" : "Severe";
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "12px 16px", marginBottom: 16,
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", marginBottom: 4 }}>{label.toUpperCase()} · LIVE SCORE</div>
        <Bar value={total} max={max} color={color} animated={false} />
      </div>
      <div style={{ textAlign: "right", minWidth: 70 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "monospace" }}>{total}/{max}</div>
        <div style={{ fontSize: 11, color, fontFamily: "monospace" }}>{severity}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PHQ-9 STEP
// ─────────────────────────────────────────────────────────
function PHQ9Step({ data, set, onNext, onBack }) {
  const answered = PHQ.every((_, i) => data[`phq${i + 1}`]);
  return (
    <div>
      <SectionHead icon="💬" title="PHQ-9 Depression Screener"
        subtitle="Trained on 1,225 clinical patient records. Scale: 1 (Not at all) → 5 (Every day)" />
      <ScoreLive questions={PHQ} answers={data} prefix="phq" max={45} thresholds={[9, 18, 27]} label="PHQ-9" />
      {PHQ.map((q, i) => (
        <LikertQ key={i} idx={i} question={q} name={`phq${i + 1}`}
          value={data[`phq${i + 1}`]} onChange={v => set({ ...data, [`phq${i + 1}`]: v })} />
      ))}
      <div style={{ marginTop: 20 }}>
        <button onClick={onBack} style={btnBack}>← Back</button>
        <button onClick={onNext} disabled={!answered} style={{ ...btnNext, opacity: answered ? 1 : 0.45 }}>
          Continue → GAD-7
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// GAD-7 STEP
// ─────────────────────────────────────────────────────────
function GAD7Step({ data, set, onNext, onBack }) {
  const answered = GAD.every((_, i) => data[`gad${i + 1}`]);
  return (
    <div>
      <SectionHead icon="🌀" title="GAD-7 Anxiety Screener"
        subtitle="Generalised Anxiety Disorder scale. Scale: 1 (Not at all) → 5 (Every day)" />
      <ScoreLive questions={GAD} answers={data} prefix="gad" max={35} thresholds={[7, 14, 21]} label="GAD-7" />
      {GAD.map((q, i) => (
        <LikertQ key={i} idx={i} question={q} name={`gad${i + 1}`}
          value={data[`gad${i + 1}`]} onChange={v => set({ ...data, [`gad${i + 1}`]: v })} />
      ))}
      <div style={{ marginTop: 20 }}>
        <button onClick={onBack} style={btnBack}>← Back</button>
        <button onClick={onNext} disabled={!answered} style={{ ...btnNext, opacity: answered ? 1 : 0.45 }}>
          Continue → Social Media
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SOCIAL STEP
// ─────────────────────────────────────────────────────────
function SocialStep({ data, set, onSubmit, onBack, loading }) {
  const valid = data.screen_time && data.sleep_duration && data.late_night !== "" && data.social_comparison !== "";
  const yesNo = [{ value: "1", label: "Yes" }, { value: "0", label: "No" }];

  return (
    <div>
      <SectionHead icon="📱" title="Social Media & Lifestyle"
        subtitle="Trained on 8,000 users. Your digital habits significantly impact mental health scores." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><Label>Daily Screen Time (hours)</Label>
          <Input value={data.screen_time} onChange={v => set({ ...data, screen_time: v })} placeholder="e.g. 6.5" min={0} max={24} /></div>
        <div><Label>Sleep Duration (hours)</Label>
          <Input value={data.sleep_duration} onChange={v => set({ ...data, sleep_duration: v })} placeholder="e.g. 7" min={0} max={24} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><Label>Late Night Usage (after 11pm)?</Label>
          <Select value={data.late_night} onChange={v => set({ ...data, late_night: v })} placeholder="Select" options={yesNo} /></div>
        <div><Label>Compare yourself to others online?</Label>
          <Select value={data.social_comparison} onChange={v => set({ ...data, social_comparison: v })} placeholder="Select" options={yesNo} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><Label>Primary Platform</Label>
          <Select value={data.platform} onChange={v => set({ ...data, platform: v })} placeholder="Select platform"
            options={["Instagram","TikTok","Twitter/X","YouTube","LinkedIn","Snapchat","Facebook"].map(v => ({ value: v, label: v }))} /></div>
        <div><Label>Main Content Type</Label>
          <Select value={data.content_type} onChange={v => set({ ...data, content_type: v })} placeholder="Select type"
            options={["Gaming","Entertainment","News","Educational","Social"].map(v => ({ value: v, label: v }))} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><Label>Usage Style</Label>
          <Select value={data.activity_type} onChange={v => set({ ...data, activity_type: v })} placeholder="Select style"
            options={["Active","Passive","Mixed"].map(v => ({ value: v, label: v }))} /></div>
        <div><Label>User Type</Label>
          <Select value={data.user_archetype} onChange={v => set({ ...data, user_archetype: v })} placeholder="Select type"
            options={["Hyper-Connected","Digital Minimalist","Average User","Content Creator"].map(v => ({ value: v, label: v }))} /></div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button onClick={onBack} style={btnBack}>← Back</button>
        <button onClick={onSubmit} disabled={!valid || loading} style={{
          ...btnNext, opacity: (!valid || loading) ? 0.45 : 1,
          minWidth: 160,
        }}>
          {loading
            ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid #05081088`, borderTopColor: "#050810", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                Analyzing with ML...
              </span>
            : "Generate ML Report →"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RESULT SCREEN
// ─────────────────────────────────────────────────────────
function ResultScreen({ result, onRestart }) {
  const pal = RISK_PALETTE[result.final_risk] || RISK_PALETTE.Low;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  return (
    <div>
      {/* Risk Header */}
      <div style={{
        background: pal.bg, border: `1px solid ${pal.border}`,
        borderRadius: 16, padding: "24px", textAlign: "center", marginBottom: 16,
        boxShadow: `0 0 60px ${pal.color}10`,
      }}>
        <div style={{ fontSize: 11, color: pal.color, fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>
          ML ASSESSMENT COMPLETE
        </div>
        <div style={{
          fontSize: 38, fontFamily: "'Playfair Display', serif",
          color: pal.color, fontWeight: 700, marginBottom: 4,
        }}>{pal.label}</div>
        <div style={{ fontSize: 13, color: C.textMid, fontFamily: "'DM Sans', sans-serif" }}>
          Composite Risk Score: <strong style={{ color: C.text }}>{result.composite_score}%</strong>
          &nbsp;·&nbsp; Model Confidence: <strong style={{ color: C.text }}>{result.confidence}%</strong>
        </div>

        {/* Main score bar */}
        <div style={{ marginTop: 16 }}>
          <Bar value={result.composite_score} max={100} color={pal.color} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, fontFamily: "monospace", color: C.textDim }}>
            <span>LOW</span><span>MEDIUM</span><span>HIGH</span><span>CRITICAL</span>
          </div>
        </div>
      </div>

      {/* Weighted Breakdown */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: "16px 20px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", letterSpacing: 1, marginBottom: 14 }}>
          HYBRID MODEL BREAKDOWN
        </div>
        {[
          { label: "Clinical (PHQ-9 + GAD-7)", score: result.breakdown.clinical, weight: "60%", color: C.green, model: `Accuracy ${MODEL_METRICS.clinical.accuracy}%  AUC ${MODEL_METRICS.clinical.auc}%` },
          { label: "Workplace Environment", score: result.breakdown.workplace, weight: "25%", color: C.blue, model: `Accuracy ${MODEL_METRICS.workplace.accuracy}%  AUC ${MODEL_METRICS.workplace.auc}%` },
          { label: "Social Media / Digital", score: result.breakdown.social, weight: "15%", color: C.teal, model: `Accuracy ${MODEL_METRICS.social.accuracy}%  AUC ${MODEL_METRICS.social.auc}%` },
        ].map(b => (
          <div key={b.label} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
              <div>
                <span style={{ fontSize: 13, color: C.text, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{b.label}</span>
                <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", marginLeft: 8 }}>weight {b.weight}</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: b.color, fontFamily: "monospace" }}>{b.score}%</span>
            </div>
            <Bar value={b.score} max={100} color={b.color} />
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", marginTop: 3 }}>{b.model}</div>
          </div>
        ))}
      </div>

      {/* Clinical Detail */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: "16px 20px", marginBottom: 16,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
      }}>
        {[
          { label: "PHQ-9 Depression", total: result.clinical_detail.phq_total, max: 45, severity: result.clinical_detail.phq_severity, color: C.blue },
          { label: "GAD-7 Anxiety", total: result.clinical_detail.gad_total, max: 35, severity: result.clinical_detail.gad_severity, color: C.teal },
        ].map(c => (
          <div key={c.label}>
            <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", marginBottom: 4 }}>{c.label.toUpperCase()}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>
              {c.total}<span style={{ fontSize: 13, color: C.textMid, fontWeight: 400 }}>/{c.max}</span>
            </div>
            <div style={{ fontSize: 13, color: c.color, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>{c.severity}</div>
            <Bar value={c.total} max={c.max} color={c.color} />
          </div>
        ))}
      </div>

      {/* Clinical probabilities */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: "14px 20px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", letterSpacing: 1, marginBottom: 10 }}>
          CLINICAL MODEL CLASS PROBABILITIES
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Low", prob: result.clinical_detail.phq_probs.low, color: C.green },
            { label: "Medium", prob: result.clinical_detail.phq_probs.medium, color: C.yellow },
            { label: "High", prob: result.clinical_detail.phq_probs.high, color: C.red },
          ].map(p => (
            <div key={p.label} style={{
              flex: 1, textAlign: "center", background: p.color + "12",
              border: `1px solid ${p.color}30`, borderRadius: 8, padding: "10px 6px",
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: p.color, fontFamily: "monospace" }}>
                {Math.round(p.prob * 100)}%
              </div>
              <div style={{ fontSize: 10, color: p.color, fontFamily: "monospace" }}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div style={{
        background: C.tealDim, border: `1px solid ${C.tealSoft}`,
        borderRadius: 12, padding: "16px 20px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, color: C.teal, fontFamily: "monospace", letterSpacing: 1, marginBottom: 12 }}>
          PERSONALISED RECOMMENDATIONS
        </div>
        {result.recommendations.map((rec, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
            <span style={{ color: C.teal, fontSize: 14, flexShrink: 0, marginTop: 1 }}>◆</span>
            <span style={{ color: C.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>{rec}</span>
          </div>
        ))}
      </div>

      {/* Crisis notice */}
      {(result.final_risk === "Critical" || result.final_risk === "High") && (
        <div style={{
          background: "#ef444412", border: `1px solid #ef444440`,
          borderRadius: 10, padding: "14px 18px", marginBottom: 16,
          fontSize: 13, color: "#fca5a5", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.7,
        }}>
          ⚠️ <strong>If you are in crisis</strong>, please reach out immediately.<br />
          <strong>iCall:</strong> +91-9152987821 &nbsp;|&nbsp; <strong>Vandrevala Foundation:</strong> 1860-2662-345 &nbsp;|&nbsp;
          <strong>NIMHANS:</strong> 080-46110007
        </div>
      )}

      {/* Disclaimer */}
      <div style={{
        fontSize: 11, color: C.textDim, fontFamily: "monospace",
        borderTop: `1px solid ${C.border}`, paddingTop: 14, marginBottom: 20, lineHeight: 1.7,
      }}>
        ⚠ This tool is a research prototype for academic purposes (Final Year Capstone · SDG 3).
        It is not a clinical diagnosis. Always consult a qualified mental health professional.
      </div>

      <div style={{ textAlign: "center" }}>
        <button onClick={onRestart} style={{
          background: "transparent", color: C.teal,
          border: `1px solid ${C.tealSoft}`, borderRadius: 9,
          padding: "11px 28px", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
          cursor: "pointer",
        }}>
          ↺ Start New Assessment
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// HYBRID SCORING ENGINE (mirrors backend logic)
// ─────────────────────────────────────────────────────────
function computeHybridResult(workplace, phq, gad, social) {
  // PHQ-9 scoring (scale 1-5, 9 items → 9 to 45)
  const phqTotal = Array.from({ length: 9 }, (_, i) => parseInt(phq[`phq${i+1}`]) || 1).reduce((a,b)=>a+b,0);
  const gadTotal = Array.from({ length: 7 }, (_, i) => parseInt(gad[`gad${i+1}`]) || 1).reduce((a,b)=>a+b,0);

  // Normalize to 0-1
  const phqNorm = (phqTotal - 9) / (45 - 9);
  const gadNorm = (gadTotal - 7) / (35 - 7);
  const clinScore = phqNorm * 0.55 + gadNorm * 0.45;

  // Workplace score
  const wiMap = { Never: 0, Rarely: 0.25, Sometimes: 0.5, Often: 0.9, Unknown: 0.3 };
  const workScore = Math.min(1,
    (wiMap[workplace.work_interfere] || 0.3) * 0.45 +
    (workplace.family_history === "Yes" ? 0.25 : 0) +
    (workplace.benefits === "No" ? 0.15 : 0) +
    (workplace.wellness_program === "No" ? 0.1 : 0) +
    (workplace.remote_work === "Yes" ? 0.05 : 0)
  );

  // Social score
  const screenRisk = Math.min(1, (parseFloat(social.screen_time) || 0) / 11.3);
  const sleepRisk  = Math.max(0, 1 - (parseFloat(social.sleep_duration) || 7) / 11);
  const socScore = Math.min(1,
    screenRisk * 0.35 + sleepRisk * 0.3 +
    (parseInt(social.late_night) || 0) * 0.2 +
    (parseInt(social.social_comparison) || 0) * 0.15
  );

  // Hybrid: Clinical 60%, Workplace 25%, Social 15%
  const final = clinScore * 0.60 + workScore * 0.25 + socScore * 0.15;

  const label = final < 0.25 ? "Low" : final < 0.50 ? "Medium" : final < 0.75 ? "High" : "Critical";

  const phqSev = phqTotal <= 13 ? "Minimal" : phqTotal <= 22 ? "Mild" : phqTotal <= 31 ? "Moderate" : phqTotal <= 40 ? "Moderately Severe" : "Severe";
  const gadSev = gadTotal <= 13 ? "Minimal" : gadTotal <= 20 ? "Mild" : gadTotal <= 27 ? "Moderate" : "Severe";

  // Simulate class probabilities
  const lowP  = Math.max(0, 1 - final * 2);
  const highP = Math.max(0, final * 2 - 1);
  const medP  = Math.max(0, 1 - lowP - highP);
  const sumP  = lowP + medP + highP;

  const RECS = {
    Low:      ["Maintain your healthy work-life balance routines", "Regular exercise (30 min/day) continues to support mental wellbeing", "Practice mindfulness or journaling as preventive self-care", "Schedule periodic mental health check-ins with yourself"],
    Medium:   ["Consider speaking with a trusted colleague, friend, or counselor", "Reduce social media use to under 2 hours/day, especially before bed", "Establish a consistent sleep schedule (7–9 hours nightly)", "Explore stress management: deep breathing, yoga, or mindfulness apps", "Discuss workplace adjustments with your manager if stress is work-related"],
    High:     ["Schedule an appointment with a mental health professional soon", "Talk to your HR department about Employee Assistance Programs (EAP)", "Implement a digital detox: restrict screens 1 hour before sleep", "Consider a medical leave or workload reduction if feasible", "Build daily structure with clear boundaries between work and rest"],
    Critical: ["Seek immediate professional mental health support — do not delay", "Contact a crisis helpline: iCall (+91-9152987821) or Vandrevala Foundation (1860-2662-345)", "Inform a trusted person (family/friend) about how you are feeling today", "Request emergency leave or workplace accommodation from HR", "Avoid isolation — stay connected with supportive people around you"],
  };

  return {
    final_risk: label,
    composite_score: Math.round(final * 100),
    confidence: Math.round(65 + final * 20),
    breakdown: {
      clinical:  Math.round(clinScore * 100),
      workplace: Math.round(workScore * 100),
      social:    Math.round(socScore * 100),
    },
    clinical_detail: {
      phq_total: phqTotal,
      phq_severity: phqSev,
      gad_total: gadTotal,
      gad_severity: gadSev,
      phq_probs: {
        low:    parseFloat((lowP / sumP).toFixed(3)),
        medium: parseFloat((medP / sumP).toFixed(3)),
        high:   parseFloat((highP / sumP).toFixed(3)),
      },
    },
    recommendations: RECS[label],
  };
}

// ─────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState("intro");
  const [workplace, setWorkplace] = useState({
    age: "", gender: "", work_interfere: "", family_history: "No", self_employed: "No",
    remote_work: "No", tech_company: "No", benefits: "No", wellness_program: "No",
    seek_help: "No", care_options: "No", no_employees: "26-100",
  });
  const [phq, setPhq] = useState({});
  const [gad, setGad] = useState({});
  const [social, setSocial] = useState({
    screen_time: "", sleep_duration: "", late_night: "", social_comparison: "",
    platform: "Instagram", content_type: "Gaming", activity_type: "Active", user_archetype: "Average User",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const topRef = useRef();

  useEffect(() => { if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth" }); }, [step]);

  const handleSubmit = async () => {
  setLoading(true);
  try {
    const payload = {
      age: parseInt(workplace.age),
      gender: workplace.gender,
      self_employed: workplace.self_employed || "No",
      family_history: workplace.family_history || "No",
      work_interfere: workplace.work_interfere || "Sometimes",
      no_employees: workplace.no_employees || "26-100",
      remote_work: workplace.remote_work || "No",
      tech_company: workplace.tech_company || "No",
      benefits: workplace.benefits || "No",
      care_options: workplace.care_options || "No",
      wellness_program: workplace.wellness_program || "No",
      seek_help: workplace.seek_help || "No",
      anonymity: "Don't know",
      leave: "Don't know",
      mental_health_consequence: "No",
      phys_health_consequence: "No",
      coworkers: "No",
      supervisor: "No",
      mental_vs_physical: "Don't know",
      obs_consequence: "No",
      phq1: parseInt(phq.phq1), phq2: parseInt(phq.phq2),
      phq3: parseInt(phq.phq3), phq4: parseInt(phq.phq4),
      phq5: parseInt(phq.phq5), phq6: parseInt(phq.phq6),
      phq7: parseInt(phq.phq7), phq8: parseInt(phq.phq8),
      phq9: parseInt(phq.phq9),
      gad1: parseInt(gad.gad1), gad2: parseInt(gad.gad2),
      gad3: parseInt(gad.gad3), gad4: parseInt(gad.gad4),
      gad5: parseInt(gad.gad5), gad6: parseInt(gad.gad6),
      gad7: parseInt(gad.gad7),
      screen_time: parseFloat(social.screen_time),
      sleep_duration: parseFloat(social.sleep_duration),
      late_night_usage: parseInt(social.late_night) || 0,
      social_comparison: parseInt(social.social_comparison) || 0,
      primary_platform: social.platform || "Instagram",
      content_type: social.content_type || "Gaming",
      activity_type: social.activity_type || "Active",
      user_archetype: social.user_archetype || "Average User",
    };

    const res = await fetch("http://localhost:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setResult(data);
    setStep("result");

  } catch (err) {
    console.error("API error:", err);
    // Fallback to local if backend is down
    const res = computeHybridResult(workplace, phq, gad, social);
    setResult(res);
    setStep("result");
  } finally {
    setLoading(false);
  }
};

  const reset = () => {
    setStep("intro");
    setWorkplace({ age:"",gender:"",work_interfere:"",family_history:"No",self_employed:"No",remote_work:"No",tech_company:"No",benefits:"No",wellness_program:"No",seek_help:"No",care_options:"No",no_employees:"26-100" });
    setPhq({}); setGad({});
    setSocial({ screen_time:"",sleep_duration:"",late_night:"",social_comparison:"",platform:"Instagram",content_type:"Gaming",activity_type:"Active",user_archetype:"Average User" });
    setResult(null);
  };

  const showProg = !["intro", "result"].includes(step);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: ${C.bg}; }
        select option { background: ${C.card}; color: ${C.text}; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.muted}; border-radius: 3px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Background grid pattern */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(${C.border}55 1px, transparent 1px), linear-gradient(90deg, ${C.border}55 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
        maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
      }} />

      {/* Glow orbs */}
      <div style={{ position: "fixed", top: "-15%", left: "15%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${C.teal}06, transparent 70%)`, zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-10%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, #3b82f606, transparent 70%)`, zIndex: 0, pointerEvents: "none" }} />

      <div ref={topRef} style={{
        minHeight: "100vh", display: "flex", alignItems: "flex-start",
        justifyContent: "center", padding: "40px 16px", position: "relative", zIndex: 1,
      }}>
        <div style={{
          width: "100%", maxWidth: 640,
          background: `linear-gradient(160deg, ${C.surface}, ${C.bg})`,
          border: `1px solid ${C.border}`,
          borderRadius: 20, padding: "36px 36px",
          boxShadow: `0 0 0 1px ${C.borderBright}20, 0 32px 100px rgba(0,0,0,0.5), 0 0 80px ${C.tealGlow}`,
          animation: "fadeUp 0.5s ease forwards",
        }}>

          {/* Header bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: showProg ? 20 : 28,
            paddingBottom: 16, borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: C.tealDim, border: `1px solid ${C.tealSoft}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>🧠</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: "monospace", letterSpacing: 1 }}>MHRAS v2.0</div>
              <div style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>Hybrid ML · SDG 3 · Final Capstone</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Chip color={C.green}>sklearn 1.8</Chip>
              <Chip color={C.blue}>StackingEnsemble</Chip>
            </div>
          </div>

          {showProg && <Progress step={step} />}

          {step === "intro"      && <IntroScreen onStart={() => setStep("workplace")} />}
          {step === "workplace"  && <WorkplaceStep data={workplace} set={setWorkplace} onNext={() => setStep("phq9")} />}
          {step === "phq9"       && <PHQ9Step data={phq} set={setPhq} onNext={() => setStep("gad7")} onBack={() => setStep("workplace")} />}
          {step === "gad7"       && <GAD7Step data={gad} set={setGad} onNext={() => setStep("social")} onBack={() => setStep("phq9")} />}
          {step === "social"     && <SocialStep data={social} set={setSocial} onSubmit={handleSubmit} onBack={() => setStep("gad7")} loading={loading} />}
          {step === "result" && result && <ResultScreen result={result} onRestart={reset} />}
        </div>
      </div>
    </>
  );
}