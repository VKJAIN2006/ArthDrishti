import pandas as pd


def create_lag_features(df):

    df = df.copy()

    # Make sure data is sorted
    df = df.sort_values(
        ["product_id", "date"]
    )

    g = df.groupby("product_id")["units_sold"]

    df["lag_7"] = g.shift(7)

    df["lag_14"] = g.shift(14)

    df["rolling_mean_7"] = (
        g.transform(
            lambda s: s.shift(1).rolling(7).mean()
        )
    )

    df["rolling_mean_30"] = (
        g.transform(
            lambda s: s.shift(1).rolling(30).mean()
        )
    )

    return df