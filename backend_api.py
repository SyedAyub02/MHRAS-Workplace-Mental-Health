"""
MHRAS — Mental Health Risk Assessment System
FastAPI Backend — Production Grade
Hybrid Framework: ML (60%) + Clinical Tools (40%)
"""

import numpy as np
import joblib
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────
# APP INIT
# ─────────────────────────────────────────────────────────
app = FastAPI(
    title="MHRAS — Mental Health Risk Assessment API",
    description="Hybrid ML + Clinical framework for workplace mental health detection",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────
# LOAD MODELS
# ─────────────────────────────────────────────────────────
MODELS = Path("models")

workplace_model    = joblib.load(MODELS / "workplace_model.pkl")
workplace_encoders = joblib.load(MODELS / "workplace_encoders.pkl")
workplace_features = joblib.load(MODELS / "workplace_feature_names.pkl")

clinical_model     = joblib.load(MODELS / "clinical_model.pkl")
clinical_features  = joblib.load(MODELS / "clinical_feature_names.pkl")

social_model       = joblib.load(MODELS / "social_model.pkl")
social_encoders    = joblib.load(MODELS / "social_encoders.pkl")
social_features    = joblib.load(MODELS / "social_feature_names.pkl")

print("✓ All models loaded")


# ─────────────────────────────────────────────────────────
# INPUT SCHEMA
# ─────────────────────────────────────────────────────────
class AssessmentInput(BaseModel):

    # Demographics
    age: int = Field(..., ge=16, le=80)
    gender: str = Field(...)  # "Male" | "Female" | "Other"

    # Workplace
    self_employed: str = "No"
    family_history: str = "No"
    work_interfere: str = "Sometimes"
    no_employees: str = "26-100"
    remote_work: str = "No"
    tech_company: str = "No"
    benefits: str = "No"
    care_options: str = "No"
    wellness_program: str = "No"
    seek_help: str = "No"
    anonymity: str = "Don't know"
    leave: str = "Don't know"
    mental_health_consequence: str = "No"
    phys_health_consequence: str = "No"
    coworkers: str = "No"
    supervisor: str = "No"
    mental_vs_physical: str = "Don't know"
    obs_consequence: str = "No"

    # PHQ-9 (1–5 scale in this dataset)
    phq1: int = Field(..., ge=1, le=5)
    phq2: int = Field(..., ge=1, le=5)
    phq3: int = Field(..., ge=1, le=5)
    phq4: int = Field(..., ge=1, le=5)
    phq5: int = Field(..., ge=1, le=5)
    phq6: int = Field(..., ge=1, le=5)
    phq7: int = Field(..., ge=1, le=5)
    phq8: int = Field(..., ge=1, le=5)
    phq9: int = Field(..., ge=1, le=5)

    # GAD-7 (1–5 scale)
    gad1: int = Field(..., ge=1, le=5)
    gad2: int = Field(..., ge=1, le=5)
    gad3: int = Field(..., ge=1, le=5)
    gad4: int = Field(..., ge=1, le=5)
    gad5: int = Field(..., ge=1, le=5)
    gad6: int = Field(..., ge=1, le=5)
    gad7: int = Field(..., ge=1, le=5)

    # Social Media
    screen_time: float = Field(..., ge=0, le=24)
    sleep_duration: float = Field(..., ge=0, le=24)
    late_night_usage: int = Field(..., ge=0, le=1)
    social_comparison: int = Field(..., ge=0, le=1)
    primary_platform: str = "Instagram"
    content_type: str = "Gaming"
    activity_type: str = "Active"
    user_archetype: str = "Average User"


# ─────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────
def safe_encode(encoder, value, fallback=0):
    try:
        return encoder.transform([str(value)])[0]
    except:
        return fallback


def get_risk_label(score: float) -> tuple:
    """score 0-1 → (label, color_key)"""
    if score < 0.25:  return ("Low",      "green")
    if score < 0.50:  return ("Medium",   "yellow")
    if score < 0.75:  return ("High",     "orange")
    return              ("Critical",  "red")


RECOMMENDATIONS = {
    "Low": [
        "Keep up your healthy work-life balance routines",
        "Regular exercise (30 min/day) continues to support mental wellbeing",
        "Practice mindfulness or journaling as preventive self-care",
        "Schedule periodic mental health check-ins with yourself",
    ],
    "Medium": [
        "Consider speaking with a trusted colleague, friend, or counselor",
        "Reduce social media use to under 2 hours/day, especially before bed",
        "Establish a consistent sleep schedule (7–9 hours nightly)",
        "Explore stress management techniques such as deep breathing or yoga",
        "Discuss workplace adjustments with your manager if stress is work-related",
    ],
    "High": [
        "Schedule an appointment with a mental health professional soon",
        "Talk to your HR department about Employee Assistance Programs (EAP)",
        "Implement a digital detox: restrict screens 1 hour before sleep",
        "Consider a medical leave or workload reduction if feasible",
        "Build a daily structure with clear boundaries between work and rest",
    ],
    "Critical": [
        "Seek immediate professional mental health support — do not delay",
        "Contact a crisis helpline: iCall (+91-9152987821) or Vandrevala Foundation (1860-2662-345)",
        "Inform a trusted person (family/friend) about how you are feeling today",
        "Request emergency leave or workplace accommodation from HR",
        "Avoid isolation — stay connected with supportive people around you",
    ],
}


# ─────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────
@app.get("/")
def health():
    return {"status": "running", "version": "2.0.0", "models": ["workplace", "clinical", "social"]}


@app.post("/predict")
def predict(data: AssessmentInput):

    # ── 1. WORKPLACE MODEL ──────────────────────────────
    work_row = {
        "Age": data.age,
        "Gender": safe_encode(workplace_encoders.get("Gender"), data.gender),
        "self_employed": safe_encode(workplace_encoders.get("self_employed"), data.self_employed),
        "family_history": safe_encode(workplace_encoders.get("family_history"), data.family_history),
        "work_interfere": safe_encode(workplace_encoders.get("work_interfere"), data.work_interfere),
        "no_employees": safe_encode(workplace_encoders.get("no_employees"), data.no_employees),
        "remote_work": safe_encode(workplace_encoders.get("remote_work"), data.remote_work),
        "tech_company": safe_encode(workplace_encoders.get("tech_company"), data.tech_company),
        "benefits": safe_encode(workplace_encoders.get("benefits"), data.benefits),
        "care_options": safe_encode(workplace_encoders.get("care_options"), data.care_options),
        "wellness_program": safe_encode(workplace_encoders.get("wellness_program"), data.wellness_program),
        "seek_help": safe_encode(workplace_encoders.get("seek_help"), data.seek_help),
        "anonymity": safe_encode(workplace_encoders.get("anonymity"), data.anonymity),
        "leave": safe_encode(workplace_encoders.get("leave"), data.leave),
        "mental_health_consequence": safe_encode(workplace_encoders.get("mental_health_consequence"), data.mental_health_consequence),
        "phys_health_consequence": safe_encode(workplace_encoders.get("phys_health_consequence"), data.phys_health_consequence),
        "coworkers": safe_encode(workplace_encoders.get("coworkers"), data.coworkers),
        "supervisor": safe_encode(workplace_encoders.get("supervisor"), data.supervisor),
        "mental_vs_physical": safe_encode(workplace_encoders.get("mental_vs_physical"), data.mental_vs_physical),
        "obs_consequence": safe_encode(workplace_encoders.get("obs_consequence"), data.obs_consequence),
    }
    import pandas as pd
    work_X = pd.DataFrame([work_row])[workplace_features]
    work_prob = workplace_model.predict_proba(work_X)[0][1]   # prob of needing treatment

    # ── 2. CLINICAL MODEL ───────────────────────────────
    phq_vals = [data.phq1, data.phq2, data.phq3, data.phq4, data.phq5,
                data.phq6, data.phq7, data.phq8, data.phq9]
    gad_vals = [data.gad1, data.gad2, data.gad3, data.gad4, data.gad5,
                data.gad6, data.gad7]
    phq_total   = sum(phq_vals)
    gad_total   = sum(gad_vals)
    phq_gad_rat = phq_total / (gad_total + 1)
    combined    = phq_total + gad_total

    clin_row = dict(
        zip(
            [f"PHQ{i}" for i in range(1,10)] + [f"GAD{i}" for i in range(1,8)] +
            ["phq_total","gad_total","phq_gad_ratio","combined_score"],
            phq_vals + gad_vals + [phq_total, gad_total, phq_gad_rat, combined]
        )
    )
    clin_X    = pd.DataFrame([clin_row])[clinical_features]
    clin_prob = clinical_model.predict_proba(clin_X)[0]      # [Low, Medium, High]
    # Map to 0-1 risk: 0*P(Low) + 0.5*P(Med) + 1.0*P(High)
    clin_score = 0.0 * clin_prob[0] + 0.5 * clin_prob[1] + 1.0 * clin_prob[2]

    # ── 3. SOCIAL MODEL ─────────────────────────────────
    sleep_deficit    = max(0, 8 - data.sleep_duration)
    screen_per_sleep = data.screen_time / (data.sleep_duration + 0.1)
    high_risk_combo  = int(data.late_night_usage and data.social_comparison)

    soc_row = {
        "Age": data.age,
        "Gender": safe_encode(social_encoders.get("Gender"), data.gender),
        "Primary_Platform": safe_encode(social_encoders.get("Primary_Platform"), data.primary_platform),
        "Daily_Screen_Time_Hours": data.screen_time,
        "Dominant_Content_Type": safe_encode(social_encoders.get("Dominant_Content_Type"), data.content_type),
        "Activity_Type": safe_encode(social_encoders.get("Activity_Type"), data.activity_type),
        "Late_Night_Usage": data.late_night_usage,
        "Social_Comparison_Trigger": data.social_comparison,
        "Sleep_Duration_Hours": data.sleep_duration,
        "User_Archetype": safe_encode(social_encoders.get("User_Archetype"), data.user_archetype),
        "sleep_deficit": sleep_deficit,
        "screen_per_sleep": screen_per_sleep,
        "high_risk_combo": high_risk_combo,
    }
    soc_X    = pd.DataFrame([soc_row])[social_features]
    soc_prob = social_model.predict_proba(soc_X)[0]
    soc_score = 0.0 * soc_prob[0] + 0.5 * soc_prob[1] + 1.0 * soc_prob[2]

    # ── 4. HYBRID FUSION ────────────────────────────────
    # Weights: Clinical 60% (PHQ+GAD most validated), Workplace 25%, Social 15%
    CLINICAL_W  = 0.60
    WORKPLACE_W = 0.25
    SOCIAL_W    = 0.15

    final_score = (
        clin_score  * CLINICAL_W +
        work_prob   * WORKPLACE_W +
        soc_score   * SOCIAL_W
    )

    risk_label, risk_color = get_risk_label(final_score)

    # Clinical interpretations
    phq_norm = (phq_total - 9) / (45 - 9)  # dataset scale 1-5, 9 items → 9-45
    gad_norm = (gad_total - 7) / (35 - 7)
    phq_severity = "Minimal" if phq_norm < 0.2 else "Mild" if phq_norm < 0.4 else "Moderate" if phq_norm < 0.6 else "Moderately Severe" if phq_norm < 0.8 else "Severe"
    gad_severity = "Minimal" if gad_norm < 0.25 else "Mild" if gad_norm < 0.5 else "Moderate" if gad_norm < 0.75 else "Severe"

    return {
        "final_risk": risk_label,
        "risk_color": risk_color,
        "composite_score": round(final_score * 100, 1),
        "confidence": round(max(clin_prob.max(), 0.5) * 100, 1),

        "breakdown": {
            "clinical":  round(clin_score  * 100, 1),
            "workplace": round(work_prob   * 100, 1),
            "social":    round(soc_score   * 100, 1),
        },

        "weights": {
            "clinical": CLINICAL_W,
            "workplace": WORKPLACE_W,
            "social": SOCIAL_W,
        },

        "clinical_detail": {
            "phq_total": phq_total,
            "phq_severity": phq_severity,
            "gad_total": gad_total,
            "gad_severity": gad_severity,
            "phq_probs": {
                "low": round(float(clin_prob[0]), 3),
                "medium": round(float(clin_prob[1]), 3),
                "high": round(float(clin_prob[2]), 3),
            }
        },

        "recommendations": RECOMMENDATIONS[risk_label],
    }
