import json
from jsonschema import Draft7Validator
import sys
from pathlib import Path

from constatnts import DATA_DIRS, SCHEMAS, NAME_PATTERN, LEAGUES

def load_json(path: Path) -> dict:
    with path.open("r") as f:
        return json.load(f)
    
def validate_file(schema: dict, path: Path) -> tuple[dict, list[str]]:
    try:
        obj = load_json(path)
    except Exception as e:
        return dict(), [f"{path}: invalid JSON ({e})"]

    v = Draft7Validator(schema)
    errs = sorted(v.iter_errors(obj), key=lambda e: e.path)

    return obj, [f"{path}: " + e.message for e in errs]

def validate_dir(schema: dict, path: Path, check_other: list[str] | None = None) -> tuple[list[str], list[str]]:
    errors = []
    seen_match_ids = []

    files = list(path.glob("*.json"))

    for filepath in files:

        if not NAME_PATTERN.match(filepath.name):
            errors.append(f"{filepath=} does not match the name pattern")

        data, schema_errors = validate_file(schema=schema, path=filepath)
        errors += schema_errors

        match_id = data.get("match_id")
        
        if not match_id:
            errors.append(f"{filepath=}, missing match_id")
        else:
            if match_id in seen_match_ids:
                errors.append(f"{match_id=} in {filepath=}, is duplicated")
            
            seen_match_ids.append(match_id)

        if check_other:
            if match_id not in check_other:
                errors.append(f"{match_id=} not found in `check_other`")

    return errors, seen_match_ids
        

def main():
    errors = []

    for league in LEAGUES:
        pred_dir = DATA_DIRS[league] / "predictions"
        result_dir = DATA_DIRS[league] / "results"

        pred_schema = load_json(SCHEMAS / "prediction.schema.json")
        result_schema = load_json(SCHEMAS / "result.schema.json")

        pred_errors, pred_match_ids = validate_dir(schema=pred_schema, path=pred_dir)
        res_errors, _ = validate_dir(schema=result_schema, path=result_dir, check_other=pred_match_ids)

        errors += pred_errors + res_errors

    if errors:
        print("❌ Validation failed:")
        print("\n".join(errors))
        sys.exit(1)
    else:
        print("✅ All prediction/result files validated successfully.")
    
    return

if __name__ == "__main__":
    main()