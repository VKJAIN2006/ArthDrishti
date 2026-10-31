"""Forecasting engine.

The trained model predicts the **next 7-day demand** for a product from the
current day's features. To forecast longer horizons we roll the history forward
one 7-day window at a time, feeding each window's prediction back as new
history so that lag / rolling features stay consistent.
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Dict, List, Optional

import numpy as np

from app.services.data_service import DataStore
from app.services.model_service import DemandModel, get_model
from app.services.data_service import get_store


class ForecastEngine:
    def __init__(self, store: DataStore, model: DemandModel):
        self.store = store
        self.model = model

    # ------------------------------------------------------------------ utils
    @staticmethod
    def _mean(seq: List[float], window: int) -> float:
        tail = seq[-window:] if len(seq) >= window else seq
        return float(np.mean(tail)) if tail else 0.0

    @staticmethod
    def _lag(seq: List[float], k: int) -> float:
        if len(seq) >= k:
            return float(seq[-k])
        return float(np.mean(seq)) if seq else 0.0

    def _features(
        self,
        hist: List[float],
        target_date: date,
        meta,
        promotion_flag: int,
        price_override: Optional[float],
    ) -> Dict[str, float]:
        return {
            "day_of_week": target_date.weekday(),
            "month": target_date.month,
            "is_weekend": 1 if target_date.weekday() >= 5 else 0,
            "is_holiday": 0,
            "lag_7": self._lag(hist, 7),
            "lag_14": self._lag(hist, 14),
            "rolling_mean_7": self._mean(hist, 7),
            "rolling_mean_30": self._mean(hist, 30),
            "price": float(price_override if price_override is not None else meta.price),
            "promotion_flag": int(promotion_flag),
            "current_stock": float(meta.current_stock),
            "reorder_level": float(meta.reorder_level),
            "lead_time_days": int(meta.lead_time_days),
            "units_sold": float(hist[-1]) if hist else 0.0,
        }

    # -------------------------------------------------------------- forecasting
    def forecast(
        self,
        horizon_days: int = 7,
        promotion_flag: int = 0,
        price_overrides: Optional[Dict[str, float]] = None,
        product_ids: Optional[List[str]] = None,
    ) -> List[dict]:
        horizon = max(1, min(int(horizon_days), 30))
        num_windows = math.ceil(horizon / 7)
        price_overrides = price_overrides or {}

        ids = product_ids or list(self.store.products.keys())
        ids = [pid for pid in ids if pid in self.store.products]

        # per-product working state
        state = {}
        for pid in ids:
            h = self.store.products[pid]
            state[pid] = {
                "hist": list(h.units),
                "cursor": self.store.last_date,  # last known date
                "meta": h.meta,
                "weights": h.weekday_weights,
                "daily": [],
            }

        for w in range(num_windows):
            rows: List[Dict] = []
            row_ids: List[str] = []
            for pid in ids:
                s = state[pid]
                target = s["cursor"] + timedelta(days=1)
                rows.append(
                    self._features(
                        s["hist"],
                        target,
                        s["meta"],
                        promotion_flag,
                        price_overrides.get(pid),
                    )
                )
                row_ids.append(pid)

            preds = self.model.predict_frame(rows)

            for pid, pred in zip(row_ids, preds):
                s = state[pid]
                total_w = max(0.0, float(pred))
                start = s["cursor"] + timedelta(days=1)
                win_dates = [start + timedelta(days=i) for i in range(7)]
                raw_weights = [s["weights"][d.weekday()] for d in win_dates]
                wsum = sum(raw_weights) or 7.0
                day_units = [total_w * (wi / wsum) for wi in raw_weights]

                for d, u in zip(win_dates, day_units):
                    s["daily"].append({"date": d.isoformat(), "units": round(u, 1)})
                s["hist"].extend(day_units)
                s["cursor"] = win_dates[-1]

        results: List[dict] = []
        for pid in ids:
            s = state[pid]
            daily = s["daily"][:horizon]
            total = round(sum(d["units"] for d in daily), 1)
            avg_daily = round(total / horizon, 2)
            weekly = self._weekly(daily)
            meta = s["meta"]
            results.append(
                {
                    "product_id": pid,
                    "product_name": meta.product_name,
                    "category": meta.category,
                    "price": round(meta.price, 2),
                    "current_stock": round(meta.current_stock, 2),
                    "reorder_level": round(meta.reorder_level, 2),
                    "lead_time_days": int(meta.lead_time_days),
                    "horizon_days": horizon,
                    "total_demand": total,
                    "avg_daily_demand": avg_daily,
                    "daily": daily,
                    "weekly": weekly,
                }
            )
        results.sort(key=lambda r: r["total_demand"], reverse=True)
        return results

    @staticmethod
    def _weekly(daily: List[dict]) -> List[dict]:
        weeks: List[dict] = []
        for i in range(0, len(daily), 7):
            chunk = daily[i : i + 7]
            weeks.append(
                {
                    "week_start": chunk[0]["date"],
                    "week_end": chunk[-1]["date"],
                    "units": round(sum(c["units"] for c in chunk), 1),
                }
            )
        return weeks


_engine: "ForecastEngine | None" = None


def get_engine() -> ForecastEngine:
    global _engine
    if _engine is None:
        _engine = ForecastEngine(get_store(), get_model())
    return _engine
