"""描画用の公開カード定義（GUI 接続層の拡張。エンジンの client_api の入口ではない）。

導入済みの kyuura-engine の同梱データ（``importlib.resources`` の ``kyuura_engine/data/kyuura_cards.json``）を読み、
カード画像の描画（kyuura-card-renderer の ``fromEngineCard``）に使う項目だけを、決まった形に写して返す。

- ソースの checkout・``.venv/src`` に依存しない（導入したパッケージの同梱データだけを読む）
- 対戦の状態（山札・サイド・手札の実際の配分・デッキリスト）を読まない。対戦ごとに作らない（どの対戦でも同じ全体の表）
- 対戦で使っているカードだけの表を作らない（対戦の構成が分かってしまうため）
- 表を取得できることは、非公開のカードが何かを知ってよいことを意味しない。どのカードの表面を描くかは、閲覧者の観測にカード ID が
  あるかどうかで画面が決める
- 印刷の値（HP など）の表で、今の HP・ダメージ・進化などの対戦中の状態ではない
- 読んだ結果は有限のキャッシュ（1 件）で持つ。形の合わないカードの記録は表に入れず、件数だけを数える（画面は未知のカードとして扱う）

    python -m kyuura_gui_server.card_definitions   # 表の識別と件数を出す
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from functools import lru_cache
from importlib import resources
from pathlib import Path
from typing import Any

import kyuura_engine

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "contract" / "kyuura-gui-card-definitions-v1.json"
_CONTRACT = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
SCHEMA: str = _CONTRACT["schema"]
SCHEMA_VERSION: int = _CONTRACT["schema_version"]
SOURCE_PACKAGE: str = _CONTRACT["source"]["package"]
SOURCE_RESOURCE: str = _CONTRACT["source"]["resource"]
SOURCE_FORMAT: str = _CONTRACT["source"]["format"]
CATEGORIES = frozenset(_CONTRACT["categories"])
CARD_ID = re.compile(_CONTRACT["card_id_pattern"])
MAX_TEXT = 2000  # 1 つの文の長さの上限（同梱データの最長より十分大きい）
MAX_ITEMS = 16  # ワザ・タイプなどの並びの上限


class CardDataUnavailable(RuntimeError):
    """同梱のカードデータを読めない・形が違う（理由は決まった文）。"""


class _Invalid(ValueError):
    """1 件のカードの記録の形が違う（その記録だけを表から外す）。"""


def valid_card_id(value: object) -> bool:
    return isinstance(value, str) and CARD_ID.fullmatch(value) is not None


def _str(value: Any, *, optional: bool = False) -> str | None:
    if value is None and optional:
        return None
    if not isinstance(value, str) or len(value) > MAX_TEXT:
        raise _Invalid
    return value


def _int(value: Any, *, optional: bool = False) -> int | None:
    if value is None and optional:
        return None
    if type(value) is not int:
        raise _Invalid
    return value


def _list(value: Any) -> list:
    if not isinstance(value, list) or len(value) > MAX_ITEMS:
        raise _Invalid
    return value


def _dict(value: Any) -> dict:
    if not isinstance(value, dict):
        raise _Invalid
    return value


def _text(value: Any, *, optional: bool = True) -> dict[str, str | None] | None:
    if value is None and optional:
        return None
    d = _dict(value)
    return {"ja": _str(d.get("ja"), optional=True), "en": _str(d.get("en"), optional=True)}


def _strings(value: Any) -> list[str]:
    return [_str(v) for v in _list(value)]  # type: ignore[misc]


def _pokemon(p: Any) -> dict[str, Any]:
    p = _dict(p)
    return {
        "stage": _str(p.get("stage"), optional=True),
        "evolves_from": _text(p.get("evolves_from")),
        "hp": _int(p.get("hp"), optional=True),
        "types": _strings(p.get("types")),
        "weaknesses": [{"type": _str(_dict(w).get("type"))} for w in _list(p.get("weaknesses"))],
        "resistances": [{"type": _str(_dict(r).get("type")), "value": _int(_dict(r).get("value"), optional=True)}
                        for r in _list(p.get("resistances"))],
        "retreat_cost": _int(p.get("retreat_cost"), optional=True),
        "rules_text": _text(p.get("rules_text")),
        "powers": [{"kind": _str(_dict(w).get("kind")), "name": _text(w.get("name"), optional=False), "text": _text(w.get("text"))}
                   for w in _list(p.get("powers"))],
        "attacks": [_attack(a) for a in _list(p.get("attacks"))],
    }


def _attack(a: Any) -> dict[str, Any]:
    a = _dict(a)
    damage = a.get("damage")
    return {
        "name": _text(a.get("name"), optional=False),
        "cost": _strings(a.get("cost")),
        "damage": None if damage is None else {"display": _str(_dict(damage).get("display"), optional=True)},
        "text": _text(a.get("text")),
    }


def project(record: Any) -> dict[str, Any]:
    """1 件の記録を、描画に使う項目だけの決まった形にする（形が違えば _Invalid）。"""
    r = _dict(record)
    card_id = r.get("id")
    category = r.get("category")
    if not valid_card_id(card_id) or category not in CATEGORIES:
        raise _Invalid
    out: dict[str, Any] = {
        "id": card_id,
        "jp_set": _str(r.get("jp_set")),
        "category": category,
        "name": _text(r.get("name"), optional=False),
        "pokemon": None,
        "trainer": None,
        "energy": None,
        "jp_print": None,
    }
    if category == "pokemon":
        out["pokemon"] = _pokemon(r.get("pokemon"))
    elif category == "trainer":
        out["trainer"] = {"text": _text(_dict(r.get("trainer")).get("text"))}
    else:
        e = _dict(r.get("energy"))
        out["energy"] = {"kind": _str(e.get("kind")), "provides": _strings(e.get("provides")), "text": _text(e.get("text"))}
    printed = r.get("jp_print")
    if printed is not None:
        printed = _dict(printed)
        out["jp_print"] = {"level": _int(printed.get("level"), optional=True), "rarity": _str(printed.get("rarity"), optional=True)}
    return out


def _read_source() -> bytes:
    try:
        return resources.files(SOURCE_PACKAGE).joinpath(SOURCE_RESOURCE).read_bytes()
    except (OSError, ModuleNotFoundError):
        raise CardDataUnavailable("同梱のカードデータを読めない") from None


def build(raw: bytes) -> dict[str, Any]:
    """同梱データのバイト列から、返す表（schema・出典の識別・カード）を作る。"""
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise CardDataUnavailable("同梱のカードデータが JSON として読めない") from None
    if not isinstance(data, dict) or data.get("format") != SOURCE_FORMAT or not isinstance(data.get("cards"), list):
        raise CardDataUnavailable("同梱のカードデータの形式が想定と違う")
    projected: list[dict[str, Any]] = []
    omitted = 0
    for record in data["cards"]:
        try:
            projected.append(project(record))
        except _Invalid:
            omitted += 1
    counts: dict[str, int] = {}
    for card in projected:
        counts[card["id"]] = counts.get(card["id"], 0) + 1
    # 同じ ID の記録が 2 つ以上あると、どれを描くか決められないので、その ID の記録はすべて外す
    cards = sorted((c for c in projected if counts[c["id"]] == 1), key=lambda c: c["id"])
    omitted += len(projected) - len(cards)
    return {
        "schema": SCHEMA,
        "schema_version": SCHEMA_VERSION,
        "source": {
            "package": SOURCE_PACKAGE,
            "resource": SOURCE_RESOURCE,
            "format": SOURCE_FORMAT,
            "engine_version": kyuura_engine.__version__,
            # 同梱データの内容の識別。バイト列は導入のしかた（改行など）で変わるので、読んだ JSON を正規化した形（キーの順・区切り・
            # UTF-8）の sha256 にする。同じ内容なら導入の環境によらず同じ値
            "sha256": hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest(),
        },
        "card_count": len(cards),
        "omitted": omitted,
        "cards": cards,
    }


@lru_cache(maxsize=1)
def catalog() -> dict[str, Any]:
    """導入済みのエンジンの公開カード定義の表（プロセスの中で 1 回だけ作る）。"""
    return build(_read_source())


@lru_cache(maxsize=1)
def catalog_json() -> bytes:
    """返す封筒の JSON（表と同じく 1 回だけ作る）。"""
    from . import GUI_SERVER_FORMAT  # noqa: PLC0415

    body = {"gui_server": GUI_SERVER_FORMAT, "ok": True, "kind": "card_definitions", **catalog()}
    return json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def main() -> int:
    try:
        table = catalog()
    except CardDataUnavailable as error:
        print(f"カード定義を作れない: {error}", file=sys.stderr)
        return 1
    print(json.dumps({k: table[k] for k in ("schema", "schema_version", "source", "card_count", "omitted")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
