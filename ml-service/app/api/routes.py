"""API routes for the ML service."""
from __future__ import annotations

from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas import BatchForecastRequest, PredictRequest, ProductForecastRequest
from app.services import risk_service
from app.services.data_service import ProductNotFoundError, get_store
from app.services.forecast_service import get_engine
from app.services.model_service import get_model

router = APIRouter()


# ---------------------------------------------------------------------- health
@router.get("/health", tags=["system"])
def health() -> dict:
    store = get_store()
    return {
        "status": "ok",
        "service": "arthdrishti-ml-service",
        "products": len(store.products),
        "data_last_date": store.last_date.isoformat(),
        "features": get_model().features,
    }


# -------------------------------------------------------------------- catalog
@router.get("/products", tags=["catalog"])
def list_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    items = get_store().catalog()
    if category:
        items = [p for p in items if p["category"].lower() == category.lower()]
    if search:
        q = search.lower()
        items = [
            p
            for p in items
            if q in p["product_id"].lower() or q in p["product_name"].lower()
        ]
    return {"count": len(items), "items": items}


@router.get("/products/{product_id}", tags=["catalog"])
def get_product(product_id: str) -> dict:
    try:
        h = get_store().get_product(product_id)
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")
    meta = h.meta.as_dict()
    meta["history_days"] = len(h.units)
    meta["last_units_sold"] = round(h.units[-1], 2) if h.units else 0
    meta["avg_daily_sales_30"] = round(sum(h.units[-30:]) / max(1, len(h.units[-30:])), 2)
    return meta


@router.get("/products/{product_id}/history", tags=["catalog"])
def product_history(product_id: str, days: int = Query(default=60, ge=1, le=500)) -> dict:
    try:
        return {"product_id": product_id, "days": days, "items": get_store().history(product_id, days)}
    except ProductNotFoundError:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")


@router.get("/categories", tags=["catalog"])
def categories() -> dict:
    return {"items": get_store().categories}


@router.get("/stats/overview", tags=["analytics"])
def overview() -> dict:
    return get_store().stats()


# -------------------------------------------------------------------- predict
def _fill_features(req: PredictRequest) -> dict:
    store = get_store()
    if req.product_id and req.product_id in store.products:
        h = store.get_product(req.product_id)
        target = store.last_date + timedelta(days=1)
        hist = h.units
        base = {
            "day_of_week": target.weekday(),
            "month": target.month,
            "is_weekend": 1 if target.weekday() >= 5 else 0,
            "is_holiday": 0,
            "lag_7": hist[-7] if len(hist) >= 7 else (hist[-1] if hist else 0),
            "lag_14": hist[-14] if len(hist) >= 14 else (hist[-1] if hist else 0),
            "rolling_mean_7": sum(hist[-7:]) / max(1, len(hist[-7:])) if hist else 0,
            "rolling_mean_30": sum(hist[-30:]) / max(1, len(hist[-30:])) if hist else 0,
            "price": h.meta.price,
            "promotion_flag": 0,
            "current_stock": h.meta.current_stock,
            "reorder_level": h.meta.reorder_level,
            "lead_time_days": h.meta.lead_time_days,
            "units_sold": hist[-1] if hist else 0,
        }
    else:
        base = {
            "day_of_week": 0,
            "month": 1,
            "is_weekend": 0,
            "is_holiday": 0,
            "lag_7": 0,
            "lag_14": 0,
            "rolling_mean_7": 0,
            "rolling_mean_30": 0,
            "price": 0,
            "promotion_flag": 0,
            "current_stock": 0,
            "reorder_level": 0,
            "lead_time_days": 0,
            "units_sold": 0,
        }

    for key, value in req.model_dump(exclude_none=True).items():
        if key in ("product_id", "horizon_days"):
            continue
        if value is not None:
            base[key] = value
    return base


@router.post("/predict", tags=["predict"])
def predict(req: PredictRequest) -> dict:
    features = _fill_features(req)
    prediction = get_model().predict_one(features)
    return {
        "product_id": req.product_id,
        "horizon_days": req.horizon_days,
        "predicted_demand": round(max(0.0, prediction)),
        "features_used": features,
    }


# ------------------------------------------------------------------- forecast
@router.post("/forecast", tags=["forecast"])
def forecast_product(req: ProductForecastRequest) -> dict:
    store = get_store()
    if req.product_id not in store.products:
        raise HTTPException(status_code=404, detail=f"Product '{req.product_id}' not found")
    overrides = {req.product_id: req.price} if req.price is not None else None
    results = get_engine().forecast(
        horizon_days=req.horizon_days,
        promotion_flag=req.promotion_flag,
        price_overrides=overrides,
        product_ids=[req.product_id],
    )
    return results[0]


@router.post("/forecast/batch", tags=["forecast"])
def forecast_batch(req: BatchForecastRequest) -> dict:
    store = get_store()
    ids = req.product_ids
    if ids is None and req.category:
        ids = [p["product_id"] for p in store.catalog() if p["category"].lower() == req.category.lower()]
    if ids is not None and not ids:
        return {"summary": risk_service.summarise([]), "items": []}

    forecasts = get_engine().forecast(
        horizon_days=req.horizon_days,
        promotion_flag=req.promotion_flag,
        product_ids=ids,
    )
    report = risk_service.build_report(forecasts)
    return {"summary": risk_service.summarise(report), "items": report}


# ----------------------------------------------------------------------- risk
@router.get("/risk", tags=["risk"])
def risk(
    horizon: int = Query(default=7, ge=1, le=30),
    level: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    store = get_store()
    ids = None
    if category:
        ids = [p["product_id"] for p in store.catalog() if p["category"].lower() == category.lower()]
    forecasts = get_engine().forecast(horizon_days=horizon, product_ids=ids)
    report = risk_service.build_report(forecasts)
    if level:
        report = [r for r in report if r["risk_level"].lower() == level.lower()]
    if search:
        q = search.lower()
        report = [
            r for r in report if q in r["product_id"].lower() or q in r["product_name"].lower()
        ]
    return {"summary": risk_service.summarise(report), "items": report}


@router.get("/top-demand", tags=["analytics"])
def top_demand(
    n: int = Query(default=10, ge=1, le=100),
    horizon: int = Query(default=7, ge=1, le=30),
) -> dict:
    forecasts = get_engine().forecast(horizon_days=horizon)
    return {"horizon_days": horizon, "items": forecasts[:n]}
