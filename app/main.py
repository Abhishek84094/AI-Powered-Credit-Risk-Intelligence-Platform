"""
CredPulse Credit Risk Intelligence Platform
FastAPI Backend — Serves ML, SHAP, Business Rules, and Talk-to-Data endpoints.
"""

import json
import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Any
from starlette.responses import FileResponse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, ".env"))
    load_dotenv(os.path.join(ROOT, ".env.example"))
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(ROOT, "models")
_MODEL_LOAD_ERROR: Optional[str] = None

def _models_ready() -> bool:
    required = ["pipeline.pkl", "lgbm_calibrated.pkl", "lgbm_base.pkl",
                "risk_thresholds.json", "feature_names.json"]
    return all(os.path.exists(os.path.join(MODELS_DIR, f)) for f in required)

def _db_ready() -> bool:
    db_path = os.path.join(ROOT, "sql", "credit_risk.db")
    return os.path.exists(db_path) and os.path.getsize(db_path) > 0

def _verify_and_preload_models() -> bool:
    """Startup verification: preload models and catch/log any sklearn/pickle incompatibility."""
    global _MODEL_LOAD_ERROR
    if not _models_ready():
        logger.warning("Model files not found in %s. Run: py -3 src/ml/train.py", MODELS_DIR)
        return False
    try:
        from src.ml.predict import _get_artifacts
        _get_artifacts()
        _MODEL_LOAD_ERROR = None
        logger.info("[OK] Startup check: Model pipeline and calibrated LightGBM loaded successfully.")
        return True
    except Exception as e:
        err_msg = (
            f"model/sklearn version mismatch: Failed to unpickle model artifacts. "
            f"Ensure environment has scikit-learn==1.6.1, lightgbm==4.7.0, numpy==1.26.4. "
            f"Error details: {e}"
        )
        logger.error(err_msg)
        _MODEL_LOAD_ERROR = err_msg
        return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    _verify_and_preload_models()
    yield

app = FastAPI(
    title="CredPulse Credit Risk Intelligence Platform",
    description="AI-powered credit risk scoring, explainability, and analytics API",
    version="1.0.0",
    lifespan=lifespan,
)

api_router = APIRouter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ─── Pydantic Models ──────────────────────────────────────────────────────────

class ApplicantInput(BaseModel):
    # Core demographics
    CODE_GENDER: Optional[str] = Field(None, example="F")
    AGE_YEARS: Optional[float] = Field(None, example=35.0)
    NAME_EDUCATION_TYPE: Optional[str] = Field(None, example="Higher education")
    NAME_INCOME_TYPE: Optional[str] = Field(None, example="Working")
    NAME_FAMILY_STATUS: Optional[str] = Field(None, example="Married")
    NAME_HOUSING_TYPE: Optional[str] = Field(None, example="House / apartment")
    NAME_CONTRACT_TYPE: Optional[str] = Field(None, example="Cash loans")
    OCCUPATION_TYPE: Optional[str] = Field(None, example="Managers")
    FLAG_OWN_CAR: Optional[str] = Field(None, example="Y")
    FLAG_OWN_REALTY: Optional[str] = Field(None, example="Y")
    CNT_CHILDREN: Optional[int] = Field(None, example=1)
    CNT_FAM_MEMBERS: Optional[float] = Field(None, example=3.0)
    REGION_RATING_CLIENT: Optional[int] = Field(None, example=2)

    # Financial
    AMT_INCOME_TOTAL: Optional[float] = Field(None, example=150000.0)
    AMT_CREDIT: Optional[float] = Field(None, example=450000.0)
    AMT_ANNUITY: Optional[float] = Field(None, example=22500.0)
    AMT_GOODS_PRICE: Optional[float] = Field(None, example=400000.0)

    # Days columns (negative values = past)
    DAYS_BIRTH: Optional[float] = Field(None, example=-12775.0)
    DAYS_EMPLOYED: Optional[float] = Field(None, example=-1825.0)
    DAYS_REGISTRATION: Optional[float] = Field(None, example=-3000.0)
    DAYS_ID_PUBLISH: Optional[float] = Field(None, example=-1000.0)

    # External scores
    EXT_SOURCE_1: Optional[float] = Field(None, example=0.5)
    EXT_SOURCE_2: Optional[float] = Field(None, example=0.55)
    EXT_SOURCE_3: Optional[float] = Field(None, example=0.52)

    # Bureau features (from aggregation)
    bur_n_credits: Optional[float] = Field(None, example=3.0)
    bur_CREDIT_DAY_OVERDUE_max: Optional[float] = Field(None, example=0.0)
    bur_AMT_CREDIT_SUM_OVERDUE_sum: Optional[float] = Field(None, example=0.0)

    # Previous application features
    prev_n_applications: Optional[float] = Field(None, example=2.0)
    prev_approval_rate: Optional[float] = Field(None, example=1.0)
    prev_refusal_rate: Optional[float] = Field(None, example=0.0)

    # Installment features
    inst_PAYMENT_DELAY_DAYS_mean: Optional[float] = Field(None, example=0.0)
    inst_IS_LATE_mean: Optional[float] = Field(None, example=0.0)


class ChatQuestion(BaseModel):
    question: str = Field(..., example="What is the default rate by education type?")
    api_key: Optional[str] = Field(None, description="Groq API key (optional, uses offline fallback if not provided)")


# ─── Health & Status ──────────────────────────────────────────────────────────

@api_router.get("/health")
def health():
    return {
        "status": "ok",
        "models_ready": _models_ready() and (_MODEL_LOAD_ERROR is None),
        "database_ready": _db_ready(),
        "model_load_error": _MODEL_LOAD_ERROR,
    }


@api_router.get("/status")
def status():
    from src.ml.predict import get_model_metadata
    meta = {}
    if _models_ready() and (_MODEL_LOAD_ERROR is None):
        try:
            meta = get_model_metadata()
        except Exception as e:
            meta = {"error": str(e)}
    return {
        "models_ready": _models_ready() and (_MODEL_LOAD_ERROR is None),
        "database_ready": _db_ready(),
        "model_load_error": _MODEL_LOAD_ERROR,
        "metadata": meta,
    }


# ─── EDA Endpoint ─────────────────────────────────────────────────────────────

@api_router.get("/eda/summary")
def eda_summary():
    """Return EDA summary for the UI dashboard."""
    eda_path = os.path.join(ROOT, "reports", "eda_summary.json")
    if not os.path.exists(eda_path):
        raise HTTPException(status_code=404, detail="EDA summary not found. Run notebooks/eda.py first.")
    with open(eda_path) as f:
        return json.load(f)


@api_router.get("/eda/insights")
def eda_insights():
    """Return business insights from EDA."""
    eda_path = os.path.join(ROOT, "reports", "eda_summary.json")
    if not os.path.exists(eda_path):
        raise HTTPException(status_code=404, detail="EDA summary not found.")
    with open(eda_path) as f:
        data = json.load(f)
    return {
        "business_insights": data.get("business_insights", []),
        "target": data.get("target", {}),
        "outlier_analysis": data.get("outlier_analysis", {}),
    }


# ─── Prediction Endpoint ──────────────────────────────────────────────────────

@api_router.post("/predict")
def predict(applicant: ApplicantInput):
    """Score an applicant and return default probability + risk band."""
    if not _models_ready():
        raise HTTPException(
            status_code=503,
            detail="Models not trained yet. Run: py -3 src/ml/train.py"
        )
    if _MODEL_LOAD_ERROR:
        raise HTTPException(
            status_code=503,
            detail=f"Model loading error: {_MODEL_LOAD_ERROR}"
        )
    from src.ml.predict import predict_single
    features = {k: v for k, v in applicant.model_dump().items() if v is not None}
    try:
        result = predict_single(features)
        return result
    except Exception as e:
        logger.error("Prediction error: %s", e)
        if "model/sklearn version mismatch" in str(e):
            raise HTTPException(status_code=503, detail=str(e))
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@api_router.post("/predict/explain")
def predict_with_explanation(applicant: ApplicantInput):
    """Score + SHAP explanation for a single applicant."""
    if not _models_ready():
        raise HTTPException(status_code=503, detail="Models not ready.")
    if _MODEL_LOAD_ERROR:
        raise HTTPException(
            status_code=503,
            detail=f"Model loading error: {_MODEL_LOAD_ERROR}"
        )
    from src.ml.predict import predict_single, _get_artifacts, prepare_applicant_df
    from src.explainability.explainer import explain_prediction, generate_plain_english_explanation
    from src.rules.rule_engine import evaluate_all_rules

    features = {k: v for k, v in applicant.model_dump().items() if v is not None}

    # Get prediction
    prediction = predict_single(features)

    # Get SHAP explanation
    try:
        pipeline, model, thresholds, feature_names = _get_artifacts()
        df = prepare_applicant_df(features, pipeline)
        X_proc = pipeline.transform(df)
        shap_result = explain_prediction(X_proc[0], feature_names)
        plain_explanation = generate_plain_english_explanation(prediction, shap_result)
    except Exception as e:
        logger.warning("SHAP explanation failed: %s", e)
        shap_result = {"error": str(e)}
        plain_explanation = "Explanation unavailable."

    # Business rules
    rule_result = evaluate_all_rules(features)

    return {
        "prediction": prediction,
        "shap_explanation": shap_result,
        "plain_explanation": plain_explanation,
        "business_rules": rule_result,
    }


# ─── Feature Importance Endpoint ──────────────────────────────────────────────

@api_router.get("/model/feature-importance")
def feature_importance(top_n: int = 20):
    """Return top feature importances for global explainability UI."""
    if not _models_ready():
        raise HTTPException(status_code=503, detail="Models not ready.")
    importance_path = os.path.join(MODELS_DIR, "feature_importance.json")
    if not os.path.exists(importance_path):
        raise HTTPException(status_code=404, detail="Feature importance not computed yet.")
    with open(importance_path) as f:
        data = json.load(f)
    top_items = data[:top_n]
    return {
        "features": top_items,
        "feature_importance": top_items,
    }


@api_router.get("/model/metadata")
def model_metadata():
    """Return model metadata and experiment results."""
    if not _models_ready():
        raise HTTPException(status_code=503, detail="Models not ready.")
    from src.ml.predict import get_model_metadata
    result = get_model_metadata()
    exp_path = os.path.join(ROOT, "experiments", "model_experiments.csv")
    if os.path.exists(exp_path):
        import csv
        with open(exp_path) as f:
            reader = csv.DictReader(f)
            result["experiments"] = [row for row in reader]
    return result


# ─── Business Rules Endpoints ─────────────────────────────────────────────────

@api_router.get("/rules")
def get_rules():
    """Return all business rules documentation."""
    from src.rules.rule_engine import get_all_rules_documentation
    return {"rules": get_all_rules_documentation()}


@api_router.post("/rules/evaluate")
def evaluate_rules(applicant: ApplicantInput):
    """Evaluate business rules for a given applicant."""
    from src.rules.rule_engine import evaluate_all_rules
    features = {k: v for k, v in applicant.model_dump().items() if v is not None}
    return evaluate_all_rules(features)


# ─── Talk-to-Data Endpoint ────────────────────────────────────────────────────

@api_router.post("/chat")
def chat(question: ChatQuestion):
    """Natural language question → SQL → Database result → Business answer."""
    if not _db_ready():
        raise HTTPException(
            status_code=503,
            detail="Analytical database not initialized. Please place Home Credit CSVs in ./data and run 'python sql/init_db.py' to enable Talk-to-Data."
        )
    from src.talk_to_data.nl_to_sql import answer_question
    api_key = question.api_key or os.getenv("GROQ_API_KEY")
    result = answer_question(question.question, api_key=api_key)
    if "rows" in result and "results" not in result:
        result["results"] = result["rows"]
    return result


# Include router under both /api and root
app.include_router(api_router, prefix="/api")
app.include_router(api_router)

# Mount frontend production build if present
dist_dir = os.path.join(ROOT, "frontend", "dist")
if os.path.exists(dist_dir):
    from fastapi.staticfiles import StaticFiles
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Don't intercept API calls
        if full_path.startswith("api/") or full_path in ["health", "status", "predict", "chat", "rules"]:
            raise HTTPException(status_code=404)
        file_path = os.path.join(dist_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

