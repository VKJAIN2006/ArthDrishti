"""Request/response schemas for the ML service."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    """Raw demand prediction. Missing features are filled from the product's
    latest data when ``product_id`` is supplied."""

    product_id: Optional[str] = None
    horizon_days: int = Field(default=7, ge=1, le=30)
    day_of_week: Optional[int] = None
    month: Optional[int] = None
    is_weekend: Optional[int] = None
    is_holiday: Optional[int] = None
    lag_7: Optional[float] = None
    lag_14: Optional[float] = None
    rolling_mean_7: Optional[float] = None
    rolling_mean_30: Optional[float] = None
    price: Optional[float] = None
    promotion_flag: Optional[int] = None
    current_stock: Optional[float] = None
    reorder_level: Optional[float] = None
    lead_time_days: Optional[float] = None
    units_sold: Optional[float] = None


class ProductForecastRequest(BaseModel):
    product_id: str
    horizon_days: int = Field(default=7, ge=1, le=30)
    promotion_flag: int = Field(default=0, ge=0, le=1)
    price: Optional[float] = None


class BatchForecastRequest(BaseModel):
    horizon_days: int = Field(default=7, ge=1, le=30)
    promotion_flag: int = Field(default=0, ge=0, le=1)
    category: Optional[str] = None
    product_ids: Optional[List[str]] = None


class ForecastResponse(BaseModel):
    product_id: str
    product_name: str
    category: str
    horizon_days: int
    total_demand: float
    avg_daily_demand: float
    daily: List[dict]
    weekly: List[dict]
