# ArthDrishti — ML Service

FastAPI microservice that owns the trained XGBoost demand model and the
stock-risk business logic. The Node backend calls this service; the frontend
never talks to it directly.

## Layout

```
ml-service/
├── app/
│   ├── main.py                 # FastAPI app + CORS + error handlers
│   ├── config.py               # paths and business constants
│   ├── schemas.py              # request models
│   ├── api/routes.py           # all endpoints
│   └── services/
│       ├── data_service.py     # dataset loading / cleaning / catalog
│       ├── model_service.py    # loads xgboost_demand_model.pkl
│       ├── forecast_service.py # 7-day window rolling forecast
│       └── risk_service.py     # stock-out / slow-moving rules
├── model/
│   ├── xgboost_demand_model.pkl
│   └── model_features.pkl
├── training/                   # original notebook + scripts (reference)
└── requirements.txt
```

The dataset lives at `../data/retail_inventory_dataset.csv`.

## Run

```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for interactive Swagger docs.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Service + model status |
| GET | `/stats/overview` | Dataset KPIs for the home page |
| GET | `/products` | Product catalog (`category`, `search` filters) |
| GET | `/products/{id}` | One product + latest sales |
| GET | `/products/{id}/history?days=60` | Recent daily sales |
| GET | `/categories` | Category list |
| POST | `/predict` | Raw next-7-day demand prediction |
| POST | `/forecast` | Single-product forecast (daily + weekly) |
| POST | `/forecast/batch` | Forecast + risk for many/all products |
| GET | `/risk` | Risk report (`horizon`, `level`, `category`, `search`) |
| GET | `/top-demand?n=10&horizon=7` | Highest forecast demand |

## How forecasting works

The model predicts a **7-day demand total** from the current day's features.
For longer horizons the engine rolls the history forward one week at a time,
feeding each predicted week back in so that `lag_*` and `rolling_*` features
stay consistent. Longer horizons are therefore less certain — the 7-day view is
the most reliable.

## Risk rules (business layer)

```
days_of_stock_left = current_stock / avg_daily_forecast_demand
High         : days_of_stock_left < lead_time_days
Medium       : days_of_stock_left < 1.5 * lead_time OR stock <= reorder_level
Overstocked  : days_of_stock_left > 45
Safe         : otherwise
reorder_qty  = avg_daily * (lead_time + 14) - current_stock   (High/Medium only)
```
