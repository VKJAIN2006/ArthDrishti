"""Dataset loading, cleaning and in-memory store.

The retail dataset is the single source of truth for product metadata and
sales history. It is loaded once at startup and kept in memory.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from app.config import DATA_CSV


class DataNotFoundError(RuntimeError):
    """Raised when the dataset file cannot be located."""


class ProductNotFoundError(KeyError):
    """Raised when a product id does not exist in the dataset."""


@dataclass
class ProductMeta:
    product_id: str
    product_name: str
    category: str
    price: float
    current_stock: float
    reorder_level: float
    lead_time_days: int

    def as_dict(self) -> dict:
        return {
            "product_id": self.product_id,
            "product_name": self.product_name,
            "category": self.category,
            "price": round(self.price, 2),
            "current_stock": round(self.current_stock, 2),
            "reorder_level": round(self.reorder_level, 2),
            "lead_time_days": int(self.lead_time_days),
        }


@dataclass
class ProductHistory:
    meta: ProductMeta
    dates: List[date] = field(default_factory=list)
    units: List[float] = field(default_factory=list)
    weekday_weights: List[float] = field(default_factory=list)


def _weekday_weights(dates: List[date], units: List[float]) -> List[float]:
    """Relative demand weight per weekday (Mon=0 .. Sun=6), normalised to mean 1."""
    buckets: Dict[int, List[float]] = {i: [] for i in range(7)}
    for d, u in zip(dates, units):
        buckets[d.weekday()].append(float(u))
    overall = float(np.mean(units)) if units else 1.0
    weights = []
    for i in range(7):
        vals = buckets[i]
        avg = float(np.mean(vals)) if vals else overall
        weights.append(avg / overall if overall else 1.0)
    # guard against zero / flat weights
    if not any(w > 0 for w in weights):
        weights = [1.0] * 7
    return weights


class DataStore:
    """Cleans the dataset and exposes products + history."""

    def __init__(self, csv_path: Path | str = DATA_CSV):
        self.csv_path = Path(csv_path)
        if not self.csv_path.exists():
            raise DataNotFoundError(
                f"Dataset not found at '{self.csv_path}'. "
                "Place retail_inventory_dataset.csv in the WORKSHOP/data folder."
            )
        self.products: Dict[str, ProductHistory] = {}
        self.categories: List[str] = []
        self.last_date: date = date.today()
        self.first_date: date = date.today()
        self.frame: pd.DataFrame = pd.DataFrame()
        self._load()

    # ------------------------------------------------------------------ load
    def _load(self) -> None:
        df = pd.read_csv(self.csv_path)
        df.columns = [c.strip() for c in df.columns]
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.dropna(subset=["date", "product_id"])

        for col in ["price", "current_stock", "reorder_level", "lead_time_days", "units_sold"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # De-duplicate the same product/day, then order chronologically.
        df = df.drop_duplicates(subset=["product_id", "date"], keep="last")
        df = df.sort_values(["product_id", "date"]).reset_index(drop=True)

        # Fill gaps within each product, then fall back to product medians.
        for col in ["price", "current_stock", "reorder_level"]:
            if col in df.columns:
                df[col] = df.groupby("product_id")[col].transform(lambda s: s.ffill().bfill())
                df[col] = df[col].fillna(df[col].median())

        self.frame = df
        self.first_date = df["date"].min().date()
        self.last_date = df["date"].max().date()
        self.categories = sorted(str(c) for c in df["category"].dropna().unique())

        for pid, group in df.groupby("product_id", sort=True):
            last = group.iloc[-1]
            meta = ProductMeta(
                product_id=str(pid),
                product_name=str(last.get("product_name", pid)),
                category=str(last.get("category", "Uncategorised")),
                price=float(last["price"]),
                current_stock=float(last["current_stock"]),
                reorder_level=float(last["reorder_level"]),
                lead_time_days=int(round(float(last["lead_time_days"]))),
            )
            dates = [d.date() for d in group["date"].tolist()]
            units = [float(u) for u in group["units_sold"].fillna(0).tolist()]
            self.products[str(pid)] = ProductHistory(
                meta=meta,
                dates=dates,
                units=units,
                weekday_weights=_weekday_weights(dates, units),
            )

    # -------------------------------------------------------------- accessors
    def get_product(self, product_id: str) -> ProductHistory:
        if product_id not in self.products:
            raise ProductNotFoundError(product_id)
        return self.products[product_id]

    def catalog(self) -> List[dict]:
        return [h.meta.as_dict() for h in self.products.values()]

    def history(self, product_id: str, days: int = 60) -> List[dict]:
        h = self.get_product(product_id)
        n = max(1, days)
        dates = h.dates[-n:]
        units = h.units[-n:]
        return [{"date": d.isoformat(), "units_sold": round(u, 2)} for d, u in zip(dates, units)]

    def stats(self) -> dict:
        df = self.frame
        total_units = float(df["units_sold"].sum())
        revenue = float((df["units_sold"] * df["price"]).sum())
        by_category = (
            df.groupby("category")["units_sold"].sum().sort_values(ascending=False)
        )
        return {
            "products": len(self.products),
            "categories": len(self.categories),
            "category_list": self.categories,
            "records": int(len(df)),
            "date_from": self.first_date.isoformat(),
            "date_to": self.last_date.isoformat(),
            "total_units_sold": round(total_units),
            "total_revenue": round(revenue, 2),
            "avg_daily_units": round(total_units / max(1, len(df)), 2),
            "units_by_category": [
                {"category": str(k), "units_sold": round(float(v))} for k, v in by_category.items()
            ],
        }


# Singleton – imported by the services and routes.
_store: Optional[DataStore] = None


def get_store() -> DataStore:
    global _store
    if _store is None:
        _store = DataStore()
    return _store
