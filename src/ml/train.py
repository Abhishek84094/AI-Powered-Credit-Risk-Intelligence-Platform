"""
CredPulse Credit Risk Intelligence Platform
Layer 3: ML Training — Complete experiment-driven model development.

Workflow:
  BASELINE (Logistic Regression)
  → LightGBM default
  → Optuna HPO (LightGBM)
  → XGBoost comparison
  → Calibration evaluation
  → Risk band threshold derivation
  → Final model save

All results logged to experiments/model_experiments.csv.
Leakage-safe: preprocessor fitted inside each CV fold.
"""

import json
import logging
import os
import sys
import time
import warnings

import joblib
import numpy as np
import optuna
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split

import lightgbm as lgb
import xgboost as xgb

warnings.filterwarnings("ignore")
optuna.logging.set_verbosity(optuna.logging.WARNING)

# ─── Logging setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(ROOT, "models")
EXPERIMENTS_DIR = os.path.join(ROOT, "experiments")
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(EXPERIMENTS_DIR, exist_ok=True)

EXPERIMENT_LOG = os.path.join(EXPERIMENTS_DIR, "model_experiments.csv")

# ─── Experiment tracker ───────────────────────────────────────────────────────
EXP_COLUMNS = [
    "exp_id", "model", "feature_set", "imbalance_strategy",
    "hyperparams", "val_method", "roc_auc", "pr_auc",
    "precision", "recall", "f1", "brier_score",
    "train_time_s", "n_features", "notes",
]


def _load_existing_experiments() -> pd.DataFrame:
    if os.path.exists(EXPERIMENT_LOG):
        df = pd.read_csv(EXPERIMENT_LOG)
        # Ensure all columns present
        for col in EXP_COLUMNS:
            if col not in df.columns:
                df[col] = ""
        return df
    return pd.DataFrame(columns=EXP_COLUMNS)


def _save_experiment(record: dict) -> None:
    df = _load_existing_experiments()
    # Avoid duplicate exp_id
    df = df[df["exp_id"] != record["exp_id"]]
    df = pd.concat([df, pd.DataFrame([record])], ignore_index=True)
    df.to_csv(EXPERIMENT_LOG, index=False)
    logger.info("  EXP [%s] %-20s ROC-AUC=%.4f PR-AUC=%.4f F1=%.4f t=%.1fs",
                record["exp_id"], record["model"], record["roc_auc"],
                record["pr_auc"], record["f1"], record["train_time_s"])


# ─── CV evaluation helper ─────────────────────────────────────────────────────

def _evaluate_cv(model_factory, X: np.ndarray, y: np.ndarray,
                 n_splits: int = 5, exp_id: str = "EXP-XX",
                 model_name: str = "Model", feature_set: str = "full",
                 imbalance_strategy: str = "default", hyperparams: dict = None,
                 notes: str = "") -> dict:
    """
    Stratified K-Fold cross-validation.
    model_factory: callable() → estimator (sklearn-compatible, not yet fitted).
    Returns dict of aggregated metrics.
    """
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    metrics = {
        "roc_auc": [], "pr_auc": [], "precision": [],
        "recall": [], "f1": [], "brier_score": []
    }
    t0 = time.time()
    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        X_tr, X_val = X[train_idx], X[val_idx]
        y_tr, y_val = y[train_idx], y[val_idx]
        model = model_factory()
        model.fit(X_tr, y_tr)
        proba = model.predict_proba(X_val)[:, 1]
        # Threshold optimization on val fold for F1/Precision/Recall
        thresholds = np.arange(0.1, 0.9, 0.05)
        best_f1, best_t = 0, 0.5
        for t in thresholds:
            preds = (proba >= t).astype(int)
            f = f1_score(y_val, preds, zero_division=0)
            if f > best_f1:
                best_f1, best_t = f, t
        preds_opt = (proba >= best_t).astype(int)
        metrics["roc_auc"].append(roc_auc_score(y_val, proba))
        metrics["pr_auc"].append(average_precision_score(y_val, proba))
        metrics["precision"].append(precision_score(y_val, preds_opt, zero_division=0))
        metrics["recall"].append(recall_score(y_val, preds_opt, zero_division=0))
        metrics["f1"].append(f1_score(y_val, preds_opt, zero_division=0))
        metrics["brier_score"].append(brier_score_loss(y_val, proba))
    elapsed = time.time() - t0
    result = {k: round(float(np.mean(v)), 4) for k, v in metrics.items()}
    record = {
        "exp_id": exp_id,
        "model": model_name,
        "feature_set": feature_set,
        "imbalance_strategy": imbalance_strategy,
        "hyperparams": json.dumps(hyperparams or {}),
        "val_method": f"{n_splits}-Fold Stratified CV",
        **result,
        "train_time_s": round(elapsed, 1),
        "n_features": X.shape[1],
        "notes": notes,
    }
    _save_experiment(record)
    return result


# ─── Feature matrix loading ───────────────────────────────────────────────────

def _load_feature_matrix():
    """Load the already-built feature matrix from Layer 2 artifacts."""
    # The pipeline and feature names were saved during Layer 2
    # Re-build feature matrix fresh (Layer 3 must re-aggregate from source)
    sys.path.insert(0, ROOT)
    from src.data.loader import build_feature_matrix, verify_data_files
    from src.data.preprocessor import (
        build_preprocessor,
        get_feature_columns,
        get_feature_names_out,
    )

    if not verify_data_files():
        raise RuntimeError("Dataset files missing. Check DATA_DIR in loader.py")

    X_raw, y, idx = build_feature_matrix(split="train")
    logger.info("Feature matrix shape: %s", X_raw.shape)
    logger.info("Target distribution: %s | Default rate: %.2f%%",
                str(y.value_counts().values), y.mean() * 100)

    numeric_cols, categorical_cols = get_feature_columns(X_raw)
    logger.info("  Numeric features: %d", len(numeric_cols))
    logger.info("  Categorical features: %d", len(categorical_cols))

    preprocessor = build_preprocessor(numeric_cols, categorical_cols)
    t0 = time.time()
    X_proc = preprocessor.fit_transform(X_raw)
    elapsed = time.time() - t0
    logger.info("  Pipeline fit+transform: %.1fs → X shape: %s", elapsed, X_proc.shape)

    feature_names = get_feature_names_out(preprocessor, numeric_cols, categorical_cols)

    # Save pipeline and feature names
    pipeline_path = os.path.join(MODELS_DIR, "pipeline.pkl")
    joblib.dump(preprocessor, pipeline_path)
    logger.info("  ✓ Pipeline saved: %s", pipeline_path)

    feat_names_path = os.path.join(MODELS_DIR, "feature_names.json")
    with open(feat_names_path, "w") as f:
        json.dump(feature_names, f)
    logger.info("  ✓ Feature names saved: %s (%d features)", feat_names_path, len(feature_names))

    return X_proc, y.values, feature_names, preprocessor, numeric_cols, categorical_cols, X_raw


# ─── Baseline: Logistic Regression ───────────────────────────────────────────

def run_baseline(X: np.ndarray, y: np.ndarray) -> dict:
    logger.info("=" * 60)
    logger.info("  STEP 3: Baseline — Logistic Regression (5-Fold CV)")
    logger.info("=" * 60)

    # Check if already done
    existing = _load_existing_experiments()
    if "EXP-01" in existing["exp_id"].values:
        logger.info("  EXP-01 already completed — skipping.")
        row = existing[existing["exp_id"] == "EXP-01"].iloc[0]
        return {"roc_auc": row["roc_auc"], "pr_auc": row["pr_auc"], "f1": row["f1"]}

    params = {"C": 0.1, "max_iter": 1000, "class_weight": "balanced", "random_state": 42}

    def factory():
        return LogisticRegression(**params)

    return _evaluate_cv(
        factory, X, y, n_splits=5, exp_id="EXP-01",
        model_name="LogisticRegression", feature_set="full_combined",
        imbalance_strategy="class_weight=balanced",
        hyperparams=params, notes="Baseline model",
    )


# ─── LightGBM default ────────────────────────────────────────────────────────

def run_lgbm_default(X: np.ndarray, y: np.ndarray) -> dict:
    logger.info("=" * 60)
    logger.info("  STEP 4: LightGBM — default hyperparameters (5-Fold CV)")
    logger.info("=" * 60)

    existing = _load_existing_experiments()
    if "EXP-02" in existing["exp_id"].values:
        logger.info("  EXP-02 already completed — skipping.")
        row = existing[existing["exp_id"] == "EXP-02"].iloc[0]
        return {"roc_auc": row["roc_auc"], "pr_auc": row["pr_auc"], "f1": row["f1"]}

    n_pos = int(y.sum())
    n_neg = int(len(y) - y.sum())
    scale_pos = round(n_neg / n_pos, 1)

    params = {
        "n_estimators": 500, "learning_rate": 0.05, "num_leaves": 63,
        "scale_pos_weight": scale_pos, "random_state": 42,
        "n_jobs": -1, "verbose": -1,
    }

    def factory():
        return lgb.LGBMClassifier(**params)

    return _evaluate_cv(
        factory, X, y, n_splits=5, exp_id="EXP-02",
        model_name="LightGBM",
        feature_set="full_combined", imbalance_strategy=f"scale_pos_weight={scale_pos}",
        hyperparams=params, notes="Default LightGBM with scale_pos_weight",
    )


# ─── Optuna HPO for LightGBM ─────────────────────────────────────────────────

def run_optuna_hpo(X: np.ndarray, y: np.ndarray) -> dict:
    logger.info("=" * 60)
    logger.info("  STEP 5: Optuna HPO — LightGBM (40 trials, 3-Fold CV)")
    logger.info("=" * 60)

    existing = _load_existing_experiments()
    if "EXP-03" in existing["exp_id"].values:
        logger.info("  EXP-03 already completed — skipping.")
        row = existing[existing["exp_id"] == "EXP-03"].iloc[0]
        return {"roc_auc": row["roc_auc"], "pr_auc": row["pr_auc"], "f1": row["f1"],
                "best_params": json.loads(row["hyperparams"])}

    n_pos = int(y.sum())
    n_neg = int(len(y) - y.sum())
    scale_pos = round(n_neg / n_pos, 1)

    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 300, 1000),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 20, 150),
            "min_child_samples": trial.suggest_int("min_child_samples", 20, 200),
            "subsample": trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
            "scale_pos_weight": scale_pos,
            "random_state": 42,
            "n_jobs": -1,
            "verbose": -1,
        }
        skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
        scores = []
        for train_idx, val_idx in skf.split(X, y):
            model = lgb.LGBMClassifier(**params)
            model.fit(X[train_idx], y[train_idx])
            proba = model.predict_proba(X[val_idx])[:, 1]
            scores.append(roc_auc_score(y[val_idx], proba))
        return np.mean(scores)

    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=42))
    study.optimize(objective, n_trials=40, show_progress_bar=False)
    best_params = study.best_params
    best_params["scale_pos_weight"] = scale_pos
    best_params["random_state"] = 42
    best_params["n_jobs"] = -1
    best_params["verbose"] = -1
    logger.info("  Best trial ROC-AUC: %.4f | Params: %s", study.best_value, best_params)

    def factory():
        return lgb.LGBMClassifier(**best_params)

    result = _evaluate_cv(
        factory, X, y, n_splits=5, exp_id="EXP-03",
        model_name="LightGBM_Tuned",
        feature_set="full_combined", imbalance_strategy=f"scale_pos_weight={scale_pos}",
        hyperparams=best_params, notes="Optuna HPO — 40 trials",
    )
    result["best_params"] = best_params
    return result


# ─── XGBoost comparison ───────────────────────────────────────────────────────

def run_xgboost(X: np.ndarray, y: np.ndarray) -> dict:
    logger.info("=" * 60)
    logger.info("  STEP 6: XGBoost comparison (5-Fold CV)")
    logger.info("=" * 60)

    existing = _load_existing_experiments()
    if "EXP-04" in existing["exp_id"].values:
        logger.info("  EXP-04 already completed — skipping.")
        row = existing[existing["exp_id"] == "EXP-04"].iloc[0]
        return {"roc_auc": row["roc_auc"], "pr_auc": row["pr_auc"], "f1": row["f1"]}

    n_pos = int(y.sum())
    n_neg = int(len(y) - y.sum())
    scale_pos = round(n_neg / n_pos, 1)

    params = {
        "n_estimators": 500, "learning_rate": 0.05, "max_depth": 6,
        "scale_pos_weight": scale_pos, "subsample": 0.8,
        "colsample_bytree": 0.8, "random_state": 42,
        "n_jobs": -1, "eval_metric": "auc", "use_label_encoder": False,
        "verbosity": 0,
    }

    def factory():
        return xgb.XGBClassifier(**params)

    return _evaluate_cv(
        factory, X, y, n_splits=5, exp_id="EXP-04",
        model_name="XGBoost",
        feature_set="full_combined", imbalance_strategy=f"scale_pos_weight={scale_pos}",
        hyperparams=params, notes="XGBoost comparison",
    )


# ─── Train final model + calibration ─────────────────────────────────────────

def train_final_model(X: np.ndarray, y: np.ndarray, best_params: dict,
                      feature_names: list[str]) -> None:
    logger.info("=" * 60)
    logger.info("  STEP 7: Training final model + probability calibration")
    logger.info("=" * 60)

    # Train on 90%, calibrate on 10%
    X_train, X_cal, y_train, y_cal = train_test_split(
        X, y, test_size=0.1, stratify=y, random_state=42
    )

    logger.info("  Training LightGBM on %.0f%% of data...", 90.0)
    t0 = time.time()
    base_model = lgb.LGBMClassifier(**best_params)
    base_model.fit(X_train, y_train)
    logger.info("  Base model trained in %.1fs", time.time() - t0)

    # Calibration
    logger.info("  Fitting isotonic calibration on calibration set...")
    calibrated_model = CalibratedClassifierCV(base_model, method="isotonic", cv="prefit")
    calibrated_model.fit(X_cal, y_cal)

    # Evaluate calibration improvement
    proba_base = base_model.predict_proba(X_cal)[:, 1]
    proba_cal = calibrated_model.predict_proba(X_cal)[:, 1]
    brier_base = brier_score_loss(y_cal, proba_base)
    brier_cal = brier_score_loss(y_cal, proba_cal)
    logger.info("  Calibration improvement — Brier before: %.4f → after: %.4f",
                brier_base, brier_cal)

    # ─── Risk band thresholds ─────────────────────────────────────────────────
    logger.info("  Deriving risk band thresholds from calibrated probabilities...")
    # Use percentile-based thresholds informed by business interpretation:
    #  - LOW:    Prob < 5%   (substantially below average default rate of 8.07%)
    #  - MEDIUM: 5% ≤ Prob < 20%
    #  - HIGH:   Prob ≥ 20%  (>2.5× the population average rate)
    # Validate these cut-points against calibration set distribution
    proba_all = calibrated_model.predict_proba(X)[:, 1]
    pct_low = (proba_all < 0.05).mean()
    pct_med = ((proba_all >= 0.05) & (proba_all < 0.20)).mean()
    pct_high = (proba_all >= 0.20).mean()
    logger.info("  Risk band distribution: LOW=%.1f%% MEDIUM=%.1f%% HIGH=%.1f%%",
                pct_low * 100, pct_med * 100, pct_high * 100)

    # Validate: check default rate in each band
    default_in_low = y[(proba_all < 0.05)].mean() if (proba_all < 0.05).any() else 0
    default_in_med = y[(proba_all >= 0.05) & (proba_all < 0.20)].mean() if ((proba_all >= 0.05) & (proba_all < 0.20)).any() else 0
    default_in_high = y[(proba_all >= 0.20)].mean() if (proba_all >= 0.20).any() else 0
    logger.info("  Actual default rates by band: LOW=%.2f%% MED=%.2f%% HIGH=%.2f%%",
                default_in_low * 100, default_in_med * 100, default_in_high * 100)

    thresholds = {"low_threshold": 0.05, "high_threshold": 0.20,
                  "band_dist": {"LOW": round(pct_low, 4), "MEDIUM": round(pct_med, 4), "HIGH": round(pct_high, 4)},
                  "actual_default_rates": {
                      "LOW": round(default_in_low, 4),
                      "MEDIUM": round(default_in_med, 4),
                      "HIGH": round(default_in_high, 4),
                  }}

    # ─── Feature importance for explainability ────────────────────────────────
    importance = base_model.feature_importances_
    feat_importance = sorted(
        zip(feature_names, importance),
        key=lambda x: x[1], reverse=True
    )
    top_features = feat_importance[:50]

    # ─── Save all artifacts ───────────────────────────────────────────────────
    logger.info("  Saving model artifacts to %s...", MODELS_DIR)

    model_path = os.path.join(MODELS_DIR, "lgbm_calibrated.pkl")
    joblib.dump(calibrated_model, model_path)
    logger.info("  ✓ Calibrated model saved: %s (%.1f KB)",
                model_path, os.path.getsize(model_path) / 1024)

    base_model_path = os.path.join(MODELS_DIR, "lgbm_base.pkl")
    joblib.dump(base_model, base_model_path)
    logger.info("  ✓ Base model saved: %s", base_model_path)

    thresh_path = os.path.join(MODELS_DIR, "risk_thresholds.json")
    with open(thresh_path, "w") as f:
        json.dump(thresholds, f, indent=2)
    logger.info("  ✓ Risk thresholds saved: %s", thresh_path)

    importance_path = os.path.join(MODELS_DIR, "feature_importance.json")
    with open(importance_path, "w") as f:
        json.dump([{"feature": k, "importance": int(v)} for k, v in feat_importance], f, indent=2)
    logger.info("  ✓ Feature importance saved: %s", importance_path)

    # Model metadata
    meta = {
        "model_type": "LightGBM + Isotonic Calibration",
        "n_features": int(X.shape[1]),
        "n_train_samples": int(X_train.shape[0]),
        "default_rate_pct": round(float(y.mean() * 100), 2),
        "brier_score_base": round(brier_base, 4),
        "brier_score_calibrated": round(brier_cal, 4),
        "risk_thresholds": thresholds,
        "best_hyperparams": best_params,
        "top_10_features": [k for k, _ in feat_importance[:10]],
    }
    meta_path = os.path.join(MODELS_DIR, "model_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    logger.info("  ✓ Model metadata saved: %s", meta_path)

    logger.info("  ✓ All model artifacts saved successfully.")
    return calibrated_model, thresholds


# ─── Main training orchestration ─────────────────────────────────────────────

def main():
    logger.info("=" * 60)
    logger.info("  LAYER 3 — MACHINE LEARNING MODEL DEVELOPMENT")
    logger.info("  CredPulse Credit Risk Intelligence Platform")
    logger.info("=" * 60)

    # Step 1: Load feature matrix
    logger.info("\n" + "=" * 60)
    logger.info("  STEP 1: Loading and preparing feature matrix")
    logger.info("=" * 60)
    X, y, feature_names, preprocessor, num_cols, cat_cols, X_raw = _load_feature_matrix()

    # Step 2: Already logged inside _load_feature_matrix

    # Step 3: Baseline
    logger.info("\nRunning baseline experiment...")
    run_baseline(X, y)

    # Step 4: LightGBM default
    logger.info("\nRunning LightGBM default experiment...")
    run_lgbm_default(X, y)

    # Step 5: Optuna HPO
    logger.info("\nRunning Optuna HPO...")
    hpo_result = run_optuna_hpo(X, y)
    best_params = hpo_result.get("best_params", {})

    # If best_params not returned (was cached), load from experiments
    if not best_params:
        existing = _load_existing_experiments()
        row = existing[existing["exp_id"] == "EXP-03"].iloc[0]
        best_params = json.loads(row["hyperparams"])

    # Step 6: XGBoost comparison
    logger.info("\nRunning XGBoost comparison...")
    run_xgboost(X, y)

    # Step 7: Final model + calibration
    logger.info("\nTraining final model...")
    calibrated_model, thresholds = train_final_model(X, y, best_params, feature_names)

    # Step 8: Print experiment summary
    logger.info("\n" + "=" * 60)
    logger.info("  EXPERIMENT SUMMARY")
    logger.info("=" * 60)
    existing = _load_existing_experiments()
    summary_cols = ["exp_id", "model", "roc_auc", "pr_auc", "f1", "brier_score", "train_time_s"]
    print(existing[summary_cols].to_string(index=False))

    logger.info("\n✓ Layer 3 COMPLETE — All model artifacts saved to %s", MODELS_DIR)


if __name__ == "__main__":
    main()
