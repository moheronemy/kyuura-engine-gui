"""検証用の固定例の来歴と、再生の結果の照らし合わせ（記録した全入口の観測と違えば使わない）。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from kyuura_gui_server import scenarios

ROOT = Path(__file__).resolve().parents[2]
ENGINE = json.loads((ROOT / "contract" / "kyuura-client-api-v1.json").read_text(encoding="utf-8"))["engine"]


@pytest.mark.parametrize("name", sorted({spec["file"] for spec in scenarios.SCENARIOS.values()}))
def test_provenance_names_the_pinned_engine(name):
    """記録を作ったエンジン（engine_commit）は書き換えない。固定版が違うなら、その版で確かめた記録が compatibility にある。"""
    data = json.loads((scenarios.DATA / name).read_text(encoding="utf-8"))
    verified = {data["engine_commit"]} | {entry["engine_commit"] for entry in data.get("compatibility", [])}
    assert ENGINE["commit"] in verified
    # 記録のエンジン: U7-3 の前に作った 2 つは ffcc5ca（来歴の追記だけ）、U7-5 の固定例は 0885d66（tools/build_u7_5_scenarios.py）
    # U7-5e の固定例は 74c8e1f（tools/build_u7_5e_scenarios.py）、U7-5f・g の固定例は e26df79（tools/build_u7_5fg_scenarios.py）
    u75e = ("rocket_charmander_seed1.json", "dark_kadabra_seed1.json", "energy_trans_seed1.json")
    u75fg = ("blaine_seed1.json", "face_down_power_seed8.json", "flash_seed2.json")
    expected = ("ffcc5cab5df1ebde0faed3fd23b481295374e1f9" if name in ("halt_seed1.json", "pikachu_seed9.json")
                else "74c8e1f8ca03d017d5c0a8a79e6fdaa33d25b7f8" if name in u75e
                else "e26df79cc6dec913c1d15b5d8203df066334d65d" if name in u75fg else "0885d664913bc8e57279ed9e44ac51cc97d5a6bf")
    assert data["engine_commit"] == expected


def test_u7_5_scenarios_do_not_reveal_seed_or_decks(bridge):
    """U7-5 の固定例の一覧（ブラウザへ返す）は名前と説明だけ。seed・デッキリスト・操作の列は返さない。"""
    listed = bridge.client.get("/api/scenarios").json()["scenarios"]
    assert {"lucky_stadium", "saffron_gym", "secret_plan", "clefairy_doll", "chaos_gym", "disguise", "rocket_charmander", "dark_kadabra", "energy_trans",
            "blaine", "face_down_power", "flash"} <= {s["id"] for s in listed}
    for item in listed:
        assert set(item) == {"id", "label", "description"}


@pytest.mark.parametrize("scenario_id", list(scenarios.SCENARIOS))
def test_replay_matches_recorded_views(scenario_id):
    hub, _ = scenarios.build(scenario_id)
    data = json.loads((scenarios.DATA / scenarios.SCENARIOS[scenario_id]["file"]).read_text(encoding="utf-8"))
    assert scenarios.digest(scenarios.views(hub)) == data["views_sha256"][scenario_id]


def test_mismatched_views_are_not_used(monkeypatch, bridge):
    original = scenarios._load

    def tampered(name):
        data = original(name)
        data["views_sha256"] = {k: "0" * 64 for k in data["views_sha256"]}
        return data

    monkeypatch.setattr(scenarios, "_load", tampered)
    with pytest.raises(scenarios.ScenarioError):
        scenarios.build("decision")
    response = bridge.client.post("/api/local-match", json={"mode": "scenario", "scenario": "decision"})
    assert response.status_code == 409 and response.json()["error"]["code"] == "GUI_SCENARIO_UNAVAILABLE"
