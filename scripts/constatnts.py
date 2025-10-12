from pathlib import Path
import re

ROOT = Path(__file__).parents[1].absolute()
DOCS = ROOT / "docs"
SCHEMAS = ROOT / "schemas"
LEAGUES = ["nba", "nhl"]
DATA_DIRS = {
    k: DOCS / "data" / k for k in LEAGUES
}
OVER_LINES = {
    "nba": 225.5,
    "nhl": 6.5
}
HCP_LINES = {
    "nba": -5.5,
    "nhl": -1.5
}

NAME_PATTERN = re.compile(r'^(?P<date>\d{4}-\d{2}-\d{2})_(?P<home>[A-Z]{2,4})_(?P<away>[A-Z]{2,4})\.json$')
