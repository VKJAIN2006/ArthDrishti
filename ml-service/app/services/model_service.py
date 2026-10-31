"""Thin wrapper around the trained XGBoost demand model."""
from __future__ import annotations

from pathlib import Path
from typing import Dict, List

import joblib
import numpy as np
import pandas as pd

from app.config import FEATURES_FILE, MODEL_FILE


class ModelNotLoadedError(RuntimeError):
    """Raised when the model artifacts are missing or invalid."""


class DemandModel:
    """Loads the pickled model + feature order and exposes predictions."""

    def __init__(self, model_file: Path | str = MODEL_FILE, features_file: Path | str = FEATURES_FILE):
        self.model_file = Path(model_file)
        self.features_file = Path(features_file)
        if not self.model_file.exists():
            raise ModelNotLoadedError(f"Model file not found: {self.model_file}")
        if not self.features_file.exists():
            raise ModelNotLoadedError(f"Feature file not found: {self.features_file}")

        self.model = joblib.load(self.model_file)
        self.features: List[str] = list(joblib.load(self.features_file))

    def predict_frame(self, rows: List[Dict]) -> np.ndarray:
        """Predict for a list of feature dicts (order is enforced)."""
        if not rows:
            return np.array([])
        df = pd.DataFrame(rows)
        for feat in self.features:
            if feat not in df.columns:
                df[feat] = 0
        df = df[self.features]
        preds = self.model.predict(df)
        return np.asarray(preds, dtype=float)

    def predict_one(self, row: Dict) -> float:
        return float(self.predict_frame([row])[0])


_model: "DemandModel | None" = None


def get_model() -> DemandModel:
    """Lazy singleton so importing this module never loads the model twice."""
    global _model
    if _model is None:
        _model = DemandModel()
    return _model
