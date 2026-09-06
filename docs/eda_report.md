# CredPulse  EDA Report

Generated: 2026-09-06 15:06:13

## 1. Dataset Overview

| Table | Rows | Cols | Missing % |
|-------|------|------|-----------|
| application_train.csv | 307,511 | 122 | 24.4% |
| application_test.csv | 48,744 | 121 | 23.81% |
| bureau.csv | 50,000 | 17 | 13.97% |
| bureau_balance.csv | 50,000 | 3 | 0.0% |
| previous_application.csv | 50,000 | 37 | 17.36% |
| POS_CASH_balance.csv | 50,000 | 8 | 0.04% |
| credit_card_balance.csv | 50,000 | 23 | 6.94% |
| installments_payments.csv | 50,000 | 8 | 0.0% |

## 2. Target Variable

- Total applicants: **307,511**
- Defaulters (TARGET=1): **24,825** (8.07%)
- Imbalance ratio: **11.39:1** (non-default:default)

## 3. Business Insights


### BI-01: Younger Applicants (<30 years) Have Higher Default Risk

**Finding**: Applicants aged <30 have substantially higher default rates than average (8.07%). Age is inversely correlated with default probability within the younger segment.

**Limitation**: *Correlation does not imply causation  younger applicants may also have shorter credit histories.*


### BI-02: External Credit Scores are Strong Default Predictors

**Finding**: Defaulters have consistently lower EXT_SOURCE scores. EXT_SOURCE_2 gap: non-defaulter mean=0.5235 vs defaulter mean=0.4109.

**Limitation**: *Correlation only  EXT_SOURCE computation is opaque; not a direct causal factor.*


### BI-03: Higher Credit Burden (Credit-to-Income Ratio) Correlates with Default

**Finding**: Defaulters have a higher mean credit-to-income ratio (3.82) compared to non-defaulters (3.903), suggesting that loan size relative to income is an important risk signal.

**Limitation**: *Ratio does not account for total outstanding debt across all lenders.*


### BI-04: Anomalous DAYS_EMPLOYED (=365243) Indicates Unemployed/Pensioner Status

**Finding**: 55,374 applicants (18.0%) have DAYS_EMPLOYED=365243 (sentinel for unemployed/pensioners). Their default rate is 5.40% vs 8.66% for employed applicants.

**Limitation**: *Sentinel value interpretation is based on domain knowledge, not direct labeling in the dataset.*


### BI-05: Gender Gap in Default Rates: Male Applicants Default More

**Finding**: Male applicants (M) have a default rate of 10.14% vs 7.00% for female applicants. This is a correlational observation only.

**Limitation**: *Gender-based decisions are prohibited in regulated lending. This is an analytical observation for research purposes only.*


### BI-06: Previous Application Refusals Are Key Risk Signals

**Finding**: Applicants with previous REFUSED applications by Home Credit have higher default risk. The refusal history aggregated per SK_ID_CURR is a strong engineered feature candidate.

**Limitation**: *This will be validated during Layer 3 feature ablation experiments.*


## 4. Leakage Audit

| Feature | Risk | Mitigation |
|---------|------|------------|
| TARGET | CRITICAL  This IS the target. | Dropped from all feature matrices. |
| DAYS_EMPLOYED = 365243 (raw value) | MEDIUM  Sentinel value requir | Replace with NaN, create binary anomaly flag separately. |
| bureau_balance monthly statuses (C/X = closed) | LOW  Aggregations are pre-app | Only aggregate historical behavior, not future outcomes. |
| SK_ID_CURR / SK_ID_PREV / SK_ID_BUREAU (ID columns | MEDIUM  IDs must never be use | Dropped from all feature matrices. |
| All sklearn preprocessing steps (imputer, scaler,  | HIGH  Must be fitted ONLY on  | Pipeline fitted inside CV loop on training fold only. Valida |
| Feature selection (importance-based) | HIGH  Feature selection using | Feature selection performed inside CV fold on training data  |
| AMT_GOODS_PRICE, AMT_CREDIT, AMT_ANNUITY | LOW  These are loan applicati | Legitimate features  represent the requested loan character |

## 5. Missing Value Strategy

- **Numeric features**: Median imputation (robust to skewed distributions)
- **Categorical features**: Mode imputation + 'Unknown' category for high-missingness (>50%)
- **Features >60% missing**: Drop from feature matrix (insufficient signal)
- **DAYS_EMPLOYED sentinel**: Replace 365243 with NaN before imputation + add binary flag


## 6. EDA Visualizations

- ![01_target_distribution](C:\Users\Abhishek\OneDrive\Pictures\Desktop\AI-Powered Credit Risk Intelligence Platform\reports\eda_figures\01_target_distribution.png)
- ![02_application_missing_values](C:\Users\Abhishek\OneDrive\Pictures\Desktop\AI-Powered Credit Risk Intelligence Platform\reports\eda_figures\02_application_missing_values.png)
- ![03_numeric_distributions](C:\Users\Abhishek\OneDrive\Pictures\Desktop\AI-Powered Credit Risk Intelligence Platform\reports\eda_figures\03_numeric_distributions.png)
- ![04_default_rate_by_age](C:\Users\Abhishek\OneDrive\Pictures\Desktop\AI-Powered Credit Risk Intelligence Platform\reports\eda_figures\04_default_rate_by_age.png)
- ![05_categorical_default_rates](C:\Users\Abhishek\OneDrive\Pictures\Desktop\AI-Powered Credit Risk Intelligence Platform\reports\eda_figures\05_categorical_default_rates.png)
- ![06_ext_source_distribution](C:\Users\Abhishek\OneDrive\Pictures\Desktop\AI-Powered Credit Risk Intelligence Platform\reports\eda_figures\06_ext_source_distribution.png)
- ![07_financial_burden_ratios](C:\Users\Abhishek\OneDrive\Pictures\Desktop\AI-Powered Credit Risk Intelligence Platform\reports\eda_figures\07_financial_burden_ratios.png)
- ![08_correlation_heatmap](C:\Users\Abhishek\OneDrive\Pictures\Desktop\AI-Powered Credit Risk Intelligence Platform\reports\eda_figures\08_correlation_heatmap.png)
- ![09_financial_outliers_boxplot](C:\Users\Abhishek\OneDrive\Pictures\Desktop\AI-Powered Credit Risk Intelligence Platform\reports\eda_figures\09_financial_outliers_boxplot.png)
- ![10_prev_application_status](C:\Users\Abhishek\OneDrive\Pictures\Desktop\AI-Powered Credit Risk Intelligence Platform\reports\eda_figures\10_prev_application_status.png)

## 7. Layer 1 Completion Criteria

- [x] Dataset structure understood
- [x] Table relationships documented
- [x] Data quality report created
- [x] Target imbalance measured
- [x] Feature categories documented
- [x] Missing-value strategy proposed
- [x] Potential leakage identified
- [x] >= 5 evidence-based business insights produced
- [x] EDA visualizations generated
- [x] EDA script runs successfully
- [x] Findings documented in docs/eda_report.md