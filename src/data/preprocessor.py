"""
CredPulse Credit Risk Intelligence Platform
Layer 2: Preprocessor — Scikit-learn Pipeline for imputation, encoding, and scaling.

Rules:
  - Pipeline fitted ONLY on training data (never on full dataset or validation fold).
  - Categorical encoding, numeric imputation, and scaling all happen inside the pipeline.
  - Output is a fitted pipeline object and feature names list.
"""

import logging
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

logger = logging.getLogger(__name__)

# Columns to always drop (IDs, raw sentinel, near-zero-variance flags that add noise)
ALWAYS_DROP = [
    "SK_ID_CURR", "SK_ID_PREV", "SK_ID_BUREAU",
    # Binary flag columns with very low information — evaluated in ablation
    # We keep them for now; model importance will prune them
]


def get_feature_columns(df: pd.DataFrame) -> tuple[list[str], list[str]]:
    """
    Split columns into numeric and categorical.
    Excludes any remaining ID-like columns and TARGET.
    """
    drop = set(ALWAYS_DROP + ["TARGET", "_SK_ID_CURR"])
    numeric_cols = [
        c for c in df.select_dtypes(include=[np.number]).columns
        if c not in drop
    ]
    categorical_cols = [
        c for c in df.select_dtypes(include=["object", "category"]).columns
        if c not in drop
    ]
    return numeric_cols, categorical_cols


def build_preprocessor(numeric_cols: list[str], categorical_cols: list[str]) -> ColumnTransformer:
    """
    Build a ColumnTransformer with:
    - Numeric: median imputation + standard scaling
    - Categorical: most_frequent imputation + one-hot encoding (handle unknown)
    """
    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, numeric_cols),
            ("cat", categorical_pipeline, categorical_cols),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    return preprocessor


def get_feature_names_out(preprocessor: ColumnTransformer,
                          numeric_cols: list[str],
                          categorical_cols: list[str]) -> list[str]:
    """Extract feature names after fit_transform."""
    cat_encoder = preprocessor.named_transformers_["cat"]["encoder"]
    cat_feature_names = list(cat_encoder.get_feature_names_out(categorical_cols))
    return numeric_cols + cat_feature_names
