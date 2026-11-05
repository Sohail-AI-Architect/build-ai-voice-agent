"""Repo-root entrypoint for the FastAPI app.

The application itself lives in ``backend/main.py`` and its modules import each
other by flat names (``config``, ``routes``, ``services``, ``my_agents``,
``my_config``). Adding ``backend/`` to ``sys.path`` keeps those imports working
so the server can be started from the project root:

    uvicorn main:app --reload

``cd backend && uvicorn main:app --reload`` keeps working as well.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.main import app  # noqa: E402

__all__ = ["app"]
