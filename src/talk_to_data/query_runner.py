"""
CredPulse Credit Risk Intelligence Platform
Query Runner: Executes read-only SQLite queries with strict security enforcement.
"""

import logging
import os
import re
import sqlite3
from typing import Optional, Tuple, List, Dict, Any

logger = logging.getLogger(__name__)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT, "sql", "credit_risk.db")

FORBIDDEN_KEYWORDS = {
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE",
    "ATTACH", "DETACH", "PRAGMA", "VACUUM", "REINDEX",
    "EXECUTE", "EXEC", "--", "/*", "*/", ";--"
}

VALID_TABLES = {"applicants", "bureau_summary", "previous_applications", "installment_summary"}


def validate_sql(sql: str) -> Tuple[bool, str]:
    """
    Validate SQL for safety and basic correctness.
    Returns (is_valid, error_message).
    """
    sql_upper = sql.upper().strip()

    # Must start with SELECT
    if not sql_upper.startswith("SELECT"):
        return False, "Query must be a SELECT statement."

    # Check for forbidden keywords
    for kw in FORBIDDEN_KEYWORDS:
        if kw in sql_upper:
            return False, f"Forbidden keyword detected: {kw}"

    # Check for multiple statements (semicolon injection)
    if sql.count(";") > 1:
        return False, "Multiple statements detected."

    # Extract FROM/JOIN table references
    from_matches = re.findall(r'\bFROM\s+(\w+)', sql_upper) + re.findall(r'\bJOIN\s+(\w+)', sql_upper)
    for table in from_matches:
        if table.lower() not in VALID_TABLES and table not in {"SELECT"}:
            return False, f"Unknown table referenced: {table}"

    return True, ""


def execute_query(sql: str, db_path: str = DB_PATH, max_rows: int = 100) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """
    Execute a validated SELECT query against the analytical SQLite database.
    Returns (rows, error_message).
    """
    is_valid, err = validate_sql(sql)
    if not is_valid:
        return None, f"SQL validation failed: {err}"

    if not os.path.exists(db_path):
        return None, f"Database not found at {db_path}. Run sql/init_db.py first."

    # Enforce LIMIT
    sql_clean = sql.strip().rstrip(";")
    if "LIMIT" not in sql_clean.upper():
        sql_clean += f" LIMIT {max_rows}"

    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(sql_clean)
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return rows, None
    except Exception as e:
        logger.error("Query execution error: %s", e)
        return None, str(e)
