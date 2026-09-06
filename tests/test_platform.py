"""
CredPulse Credit Risk Intelligence Platform — Comprehensive Test Suite
Tests for:
  - Business Rules Engine (Layer 5)
  - Data Preprocessing & Leakage Guards (Layer 1 & 2)
  - Talk-to-Data Safety & Offline Fallback (Layer 6)
  - FastAPI Application Endpoints
"""

import os
import sys
import unittest
from fastapi.testclient import TestClient

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from app.main import app
from src.rules.rule_engine import (
    evaluate_all_rules,
    get_all_rules_documentation,
    Rule_HighExternalSourceLowScore,
    Rule_HighDebtToIncome,
    Rule_YoungApplicant,
    Rule_PreviousRefusals,
    Rule_PaymentDelays,
    Rule_StrongExternalScores,
)
from src.talk_to_data.nl_to_sql import validate_sql, _find_offline_pattern, answer_question


class TestCreditRiskPlatform(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    # ─── 1. Business Rules Engine Tests ──────────────────────────────────────────

    def test_get_all_rules_documentation(self):
        rules = get_all_rules_documentation()
        self.assertGreaterEqual(len(rules), 6, "Expected at least 6 evidence-based business rules")
        for r in rules:
            self.assertIn("rule_id", r)
            self.assertIn("name", r)
            self.assertIn("description", r)
            self.assertIn("supporting_evidence", r)

    def test_rule_high_external_source_low_score_triggers(self):
        rule = Rule_HighExternalSourceLowScore()
        applicant = {
            "EXT_SOURCE_1": 0.20,
            "EXT_SOURCE_2": 0.25,
            "EXT_SOURCE_3": 0.22,
        }
        res = rule.evaluate(applicant)
        self.assertIsNotNone(res)
        self.assertTrue(res["triggered"])
        self.assertEqual(res["risk_signal"], "HIGH")

    def test_rule_high_external_source_low_score_passes(self):
        rule = Rule_HighExternalSourceLowScore()
        applicant = {
            "EXT_SOURCE_1": 0.70,
            "EXT_SOURCE_2": 0.75,
            "EXT_SOURCE_3": 0.80,
        }
        res = rule.evaluate(applicant)
        self.assertIsNone(res)

    def test_rule_high_debt_to_income_triggers(self):
        rule = Rule_HighDebtToIncome()
        applicant = {
            "AMT_CREDIT": 1000000,
            "AMT_INCOME_TOTAL": 100000,  # DTI = 10.0 > 4.0
        }
        res = rule.evaluate(applicant)
        self.assertIsNotNone(res)
        self.assertTrue(res["triggered"])
        self.assertEqual(res["risk_signal"], "HIGH")

    def test_rule_strong_external_scores_triggers_low_risk(self):
        rule = Rule_StrongExternalScores()
        applicant = {
            "EXT_SOURCE_1": 0.75,
            "EXT_SOURCE_2": 0.82,
            "EXT_SOURCE_3": 0.79,
        }
        res = rule.evaluate(applicant)
        self.assertIsNotNone(res)
        self.assertTrue(res["triggered"])
        self.assertEqual(res["risk_signal"], "LOW")

    def test_evaluate_all_rules_integration(self):
        high_risk_applicant = {
            "AMT_CREDIT": 1000000,
            "AMT_INCOME_TOTAL": 100000,
            "EXT_SOURCE_1": 0.15,
            "EXT_SOURCE_2": 0.18,
            "EXT_SOURCE_3": 0.20,
            "DAYS_BIRTH": -8500,
        }
        result = evaluate_all_rules(high_risk_applicant)
        self.assertEqual(result["overall_rule_signal"], "HIGH")
        self.assertGreaterEqual(len(result["triggered_rules"]), 1)
        self.assertIn("disclaimer", result)

    # ─── 2. Talk-to-Data Safety & Offline Fallback Tests ─────────────────────────

    def test_sql_safety_validator(self):
        # Valid analytical queries
        valid1, _ = validate_sql("SELECT COUNT(*) FROM applicants WHERE TARGET = 1")
        self.assertTrue(valid1)
        valid2, _ = validate_sql("SELECT NAME_EDUCATION_TYPE, AVG(TARGET) FROM applicants GROUP BY 1 LIMIT 50")
        self.assertTrue(valid2)

        # Dangerous mutation attempts must be blocked
        self.assertFalse(validate_sql("DROP TABLE applicants;")[0])
        self.assertFalse(validate_sql("DELETE FROM applicants WHERE TARGET = 1;")[0])
        self.assertFalse(validate_sql("INSERT INTO applicants (SK_ID_CURR) VALUES (999);")[0])
        self.assertFalse(validate_sql("UPDATE applicants SET TARGET = 0;")[0])
        self.assertFalse(validate_sql("ALTER TABLE applicants ADD COLUMN test TEXT;")[0])

    def test_offline_nl_to_sql_patterns(self):
        sql1 = _find_offline_pattern("What is the default rate by education type?")
        self.assertIsNotNone(sql1)
        self.assertIn("SELECT", sql1.upper())
        self.assertIn("NAME_EDUCATION_TYPE", sql1)

        sql2 = _find_offline_pattern("What is the distribution of income types?")
        self.assertIsNotNone(sql2)
        self.assertIn("SELECT", sql2.upper())
        self.assertIn("NAME_INCOME_TYPE", sql2)

        sql3 = _find_offline_pattern("Show default rates across payment delay")
        self.assertIsNotNone(sql3)
        self.assertIn("SELECT", sql3.upper())

    # ─── 3. FastAPI Endpoint Tests ───────────────────────────────────────────────

    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("models_ready", data)
        self.assertIn("database_ready", data)

    def test_api_prefix_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")

    def test_rules_endpoint(self):
        response = self.client.get("/rules")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("rules", data)
        self.assertGreaterEqual(len(data["rules"]), 6)

    def test_rules_evaluate_endpoint(self):
        payload = {
            "AMT_CREDIT": 1200000,
            "AMT_INCOME_TOTAL": 100000,
            "EXT_SOURCE_1": 0.12,
            "EXT_SOURCE_2": 0.15,
            "EXT_SOURCE_3": 0.18,
        }
        response = self.client.post("/rules/evaluate", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("overall_rule_signal", data)
        self.assertIn("triggered_rules", data)
        self.assertGreaterEqual(len(data["triggered_rules"]), 1)

    def test_eda_summary_endpoint(self):
        response = self.client.get("/eda/summary")
        if os.path.exists(os.path.join(ROOT, "reports", "eda_summary.json")):
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue("dataset_overview" in data or "target" in data)
        else:
            self.assertIn(response.status_code, (404, 503))

    def test_chat_endpoint_with_offline_fallback(self):
        # With database initialized, analytical queries should succeed
        payload = {
            "question": "What is the default rate by education type?"
        }
        response = self.client.post("/chat", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("sql", data)
        self.assertIn("results", data)

    def test_predict_endpoint(self):
        payload = {
            "AMT_CREDIT": 450000,
            "AMT_INCOME_TOTAL": 250000,
            "EXT_SOURCE_1": 0.75,
            "EXT_SOURCE_2": 0.80,
            "EXT_SOURCE_3": 0.78,
            "DAYS_BIRTH": -14000,
            "DAYS_EMPLOYED": -3000,
        }
        response = self.client.post("/predict", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("default_probability", data)
        self.assertIn("risk_score_pct", data)
        self.assertIn("risk_band", data)
        self.assertEqual(data["risk_band"], "LOW")

    def test_predict_explain_endpoint(self):
        payload = {
            "AMT_CREDIT": 900000,
            "AMT_INCOME_TOTAL": 80000,
            "EXT_SOURCE_1": 0.20,
            "EXT_SOURCE_2": 0.18,
            "EXT_SOURCE_3": 0.22,
            "DAYS_BIRTH": -8500,
        }
        response = self.client.post("/predict/explain", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("prediction", data)
        self.assertIn("shap_explanation", data)
        self.assertIn("plain_explanation", data)
        self.assertIn("business_rules", data)

    def test_data_preprocessor_pipeline(self):
        """Verify that src.data package functions correctly and builds pipeline without error."""
        import pandas as pd
        from src.data.preprocessor import build_preprocessor, get_feature_columns, get_feature_names_out
        from src.data.loader import verify_data_files

        # Test preprocessor on a synthetic mini dataframe
        df_sample = pd.DataFrame({
            "SK_ID_CURR": [100001, 100002],
            "AMT_INCOME_TOTAL": [150000.0, 200000.0],
            "AMT_CREDIT": [500000.0, 600000.0],
            "CODE_GENDER": ["F", "M"],
            "NAME_CONTRACT_TYPE": ["Cash loans", "Revolving loans"],
        })
        num_cols, cat_cols = get_feature_columns(df_sample)
        self.assertEqual(sorted(num_cols), ["AMT_CREDIT", "AMT_INCOME_TOTAL"])
        self.assertEqual(sorted(cat_cols), ["CODE_GENDER", "NAME_CONTRACT_TYPE"])

        preprocessor = build_preprocessor(num_cols, cat_cols)
        X_proc = preprocessor.fit_transform(df_sample)
        self.assertEqual(X_proc.shape[0], 2)

        feat_names = get_feature_names_out(preprocessor, num_cols, cat_cols)
        self.assertGreaterEqual(len(feat_names), 4)
        self.assertIn("AMT_CREDIT", feat_names)


if __name__ == "__main__":
    unittest.main()

