# CredPulse — AI-Powered Credit Risk Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg)](https://tailwindcss.com)
[![LightGBM](https://img.shields.io/badge/LightGBM-4.0%2B-green.svg)](https://lightgbm.readthedocs.io)
[![TreeSHAP](https://img.shields.io/badge/Explainability-TreeSHAP-orange.svg)](https://shap.readthedocs.io)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://docker.com)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20CredPulse-red.svg)]()

> An enterprise-grade AI credit underwriting and risk intelligence platform engineered for the **Home Credit Default Risk** domain. Features calibrated machine learning scoring, exact Shapley-value explainability, audited business rules governance, and a natural language SQL analytics interface.

---

## Architecture Overview

The system is constructed with strict modular separation across **6 core layers**:

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                             REACT 19 FRONTEND                               │
 │   EDA Dashboard  •  Risk Scoring  •  TreeSHAP XAI  •  Rules  •  NL-to-SQL   │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │ JSON REST API
 ┌──────────────────────────────────────▼──────────────────────────────────────┐
 │                              FASTAPI BACKEND                                │
 │               Async Endpoints  •  Pydantic V2 Schemas  •  CORS              │
 └──────────────────┬───────────────────┬───────────────────┬──────────────────┘
                    │                   │                   │
 ┌──────────────────▼──────┐ ┌──────────▼─────────┐ ┌───────▼─────────────────┐
 │   LAYER 3: ML SCORING   │ │ LAYER 4: TREE-SHAP │ │ LAYER 5: BUSINESS RULES │
 │ Tuned LightGBM (0.7812) │ │ Additive Shapley   │ │ 6 Validated Guardrails  │
 │ Isotonic Calibration    │ │ Waterfall Attrib.  │ │ Underwriting Simulator  │
 │ F1-Optimal Thresholding │ │ Adverse Action Rsn │ │ Governance Engine       │
 └─────────────────────────┘ └────────────────────┘ └─────────────────────────┘
                    │                   │                   │
 ┌──────────────────▼───────────────────▼───────────────────▼──────────────────┐
 │                         LAYER 6: TALK-TO-DATA                               │
 │   Groq Llama-3.3-70B  •  Deterministic Offline Fallback  •  Safe SQL Engine │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │ Read-Only Analytics
 ┌──────────────────────────────────────▼──────────────────────────────────────┐
 │                         SQLITE ANALYTICAL DATABASE                          │
 │  307K Applicants • 305K Bureau • 1.67M Prev Applications • 339K Installments│
 └─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Experimental Results

All models were evaluated using **5-Fold Stratified Cross-Validation** with strict leakage prevention (imputation and scaling fit exclusively inside training splits):

| Exp ID | Model | Feature Set | Imbalance Strategy | Val ROC-AUC | Val PR-AUC | F1 Score | Brier Score |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **EXP-01** | Logistic Regression | Full Combined (284 feat.) | `class_weight=balanced` | 0.7642 | 0.2443 | 0.3109 | 0.1968 |
| **EXP-02** | Default LightGBM | Full Combined (284 feat.) | `scale_pos_weight=11.4` | 0.7733 | 0.2613 | 0.3236 | 0.1531 |
| **EXP-03** | **Tuned LightGBM (Production)** | **Full Combined (284 feat.)** | **`scale_pos_weight=11.4`** | **0.7812** | **0.2741** | **0.3382** | **0.1482** |
| **EXP-04** | XGBoost Benchmark | Full Combined (284 feat.) | `scale_pos_weight=11.4` | 0.7765 | 0.2678 | 0.3294 | 0.1505 |

### Calibration & Risk Thresholds
- **Calibration Method:** Isotonic Regression (`CalibratedClassifierCV(method='isotonic')`)
- **Risk Bands:**
  - `LOW RISK` (PD < 5.0%): Represents ~42% of applicants, observed default rate 2.4%
  - `MEDIUM RISK` (5.0% ≤ PD < 20.0%): Represents ~47% of applicants, observed default rate 9.1%
  - `HIGH RISK` (PD ≥ 20.0%): Represents ~11% of applicants, observed default rate 24.8%

---

## 6 Evidence-Based Business Rules

All policy rules are derived from empirical EDA default correlations and SHAP importance rankings:

1. **BR-01: Low External Credit Scores → Elevated Risk**
   - *Logic:* Triggered if mean `EXT_SOURCE` < 0.35.
   - *Evidence:* Applicants with mean `EXT_SOURCE` < 0.35 exhibit a 21.4% default rate vs 3.2% for prime applicants.
2. **BR-02: High Debt Burden → Elevated Risk**
   - *Logic:* Triggered if Credit-to-Income ratio > 4.0.
   - *Evidence:* Defaulters carry disproportionately higher debt-to-income loads with lower repayment capacity.
3. **BR-03: Young Borrower (< 25 Years) with Low Credit Score**
   - *Logic:* Triggered if Age < 25 and mean `EXT_SOURCE` < 0.40.
   - *Evidence:* Youngest demographic quartile experiences a default rate of 11.5% due to thin credit files.
4. **BR-04: Prior Credit Application Refusals**
   - *Logic:* Triggered if `prev_REFUSED_COUNT` ≥ 2.
   - *Evidence:* Defaulters average 2.3× more previous loan application rejections.
5. **BR-05: Historical Installment Payment Delays**
   - *Logic:* Triggered if `inst_IS_LATE_mean` > 0.20 (more than 20% payments delayed).
   - *Evidence:* Late installment payments strongly indicate liquidity and cash-flow distress.
6. **BR-06: Prime Borrower Fast-Track Pass**
   - *Logic:* Passed if `EXT_SOURCE` > 0.55 and debt-to-income < 3.0.
   - *Evidence:* Observed default rate below 2.0% enables automated approval workflows.

---

## Talk-to-Data Architecture (Layer 6)

The platform provides natural language querying over the complete Home Credit dataset:
- **Groq Llama-3.3-70B Integration:** Translates natural language questions to read-only SQLite queries within milliseconds.
- **Deterministic Offline Fallback:** When offline or without API keys, a deterministic template engine guarantees answers to common risk and underwriting queries.
- **Zero Hallucination Guarantee:** Prompts inject only strict table and column schemas—no fabricated data. All figures come from actual executed SQL on 307K+ records.
- **SQL Security Firewall:** All queries undergo keyword analysis blocking `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `ATTACH`, and multi-statement injection.

---

## Quickstart & Local Setup

### Prerequisites
- Python 3.10 or 3.11
- Node.js 20+ & npm (for UI development)
- (Optional) Docker & Docker Compose

### 1. Installation

```bash
# Clone the repository
cd "AI-Powered Credit Risk Intelligence Platform"

# Install Python backend dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
npm run build
cd ..
```

### 2. Initialize Database & Train Models

```bash
# Initialize SQLite analytical database (loads 307K rows)
py -3 sql/init_db.py

# Train production model and calibrate
py -3 src/ml/train.py
```

### 3. Launch Platform

#### Option A: Unified Full-Stack (FastAPI serves built React SPA)
```bash
py -3 app/main.py
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser!

#### Option B: Development Mode (Vite HMR + FastAPI API)
- Terminal 1 (Backend): `py -3 app/main.py`
- Terminal 2 (Frontend): `cd frontend && npm run dev`
Visit **[http://localhost:5173](http://localhost:5173)**.

---

## Docker Deployment

The project includes a production multi-stage `Dockerfile` and `docker-compose.yml`:

```bash
# Build and run container
docker-compose up --build -d

# Check container health
docker ps
```
The entire application is accessible at **http://localhost:8000**.

---

## Running Test Suite

Verify all system invariants, rule engines, SQL safety, and API endpoints:

```bash
py -3 tests/test_platform.py
```
*Expected output: 14 passing unit & integration tests.*

---

## Project Structure

```
AI-Powered Credit Risk Intelligence Platform/
├── app/
│   └── main.py                     # FastAPI REST API & SPA static serving
├── data/
│   └── home-credit-default-risk/   # Raw Home Credit CSV dataset files
├── experiments/
│   └── model_experiments.csv       # CV benchmark audit trail (EXP-01 - EXP-04)
├── frontend/
│   ├── src/
│   │   ├── pages/                  # Dashboard, Prediction, Explainability, Rules, Chat
│   │   ├── services/api.js         # API integration client
│   │   ├── App.jsx                 # Routing and navigation
│   │   └── index.css               # TailwindCSS v4 dark-theme styling
│   ├── package.json
│   └── vite.config.js
├── models/
│   ├── lgbm_calibrated.pkl         # Production calibrated model
│   ├── lgbm_base.pkl               # Uncalibrated gradient booster
│   ├── pipeline.pkl                # Preprocessing pipeline
│   ├── risk_thresholds.json        # Calibrated decision cut-points
│   └── feature_importance.json     # TreeSHAP global importance ranking
├── reports/
│   └── eda_summary.json            # Structured EDA distributions & insights
├── sql/
│   ├── credit_risk.db              # SQLite analytical database (224MB)
│   └── init_db.py                  # Database ETL loader
├── src/
│   ├── data/                       # loader.py, preprocessor.py
│   ├── explainability/             # explainer.py (TreeSHAP & waterfall)
│   ├── ml/                         # train.py, predict.py
│   ├── rules/                      # rule_engine.py (Layer 5)
│   └── talk_to_data/               # nl_to_sql.py (Layer 6)
├── tests/
│   └── test_platform.py            # Unit & integration test suite
├── Dockerfile                      # Multi-stage production container build
├── docker-compose.yml              # Container orchestration
└── README.md
```
