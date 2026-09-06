"""
CredPulse Credit Risk Intelligence Platform
Prompt Templates & Schema Definitions for NL-to-SQL System.
"""

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
   - AMT_INCOME_TOTAL: REAL — Annual income
   - AMT_CREDIT: REAL — Loan amount requested
   - AMT_ANNUITY: REAL — Annual repayment amount
   - AMT_GOODS_PRICE: REAL — Price of goods the loan is for
   - AGE_YEARS: REAL — Applicant age in years
   - EMPLOYED_YEARS: REAL — Years employed
   - DEBT_TO_INCOME: REAL — AMT_CREDIT / AMT_INCOME_TOTAL
   - ANNUITY_TO_INCOME: REAL — AMT_ANNUITY / AMT_INCOME_TOTAL
   - EXT_SOURCE_1, EXT_SOURCE_2, EXT_SOURCE_3: REAL — External credit scores (0-1 range)
   - EXT_SOURCE_MEAN: REAL — Average of available external scores
   - FLAG_OWN_CAR: TEXT — 'Y' or 'N'
   - FLAG_OWN_REALTY: TEXT — 'Y' or 'N'
   - OCCUPATION_TYPE: TEXT — Applicant's occupation
   - CNT_CHILDREN: INTEGER — Number of children
   - REGION_RATING_CLIENT: INTEGER — Region risk rating (1=low, 3=high)

2. bureau_summary (305,811 rows — credit bureau history per applicant)
   Columns:
   - SK_ID_CURR: INTEGER — Applicant ID (foreign key)
   - n_bureau_credits: INTEGER — Total number of historical credit lines
   - n_active_credits: INTEGER — Number of currently active credit lines
   - n_closed_credits: INTEGER — Number of closed credit lines
   - max_days_overdue: REAL — Maximum overdue days recorded
   - total_credit_sum: REAL — Total credit amount across all bureau records
   - total_debt: REAL — Total current debt across all bureau records
   - total_overdue: REAL — Total overdue amount

3. previous_applications (1,670,214 rows — previous Home Credit applications)
   Columns:
   - SK_ID_CURR: INTEGER — Applicant ID
   - SK_ID_PREV: INTEGER — Previous application ID
   - NAME_CONTRACT_STATUS: TEXT — 'Approved', 'Refused', 'Canceled', 'Unused offer'
   - NAME_CONTRACT_TYPE: TEXT — 'Cash loans', 'Consumer loans', 'Revolving loans'
   - AMT_APPLICATION: REAL — Amount applied for in previous loan
   - AMT_CREDIT: REAL — Amount approved in previous loan
   - AMT_ANNUITY: REAL — Annuity of previous loan
   - DAYS_DECISION: REAL — Days before current application decision was made

4. installment_summary (339,587 rows — payment behavior summary)
   Columns:
   - SK_ID_CURR: INTEGER — Applicant ID
   - n_installments: INTEGER — Total installment payments made
   - avg_payment_delay: REAL — Average days payment was delayed (negative = early)
   - max_payment_delay: REAL — Maximum days payment was delayed
   - late_payment_rate: REAL — Fraction of payments made after due date (0.0 to 1.0)
   - total_paid: REAL — Total amount paid across all installments
"""

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
