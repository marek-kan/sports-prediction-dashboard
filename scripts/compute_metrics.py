import datetime
import json
from pathlib import Path
from typing import Any, Callable, Iterable, Optional

from constatnts import LEAGUES, DATA_DIRS, OVER_LINES, HCP_LINES, NAME_PATTERN


def load_json(path: Path) -> dict:
    with path.open("r") as f:
        return json.load(f)
    

def get_dict_from_list(obj: list[dict[str, float]], key_name: str, value: float) -> dict[str, float]:
    return next((item for item in obj if item[key_name] == value), None)
    

def load_predictions(league: str) -> tuple[list[dict[str, Any]], list[Path]]:

    data_dir = DATA_DIRS[league]
    over_line = OVER_LINES[league]
    hcp_line = HCP_LINES[league]

    pred_dir = data_dir / "predictions"

    if not pred_dir.exists():
        pred_dir.mkdir(parents=True)

    json_files = list(pred_dir.glob("*.json"))
    preds = []
    for filepath in json_files:
        pred_dict = load_json(filepath)
        codes = NAME_PATTERN.match(filepath.name)
        _preds = pred_dict.get("preds", {})

        ou_preds: list[dict[str, float]] = _preds.get("ou", {})
        ou_pred = get_dict_from_list(ou_preds, key_name="points", value=over_line).get("prob")

        hcp_preds: list[dict[str, float]] = _preds.get("hcp", {})
        hcp_pred = get_dict_from_list(hcp_preds, key_name="hcp", value=hcp_line).get("prob")

        m_id = pred_dict.get("match_id")

        preds.append({
            "filename": filepath.name,
            "match_id": m_id,
            "start_time_utc": pred_dict.get("start_time_utc"),
            "home_team": pred_dict.get("home_team"),
            "away_team": pred_dict.get("away_team"),
            "home_code": codes.group("home"),
            "away_code": codes.group("away"),
            "ft_home": _preds.get("ft", {}).get("home"),
            "over": [over_line, ou_pred],
            "hcp": [hcp_line, hcp_pred],
            "mu_home": _preds.get("mu", {}).get("home"),
            "mu_away": _preds.get("mu", {}).get("away"),
        })
    return preds, json_files


def load_results(league: str) -> tuple[dict[dict[str, int]], list[Path]]:

    results = {}
    data_dir = DATA_DIRS[league]
    res_dir = data_dir / "results"

    if not res_dir.exists():
        res_dir.mkdir(parents=True)

    json_files = list(res_dir.glob("*.json"))

    for filepath in json_files:
        result_dict = load_json(filepath)
        m_id = result_dict.get("match_id")
        results[m_id] = {"home_score": result_dict.get("home_team"), "away_score": result_dict.get("away_team")}

    return results, json_files


def join_preds_results(preds: list[dict[str, Any]], results: dict[dict[str, int]]) -> list[dict[str, Any]]:
    rows = []
    for p in preds:
        r = results.get(p["match_id"])
        row = dict(p)
        if r:
            row.update(r)
        rows.append(row)
    return rows


def accuracy_from_data(
    data: Iterable[dict[str, Any]],
    label_fn: Callable[[dict[str, Any]], int],
    prob_fn: Callable[[dict[str, Any]], float],
    baseline_fn: Optional[Callable[[dict[str, Any]], bool]] = None
) -> tuple[float, Optional[float]]:
    hits = 0
    hits_base = 0
    n = 0

    for r in data:
        y = 1 if label_fn(r) else 0
        p = float(prob_fn(r))
        pred = p >= 0.5

        hits += (pred == bool(y))
        if baseline_fn is not None:
            hits_base += (baseline_fn(r) == bool(y))
        n += 1

    if n == 0:
        return "null", ("null" if baseline_fn is not None else None)

    acc = hits / n
    acc_base = (hits_base / n) if baseline_fn is not None else None
    return acc, acc_base

def calculate_ft_accuracy(league: str, data: Iterable[dict[str, Any]]) -> tuple[float, float]:
    return accuracy_from_data(
        data,
        label_fn=lambda r: (r["home_score"] > r["away_score"]),
        prob_fn=lambda r: r["ft_home"],
        baseline_fn=lambda r: True  # "always pick Home"
    )

def calculate_ou_accuracy(league: str, data: Iterable[dict[str, Any]]) -> float:
    return accuracy_from_data(
        data,
        label_fn=lambda r: (r["home_score"] + r["away_score"] > float(r["over"][0])),  # treat push as Under
        prob_fn=lambda r: r["over"][1],
        baseline_fn=lambda r: True
    )

def calculate_hcp_accuracy(league: str, data: Iterable[dict[str, Any]]) -> float:
    return accuracy_from_data(
        data,
        label_fn=lambda r: ((r["home_score"] - r["away_score"]) + float(r["hcp"][0]) > 0),
        prob_fn=lambda r: r["hcp"][1],
        baseline_fn=lambda r: False if league == "nhl" else True
    )


def calculate_metrics(league: str, data: list[dict[str, Any]]) -> dict:
    # have result
    comp = [r for r in data if r.get("home_score") is not None and r.get("away_score") is not None]
    ft_acc, ft_baseline = calculate_ft_accuracy(data=comp, league=league)
    ou_acc, ou_baseline = calculate_ou_accuracy(data=comp, league=league)
    hcp_acc, hcp_baseline = calculate_hcp_accuracy(data=comp, league=league)

    metrics = {
        "updated_at": datetime.datetime.now(tz=datetime.UTC).isoformat(timespec="seconds")+"Z",
        "n": len(comp),
        "ft_accuracy": ft_acc,
        "ft_accuracy_baseline": ft_baseline,
        "over_accuracy": ou_acc,
        "over_accuracy_baseline": ou_baseline,
        "hcp_accuracy": hcp_acc,
        "hcp_accuracy_baseline": hcp_baseline,
    }
    return metrics


def save_json(obj: dict | list, path: Path, indent: int = 2, **kwargs) -> None:
    with path.open("w") as f:
        json.dump(obj, f, indent=indent, **kwargs)


def main() -> None:
    for league in LEAGUES:
        print(f"{league=}")
        data_dir = DATA_DIRS[league]

        if not data_dir.exists():
            data_dir.mkdir(parents=True)

        predictions, pred_files = load_predictions(league=league)
        
        results, res_files = load_results(league=league)

        joined = join_preds_results(preds=predictions, results=results)
        results_list = [r for r in joined if r.get("home_score", None) is not None]
        output_predictions = [r for r in predictions if r["match_id"] not in results.keys()]

        metrics = calculate_metrics(league=league, data=joined)

        manifest = {
            "predictions_files": sorted([filepath.name for filepath in pred_files]),
            "results_files": sorted([filepath.name for filepath in res_files]),
            "generated_at": metrics["updated_at"]
        }

        save_json(
            obj=sorted(output_predictions, key=lambda _data: _data["start_time_utc"]),
            path=data_dir / "predictions_flat.json"
        )
        save_json(obj=results_list, path=data_dir / "results_flat.json")
        save_json(obj=metrics, path=data_dir / "metrics.json")
        save_json(obj=manifest, path=data_dir / "manifest.json")
    return


if __name__ == "__main__":
    main()

