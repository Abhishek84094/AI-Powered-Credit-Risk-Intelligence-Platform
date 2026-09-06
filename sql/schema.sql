-- ==============================================================================
-- CredPulse Credit Risk Intelligence Platform — SQLite Database Schema
-- ==============================================================================

-- 1. Main loan applicants table
CREATE TABLE IF NOT EXISTS applicants (
    SK_ID_CURR INTEGER PRIMARY KEY,
    TARGET INTEGER,
    CODE_GENDER TEXT,
    NAME_EDUCATION_TYPE TEXT,
    NAME_INCOME_TYPE TEXT,
    NAME_FAMILY_STATUS TEXT,
    NAME_HOUSING_TYPE TEXT,
    NAME_CONTRACT_TYPE TEXT,
    AMT_INCOME_TOTAL REAL,
    AMT_CREDIT REAL,
    AMT_ANNUITY REAL,
    AMT_GOODS_PRICE REAL,
    DAYS_BIRTH REAL,
    DAYS_EMPLOYED REAL,
    CNT_CHILDREN INTEGER,
    CNT_FAM_MEMBERS REAL,
    REGION_RATING_CLIENT INTEGER,
    EXT_SOURCE_1 REAL,
    EXT_SOURCE_2 REAL,
    EXT_SOURCE_3 REAL,
    FLAG_OWN_CAR TEXT,
    FLAG_OWN_REALTY TEXT,
    OCCUPATION_TYPE TEXT,
    ORGANIZATION_TYPE TEXT,
    REG_CITY_NOT_LIVE_CITY INTEGER,
    LIVE_CITY_NOT_WORK_CITY INTEGER,
    AGE_YEARS REAL,
    EMPLOYED_YEARS REAL,
    DEBT_TO_INCOME REAL,
    ANNUITY_TO_INCOME REAL,
    EXT_SOURCE_MEAN REAL
);

-- 2. Aggregated Bureau Summary
CREATE TABLE IF NOT EXISTS bureau_summary (
    SK_ID_CURR INTEGER PRIMARY KEY,
    n_bureau_credits INTEGER,
    n_active_credits INTEGER,
    n_closed_credits INTEGER,
    max_days_overdue REAL,
    total_credit_sum REAL,
    total_debt REAL,
    total_overdue REAL,
    FOREIGN KEY(SK_ID_CURR) REFERENCES applicants(SK_ID_CURR)
);

-- 3. Previous Applications
CREATE TABLE IF NOT EXISTS previous_applications (
    SK_ID_CURR INTEGER,
    SK_ID_PREV INTEGER,
    NAME_CONTRACT_STATUS TEXT,
    NAME_CONTRACT_TYPE TEXT,
    AMT_APPLICATION REAL,
    AMT_CREDIT REAL,
    AMT_ANNUITY REAL,
    AMT_GOODS_PRICE REAL,
    DAYS_DECISION REAL,
    FOREIGN KEY(SK_ID_CURR) REFERENCES applicants(SK_ID_CURR)
);

-- 4. Installment Payment History Summary
CREATE TABLE IF NOT EXISTS installment_summary (
    SK_ID_CURR INTEGER PRIMARY KEY,
    n_installments INTEGER,
    avg_payment_delay REAL,
    max_payment_delay REAL,
    late_payment_rate REAL,
    total_paid REAL,
    FOREIGN KEY(SK_ID_CURR) REFERENCES applicants(SK_ID_CURR)
);

-- Indexes for high performance analytical queries
CREATE INDEX IF NOT EXISTS idx_applicants_id ON applicants(SK_ID_CURR);
CREATE INDEX IF NOT EXISTS idx_applicants_target ON applicants(TARGET);
CREATE INDEX IF NOT EXISTS idx_applicants_education ON applicants(NAME_EDUCATION_TYPE);
CREATE INDEX IF NOT EXISTS idx_applicants_income_type ON applicants(NAME_INCOME_TYPE);
CREATE INDEX IF NOT EXISTS idx_bureau_id ON bureau_summary(SK_ID_CURR);
CREATE INDEX IF NOT EXISTS idx_prev_id ON previous_applications(SK_ID_CURR);
CREATE INDEX IF NOT EXISTS idx_inst_id ON installment_summary(SK_ID_CURR);
