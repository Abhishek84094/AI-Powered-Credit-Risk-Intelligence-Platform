"""
CredPulse Credit Risk Intelligence Platform
Layer 1: Data Loader — Memory-efficient multi-table ingestion & aggregation.
 SK_ID_CURR grain.

Design principles:
  - All aggregations are legitimate pre-application history (no leakage).
  - Each table is aggregated BEFORE joining to application base.
  - ID columns (SK_ID_CURR, SK_ID_PREV, SK_ID_BUREAU) are never used as features.
  - DAYS_EMPLOYED sentinel (365243) is handled explicitly.
"""

import os
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

def _get_data_dir() -> str:
    env_dir = os.getenv("DATA_DIR")
    if env_dir and os.path.exists(os.path.join(env_dir, "application_train.csv")):
        return os.path.abspath(env_dir)
    sub = os.path.join(os.path.dirname(__file__), "..", "..", "data", "home-credit-default-risk")
    if os.path.exists(os.path.join(sub, "application_train.csv")):
        return os.path.abspath(sub)
    flat = os.path.join(os.path.dirname(__file__), "..", "..", "data")
    if os.path.exists(os.path.join(flat, "application_train.csv")):
        return os.path.abspath(flat)
    return os.path.abspath(sub)

DATA_DIR = _get_data_dir()

REQUIRED_FILES = [
    "application_train.csv",
    "application_test.csv",
    "bureau.csv",
    "bureau_balance.csv",
    "previous_application.csv",
    "POS_CASH_balance.csv",
    "credit_card_balance.csv",
    "installments_payments.csv",
]


def _path(filename: str) -> str:
    return os.path.join(_get_data_dir(), filename)


def verify_data_files() -> bool:
    current_dir = _get_data_dir()
    missing = [f for f in REQUIRED_FILES if not os.path.exists(os.path.join(current_dir, f))]
    if missing:
        logger.error("Missing dataset files in %s: %s", current_dir, missing)
        return False
    logger.info("[OK] All %d dataset files verified in %s", len(REQUIRED_FILES), current_dir)
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Application base loader
# ─────────────────────────────────────────────────────────────────────────────

def _clean_application(df: pd.DataFrame) -> pd.DataFrame:
    """Fix known data issues in application tables."""
    # Sentinel for unemployed/pensioner — replace with NaN and create binary flag
    df["DAYS_EMPLOYED_ANOM"] = (df["DAYS_EMPLOYED"] == 365243).astype(np.int8)
    df["DAYS_EMPLOYED"] = df["DAYS_EMPLOYED"].replace(365243, np.nan)

    # Derived age and employment features (in years — positive)
    df["APPLICANT_AGE_YEARS"] = -df["DAYS_BIRTH"] / 365.25
    df["EMPLOYED_YEARS"] = -df["DAYS_EMPLOYED"] / 365.25

    # Financial ratios
    df["DEBT_TO_INCOME"] = df["AMT_CREDIT"] / (df["AMT_INCOME_TOTAL"] + 1)
    df["ANNUITY_TO_INCOME"] = df["AMT_ANNUITY"] / (df["AMT_INCOME_TOTAL"] + 1)
    df["CREDIT_TO_GOODS"] = df["AMT_CREDIT"] / (df["AMT_GOODS_PRICE"].replace(0, np.nan) + 1)
    df["INCOME_PER_PERSON"] = df["AMT_INCOME_TOTAL"] / (df["CNT_FAM_MEMBERS"].replace(0, np.nan) + 1)
    df["CREDIT_PER_PERSON"] = df["AMT_CREDIT"] / (df["CNT_FAM_MEMBERS"].replace(0, np.nan) + 1)

    # External source composite
    ext_cols = ["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]
    df["EXT_SOURCE_MEAN"] = df[ext_cols].mean(axis=1)
    df["EXT_SOURCE_MIN"] = df[ext_cols].min(axis=1)
    df["EXT_SOURCE_PRODUCT"] = df[ext_cols].prod(axis=1)

    # Drop high-cardinality IDs (never use as features)
    drop_cols = ["SK_ID_CURR"]
    if "TARGET" in df.columns:
        drop_cols_data = [c for c in drop_cols if c in df.columns]
    else:
        drop_cols_data = [c for c in drop_cols if c in df.columns]
    df = df.drop(columns=drop_cols_data, errors="ignore")
    return df


def load_application(split: str = "train", nrows: int | None = None) -> tuple[pd.DataFrame, pd.Series | None, pd.Series]:
    """
    Returns (X, y, idx) for train split or (X, None, idx) for test split.
    X has SK_ID_CURR retained as index only (not a feature column).
    """
    filename = "application_train.csv" if split == "train" else "application_test.csv"
    logger.info("Loading %s...", filename)
    df = pd.read_csv(_path(filename), nrows=nrows)
    mb = df.memory_usage(deep=True).sum() / 1e6
    logger.info("  %s: %s rows × %s cols (%.1f MB)", filename, f"{len(df):,}", df.shape[1], mb)

    y = df["TARGET"].copy() if "TARGET" in df.columns else None
    idx = df["SK_ID_CURR"].copy()

    # Clean & engineer application features
    df = _clean_application(df)

    # Remove target from features
    df = df.drop(columns=["TARGET"], errors="ignore")

    return df, y, idx


# ─────────────────────────────────────────────────────────────────────────────
# Bureau aggregation
# ─────────────────────────────────────────────────────────────────────────────

def _agg_bureau(nrows: int | None = None) -> pd.DataFrame:
    """Aggregate bureau + bureau_balance to SK_ID_CURR grain."""
    logger.info("Aggregating bureau tables → SK_ID_CURR grain...")

    # Bureau balance (monthly status per credit)
    logger.info("  Loading bureau_balance.csv...")
    bb = pd.read_csv(_path("bureau_balance.csv"), nrows=nrows * 5 if nrows else None)
    # Map STATUS to numeric: C=closed(0), X=unknown(0), 0-5=DPD buckets
    status_map = {"C": 0, "X": 0, "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5}
    bb["STATUS_NUM"] = bb["STATUS"].map(status_map).fillna(0)
    bb_agg = bb.groupby("SK_ID_BUREAU").agg(
        bb_months_count=("MONTHS_BALANCE", "count"),
        bb_dpd_mean=("STATUS_NUM", "mean"),
        bb_dpd_max=("STATUS_NUM", "max"),
        bb_dpd_positive_months=("STATUS_NUM", lambda x: (x > 0).sum()),
    ).reset_index()
    logger.info("  bureau_balance aggregated: %s bureau entries", f"{len(bb):,}")

    # Bureau (one row per external credit bureau entry)
    logger.info("  Loading bureau.csv...")
    bur = pd.read_csv(_path("bureau.csv"), nrows=nrows * 3 if nrows else None)
    bur = bur.merge(bb_agg, on="SK_ID_BUREAU", how="left")

    agg_dict = {
        "SK_ID_BUREAU": "count",          # n_credits
        "DAYS_CREDIT": ["mean", "min"],
        "CREDIT_DAY_OVERDUE": ["mean", "max", "sum"],
        "AMT_CREDIT_SUM": ["mean", "max", "sum"],
        "AMT_CREDIT_SUM_DEBT": ["mean", "sum"],
        "AMT_CREDIT_SUM_OVERDUE": ["mean", "sum"],
        "AMT_CREDIT_MAX_OVERDUE": ["mean", "max"],
        "AMT_ANNUITY": "sum",
        "bb_dpd_mean": "mean",
        "bb_dpd_max": "max",
        "bb_dpd_positive_months": "sum",
    }

    bureau_agg = bur.groupby("SK_ID_CURR").agg(agg_dict)
    bureau_agg.columns = ["_".join(c).strip("_") for c in bureau_agg.columns]
    bureau_agg = bureau_agg.rename(columns={"SK_ID_BUREAU_count": "bur_n_credits"})

    # Active vs closed credits
    active = bur[bur["CREDIT_ACTIVE"] == "Active"].groupby("SK_ID_CURR").agg(
        bur_active_credits=("SK_ID_BUREAU", "count"),
        bur_active_debt_sum=("AMT_CREDIT_SUM_DEBT", "sum"),
    )
    closed = bur[bur["CREDIT_ACTIVE"] == "Closed"].groupby("SK_ID_CURR").agg(
        bur_closed_credits=("SK_ID_BUREAU", "count"),
    )
    bureau_agg = bureau_agg.join(active, how="left").join(closed, how="left")

    # Active credit ratio
    bureau_agg["bur_active_credit_ratio"] = (
        bureau_agg["bur_active_credits"] / bureau_agg["bur_n_credits"].replace(0, np.nan)
    )

    bureau_agg = bureau_agg.add_prefix("bur_") if not any(c.startswith("bur_") for c in bureau_agg.columns) else bureau_agg
    # Rename duplicates from prefix
    cols_to_rename = {c: f"bur_{c}" for c in bureau_agg.columns if not c.startswith("bur_")}
    bureau_agg = bureau_agg.rename(columns=cols_to_rename)
    bureau_agg = bureau_agg.reset_index()

    logger.info("  [OK] bureau aggregated to SK_ID_CURR: %s applicants, %s features",
                f"{len(bureau_agg):,}", bureau_agg.shape[1] - 1)
    return bureau_agg


# ─────────────────────────────────────────────────────────────────────────────
# Previous application aggregation
# ─────────────────────────────────────────────────────────────────────────────

def _agg_previous_application(nrows: int | None = None) -> pd.DataFrame:
    logger.info("Aggregating previous_application → SK_ID_CURR grain...")
    prev = pd.read_csv(_path("previous_application.csv"), nrows=nrows * 3 if nrows else None)

    # Replace sentinel values in DAYS columns
    for col in ["DAYS_FIRST_DRAWING", "DAYS_FIRST_DUE", "DAYS_LAST_DUE_1ST_VERSION",
                "DAYS_LAST_DUE", "DAYS_TERMINATION"]:
        if col in prev.columns:
            prev[col] = prev[col].replace(365243, np.nan)

    # Approval / refusal / cancelled flags
    status_dummies = pd.get_dummies(prev["NAME_CONTRACT_STATUS"], prefix="prev_status")
    prev = pd.concat([prev, status_dummies], axis=1)

    agg_dict = {
        "SK_ID_PREV": "count",
        "AMT_ANNUITY": ["mean", "max"],
        "AMT_APPLICATION": ["mean", "sum"],
        "AMT_CREDIT": ["mean", "sum"],
        "AMT_DOWN_PAYMENT": "sum",
        "AMT_GOODS_PRICE": "mean",
        "RATE_DOWN_PAYMENT": "mean",
        "CNT_PAYMENT": ["mean", "sum"],
        "DAYS_DECISION": "mean",
    }

    # Add status dummy columns
    for c in status_dummies.columns:
        agg_dict[c] = "sum"

    prev_agg = prev.groupby("SK_ID_CURR").agg(agg_dict)
    prev_agg.columns = ["_".join(c).strip("_") for c in prev_agg.columns]
    prev_agg = prev_agg.rename(columns={"SK_ID_PREV_count": "prev_n_applications"})

    # Approval rate
    approved_col = [c for c in prev_agg.columns if "Approved" in c]
    refused_col = [c for c in prev_agg.columns if "Refused" in c]
    if approved_col:
        prev_agg["prev_approval_rate"] = prev_agg[approved_col[0]] / prev_agg["prev_n_applications"].replace(0, np.nan)
    if refused_col:
        prev_agg["prev_refusal_rate"] = prev_agg[refused_col[0]] / prev_agg["prev_n_applications"].replace(0, np.nan)

    prev_agg = prev_agg.add_prefix("prev_") if not any(c.startswith("prev_") for c in prev_agg.columns) else prev_agg
    cols_to_rename = {c: f"prev_{c}" for c in prev_agg.columns if not c.startswith("prev_")}
    prev_agg = prev_agg.rename(columns=cols_to_rename)
    prev_agg = prev_agg.reset_index()

    logger.info("  [OK] previous_application aggregated: %s applicants, %s features",
                f"{len(prev_agg):,}", prev_agg.shape[1] - 1)
    return prev_agg


# ─────────────────────────────────────────────────────────────────────────────
# Installments payments aggregation
# ─────────────────────────────────────────────────────────────────────────────

def _agg_installments(nrows: int | None = None) -> pd.DataFrame:
    logger.info("Aggregating installments_payments → SK_ID_CURR grain...")
    inst = pd.read_csv(_path("installments_payments.csv"), nrows=nrows * 5 if nrows else None)

    # Payment delay (positive = late)
    inst["PAYMENT_DELAY_DAYS"] = inst["DAYS_ENTRY_PAYMENT"] - inst["DAYS_INSTALMENT"]
    # Underpayment (negative = paid less than required)
    inst["PAYMENT_DIFF"] = inst["AMT_PAYMENT"] - inst["AMT_INSTALMENT"]
    inst["IS_LATE"] = (inst["PAYMENT_DELAY_DAYS"] > 0).astype(np.int8)
    inst["IS_UNDERPAID"] = (inst["PAYMENT_DIFF"] < 0).astype(np.int8)

    agg_dict = {
        "SK_ID_PREV": "count",
        "PAYMENT_DELAY_DAYS": ["mean", "max", "sum"],
        "PAYMENT_DIFF": ["mean", "min"],
        "IS_LATE": ["mean", "sum"],
        "IS_UNDERPAID": ["mean", "sum"],
        "AMT_INSTALMENT": ["mean", "sum"],
        "AMT_PAYMENT": ["mean", "sum"],
    }

    inst_agg = inst.groupby("SK_ID_CURR").agg(agg_dict)
    inst_agg.columns = ["_".join(c).strip("_") for c in inst_agg.columns]
    inst_agg = inst_agg.rename(columns={"SK_ID_PREV_count": "inst_n_payments"})

    inst_agg = inst_agg.add_prefix("inst_") if not any(c.startswith("inst_") for c in inst_agg.columns) else inst_agg
    cols_to_rename = {c: f"inst_{c}" for c in inst_agg.columns if not c.startswith("inst_")}
    inst_agg = inst_agg.rename(columns=cols_to_rename)
    inst_agg = inst_agg.reset_index()

    logger.info("  [OK] installments aggregated: %s applicants, %s features",
                f"{len(inst_agg):,}", inst_agg.shape[1] - 1)
    return inst_agg


# ─────────────────────────────────────────────────────────────────────────────
# POS CASH balance aggregation
# ─────────────────────────────────────────────────────────────────────────────

def _agg_pos_cash(nrows: int | None = None) -> pd.DataFrame:
    logger.info("Aggregating POS_CASH_balance → SK_ID_CURR grain...")
    pos = pd.read_csv(_path("POS_CASH_balance.csv"), nrows=nrows * 5 if nrows else None)

    pos["IS_DPD"] = (pos["SK_DPD"] > 0).astype(np.int8)
    pos["IS_DPD_DEF"] = (pos["SK_DPD_DEF"] > 0).astype(np.int8)

    agg_dict = {
        "SK_ID_PREV": "count",
        "MONTHS_BALANCE": "count",
        "CNT_INSTALMENT": "mean",
        "CNT_INSTALMENT_FUTURE": "mean",
        "SK_DPD": ["mean", "max"],
        "SK_DPD_DEF": ["mean", "max"],
        "IS_DPD": ["mean", "sum"],
        "IS_DPD_DEF": ["mean", "sum"],
    }

    pos_agg = pos.groupby("SK_ID_CURR").agg(agg_dict)
    pos_agg.columns = ["_".join(c).strip("_") for c in pos_agg.columns]
    pos_agg = pos_agg.rename(columns={"SK_ID_PREV_count": "pos_n_records"})

    pos_agg = pos_agg.add_prefix("pos_") if not any(c.startswith("pos_") for c in pos_agg.columns) else pos_agg
    cols_to_rename = {c: f"pos_{c}" for c in pos_agg.columns if not c.startswith("pos_")}
    pos_agg = pos_agg.rename(columns=cols_to_rename)
    pos_agg = pos_agg.reset_index()

    logger.info("  [OK] POS_CASH aggregated: %s applicants, %s features",
                f"{len(pos_agg):,}", pos_agg.shape[1] - 1)
    return pos_agg


# ─────────────────────────────────────────────────────────────────────────────
# Credit card balance aggregation
# ─────────────────────────────────────────────────────────────────────────────

def _agg_credit_card(nrows: int | None = None) -> pd.DataFrame:
    logger.info("Aggregating credit_card_balance → SK_ID_CURR grain...")
    cc = pd.read_csv(_path("credit_card_balance.csv"), nrows=nrows * 5 if nrows else None)

    cc["UTILIZATION"] = cc["AMT_BALANCE"] / (cc["AMT_CREDIT_LIMIT_ACTUAL"].replace(0, np.nan) + 1)
    cc["IS_DPD"] = (cc["SK_DPD"] > 0).astype(np.int8)

    agg_dict = {
        "SK_ID_PREV": "count",
        "AMT_BALANCE": ["mean", "max"],
        "AMT_CREDIT_LIMIT_ACTUAL": "mean",
        "AMT_DRAWINGS_CURRENT": ["mean", "sum"],
        "AMT_PAYMENT_CURRENT": ["mean", "sum"],
        "AMT_PAYMENT_TOTAL_CURRENT": ["mean", "sum"],
        "UTILIZATION": ["mean", "max"],
        "SK_DPD": ["mean", "max"],
        "IS_DPD": ["mean", "sum"],
    }

    cc_agg = cc.groupby("SK_ID_CURR").agg(agg_dict)
    cc_agg.columns = ["_".join(c).strip("_") for c in cc_agg.columns]
    cc_agg = cc_agg.rename(columns={"SK_ID_PREV_count": "cc_n_records"})

    cc_agg = cc_agg.add_prefix("cc_") if not any(c.startswith("cc_") for c in cc_agg.columns) else cc_agg
    cols_to_rename = {c: f"cc_{c}" for c in cc_agg.columns if not c.startswith("cc_")}
    cc_agg = cc_agg.rename(columns=cols_to_rename)
    cc_agg = cc_agg.reset_index()

    logger.info("  [OK] credit_card aggregated: %s applicants, %s features",
                f"{len(cc_agg):,}", cc_agg.shape[1] - 1)
    return cc_agg


# ─────────────────────────────────────────────────────────────────────────────
# Full feature matrix builder
# ─────────────────────────────────────────────────────────────────────────────

def build_feature_matrix(split: str = "train", nrows: int | None = None) -> tuple[pd.DataFrame, pd.Series | None, pd.Series]:
    """
    Build the complete feature matrix for the given split.
    Returns (X, y, idx) where idx is SK_ID_CURR (not a feature column).
    Leakage-safe: no future/post-outcome information included.
    """
    logger.info("=" * 60)
    logger.info("  Building feature matrix — split=%s (nrows=%s)", split, nrows)
    logger.info("=" * 60)

    # Load application base
    app, y, idx = load_application(split, nrows=nrows)

    # Load and aggregate all historical tables
    bureau_agg = _agg_bureau(nrows=nrows)
    prev_agg = _agg_previous_application(nrows=nrows)
    inst_agg = _agg_installments(nrows=nrows)
    pos_agg = _agg_pos_cash(nrows=nrows)
    cc_agg = _agg_credit_card(nrows=nrows)

    logger.info("Joining all aggregations to application base...")
    # Reconstruct index alignment
    base = app.copy()
    base["_SK_ID_CURR"] = idx.values

    base = base.merge(bureau_agg, left_on="_SK_ID_CURR", right_on="SK_ID_CURR", how="left")
    base = base.drop(columns=["SK_ID_CURR"], errors="ignore")

    base = base.merge(prev_agg, left_on="_SK_ID_CURR", right_on="SK_ID_CURR", how="left")
    base = base.drop(columns=["SK_ID_CURR"], errors="ignore")

    base = base.merge(inst_agg, left_on="_SK_ID_CURR", right_on="SK_ID_CURR", how="left")
    base = base.drop(columns=["SK_ID_CURR"], errors="ignore")

    base = base.merge(pos_agg, left_on="_SK_ID_CURR", right_on="SK_ID_CURR", how="left")
    base = base.drop(columns=["SK_ID_CURR"], errors="ignore")

    base = base.merge(cc_agg, left_on="_SK_ID_CURR", right_on="SK_ID_CURR", how="left")
    base = base.drop(columns=["SK_ID_CURR", "_SK_ID_CURR"], errors="ignore")

    logger.info("  ✓ Final feature matrix: %s rows × %s features",
                f"{base.shape[0]:,}", base.shape[1])

    if y is not None:
        logger.info("  Target distribution: %s | Default rate: %.2f%%",
                    str(y.value_counts().values), (y.mean() * 100))

    return base, y, idx
