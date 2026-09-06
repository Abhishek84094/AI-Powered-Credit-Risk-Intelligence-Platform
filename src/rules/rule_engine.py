"""
CredPulse Credit Risk Intelligence Platform
Layer 5: Business Rules Engine.

All rules are derived from EDA findings, SHAP importance, and validated model behavior.
Rules are labeled as data/model-derived decision-support rules — NOT banking policy.
"""

from dataclasses import dataclass, field
from typing import Optional


# ─── Rule registry ────────────────────────────────────────────────────────────

@dataclass
class BusinessRule:
    rule_id: str
    name: str
    description: str
    supporting_evidence: str
    limitation: str
    risk_direction: str  # "HIGH" | "LOW" | "CAUTION"

    def evaluate(self, features: dict) -> Optional[dict]:
        """Override in subclasses. Returns match dict or None."""
        raise NotImplementedError


@dataclass
class Rule_HighExternalSourceLowScore(BusinessRule):
    rule_id: str = "BR-01"
    name: str = "Low External Credit Scores → Elevated Risk"
    description: str = (
        "IF all available external credit scores (EXT_SOURCE_1/2/3) are below 0.35, "
        "the applicant is flagged as HIGH risk."
    )
    supporting_evidence: str = (
        "EDA finding BI-02: Defaulters have EXT_SOURCE mean ~0.39 vs non-defaulters ~0.52. "
        "SHAP analysis confirms EXT_SOURCE features are top predictors."
    )
    limitation: str = "EXT_SOURCE computation is opaque (external bureau aggregate)."
    risk_direction: str = "HIGH"

    def evaluate(self, features: dict) -> Optional[dict]:
        scores = [features.get(f"EXT_SOURCE_{i}") for i in [1, 2, 3] if features.get(f"EXT_SOURCE_{i}") is not None]
        if not scores:
            return None
        avg = sum(scores) / len(scores)
        if avg < 0.35:
            return {
                "rule_id": self.rule_id,
                "triggered": True,
                "message": f"All external credit scores below threshold (avg={avg:.3f} < 0.35).",
                "risk_signal": "HIGH",
            }
        return None


@dataclass
class Rule_HighDebtToIncome(BusinessRule):
    rule_id: str = "BR-02"
    name: str = "High Debt Burden → Elevated Risk"
    description: str = (
        "IF credit amount exceeds 4× annual income (debt-to-income ratio > 4.0), "
        "applicant is flagged as HIGH risk."
    )
    supporting_evidence: str = (
        "EDA finding BI-03: Defaulters have higher debt-to-income ratios. "
        "DEBT_TO_INCOME is a top-10 SHAP feature."
    )
    limitation: str = "Does not account for total debt across all lenders."
    risk_direction: str = "HIGH"

    def evaluate(self, features: dict) -> Optional[dict]:
        dti = features.get("DEBT_TO_INCOME")
        if dti is None:
            amt_credit = features.get("AMT_CREDIT")
            amt_income = features.get("AMT_INCOME_TOTAL")
            if amt_credit and amt_income and amt_income > 0:
                dti = amt_credit / amt_income
        if dti is not None and dti > 4.0:
            return {
                "rule_id": self.rule_id,
                "triggered": True,
                "message": f"Debt-to-income ratio is {dti:.2f}× (threshold: 4.0×).",
                "risk_signal": "HIGH",
            }
        return None


@dataclass
class Rule_YoungApplicant(BusinessRule):
    rule_id: str = "BR-03"
    name: str = "Young Applicant (<25) → Elevated Risk"
    description: str = (
        "IF applicant is younger than 25 years, elevated default risk is observed."
    )
    supporting_evidence: str = (
        "EDA finding BI-01: Applicants <25 have 12.3% default rate vs population average 8.07%."
    )
    limitation: str = (
        "Age is a correlational signal only. Younger applicants may have shorter credit histories. "
        "Age-based decisions must comply with fair lending regulations."
    )
    risk_direction: str = "CAUTION"

    def evaluate(self, features: dict) -> Optional[dict]:
        age = features.get("APPLICANT_AGE_YEARS")
        if age is None:
            days_birth = features.get("DAYS_BIRTH")
            if days_birth is not None:
                age = -days_birth / 365.25
        if age is not None and age < 25:
            return {
                "rule_id": self.rule_id,
                "triggered": True,
                "message": f"Applicant is {age:.1f} years old (below 25-year threshold).",
                "risk_signal": "CAUTION",
            }
        return None


@dataclass
class Rule_PreviousRefusals(BusinessRule):
    rule_id: str = "BR-04"
    name: str = "High Previous Refusal Rate → Elevated Risk"
    description: str = (
        "IF more than 50% of previous Home Credit applications were refused, "
        "applicant is flagged as HIGH risk."
    )
    supporting_evidence: str = (
        "EDA finding BI-06: Prior refusal history is a strong engineered feature. "
        "SHAP importance: prev_refusal_rate appears in top-20 features."
    )
    limitation: str = "Only captures Home Credit history, not external refusals."
    risk_direction: str = "HIGH"

    def evaluate(self, features: dict) -> Optional[dict]:
        rate = features.get("prev_refusal_rate")
        if rate is not None and rate > 0.5:
            return {
                "rule_id": self.rule_id,
                "triggered": True,
                "message": f"Previous loan refusal rate is {rate:.1%} (threshold: 50%).",
                "risk_signal": "HIGH",
            }
        return None


@dataclass
class Rule_PaymentDelays(BusinessRule):
    rule_id: str = "BR-05"
    name: str = "Chronic Payment Delays → Elevated Risk"
    description: str = (
        "IF average installment payment delay exceeds 7 days AND "
        "late payment rate exceeds 20%, applicant is flagged as HIGH risk."
    )
    supporting_evidence: str = (
        "Installment payment delay features (inst_PAYMENT_DELAY_DAYS_mean, inst_IS_LATE_mean) "
        "are consistently high-importance SHAP features across CV folds."
    )
    limitation: str = "Only captures Home Credit installment behavior; external payment delays not included."
    risk_direction: str = "HIGH"

    def evaluate(self, features: dict) -> Optional[dict]:
        delay = features.get("inst_PAYMENT_DELAY_DAYS_mean")
        late_rate = features.get("inst_IS_LATE_mean")
        if delay is not None and late_rate is not None:
            if delay > 7 and late_rate > 0.20:
                return {
                    "rule_id": self.rule_id,
                    "triggered": True,
                    "message": (
                        f"Avg payment delay={delay:.1f} days (>7) and "
                        f"late payment rate={late_rate:.1%} (>20%)."
                    ),
                    "risk_signal": "HIGH",
                }
        return None


@dataclass
class Rule_StrongExternalScores(BusinessRule):
    rule_id: str = "BR-06"
    name: str = "Strong External Credit Scores → Low Risk Signal"
    description: str = (
        "IF all available external credit scores are above 0.55, "
        "applicant shows a low-risk signal."
    )
    supporting_evidence: str = (
        "Non-defaulters have EXT_SOURCE mean ~0.52 and higher. "
        "SHAP confirms EXT_SOURCE features are strongest protective factors."
    )
    limitation: str = "EXT_SOURCE computation is opaque."
    risk_direction: str = "LOW"

    def evaluate(self, features: dict) -> Optional[dict]:
        scores = [features.get(f"EXT_SOURCE_{i}") for i in [1, 2, 3] if features.get(f"EXT_SOURCE_{i}") is not None]
        if len(scores) >= 2:
            avg = sum(scores) / len(scores)
            if avg > 0.55:
                return {
                    "rule_id": self.rule_id,
                    "triggered": True,
                    "message": f"External credit scores above threshold (avg={avg:.3f} > 0.55).",
                    "risk_signal": "LOW",
                }
        return None


# ─── Rule Engine ──────────────────────────────────────────────────────────────

ALL_RULES = [
    Rule_HighExternalSourceLowScore(),
    Rule_HighDebtToIncome(),
    Rule_YoungApplicant(),
    Rule_PreviousRefusals(),
    Rule_PaymentDelays(),
    Rule_StrongExternalScores(),
]


def evaluate_all_rules(features: dict) -> dict:
    """
    Evaluate all business rules against applicant features.
    Returns aggregated rule results and overall rule-based signal.
    """
    triggered = []
    not_triggered = []
    for rule in ALL_RULES:
        result = rule.evaluate(features)
        if result and result.get("triggered"):
            triggered.append({
                "rule_id": rule.rule_id,
                "name": rule.name,
                "message": result["message"],
                "risk_signal": result["risk_signal"],
                "evidence": rule.supporting_evidence,
                "limitation": rule.limitation,
            })
        else:
            not_triggered.append({
                "rule_id": rule.rule_id,
                "name": rule.name,
                "risk_direction": rule.risk_direction,
            })

    # Aggregate rule signal
    if any(r["risk_signal"] == "HIGH" for r in triggered):
        overall_signal = "HIGH"
    elif any(r["risk_signal"] == "CAUTION" for r in triggered):
        overall_signal = "CAUTION"
    elif any(r["risk_signal"] == "LOW" for r in triggered):
        overall_signal = "LOW"
    else:
        overall_signal = "NEUTRAL"

    return {
        "triggered_rules": triggered,
        "not_triggered_count": len(not_triggered),
        "overall_rule_signal": overall_signal,
        "disclaimer": (
            "These rules are derived from data analysis and model behavior. "
            "They are decision-support tools and do NOT represent official lending policy."
        ),
    }


def get_all_rules_documentation() -> list[dict]:
    """Return documentation for all rules (for UI display)."""
    return [
        {
            "rule_id": r.rule_id,
            "name": r.name,
            "description": r.description,
            "supporting_evidence": r.supporting_evidence,
            "limitation": r.limitation,
            "risk_direction": r.risk_direction,
        }
        for r in ALL_RULES
    ]
