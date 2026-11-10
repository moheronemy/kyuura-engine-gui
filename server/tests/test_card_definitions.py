"""描画用の公開カード定義（GUI 接続層の拡張の口 GET /api/card-definitions）。実際の固定版のエンジンの同梱データを読む。"""

from __future__ import annotations

import json
from importlib import resources
from pathlib import Path

import pytest

from kyuura_gui_server import card_definitions as cd
from kyuura_gui_server.safety import forbidden_paths

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = json.loads((ROOT / "contract" / "kyuura-gui-card-definitions-v2.json").read_text(encoding="utf-8"))
RECORD_KEYS = {"id", "jp_set", "category", "name", "pokemon", "trainer", "energy", "jp_print"}
POKEMON_KEYS = {"stage", "evolves_from", "hp", "types", "weaknesses", "resistances", "retreat_cost", "rules_text", "powers", "attacks"}


def packaged_cards():
    return json.loads(resources.files("kyuura_engine").joinpath("data/kyuura_cards.json").read_text(encoding="utf-8"))["cards"]


def test_route_returns_whole_public_table_with_schema(bridge):
    response = bridge.client.get("/api/card-definitions")
    assert response.status_code == 200 and response.headers["content-type"].startswith("application/json")
    body = response.json()
    assert (body["gui_server"], body["ok"], body["kind"]) == (1, True, "card_definitions")
    assert (body["schema"], body["schema_version"]) == (CONTRACT["schema"], CONTRACT["schema_version"])
    assert body["source"]["format"] == CONTRACT["source"]["format"] and body["source"]["engine_version"] == "0.179.0"
    assert len(body["source"]["sha256"]) == 64
    # 対戦で使うカードに絞らない: 同梱データの全件（形の合わない記録はない）
    assert body["omitted"] == 0 and body["card_count"] == len(body["cards"]) == len(packaged_cards()) == 1374
    assert forbidden_paths(body) == []
    for card in body["cards"]:
        assert set(card) == RECORD_KEYS, card["id"]
        if card["pokemon"] is not None:
            assert set(card["pokemon"]) == POKEMON_KEYS
    # 出典の記録・メモ・URL など、描画に使わない項目を写さない
    text = response.text
    for word in ("ja_text_source", "source_ids", "notes", "same_card_group", "http", "remarks", "dex"):
        assert f'"{word}"' not in text and (word != "http" or "http" not in text), word


def test_table_does_not_depend_on_matches(bridge):
    before = bridge.client.get("/api/card-definitions").content
    decks = bridge.preset_decks()
    created = bridge.create(mode="decks", decks=decks)
    assert created["ok"] is True
    bridge.create(mode="scenario", scenario="pikachu_seed9")
    after = bridge.client.get("/api/card-definitions").content
    assert before == after  # 対戦の構成・状態で変わらない（同じ 1 つの表）
    assert cd.catalog() is cd.catalog()  # 有限のキャッシュ（1 件）で、要求ごとに作り直さない


def test_source_digest_names_its_method():
    """sha256 の方式を示す（schema_version 2）。改行・キーの順・空白だけが違う同じ内容は同じ値、値・記録・並びが違えば別の値
    （広い正規化で内容の違いを隠さない）。"""
    body = cd.catalog()
    assert CONTRACT["schema_version"] == body["schema_version"] == 2
    assert body["source"]["sha256_method"] == CONTRACT["source"]["sha256_method"] == "kyuura-gui canonical-json 1"
    raw = resources.files("kyuura_engine").joinpath("data/kyuura_cards.json").read_bytes()
    assert body["source"]["sha256"] == cd.canonical_sha256(json.loads(raw.decode("utf-8")))
    base = {"format": CONTRACT["source"]["format"], "cards": [_record(id="A-1"), _record(id="B-1")]}
    same = json.dumps(base, indent=3, sort_keys=False).replace("\n", "\r\n").encode("utf-8")
    assert cd.build(same)["source"]["sha256"] == cd.build(json.dumps(base).encode("utf-8"))["source"]["sha256"]
    changed = [
        {**base, "cards": [_record(id="A-1", name={"ja": "テスト2", "en": None}), _record(id="B-1")]},  # 写さない項目でない値
        {**base, "cards": [_record(id="A-1", notes=["別"]), _record(id="B-1")]},  # 写さない項目でも内容の違い
        {**base, "cards": [_record(id="B-1"), _record(id="A-1")]},  # 並び
        {**base, "cards": [_record(id="A-1")]},  # 記録の削除
    ]
    digests = {cd.build(json.dumps(d).encode("utf-8"))["source"]["sha256"] for d in [base, *changed]}
    assert len(digests) == 5


def test_reads_installed_package_data_not_source_checkout():
    location = Path(str(resources.files("kyuura_engine").joinpath("data/kyuura_cards.json")))
    assert "site-packages" in location.parts and ".venv/src" not in location.as_posix()


def test_projection_of_pokemon_trainer_energy():
    table = {c["id"]: c for c in cd.catalog()["cards"]}
    ponyta = table["PMCG1-016"]
    assert ponyta["category"] == "pokemon" and ponyta["name"]["ja"] == "ポニータ"
    assert ponyta["pokemon"]["hp"] == 40 and ponyta["pokemon"]["types"] == ["fire"]
    assert ponyta["pokemon"]["weaknesses"] == [{"type": "water"}]
    assert ponyta["pokemon"]["attacks"][0]["cost"] == ["colorless", "colorless"]
    assert ponyta["pokemon"]["attacks"][0]["damage"] == {"display": "20"}
    assert ponyta["jp_print"] == {"level": 10, "rarity": "●(C)"}
    trainers = [c for c in table.values() if c["category"] == "trainer"]
    energies = [c for c in table.values() if c["category"] == "energy"]
    assert trainers and all(c["pokemon"] is None and c["energy"] is None and set(c["trainer"]) == {"text"} for c in trainers)
    assert energies and all(set(c["energy"]) == {"kind", "provides", "text"} for c in energies)
    assert {c["energy"]["kind"] for c in energies} == {"basic", "special"}


def _record(**overrides):
    base = {
        "id": "T-1", "jp_set": "PMCG1", "category": "trainer", "name": {"ja": "テスト", "en": None},
        "pokemon": None, "trainer": {"kinds": [], "text": {"ja": "説明", "en": None}}, "energy": None,
        "jp_print": None, "notes": ["写さない"],
    }
    return {**base, **overrides}


def _source(cards, fmt=CONTRACT["source"]["format"]):
    return json.dumps({"format": fmt, "cards": cards}).encode("utf-8")


@pytest.mark.parametrize(
    "bad",
    [
        _record(id="../x"),
        _record(id=""),
        _record(id="X" * 40),
        _record(id=7),
        _record(category="unknown"),
        _record(name="テスト"),
        _record(trainer=None),
        _record(category="pokemon", pokemon={"hp": "40"}),
        _record(category="energy", energy={"kind": "basic", "provides": "fire", "text": None}),
        _record(jp_print={"level": "10", "rarity": None}),
        "not a record",
    ],
)
def test_malformed_records_are_omitted(bad):
    table = cd.build(_source([_record(id="OK-1"), bad]))
    assert [c["id"] for c in table["cards"]] == ["OK-1"] and table["omitted"] == 1
    assert "notes" not in table["cards"][0]


def test_duplicate_ids_are_omitted():
    table = cd.build(_source([_record(id="D-1"), _record(id="D-1"), _record(id="OK-1")]))
    assert [c["id"] for c in table["cards"]] == ["OK-1"] and table["omitted"] == 2


@pytest.mark.parametrize("raw", [b"{not json", b"\xff\xfe", json.dumps([1]).encode(), _source([], fmt="other format 9"), json.dumps({"format": CONTRACT["source"]["format"]}).encode()])
def test_unreadable_source_fails_explicitly(raw):
    with pytest.raises(cd.CardDataUnavailable):
        cd.build(raw)


def test_route_failure_is_a_fixed_error(bridge, monkeypatch):
    def broken():
        raise cd.CardDataUnavailable("同梱のカードデータを読めない")

    monkeypatch.setattr(cd, "catalog_json", broken)
    response = bridge.client.get("/api/card-definitions")
    assert response.status_code == 503
    assert response.json() == {"gui_server": 1, "ok": False, "error": {"code": "GUI_CARD_DATA_UNAVAILABLE", "message": "同梱のカード定義を読めない（カード画像は文字の表示になる）"}}
    assert "Traceback" not in response.text


def test_card_id_pattern():
    assert cd.valid_card_id("PMCG1-016") and cd.valid_card_id("NIP1X-001") and cd.valid_card_id("neo4-082")
    for bad in ("", "-x", "a/b", "a b", "x" * 33, None, 5):
        assert not cd.valid_card_id(bad)


def test_renderer_is_pinned_to_full_commit():
    commit = CONTRACT["renderer"]["commit"]
    assert len(commit) == 40 and all(c in "0123456789abcdef" for c in commit)
    package = json.loads((ROOT / "web" / "package.json").read_text(encoding="utf-8"))
    assert package["dependencies"]["kyuura-card-renderer"] == f"github:moheronemy/kyuura-card-renderer#{commit}"
    lock = json.loads((ROOT / "web" / "package-lock.json").read_text(encoding="utf-8"))
    resolved = lock["packages"]["node_modules/kyuura-card-renderer"]["resolved"]
    assert resolved.endswith(f"github.com/moheronemy/kyuura-card-renderer.git#{commit}")
