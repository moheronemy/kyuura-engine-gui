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
    assert data["engine_commit"] == "ffcc5cab5df1ebde0faed3fd23b481295374e1f9"  # 記録のエンジン（U7-3 の前）。来歴の追記だけ


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
