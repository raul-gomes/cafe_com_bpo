"""The Alembic chain has to be a valid graph — and it was not.

Bug of 2026-10-02: the `companies.negotiated_at` migration was born with revision
id `b1c2d3e4f5a6`, **which already existed** on another branch
(`add_number_fields_to_contracts`). With the id repeated, Alembic warns "Revision
... is present more than once", the merge's `down_revision` resolves to the wrong
file, and the new migration **drops out of the chain**: the database stays on the
old head, the column never appears, and every endpoint reading `companies` answers
500 (`column companies.negotiated_at does not exist`).

The default suite missed it because module tests run on SQLite with the tables
built from the models — the migration chain is only exercised by `integration` /
`migration-ci`. A repeated id is an Alembic configuration mistake, not production
code, so the test pins the configuration, as AGENTS.md requires for CI and config
fixes.
"""

import re
from collections import Counter
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"

# Alembic accepts both the annotated form (`revision: str = "x"`) and the plain
# one (`revision = "x"`), and `down_revision` has three annotation shapes in this
# repository. The tests parse both, or they would skip half the chain.
ASSIGNMENT_RE = r"(?::[^=]+)?\s*=\s*"
REVISION_RE = re.compile(r"^revision" + ASSIGNMENT_RE + r'"([^"]+)"', re.MULTILINE)
DOWN_REVISION_RE = re.compile(
    # A merge tuple spans several lines, so the value is captured across them
    # instead of line by line: reading only the first line reports the merge
    # parents as unreferenced and invents extra heads.
    r"^down_revision" + ASSIGNMENT_RE + r'(\(.*?\)|"[^"]+"|None)',
    re.MULTILINE | re.DOTALL,
)


def _parse(path: Path) -> tuple[str, tuple[str, ...]]:
    """Reads `revision` and `down_revision` from one migration file.

    Args:
        path: Migration file to read.

    Returns:
        The revision id and its parents. `down_revision` is either one id or a
        tuple (a merge of branches), and the tuple is what defines the graph.
    """
    source = path.read_text(encoding="utf-8")
    revision = REVISION_RE.search(source)
    assert revision, f"{path.name} declares no revision"
    down = DOWN_REVISION_RE.search(source)
    assert down, f"{path.name} declares no down_revision"
    bruto = down.group(1).strip().rstrip(",")
    if bruto.startswith("("):
        return revision.group(1), tuple(re.findall(r'"([^"]+)"', bruto))
    alvo = re.search(r'"([^"]+)"', bruto)
    return revision.group(1), (alvo.group(1),) if alvo else ()


def _graph() -> dict[str, tuple[Path, tuple[str, ...]]]:
    """Maps every revision id to its file and its parents."""
    grafo: dict[str, tuple[Path, tuple[str, ...]]] = {}
    for path in sorted(VERSIONS_DIR.glob("*.py")):
        revision, parents = _parse(path)
        grafo[revision] = (path, parents)
    return grafo


def test_revision_ids_are_unique():
    """No repeated revision id — that is what makes the chain ambiguous."""
    revisoes = []
    for path in VERSIONS_DIR.glob("*.py"):
        achado = REVISION_RE.search(path.read_text(encoding="utf-8"))
        assert achado, f"{path.name} declares no revision"
        revisoes.append(achado.group(1))
    repetidas = [rev for rev, total in Counter(revisoes).items() if total > 1]

    assert not repetidas, (
        f"revision id repeated in {repetidas}: Alembic resolves the down_revision "
        "to the wrong file and the migration leaves the chain. Rename the file and "
        "the `revision` inside it."
    )


def test_every_down_revision_exists():
    """No dangling parent — `alembic upgrade` would stop in the middle."""
    grafo = _graph()
    orfaos = [
        f"{path.name} (revision {revision}) points to {parent}"
        for revision, (path, parents) in grafo.items()
        for parent in parents
        if parent not in grafo
    ]

    assert not orfaos, "down_revision that does not exist: " + "; ".join(orfaos)


def test_the_chain_has_a_single_head():
    """One tip only: two heads make `alembic upgrade head` ambiguous."""
    grafo = _graph()
    pais = {parent for _, parents in grafo.values() for parent in parents}
    heads = sorted(set(grafo) - pais)

    assert len(heads) == 1, f"the chain has {len(heads)} heads: {heads}"
