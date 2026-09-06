"""
CredPulse Credit Risk Intelligence Platform
Layer 6: NL-to-SQL — Groq LLM + deterministic offline fallback.

Architecture:
  User Question → Schema Context + Prompt → Groq LLM → SQL → Validation → Execute → Answer

Hallucination controls:
  - Strict schema-only context in prompt (no real data values)
  - SQL validation (syntax + safety) before execution
  - Read-only enforcement: disallow DML/DDL keywords
  - Query LIMIT to prevent resource exhaustion
  - Business-readable answer generation from actual DB results
  - Deterministic fallback patterns for offline/key-unavailable scenarios
"""

import json
import logging
import os
import re
import sqlite3
import textwrap
from typing import Optional

logger = logging.getLogger(__name__)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(ROOT, "sql", "credit_risk.db")

# ─── Schema definition (single source of truth for prompts) ──────────────────
DATABASE_SCHEMA = """
Database: Home Credit Default Risk — Analytical SQLite Database

TABLES:

1. applicants (307,511 rows — one row per loan application)
   Columns:
   - SK_ID_CURR: INTEGER — Unique applicant ID (primary key)
   - TARGET: INTEGER — Default outcome (1=defaulted, 0=did not default)
   - CODE_GENDER: TEXT — 'F' or 'M'
   - NAME_EDUCATION_TYPE: TEXT — e.g. 'Higher education', 'Secondary / secondary special', etc.
   - NAME_INCOME_TYPE: TEXT — e.g. 'Working', 'Pensioner', 'Commercial associate', etc.
   - NAME_FAMILY_STATUS: TEXT — e.g. 'Married', 'Single / not married', etc.
   - NAME_HOUSING_TYPE: TEXT — e.g. 'House / apartment', 'With parents', etc.
   - NAME_CONTRACT_TYPE: TEXT — 'Cash loans' or 'Revolving loans'
   - AMT_INCOME_TOTAL: REAL — Annual income (currency units)
   - AMT_CREDIT: REAL — Loan amount requested
   - AMT_ANNUITY: REAL — Annual repayment amount
   - AMT_GOODS_PRICE: REAL — Price of goods the loan is for
   - AGE_YEARS: REAL — Applicant age in years (derived)
   - EMPLOYED_YEARS: REAL — Years employed (NULL for pensioners)
   - DEBT_TO_INCOME: REAL — AMT_CREDIT / AMT_INCOME_TOTAL
   - ANNUITY_TO_INCOME: REAL — AMT_ANNUITY / AMT_INCOME_TOTAL
   - EXT_SOURCE_1, EXT_SOURCE_2, EXT_SOURCE_3: REAL — External credit scores (0-1 range)
   - EXT_SOURCE_MEAN: REAL — Average of available external scores
   - FLAG_OWN_CAR: TEXT — 'Y' or 'N'
   - FLAG_OWN_REALTY: TEXT — 'Y' or 'N'
   - OCCUPATION_TYPE: TEXT — Applicant's occupation
   - CNT_CHILDREN: INTEGER — Number of children
   - REGION_RATING_CLIENT: INTEGER — Region risk rating (1=low, 3=high)

2. bureau_summary (305,811 rows — aggregated bureau credits per applicant)
   Columns:
   - SK_ID_CURR: INTEGER — Links to applicants
   - n_bureau_credits: INTEGER — Total number of external credits
   - n_active_credits: INTEGER — Active credits
   - n_closed_credits: INTEGER — Closed credits
   - max_days_overdue: INTEGER — Maximum days overdue across all credits
   - total_credit_sum: REAL — Total credit amount
   - total_debt: REAL — Total remaining debt
   - total_overdue: REAL — Total overdue amount

3. previous_applications (1,670,214 rows — one row per previous HC application)
   Columns:
   - SK_ID_CURR: INTEGER — Links to applicants
   - SK_ID_PREV: INTEGER — Previous application ID
   - NAME_CONTRACT_STATUS: TEXT — 'Approved', 'Refused', 'Canceled', 'Unused offer'
   - NAME_CONTRACT_TYPE: TEXT — 'Cash loans', 'Revolving loans', 'Consumer loans'
   - AMT_APPLICATION: REAL — Application amount
   - AMT_CREDIT: REAL — Approved credit amount
   - DAYS_DECISION: INTEGER — Days before current application when decision was made

4. installment_summary (336,935 rows — aggregated installment payments per applicant)
   Columns:
   - SK_ID_CURR: INTEGER — Links to applicants
   - n_installments: INTEGER — Total installment payment records
   - avg_payment_delay: REAL — Average days late (positive=late)
   - max_payment_delay: REAL — Maximum payment delay
   - late_payment_rate: REAL — Fraction of payments made late (0-1)
   - total_paid: REAL — Total amount paid

IMPORTANT NOTES:
- TARGET=1 means the applicant DEFAULTED (missed payments)
- TARGET=0 means the applicant DID NOT default
- Only use the column names listed above — no other columns exist
- Always include LIMIT in queries (max 1000 rows for detailed, no limit for aggregations)
"""

# ─── Prompt templates ─────────────────────────────────────────────────────────

SYSTEM_PROMPT = f"""You are a precise SQL analyst for the Home Credit Default Risk database.
You MUST generate syntactically correct SQLite SQL queries based ONLY on the provided schema.

RULES:
1. Only use tables and columns defined in the schema below.
2. NEVER use DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, ATTACH, or PRAGMA statements.
3. Always add LIMIT (max 100 for row-level queries).
4. Use proper SQLite syntax (no backtick quoting — use double quotes for aliases).
5. If the question cannot be answered with the available schema, respond with: UNSUPPORTED_QUERY
6. Return ONLY the SQL query — no explanation, no markdown fences, no preamble.

SCHEMA:
{DATABASE_SCHEMA}
"""

USER_PROMPT_TEMPLATE = """Question: {question}

Generate a single SQLite SELECT query to answer this question.
If impossible given the schema, respond with exactly: UNSUPPORTED_QUERY"""


# ─── Safety validator ─────────────────────────────────────────────────────────

FORBIDDEN_KEYWORDS = {
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE",
    "ATTACH", "DETACH", "PRAGMA", "VACUUM", "REINDEX",
    "EXECUTE", "EXEC", "--", "/*", "*/", ";--"
}


def validate_sql(sql: str) -> tuple[bool, str]:
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

    # Check table names are valid
    valid_tables = {"applicants", "bureau_summary", "previous_applications", "installment_summary"}
    # Extract FROM/JOIN table references (simple check)
    from_matches = re.findall(r'\bFROM\s+(\w+)', sql_upper) + re.findall(r'\bJOIN\s+(\w+)', sql_upper)
    for table in from_matches:
        if table.lower() not in valid_tables and table not in {"SELECT"}:
            return False, f"Unknown table referenced: {table}"

    return True, ""


# ─── Deterministic offline fallback patterns ──────────────────────────────────

OFFLINE_PATTERNS = [
    {
        "keywords": ["default rate", "education", "education type"],
        "sql": """
            SELECT NAME_EDUCATION_TYPE,
                   COUNT(*) as total_applicants,
                   SUM(TARGET) as defaulters,
                   ROUND(AVG(TARGET) * 100, 2) as default_rate_pct
            FROM applicants
            GROUP BY NAME_EDUCATION_TYPE
            ORDER BY default_rate_pct DESC
        """,
        "description": "Default rate by education level",
    },
    {
        "keywords": ["default rate", "income", "income type"],
        "sql": """
            SELECT NAME_INCOME_TYPE,
                   COUNT(*) as total_applicants,
                   SUM(TARGET) as defaulters,
                   ROUND(AVG(TARGET) * 100, 2) as default_rate_pct,
                   ROUND(AVG(AMT_INCOME_TOTAL), 2) as avg_income
            FROM applicants
            GROUP BY NAME_INCOME_TYPE
            ORDER BY default_rate_pct DESC
        """,
        "description": "Default rate by income type",
    },
    {
        "keywords": ["high risk", "loan amount", "credit amount", "largest", "top"],
        "sql": """
            SELECT SK_ID_CURR, AMT_CREDIT, AMT_INCOME_TOTAL,
                   ROUND(DEBT_TO_INCOME, 2) as debt_to_income,
                   AGE_YEARS, TARGET
            FROM applicants
            WHERE TARGET = 1
            ORDER BY AMT_CREDIT DESC
            LIMIT 20
        """,
        "description": "Top defaulters by loan amount",
    },
    {
        "keywords": ["average", "age", "by gender", "male", "female"],
        "sql": """
            SELECT CODE_GENDER,
                   COUNT(*) as applicants,
                   ROUND(AVG(AGE_YEARS), 1) as avg_age,
                   ROUND(AVG(AMT_INCOME_TOTAL), 0) as avg_income,
                   ROUND(AVG(TARGET) * 100, 2) as default_rate_pct
            FROM applicants
            GROUP BY CODE_GENDER
        """,
        "description": "Applicant statistics by gender",
    },
    {
        "keywords": ["bureau", "overdue", "default"],
        "sql": """
            SELECT
                CASE
                    WHEN b.max_days_overdue = 0 THEN 'No overdue'
                    WHEN b.max_days_overdue < 30 THEN '1-30 days'
                    WHEN b.max_days_overdue < 90 THEN '31-90 days'
                    ELSE 'Over 90 days'
                END as overdue_bucket,
                COUNT(*) as count,
                ROUND(AVG(a.TARGET) * 100, 2) as default_rate_pct
            FROM applicants a
            JOIN bureau_summary b ON a.SK_ID_CURR = b.SK_ID_CURR
            GROUP BY overdue_bucket
            ORDER BY default_rate_pct DESC
        """,
        "description": "Default rate by bureau overdue bucket",
    },
    {
        "keywords": ["total", "count", "how many", "number of applicants"],
        "sql": """
            SELECT
                COUNT(*) as total_applicants,
                SUM(TARGET) as total_defaulters,
                SUM(1 - TARGET) as total_non_defaulters,
                ROUND(AVG(TARGET) * 100, 2) as overall_default_rate_pct
            FROM applicants
        """,
        "description": "Overall applicant and default statistics",
    },
    {
        "keywords": ["region", "region rating", "location"],
        "sql": """
            SELECT REGION_RATING_CLIENT,
                   COUNT(*) as applicants,
                   ROUND(AVG(TARGET) * 100, 2) as default_rate_pct,
                   ROUND(AVG(AMT_INCOME_TOTAL), 0) as avg_income
            FROM applicants
            GROUP BY REGION_RATING_CLIENT
            ORDER BY REGION_RATING_CLIENT
        """,
        "description": "Default rate by region risk rating",
    },
    {
        "keywords": ["payment delay", "late", "installment"],
        "sql": """
            SELECT
                CASE
                    WHEN i.avg_payment_delay <= 0 THEN 'On time'
                    WHEN i.avg_payment_delay <= 7 THEN '1-7 days late'
                    WHEN i.avg_payment_delay <= 30 THEN '8-30 days late'
                    ELSE 'Over 30 days late'
                END as delay_bucket,
                COUNT(*) as applicants,
                ROUND(AVG(a.TARGET) * 100, 2) as default_rate_pct
            FROM applicants a
            JOIN installment_summary i ON a.SK_ID_CURR = i.SK_ID_CURR
            GROUP BY delay_bucket
            ORDER BY default_rate_pct DESC
        """,
        "description": "Default rate by payment delay bucket",
    },
]


def _find_offline_pattern(question: str) -> Optional[str]:
    """Match question to a deterministic fallback SQL pattern."""
    q_lower = question.lower()
    for pattern in OFFLINE_PATTERNS:
        if any(kw in q_lower for kw in pattern["keywords"]):
            return pattern["sql"].strip()
    return None


# ─── LLM integration ──────────────────────────────────────────────────────────

GROQ_MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile",
    "llama3-70b-8192",
]


def _call_groq(question: str, api_key: str) -> str:
    """Call Groq API to generate SQL using available models."""
    try:
        from groq import Groq
        client = Groq(api_key=api_key)

        for model in GROQ_MODELS:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": USER_PROMPT_TEMPLATE.format(question=question)},
                    ],
                    temperature=0.0,
                    max_tokens=512,
                )
                raw_sql = response.choices[0].message.content.strip()
                # Clean markdown fences if model returned ```sql ... ```
                cleaned = re.sub(r"^```(?:sql)?\s*", "", raw_sql, flags=re.IGNORECASE)
                cleaned = re.sub(r"\s*```$", "", cleaned).strip()
                return cleaned
            except Exception as model_err:
                logger.debug("Model %s failed: %s, trying next...", model, model_err)
                continue

        return "UNSUPPORTED_QUERY"
    except Exception as e:
        logger.warning("Groq API client error: %s", e)
        return "UNSUPPORTED_QUERY"


def generate_sql(question: str, api_key: Optional[str] = None,
                 use_offline_fallback: bool = True) -> tuple[str, str]:
    """
    Generate SQL from natural language question.
    Returns (sql, source) where source is 'llm' | 'offline_pattern' | 'unsupported'.
    """
    api_key = api_key or os.getenv("GROQ_API_KEY")

    # Try LLM first if API key provided
    if api_key:
        sql = _call_groq(question, api_key)
        if sql and sql != "UNSUPPORTED_QUERY":
            is_valid, error = validate_sql(sql)
            if is_valid:
                return sql, "llm"
            else:
                logger.warning("LLM generated invalid SQL: %s | Error: %s", sql[:100], error)

    # Offline deterministic fallback
    if use_offline_fallback:
        offline_sql = _find_offline_pattern(question)
        if offline_sql:
            return offline_sql, "offline_pattern"

    return "", "unsupported"


# ─── Query executor ───────────────────────────────────────────────────────────

def execute_query(sql: str, max_rows: int = 100) -> tuple[list[dict], list[str], str]:
    """
    Execute SQL against the read-only SQLite database.
    Returns (rows, columns, error_message).
    """
    db_to_use = DB_PATH
    if not (os.path.exists(db_to_use) and os.path.getsize(db_to_use) > 0):
        seed_path = os.path.join(ROOT, "sql", "credit_risk_seed.db")
        if os.path.exists(seed_path) and os.path.getsize(seed_path) > 0:
            db_to_use = seed_path
        else:
            return [], [], f"Database not found at {DB_PATH}. Run sql/init_db.py first."

    # Safety validation
    is_valid, error = validate_sql(sql)
    if not is_valid:
        return [], [], f"SQL validation failed: {error}"

    try:
        conn = sqlite3.connect(f"file:{db_to_use}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA query_only = ON;")
        cursor = conn.execute(sql)
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(row) for row in cursor.fetchmany(max_rows)]
        conn.close()
        return rows, columns, ""
    except sqlite3.OperationalError as e:
        return [], [], f"SQL execution error: {str(e)}"
    except Exception as e:
        return [], [], f"Unexpected error: {str(e)}"


# ─── Business answer generator ────────────────────────────────────────────────

def generate_business_answer(question: str, rows: list[dict], columns: list[str],
                              sql: str, source: str) -> str:
    """
    Generate a business-readable answer from actual query results.
    The database result is the source of truth — never fabricated.
    """
    if not rows:
        return "No results found for this query."

    n = len(rows)
    summary = f"**Query returned {n} result{'s' if n > 1 else ''}.**\n\n"

    # Auto-generate summary based on result structure
    if n == 1 and len(columns) <= 4:
        # Single result — present as key-value
        for col, val in rows[0].items():
            summary += f"• **{col}**: {val}\n"
    elif "default_rate_pct" in columns:
        # Default rate result — highlight key findings
        sorted_rows = sorted(rows, key=lambda r: r.get("default_rate_pct", 0), reverse=True)
        summary += "Default rates (highest to lowest):\n"
        for r in sorted_rows[:5]:
            # Find the group-by column (first text column)
            group_col = next((c for c in columns if c not in
                              ["default_rate_pct", "total_applicants", "defaulters",
                               "avg_income", "count", "applicants"]), columns[0])
            group_val = r.get(group_col, "N/A")
            rate = r.get("default_rate_pct", "N/A")
            count = r.get("total_applicants", r.get("count", r.get("applicants", "")))
            summary += f"  • **{group_val}**: {rate}% default rate"
            if count:
                summary += f" ({count:,} applicants)" if isinstance(count, int) else f" ({count} applicants)"
            summary += "\n"
        if source == "offline_pattern":
            summary += "\n*Note: Answer based on deterministic query pattern.*"
    else:
        summary += f"Showing top {min(n, 5)} results:\n"
        for r in rows[:5]:
            row_str = " | ".join(f"{k}: {v}" for k, v in r.items())
            summary += f"  • {row_str}\n"

    return summary


# ─── Main orchestrator ────────────────────────────────────────────────────────

def answer_question(question: str, api_key: Optional[str] = None) -> dict:
    """
    Full NL-to-SQL pipeline. Returns structured result for UI consumption.
    """
    question = question.strip()
    if not question:
        return {"error": "Empty question provided."}

    # Generate SQL
    sql, source = generate_sql(question, api_key=api_key)

    if source == "unsupported" or not sql:
        return {
            "question": question,
            "sql": None,
            "source": "unsupported",
            "rows": [],
            "columns": [],
            "answer": (
                "I cannot answer this question with the available data. "
                "Try asking about default rates, income distributions, bureau credits, "
                "payment delays, or applicant demographics."
            ),
            "error": None,
        }

    # Execute
    rows, columns, error = execute_query(sql)

    if error:
        return {
            "question": question,
            "sql": sql,
            "source": source,
            "rows": [],
            "columns": [],
            "answer": f"Query execution failed: {error}",
            "error": error,
        }

    # Generate business answer
    answer = generate_business_answer(question, rows, columns, sql, source)

    return {
        "question": question,
        "sql": sql,
        "source": source,
        "rows": rows[:50],  # Limit for API response size
        "columns": columns,
        "answer": answer,
        "error": None,
    }
