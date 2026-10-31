"""Business-layer stock risk logic.

This sits *on top of* the ML forecast. It never trains anything — it simply
turns predicted demand into an explainable decision for the store manager.
"""
from __future__ import annotations

from typing import List

from app.config import MEDIUM_RISK_FACTOR, REORDER_COVER_DAYS, SLOW_MOVING_DAYS

RISK_ORDER = {"High": 0, "Medium": 1, "Overstocked": 2, "Safe": 3}


def classify(
    avg_daily_demand: float,
    current_stock: float,
    reorder_level: float,
    lead_time_days: float,
) -> dict:
    """Return risk level, days of stock left and suggested reorder quantity."""
    lead = max(1.0, float(lead_time_days))
    if avg_daily_demand <= 0:
        days_left = float("inf")
    else:
        days_left = current_stock / avg_daily_demand

    if avg_daily_demand <= 0:
        level = "Overstocked" if current_stock > 0 else "Safe"
    elif days_left < lead:
        level = "High"
    elif days_left < MEDIUM_RISK_FACTOR * lead or current_stock <= reorder_level:
        level = "Medium"
    elif days_left > SLOW_MOVING_DAYS:
        level = "Overstocked"
    else:
        level = "Safe"

    if level in ("High", "Medium"):
        reorder_qty = max(
            0, int(round(avg_daily_demand * (lead + REORDER_COVER_DAYS) - current_stock))
        )
    else:
        reorder_qty = 0

    actions = {
        "High": f"Reorder immediately — about {reorder_qty} units needed before stock-out.",
        "Medium": f"Reorder soon — plan a purchase of roughly {reorder_qty} units.",
        "Overstocked": "Slow-moving — pause reordering and consider a discount or bundle.",
        "Safe": "Stock levels healthy — no action needed.",
    }

    return {
        "risk_level": level,
        "days_of_stock_left": None if days_left == float("inf") else round(days_left, 1),
        "reorder_qty": reorder_qty,
        "action": actions[level],
    }


def build_report(forecasts: List[dict]) -> List[dict]:
    """Enrich each forecast with risk fields and sort by severity."""
    report = []
    for f in forecasts:
        risk = classify(
            avg_daily_demand=f["avg_daily_demand"],
            current_stock=f["current_stock"],
            reorder_level=f["reorder_level"],
            lead_time_days=f["lead_time_days"],
        )
        report.append({**f, **risk})
    report.sort(key=lambda r: (RISK_ORDER.get(r["risk_level"], 9), -r["total_demand"]))
    return report


def summarise(report: List[dict]) -> dict:
    counts = {"High": 0, "Medium": 0, "Overstocked": 0, "Safe": 0}
    for r in report:
        counts[r["risk_level"]] = counts.get(r["risk_level"], 0) + 1
    return {
        "total_products": len(report),
        "high": counts["High"],
        "medium": counts["Medium"],
        "overstocked": counts["Overstocked"],
        "safe": counts["Safe"],
        "total_forecast_demand": round(sum(r["total_demand"] for r in report), 1),
        "total_reorder_units": int(sum(r["reorder_qty"] for r in report)),
    }
