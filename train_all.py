import pandas as pd
import numpy as np
import joblib
import warnings
import json
from pathlib import Path

warnings.filterwarnings("ignore")

from sklearn.ensemble import (
    HistGradientBoostingClassifier,
    ExtraTreesClassifier,
    RandomForestClassifier,
    StackingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, f1_score, roc_auc_score
from sklearn.pipeline import Pipeline

DATA = Path("Datasets")
OUT  = Path("models")
OUT.mkdir(exist_ok=True)

results = {}

# ── MODEL 1: WORKPLACE ──
print("\n=== MODEL 1: WORKPLACE (survey.csv) ===")
df = pd.read_csv(DATA / "survey.csv")
df = df[(df["Age"] >= 16) & (df["Age"] <= 75)].copy()

def clean_gender(g):
    g = str(g).lower().strip()
    if any(x in g for x in ["female","woman","f","girl"]): return "Female"
    if any(x in g for x in ["male","man","m","boy"]): return "Male"
    return "Other"

df["Gender"] = df["Gender"].apply(clean_gender)
df["work_interfere"] = df["work_interfere"].fillna("Unknown")

WORK_FEATURES = [
    "Age","Gender","self_employed","family_history","work_interfere",
    "no_employees","remote_work","tech_company","benefits","care_options",
    "wellness_program","seek_help","anonymity","leave",
    "mental_health_consequence","phys_health_consequence","coworkers",
    "supervisor","mental_vs_physical","obs_consequence"
]
TARGET = "treatment"
df = df[WORK_FEATURES + [TARGET]].fillna("Unknown")

encoders_work = {}
for col in df.select_dtypes("object").columns:
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col].astype(str))
    encoders_work[col] = le

X = df.drop(TARGET, axis=1)
y = df[TARGET]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

work_model = StackingClassifier(
    estimators=[
        ("hgb", HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_depth=6, random_state=42)),
        ("et",  ExtraTreesClassifier(n_estimators=300, max_depth=12, n_jobs=-1, random_state=42)),
        ("mlp", Pipeline([("scaler", StandardScaler()), ("clf", MLPClassifier(hidden_layer_sizes=(128,64,32), max_iter=500, early_stopping=True, random_state=42))])),
    ],
    final_estimator=LogisticRegression(C=1.0, max_iter=1000, random_state=42),
    cv=5, n_jobs=-1
)
print("Training... (2-3 mins)")
work_model.fit(X_train, y_train)
pred = work_model.predict(X_test)
acc = accuracy_score(y_test, pred)
f1  = f1_score(y_test, pred, average="weighted")
auc = roc_auc_score(y_test, work_model.predict_proba(X_test)[:,1])
print(f"  Accuracy: {acc:.4f}  F1: {f1:.4f}  AUC: {auc:.4f}")
joblib.dump(work_model,    OUT / "workplace_model.pkl")
joblib.dump(encoders_work, OUT / "workplace_encoders.pkl")
joblib.dump(list(X.columns), OUT / "workplace_feature_names.pkl")
results["workplace"] = {"accuracy": round(acc,4), "f1": round(f1,4), "auc": round(auc,4)}
print("  Saved!")

# ── MODEL 2: CLINICAL ──
print("\n=== MODEL 2: CLINICAL (PHQ9_GAD7_df.csv) ===")
df2 = pd.read_csv(DATA / "PHQ9_GAD7_df.csv", sep=";")
df2["risk"] = df2["CONDITION"].map({"H": 0, "P": 1, "D": 2})
PHQ_FEATS = [f"PHQ{i}" for i in range(1,10)]
GAD_FEATS = [f"GAD{i}" for i in range(1,8)]
df2["phq_total"] = df2[PHQ_FEATS].sum(axis=1)
df2["gad_total"] = df2[GAD_FEATS].sum(axis=1)
df2["phq_gad_ratio"] = df2["phq_total"] / (df2["gad_total"] + 1)
df2["combined_score"] = df2["phq_total"] + df2["gad_total"]
ALL_CLINICAL = PHQ_FEATS + GAD_FEATS + ["phq_total","gad_total","phq_gad_ratio","combined_score"]

X2 = df2[ALL_CLINICAL]
y2 = df2["risk"]
X2_train, X2_test, y2_train, y2_test = train_test_split(X2, y2, test_size=0.2, random_state=42, stratify=y2)

clinical_model = StackingClassifier(
    estimators=[
        ("hgb", HistGradientBoostingClassifier(max_iter=400, learning_rate=0.03, max_depth=5, random_state=42)),
        ("et",  ExtraTreesClassifier(n_estimators=400, max_depth=10, n_jobs=-1, random_state=42)),
        ("rf",  RandomForestClassifier(n_estimators=300, max_depth=10, n_jobs=-1, random_state=42)),
        ("mlp", Pipeline([("scaler", StandardScaler()), ("clf", MLPClassifier(hidden_layer_sizes=(256,128,64), max_iter=600, early_stopping=True, random_state=42))])),
    ],
    final_estimator=LogisticRegression(C=2.0, max_iter=1000, random_state=42),
    cv=5, n_jobs=-1
)
print("Training... (3-4 mins)")
clinical_model.fit(X2_train, y2_train)
pred2 = clinical_model.predict(X2_test)
acc2 = accuracy_score(y2_test, pred2)
f1_2 = f1_score(y2_test, pred2, average="weighted")
auc2 = roc_auc_score(y2_test, clinical_model.predict_proba(X2_test), multi_class="ovr", average="weighted")
print(f"  Accuracy: {acc2:.4f}  F1: {f1_2:.4f}  AUC: {auc2:.4f}")
joblib.dump(clinical_model, OUT / "clinical_model.pkl")
joblib.dump(ALL_CLINICAL,   OUT / "clinical_feature_names.pkl")
results["clinical"] = {"accuracy": round(acc2,4), "f1": round(f1_2,4), "auc": round(auc2,4)}
print("  Saved!")

# ── MODEL 3: SOCIAL ──
print("\n=== MODEL 3: SOCIAL MEDIA ===")
df3 = pd.read_csv(DATA / "social_media_mental_health.csv")
df3["total_score"] = df3["PHQ_9_Score"] + df3["GAD_7_Score"]
df3["risk"] = df3["total_score"].apply(lambda s: 0 if s<=9 else (1 if s<=19 else 2))
df3["sleep_deficit"]    = np.maximum(0, 8 - df3["Sleep_Duration_Hours"])
df3["screen_per_sleep"] = df3["Daily_Screen_Time_Hours"] / (df3["Sleep_Duration_Hours"] + 0.1)
df3["high_risk_combo"]  = (df3["Late_Night_Usage"] & df3["Social_Comparison_Trigger"]).astype(int)
SOCIAL_FEATURES = ["Age","Gender","Primary_Platform","Daily_Screen_Time_Hours",
    "Dominant_Content_Type","Activity_Type","Late_Night_Usage",
    "Social_Comparison_Trigger","Sleep_Duration_Hours","User_Archetype",
    "sleep_deficit","screen_per_sleep","high_risk_combo"]

X3 = df3[SOCIAL_FEATURES].copy()
y3 = df3["risk"]
encoders_social = {}
for col in X3.select_dtypes("object").columns:
    le = LabelEncoder()
    X3[col] = le.fit_transform(X3[col].astype(str))
    encoders_social[col] = le

X3_train, X3_test, y3_train, y3_test = train_test_split(X3, y3, test_size=0.2, random_state=42, stratify=y3)

social_model = StackingClassifier(
    estimators=[
        ("hgb", HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_depth=6, random_state=42)),
        ("et",  ExtraTreesClassifier(n_estimators=300, max_depth=12, n_jobs=-1, random_state=42)),
        ("mlp", Pipeline([("scaler", StandardScaler()), ("clf", MLPClassifier(hidden_layer_sizes=(128,64), max_iter=400, early_stopping=True, random_state=42))])),
    ],
    final_estimator=LogisticRegression(C=1.0, max_iter=1000, random_state=42),
    cv=5, n_jobs=-1
)
print("Training... (2-3 mins)")
social_model.fit(X3_train, y3_train)
pred3 = social_model.predict(X3_test)
acc3 = accuracy_score(y3_test, pred3)
f1_3 = f1_score(y3_test, pred3, average="weighted")
auc3 = roc_auc_score(y3_test, social_model.predict_proba(X3_test), multi_class="ovr", average="weighted")
print(f"  Accuracy: {acc3:.4f}  F1: {f1_3:.4f}  AUC: {auc3:.4f}")
joblib.dump(social_model,    OUT / "social_model.pkl")
joblib.dump(encoders_social, OUT / "social_encoders.pkl")
joblib.dump(SOCIAL_FEATURES, OUT / "social_feature_names.pkl")
results["social"] = {"accuracy": round(acc3,4), "f1": round(f1_3,4), "auc": round(auc3,4)}
print("  Saved!")

# ── SUMMARY ──
print("\n" + "="*50)
print("ALL MODELS TRAINED SUCCESSFULLY")
print("="*50)
for name, r in results.items():
    print(f"  {name:12s}  acc={r['accuracy']}  f1={r['f1']}  auc={r['auc']}")
print(f"\nModels saved in: {OUT.resolve()}")