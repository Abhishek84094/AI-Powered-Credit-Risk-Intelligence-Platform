"""
CredPulse Credit Risk Intelligence Platform
Layer 6: Database Initialization — Loads Home Credit data into SQLite.

This creates a lightweight analytical database for the Talk-to-Data feature.
Only read-only analytical queries are permitted through the chatbot.
"""

import logging
import os
import sqlite3
import sys

import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data", "home-credit-default-risk")
DB_PATH = os.path.join(ROOT, "sql", "credit_risk.db")
SCHEMA_PATH = os.path.join(ROOT, "sql", "schema.sql")


def create_database() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    logger.info("Creating SQLite database at: %s", DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")

    # ─── Table 1: applicants (from application_train) ─────────────────────────
    logger.info("Loading application_train.csv...")
    app = pd.read_csv(os.path.join(DATA_DIR, "application_train.csv"),
                      usecols=[
                          "SK_ID_CURR", "TARGET", "CODE_GENDER", "NAME_EDUCATION_TYPE",
                          "NAME_INCOME_TYPE", "NAME_FAMILY_STATUS", "NAME_HOUSING_TYPE",
                          "NAME_CONTRACT_TYPE", "AMT_INCOME_TOTAL", "AMT_CREDIT",
                          "AMT_ANNUITY", "AMT_GOODS_PRICE", "DAYS_BIRTH", "DAYS_EMPLOYED",
                          "CNT_CHILDREN", "CNT_FAM_MEMBERS", "REGION_RATING_CLIENT",
                          "EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3",
                          "FLAG_OWN_CAR", "FLAG_OWN_REALTY",
                          "OCCUPATION_TYPE", "ORGANIZATION_TYPE",
                          "REG_CITY_NOT_LIVE_CITY", "LIVE_CITY_NOT_WORK_CITY",
                      ])
    # Derived columns for easier querying
    app["AGE_YEARS"] = (-app["DAYS_BIRTH"] / 365.25).round(1)
    app["EMPLOYED_YEARS"] = app["DAYS_EMPLOYED"].apply(
        lambda x: round(-x / 365.25, 1) if x != 365243 else None
    )
    app["DEBT_TO_INCOME"] = (app["AMT_CREDIT"] / (app["AMT_INCOME_TOTAL"] + 1)).round(4)
    app["ANNUITY_TO_INCOME"] = (app["AMT_ANNUITY"] / (app["AMT_INCOME_TOTAL"] + 1)).round(4)
    app["EXT_SOURCE_MEAN"] = app[["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]].mean(axis=1).round(4)

    app.to_sql("applicants", conn, if_exists="replace", index=False, chunksize=10000)
    logger.info("  ✓ applicants table: %s rows", f"{len(app):,}")

    # ─── Table 2: bureau_summary ──────────────────────────────────────────────
    logger.info("Loading bureau.csv...")
    bur = pd.read_csv(os.path.join(DATA_DIR, "bureau.csv"),
                      usecols=["SK_ID_CURR", "SK_ID_BUREAU", "CREDIT_ACTIVE", "CREDIT_TYPE",
                                "CREDIT_DAY_OVERDUE", "AMT_CREDIT_SUM", "AMT_CREDIT_SUM_DEBT",
                                "AMT_CREDIT_SUM_OVERDUE", "DAYS_CREDIT"])
    bur_summary = bur.groupby("SK_ID_CURR").agg(
        n_bureau_credits=("SK_ID_BUREAU", "count"),
        n_active_credits=("CREDIT_ACTIVE", lambda x: (x == "Active").sum()),
        n_closed_credits=("CREDIT_ACTIVE", lambda x: (x == "Closed").sum()),
        max_days_overdue=("CREDIT_DAY_OVERDUE", "max"),
        total_credit_sum=("AMT_CREDIT_SUM", "sum"),
        total_debt=("AMT_CREDIT_SUM_DEBT", "sum"),
        total_overdue=("AMT_CREDIT_SUM_OVERDUE", "sum"),
    ).reset_index()
    bur_summary.to_sql("bureau_summary", conn, if_exists="replace", index=False, chunksize=10000)
    logger.info("  ✓ bureau_summary table: %s rows", f"{len(bur_summary):,}")

    # ─── Table 3: previous_applications ──────────────────────────────────────
    logger.info("Loading previous_application.csv...")
    prev = pd.read_csv(os.path.join(DATA_DIR, "previous_application.csv"),
                       usecols=["SK_ID_CURR", "SK_ID_PREV", "NAME_CONTRACT_STATUS",
                                 "NAME_CONTRACT_TYPE", "AMT_APPLICATION", "AMT_CREDIT",
                                 "AMT_ANNUITY", "AMT_GOODS_PRICE", "DAYS_DECISION"])
    prev.to_sql("previous_applications", conn, if_exists="replace", index=False, chunksize=10000)
    logger.info("  ✓ previous_applications table: %s rows", f"{len(prev):,}")

    # ─── Table 4: installment_summary ─────────────────────────────────────────
    logger.info("Loading installments_payments.csv (summary only)...")
    inst = pd.read_csv(os.path.join(DATA_DIR, "installments_payments.csv"),
                       usecols=["SK_ID_CURR", "SK_ID_PREV", "DAYS_INSTALMENT",
                                 "DAYS_ENTRY_PAYMENT", "AMT_INSTALMENT", "AMT_PAYMENT"])
    inst["PAYMENT_DELAY"] = inst["DAYS_ENTRY_PAYMENT"] - inst["DAYS_INSTALMENT"]
    inst["IS_LATE"] = (inst["PAYMENT_DELAY"] > 0).astype(int)
    inst_summary = inst.groupby("SK_ID_CURR").agg(
        n_installments=("SK_ID_PREV", "count"),
        avg_payment_delay=("PAYMENT_DELAY", "mean"),
        max_payment_delay=("PAYMENT_DELAY", "max"),
        late_payment_rate=("IS_LATE", "mean"),
        total_paid=("AMT_PAYMENT", "sum"),
    ).reset_index()
    inst_summary["avg_payment_delay"] = inst_summary["avg_payment_delay"].round(2)
    inst_summary["late_payment_rate"] = inst_summary["late_payment_rate"].round(4)
    inst_summary.to_sql("installment_summary", conn, if_exists="replace", index=False, chunksize=10000)
    logger.info("  ✓ installment_summary table: %s rows", f"{len(inst_summary):,}")

    # ─── Indexes ──────────────────────────────────────────────────────────────
    logger.info("Creating indexes...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_applicants_id ON applicants(SK_ID_CURR);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_applicants_target ON applicants(TARGET);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bureau_id ON bureau_summary(SK_ID_CURR);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prev_id ON previous_applications(SK_ID_CURR);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_inst_id ON installment_summary(SK_ID_CURR);")

    conn.commit()
    conn.close()
    db_size_mb = os.path.getsize(DB_PATH) / 1e6
    logger.info("✓ Database created: %s (%.1f MB)", DB_PATH, db_size_mb)


if __name__ == "__main__":
    create_database()
