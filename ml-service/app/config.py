"""Central configuration for the ML service.

All paths are resolved relative to the WORKSHOP project root so the service
can be started from any working directory.
"""
from __future__ import annotations

import os
from pathlib import Path

# ml-service/app/config.py  ->  parents[0]=app, [1]=ml-service, [2]=WORKSHOP
PROJECT_ROOT = Path(__file__).resolve().parents[2]

ML_SERVICE_DIR = PROJECT_ROOT / "ml-service"
MODEL_DIR = Path(os.getenv("MODEL_DIR", ML_SERVICE_DIR / "model"))
DATA_CSV = Path(os.getenv("DATA_CSV", PROJECT_ROOT / "data" / "retail_inventory_dataset.csv"))

MODEL_FILE = MODEL_DIR / "xgboost_demand_model.pkl"
FEATURES_FILE = MODEL_DIR / "model_features.pkl"

# Business layer defaults
DEFAULT_HORIZON_DAYS = 7
SLOW_MOVING_DAYS = 45          # days of stock left above which we call it overstocked
REORDER_COVER_DAYS = 14        # safety cover added when computing reorder quantity
MEDIUM_RISK_FACTOR = 1.5       # days left < factor * lead time -> medium risk

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500",
).split(",")
