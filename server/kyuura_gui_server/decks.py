"""デッキの指定（エンジンの公開の方法: ``preset_deck``・``expand_decklist``・``deck_problems``）とカード名の表。

- デッキは「カード ID と枚数」の並び。並べ方はエンジンの ``expand_decklist`` に任せる
- 検査はエンジンの ``deck_problems``（GUI で規則を再実装しない）。問題の文はエンジンが作る定型の文で、入力した本人の
  デッキのことだけを書く（相手の観測には入れない。作成の応答だけで返す）
- カード名の表は、同梱のカードデータ（公開の静的なデータ）から表示に要る最小の項目だけ
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from kyuura_engine import deck_problems, expand_decklist, load_card_pool, preset_deck, preset_deck_ids

MAX_ENTRIES = 80  # 1 つのデッキの行の上限（60 枚のデッキなら十分）
MAX_COUNT = 60
MAX_ID_LENGTH = 32


class DeckInputError(ValueError):
    """デッキの入力の形が正しくない（エンジンの検査の前）。"""


@lru_cache(maxsize=1)
def _pool():
    return load_card_pool()


@lru_cache(maxsize=1)
def card_catalog() -> list[dict[str, Any]]:
    """対戦に使えるカードの表示用の最小の表（ID・日本語名・分類・段階・HP）。"""
    pool = _pool()
    out = []
    for card_id, d in pool.definitions.items():
        if not pool.is_playable(card_id):
            continue
        out.append({"id": card_id, "name_ja": d.name_ja, "category": d.category, "stage": d.stage, "hp": d.hp})
    out.sort(key=lambda c: c["id"])
    return out


def presets() -> list[dict[str, Any]]:
    """エンジンの固定デッキ（公開の ``preset_deck``）。動作確認用のサンプル。"""
    pool = _pool()
    out = []
    for deck_id in preset_deck_ids():
        deck = preset_deck(deck_id)
        out.append({"id": deck_id, "name_ja": deck.name_ja,
                    "entries": [{"card_id": card_id, "count": count, "name_ja": pool.definitions[card_id].name_ja if card_id in pool.definitions else None}
                                for card_id, count in deck.entries]})
    return out


def parse_entries(raw: Any) -> list[str]:
    """``[{"card_id": str, "count": int}, ...]`` をカード ID の並びにする（形の確かめだけ。中身の検査はエンジン）。"""
    if not isinstance(raw, list) or not raw or len(raw) > MAX_ENTRIES:
        raise DeckInputError("デッキの行がない、または多すぎる")
    counts: dict[str, int] = {}
    for item in raw:
        if not isinstance(item, dict) or set(item) - {"card_id", "count"}:
            raise DeckInputError("デッキの行の形が正しくない")
        card_id, count = item.get("card_id"), item.get("count")
        if type(card_id) is not str or not card_id or len(card_id) > MAX_ID_LENGTH:
            raise DeckInputError("カード ID が正しくない")
        if type(count) is not int or not 1 <= count <= MAX_COUNT:
            raise DeckInputError("枚数が正しくない（1〜60）")
        counts[card_id] = counts.get(card_id, 0) + count
    return expand_decklist(counts)


def problems(cards: list[str]) -> list[dict[str, str]]:
    """エンジンの ``deck_problems`` の結果を、コードと文に分ける（文はエンジンの定型の文のまま）。"""
    out = []
    for text in deck_problems(cards, _pool()):
        code, sep, message = text.partition(": ")
        out.append({"code": code if sep else "DECK_PROBLEM", "message": message if sep else text})
    return out
