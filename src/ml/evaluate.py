"""
CredPulse Credit Risk Intelligence Platform
ML Evaluation Module — Evaluates saved models, computes metrics, and compares experiments.
"""

import json
import logging
import os
import sys
import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    confusion_matrix,
    classification_report,
)

logger = logging.getLogger(__name__)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(ROOT, "models")
EXPERIMENTS_PATH = os.path.join(ROOT, "experiments", "model_experiments.csv")


def compute_metrics(y_true: np.ndarray, y_proba: np.ndarray, threshold: float = 0.5) -> dict:
    """Compute standard classification and calibration metrics."""
    y_pred = (y_proba >= threshold).astype(int)

    return {
        "roc_auc": round(float(roc_auc_score(y_true, y_proba)), 4),
        "pr_auc": round(float(average_precision_score(y_true, y_proba)), 4),
        "brier_score": round(float(brier_score_loss(y_true, y_proba)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "threshold": threshold,
    }


def print_experiment_summary():
    """Print the complete experiment benchmark table from model_experiments.csv."""
    if not os.path.exists(EXPERIMENTS_PATH):
        print(f"No experiment tracking log found at {EXPERIMENTS_PATH}")
        return

    df = pd.read_csv(EXPERIMENTS_PATH)
    cols = ["exp_id", "model", "roc_auc", "pr_auc", "f1", "brier_score", "train_time_s"]
    print("\n" + "=" * 70)
    print("  CREDPULSE MODEL BENCHMARK & EVALUATION SUMMARY")
    print("=" * 70)
    print(df[cols].to_string(index=False))
    print("=" * 70)

    # Print best model
    best_row = df.loc[df["roc_auc"].idxmax()]
    print(f"\nTop Model: {best_row['model']} (ROC-AUC: {best_row['roc_auc']:.4f}, PR-AUC: {best_row['pr_auc']:.4f})")
    print(f"Imbalance Strategy: {best_row.get('imbalance_strategy', 'N/A')}")
    print(f"Validation Method: {best_row.get('val_method', 'N/A')}\n")


if __name__ == "__main__":
    print_experiment_summary()
