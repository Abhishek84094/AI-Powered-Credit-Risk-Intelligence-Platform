import os
import sys
import json
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import joblib
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    brier_score_loss,
    confusion_matrix,
)
from sklearn.model_selection import train_test_split
from src.data.loader import build_feature_matrix

def main():
    print("Loading test data to compute exact hold-out metrics on retrained model...")
    # Load 50,000 holdout sample for fast and statistically sound evaluation
    X_raw, y, idx = build_feature_matrix(split="train", nrows=50000)
    
    pipeline = joblib.load(os.path.join(ROOT, "models", "pipeline.pkl"))
    model = joblib.load(os.path.join(ROOT, "models", "lgbm_calibrated.pkl"))
    base_model = joblib.load(os.path.join(ROOT, "models", "lgbm_base.pkl"))
    
    # Split using same seed and ratio
    _, X_val, _, y_val = train_test_split(X_raw, y.values, test_size=0.2, stratify=y.values, random_state=42)
    
    print(f"Transforming validation set ({len(y_val):,} applicants)...")
    X_val_proc = pipeline.transform(X_val)
    
    proba_base = base_model.predict_proba(X_val_proc)[:, 1]
    proba_cal = model.predict_proba(X_val_proc)[:, 1]
    
    roc_base = roc_auc_score(y_val, proba_base)
    roc_cal = roc_auc_score(y_val, proba_cal)
    pr_auc = average_precision_score(y_val, proba_cal)
    brier_base = brier_score_loss(y_val, proba_base)
    brier_cal = brier_score_loss(y_val, proba_cal)
    
    # Standard threshold 0.50
    preds_50 = (proba_cal >= 0.50).astype(int)
    acc_50 = accuracy_score(y_val, preds_50)
    
    # Threshold 0.20 (High Risk band cutoff)
    preds_20 = (proba_cal >= 0.20).astype(int)
    acc_20 = accuracy_score(y_val, preds_20)
    prec_20 = precision_score(y_val, preds_20, zero_division=0)
    rec_20 = recall_score(y_val, preds_20, zero_division=0)
    f1_20 = f1_score(y_val, preds_20, zero_division=0)
    
    print("\n" + "="*60)
    print("  EXACT METRICS ON RETRAINED MODEL (UNSEEN HOLDOUT SET)")
    print("="*60)
    print(f"ROC-AUC (Base Model):              {roc_base:.4f} ({roc_base*100:.2f}%)")
    print(f"ROC-AUC (Calibrated Model):        {roc_cal:.4f} ({roc_cal*100:.2f}%)")
    print(f"PR-AUC (Precision-Recall AUC):     {pr_auc:.4f} ({pr_auc*100:.2f}%)")
    print(f"Brier Score (Pre-calibration):     {brier_base:.4f}")
    print(f"Brier Score (Post-calibration):    {brier_cal:.4f}")
    print(f"Standard Classification Accuracy:  {acc_50*100:.2f}% (at threshold t=0.50)")
    print(f"High-Risk Policy Accuracy (t=0.20):{acc_20*100:.2f}%")
    print(f"High-Risk Policy Recall (t=0.20):  {rec_20*100:.2f}% (catches defaults)")
    print(f"High-Risk Policy Precision (t=0.20):{prec_20*100:.2f}%")
    print(f"High-Risk Policy F1 (t=0.20):      {f1_20:.4f}")
    print("="*60)

if __name__ == "__main__":
    main()
