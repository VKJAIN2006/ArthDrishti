# ArthDrishti — AI Inventory Demand & Stock Risk Prediction System

An end-to-end retail analytics project. It forecasts product demand using an XGBoost model, computes stock-out/slow-moving risk, exposes it via APIs, and renders it through a clean multi-page dashboard.

## Project structure

```
MACHINE LEARNING/
└── WORKSHOP/
    ├── backend/        Node/Express + Mongoose (REST API, auth, DB)
    ├── ml-service/     Python FastAPI (loads trained model, forecasting + risk)
    ├── frontend/       Multi-page static site (HTML/CSS/JS, Chart.js)
    ├── data/           retail_inventory_dataset.csv (100 products × ~500 days)
    └── README.md       (this file)
```

The original Node skeleton was archived conceptually by restructuring; all working code lives under WORKSHOP.

## Quick start

### 1) Start ML microservice (port 8000)
```bash
cd WORKSHOP/ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Swagger UI: http://localhost:8000/docs

### 2) Start backend API (port 3000)
```bash
cd WORKSHOP/backend
npm install  # only if node_modules missing; it's included here
npm run seed  # seeds MongoDB from ../data/retail_inventory_dataset.csv
npm start
```
API health: http://localhost:3000/api/health

### 3) Open frontend
Open http://localhost:3000/index.html in your browser (served by the backend) or open frontend/*.html directly. Since the frontend uses relative `/api` calls, opening via `localhost:3000` is recommended.

## Demo credentials
- `admin@arthdrishti.com` / `Admin@123`
- `manager@arthdrishti.com` / `Manager@123`

## Key features
- **Demand forecasting**: 7/14/30-day forecast per product; rolling/lags to avoid leakage.
- **Stock risk logic**: High/Medium/Overstocked/Safe with days-left, reorder quantity, action.
- **Manager dashboard**: filters (horizon/category/risk/search), summary cards, risk-by-category, top-10 demand, full risk table, CSV export.
- **Product drill-down**: daily forecast, 60-day history, weekday/weekly breakdown, risk card.
- **End-to-end UX**: mobile menu, favicon, meta tags, custom 404, clickable logo/email/phone, dynamic copyright year, no horizontal scroll, toasts (success/error), CSV downloads.
- **Auth + persistence**: MongoDB for users, products, sales, forecast snapshots, contact messages. DB falls back gracefully if unavailable.

## ML artifacts
- `ml-service/model/xgboost_demand_model.pkl`
- `ml-service/model/model_features.pkl`
- Features: day_of_week, month, is_weekend, is_holiday, lag_7, lag_14, rolling_mean_7, rolling_mean_30, price, promotion_flag, current_stock, reorder_level, lead_time_days, units_sold

## Notes
- The 30-day forecast rolls forward week-by-week (each week feeds lags/rolling means). It's less certain than 7-day.
- Saving a snapshot (`Save snapshot` on dashboard) stores forecasts and risk in MongoDB and requires auth.
- Contact form submits to `/api/contact` and saves to MongoDB if connected.
- The system is mobile-optimised; large tables scroll horizontally with `.table-wrap`.

## Running both servers together
Two terminals:
1. `cd WORKSHOP/ml-service && uvicorn app.main:app --port 8000 --reload`
2. `cd WORKSHOP/backend && npm start`

Open http://localhost:3000.

## File organisation (high level)
- `ml-service/app/` – FastAPI app (routes, services: data/model/forecast/risk)
- `backend/src/` – Express app (config, utils, models, controllers, routes, middleware, seed)
- `frontend/` – static HTML/CSS/JS + assets

## Troubleshooting
- If ML service is down: backend returns 503 on ML-dependent endpoints; UI shows a friendly toast.
- If MongoDB is down: backend starts in degraded mode; DB-only features return 503.
- CORS: configured for localhost:3000/5500/5173.
- Windows paths: everything resolves relative to WORKSHOP; no absolute hardcoded paths in runtime code.
