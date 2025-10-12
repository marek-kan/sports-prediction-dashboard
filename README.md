# Sports Betting Dashboard — NHL & NBA

> **Disclaimer:** This project is for *informational and educational purposes only*.  
> It is **not** investment or betting advice.

## Overview

This repository powers a public-facing **day-ahead prediction dashboard** for **NHL** and **NBA** markets — including:
- Moneyline
- Totals (Over/Under)
- Asian handicaps

## Motivation

This project started as a curiosity: can a well-engineered machine learning system match or outperform market closing lines using only on-court performance data?  
It’s primarily a learning and research playground focused on time-series modeling, feature engineering, and execution strategy optimization, wrapped in a transparent, versioned prediction system that anyone can evaluate over time.

## Technical Stack

- **Backend / Modeling:** Python (pandas/polars, scikit-learn, tensorflow, kedro, dash)
- **Data Storage:** PostgreSQL / parquet artifacts
- **CI/CD:** GitHub Actions, ArgoCD, kubernetes
- **Frontend:** 
  - (on-prem) Dashboard with up-to-date predictions (dash)
  - (public) Static GitHub Pages (HTML + JS)

Majority of the solution is hidden in private repositories at this time. If the models are not good enough to beat the markets continuessly I will release all data pipelines along with model repository.

## Release cadence

- Predictions updated daily (day-ahead)
- Results added the following day


## Data conventions

One JSON object per prediction/result (filename: `{YYYY-MM-DD}_{HOME}_{AWAY}.json`), e.g. `2024-10-30_UTA_LAL.json`

**Predictions** : `docs/data/{league}/predictions`, under the key "preds" are probability predictions for various events.
```json
{
  "match_id": "123",
  "start_time_utc": "2024-10-30T23:30:00Z",
  "home_team": "Utah Jazz",
  "away_team": "Los Angeles Lakers",
  "preds": {
    "rt": {"home": 0.5231, "draw": 0.0268, "away": 0.4502},
    "ft": {"home": 0.5375, "away": 0.4625},
    "mu": {"home": 110.8277, "away": 109.4692},
    "std": {"home": 10.9922, "away": 15.3127},
    "hcp": [{"hcp": -0.5, "prob": 0.5231}, {"hcp": 0.5, "prob": 0.5498}],
    "ou": [{"points": 220.5, "prob": 0.4962}, {"points": 221.5, "prob": 0.4774}]
  }
}
```

**Results**: `docs/data/{league}/results`, contains only match id and final scoreline.
```json
{
  "match_id": "123",
  "home_team": 2, 
  "away_team": 1
}
```
