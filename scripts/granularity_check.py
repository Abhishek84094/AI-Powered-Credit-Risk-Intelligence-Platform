import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.ml.predict import predict_single

ext_values = [0.10, 0.18, 0.26, 0.35, 0.43, 0.52, 0.61, 0.70, 0.79, 0.88]
results = []

for v in ext_values:
    app = {
        "AMT_INCOME_TOTAL": 150000.0,
        "AMT_CREDIT": 450000.0,
        "AMT_ANNUITY": 22500.0,
        "DAYS_BIRTH": -14000,
        "DAYS_EMPLOYED": -2000,
        "EXT_SOURCE_1": v,
        "EXT_SOURCE_2": v,
        "EXT_SOURCE_3": v,
    }
    res = predict_single(app)
    results.append((v, res["default_probability"], res["risk_score_pct"], res["risk_band"]))

print("| EXT_SOURCE   | Default Prob   | Risk Score (%)   | Risk Band    |")
print("|--------------|----------------|------------------|--------------|")
for v, p, s, b in results:
    print(f"| {v:<12.2f} | {p:<14.4f} | {s:<16.2f} | {b:<12} |")

probs = [r[1] for r in results]
unique_probs = len(set(probs))
print(f"\nTotal unique probability values: {unique_probs} out of {len(probs)}")

# Lower EXT_SOURCE = higher risk of default
# Higher EXT_SOURCE = lower risk of default (monotonic decreasing in probability)
is_monotonic_decreasing = all(probs[i] >= probs[i+1] for i in range(len(probs)-1))
print(f"Strict/non-increasing risk monotonicity as credit score increases: {is_monotonic_decreasing}")
