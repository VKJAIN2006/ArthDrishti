import joblib
import pandas as pd
import os


# Get the directory where this file is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# Load trained model
model = joblib.load(
    os.path.join(BASE_DIR, "xgboost_demand_model.pkl")
)

# Load feature list
features = joblib.load(
    os.path.join(BASE_DIR, "model_features.pkl")
)


def predict_demand(input_data):

    # Convert dictionary to DataFrame
    input_df = pd.DataFrame([input_data])

    # Make sure features are in the correct order
    input_df = input_df[features]

    # Prediction
    prediction = model.predict(input_df)[0]

    return round(float(prediction))


if __name__ == "__main__":

    sample_data = {
        "day_of_week": 2,
        "month": 10,
        "is_weekend": 0,
        "is_holiday": 0,
        "lag_7": 58,
        "lag_14": 61,
        "rolling_mean_7": 60.4,
        "rolling_mean_30": 57.8,
        "price": 250,
        "promotion_flag": 1,
        "current_stock": 500,
        "reorder_level": 200,
        "lead_time_days": 4,
        "units_sold": 65
    }

    prediction = predict_demand(sample_data)

    print("Predicted Next 7 Days Demand:", prediction)