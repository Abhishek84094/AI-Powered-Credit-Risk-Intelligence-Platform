"""
CredPulse Credit Risk Intelligence Platform
Layer 4: Explainability — SHAP-based global and local explanations.

Every explanation comes from the actual model prediction.
No fabricated explanations.
"""

import json
import logging
import os

import joblib
import numpy as np
import pandas as pd
import shap

logger = logging.getLogger(__name__)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(ROOT, "models")

# Friendly feature name mapping for UI display
FEATURE_DISPLAY_NAMES = {
    "EXT_SOURCE_MEAN": "External Credit Score (avg)",
    "EXT_SOURCE_2": "External Credit Score 2",
    "EXT_SOURCE_3": "External Credit Score 3",
    "EXT_SOURCE_1": "External Credit Score 1",
    "EXT_SOURCE_MIN": "External Credit Score (min)",
    "EXT_SOURCE_PRODUCT": "External Credit Score (product)",
    "DEBT_TO_INCOME": "Debt-to-Income Ratio",
    "ANNUITY_TO_INCOME": "Annuity-to-Income Ratio",
    "CREDIT_TO_GOODS": "Credit-to-Goods Ratio",
    "INCOME_PER_PERSON": "Income Per Family Member",
    "APPLICANT_AGE_YEARS": "Applicant Age (years)",
    "EMPLOYED_YEARS": "Years Employed",
    "DAYS_EMPLOYED_ANOM": "Employment Anomaly Flag",
    "AMT_INCOME_TOTAL": "Annual Income",
    "AMT_CREDIT": "Loan Amount",
    "AMT_ANNUITY": "Annual Repayment",
    "AMT_GOODS_PRICE": "Goods Price",
    "bur_n_credits": "# Bureau Credits",
    "bur_CREDIT_DAY_OVERDUE_max": "Max Days Overdue (Bureau)",
    "bur_AMT_CREDIT_SUM_OVERDUE_sum": "Total Overdue Amount (Bureau)",
    "bur_active_credit_ratio": "Active Credit Ratio",
    "prev_n_applications": "# Previous HC Applications",
    "prev_approval_rate": "Previous Approval Rate",
    "prev_refusal_rate": "Previous Refusal Rate",
    "inst_PAYMENT_DELAY_DAYS_mean": "Avg Payment Delay (days)",
    "inst_IS_LATE_mean": "Late Payment Rate",
    "inst_IS_UNDERPAID_mean": "Underpayment Rate",
    "pos_IS_DPD_mean": "POS/CASH DPD Rate",
    "cc_UTILIZATION_mean": "Credit Card Utilization",
    "cc_IS_DPD_mean": "Credit Card DPD Rate",
    "REGION_RATING_CLIENT": "Region Risk Rating",
}


def _display_name(feature: str) -> str:
    return FEATURE_DISPLAY_NAMES.get(feature, feature.replace("_", " ").title())


def _load_base_model():
    """Load the base LightGBM model (required for TreeSHAP)."""
    base_path = os.path.join(MODELS_DIR, "lgbm_base.pkl")
    if not os.path.exists(base_path):
        raise FileNotFoundError(f"Base model not found at {base_path}. Run train.py first.")
    return joblib.load(base_path)


def _load_pipeline():
    pipeline_path = os.path.join(MODELS_DIR, "pipeline.pkl")
    if not os.path.exists(pipeline_path):
        raise FileNotFoundError(f"Pipeline not found at {pipeline_path}.")
    return joblib.load(pipeline_path)


def _load_feature_names() -> list[str]:
    feat_path = os.path.join(MODELS_DIR, "feature_names.json")
    if not os.path.exists(feat_path):
        raise FileNotFoundError(f"Feature names not found at {feat_path}.")
    with open(feat_path) as f:
        return json.load(f)


# ─── Global explanation ───────────────────────────────────────────────────────

def compute_global_importance(X_sample: np.ndarray, feature_names: list[str],
                               n_samples: int = 1000) -> list[dict]:
    """
    Compute mean absolute SHAP values for global feature importance.
    Uses a random sample to keep computation fast.
    """
    logger.info("Computing global SHAP importance on %d samples...", n_samples)
    model = _load_base_model()
    rng = np.random.RandomState(42)
    idx = rng.choice(len(X_sample), size=min(n_samples, len(X_sample)), replace=False)
    X_sub = X_sample[idx]
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sub)
    # For binary classification, shap_values is a list [class0, class1]
    if isinstance(shap_values, list):
        shap_vals = shap_values[1]  # Use class 1 (default)
    else:
        shap_vals = shap_values
    mean_abs = np.abs(shap_vals).mean(axis=0)
    importance = sorted(
        [{"feature": fn, "display_name": _display_name(fn),
          "mean_abs_shap": round(float(v), 6)}
         for fn, v in zip(feature_names, mean_abs)],
        key=lambda x: x["mean_abs_shap"], reverse=True
    )
    logger.info("  ✓ Global SHAP computed — Top feature: %s (%.4f)",
                importance[0]["display_name"], importance[0]["mean_abs_shap"])
    return importance


# ─── Local explanation ────────────────────────────────────────────────────────

def explain_prediction(X_single: np.ndarray, feature_names: list[str]) -> dict:
    """
    Generate a local SHAP explanation for one prediction.
    Returns structured explanation with risk factors and human-readable interpretation.
    """
    model = _load_base_model()
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_single.reshape(1, -1))

    if isinstance(shap_values, list):
        sv = shap_values[1][0]  # class 1, first sample
        base_val = explainer.expected_value[1]
    else:
        sv = shap_values[0]
        base_val = explainer.expected_value

    # Build contribution list
    contributions = [
        {
            "feature": fn,
            "display_name": _display_name(fn),
            "shap_value": round(float(sv[i]), 6),
            "feature_value": round(float(X_single[i]), 4) if not np.isnan(X_single[i]) else None,
        }
        for i, fn in enumerate(feature_names)
    ]
    contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

    # Risk-increasing (positive SHAP) and risk-reducing (negative SHAP)
    risk_increasing = [c for c in contributions if c["shap_value"] > 0][:5]
    risk_reducing = [c for c in contributions if c["shap_value"] < 0][:5]

    # Human-readable interpretation
    def _interpret(c: dict) -> str:
        fn = c["feature"]
        val = c["feature_value"]
        direction = "increases" if c["shap_value"] > 0 else "reduces"
        if fn in ["EXT_SOURCE_MEAN", "EXT_SOURCE_2", "EXT_SOURCE_3", "EXT_SOURCE_1"]:
            return f"External credit score of {val:.3f} {direction} default risk"
        elif fn == "DEBT_TO_INCOME":
            return f"Debt-to-income ratio of {val:.2f}× {direction} default risk"
        elif fn == "APPLICANT_AGE_YEARS":
            return f"Applicant age of {val:.1f} years {direction} default risk"
        elif fn == "ANNUITY_TO_INCOME":
            return f"Annual repayment burden ({val:.2%} of income) {direction} default risk"
        elif fn == "inst_PAYMENT_DELAY_DAYS_mean":
            return f"Average payment delay of {val:.1f} days {direction} default risk"
        elif fn == "inst_IS_LATE_mean":
            return f"Late payment rate of {val:.1%} {direction} default risk"
        elif fn == "prev_refusal_rate":
            return f"Previous application refusal rate of {val:.1%} {direction} default risk"
        elif fn == "bur_CREDIT_DAY_OVERDUE_max":
            return f"Bureau overdue of {val:.0f} days {direction} default risk"
        else:
            return f"{_display_name(fn)} (value: {val}) {direction} default risk"

    return {
        "base_value": round(float(base_val), 4),
        "top_contributions": contributions[:10],
        "risk_increasing_factors": [
            {**c, "interpretation": _interpret(c)} for c in risk_increasing
        ],
        "risk_reducing_factors": [
            {**c, "interpretation": _interpret(c)} for c in risk_reducing
        ],
        "total_top_shap_features": len(contributions),
    }


def generate_plain_english_explanation(prediction_result: dict, shap_result: dict) -> str:
    """
    Generate a non-technical, human-readable risk explanation summary.
    Always reflects actual model output — never fabricated.
    """
    prob = prediction_result["risk_score_pct"]
    band = prediction_result["risk_band"]

    emoji_map = {"LOW": "🟢", "MEDIUM": "🟡", "HIGH": "🔴"}
    summary = [
        f"**Risk Score:** {prob:.1f}%",
        f"**Risk Band:** {emoji_map.get(band, '')} {band}",
        "",
        "**Main factors increasing risk:**",
    ]
    for f in shap_result.get("risk_increasing_factors", [])[:3]:
        summary.append(f"  • {f['interpretation']}")

    summary.append("")
    summary.append("**Factors reducing risk:**")
    for f in shap_result.get("risk_reducing_factors", [])[:3]:
        summary.append(f"  • {f['interpretation']}")

    if band == "HIGH":
        summary.append("\n⚠️ This applicant shows several elevated risk signals.")
    elif band == "MEDIUM":
        summary.append("\nℹ️ This applicant shows mixed risk signals.")
    else:
        summary.append("\n✅ This applicant shows predominantly low-risk signals.")

    return "\n".join(summary)
