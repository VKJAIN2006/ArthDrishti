"""ArthDrishti ML service — FastAPI entry point.

Run with:  uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import CORS_ORIGINS
from app.services.data_service import DataNotFoundError, get_store
from app.services.model_service import ModelNotLoadedError, get_model

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ml-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading dataset and model ...")
    store = get_store()
    model = get_model()
    logger.info("Ready: %d products, model features=%s", len(store.products), model.features)
    yield
    logger.info("Shutting down ML service")


app = FastAPI(
    title="ArthDrishti ML Service",
    description="Demand forecasting and stock-risk predictions for the inventory system.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DataNotFoundError)
async def data_not_found_handler(request: Request, exc: DataNotFoundError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.exception_handler(ModelNotLoadedError)
async def model_error_handler(request: Request, exc: ModelNotLoadedError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


app.include_router(router)


@app.get("/", tags=["system"])
def root() -> dict:
    return {
        "service": "ArthDrishti ML Service",
        "docs": "/docs",
        "endpoints": [
            "/health",
            "/products",
            "/products/{product_id}",
            "/products/{product_id}/history",
            "/categories",
            "/stats/overview",
            "/predict",
            "/forecast",
            "/forecast/batch",
            "/risk",
            "/top-demand",
        ],
    }
