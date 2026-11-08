"""導入元の確認（direct_url.json）が、確認できない場合を明示的に失敗にすること。

配布メタデータは模擬のもの（実際の導入の確認は test_contract.py の test_engine_identity）。
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from kyuura_gui_server.engine_source import EngineSourceError, verify_engine_source

COMMIT = "ffcc5cab5df1ebde0faed3fd23b481295374e1f9"
SECRET_URL = "https://user:token@example.invalid/kyuura-engine"


class FakeDist:
    def __init__(self, text, version="0.164.0", root="site"):
        self._text = text
        self.version = version
        self._root = Path(root).resolve()

    def read_text(self, name):
        assert name == "direct_url.json"
        return self._text

    def locate_file(self, path):
        return self._root / path


def module_at(root="site", version="0.164.0"):
    return SimpleNamespace(__version__=version, __file__=str(Path(root).resolve() / "kyuura_engine" / "__init__.py"))


def git_record(**vcs):
    return json.dumps({"url": SECRET_URL, "vcs_info": {"vcs": "git", "commit_id": COMMIT, "requested_revision": COMMIT, **vcs}})


def check(text, *, version="0.164.0", module=None):
    return verify_engine_source(COMMIT, "0.164.0", distribution=FakeDist(text, version), module=module or module_at())


def test_git_install_with_pinned_commit_passes():
    summary = check(git_record())
    assert summary["commit_id"] == COMMIT and summary["install"] == "git"
    assert SECRET_URL not in json.dumps(summary) and "token" not in json.dumps(summary)  # URL を要約に出さない


@pytest.mark.parametrize(
    ("text", "reason"),
    [
        (None, "direct_url.json がない"),
        ("{not json", "JSON として読めない"),
        ("[1, 2]", "形が正しくない"),
        (json.dumps({"url": SECRET_URL, "dir_info": {"editable": True}}), "編集可能インストール"),
        (json.dumps({"url": SECRET_URL, "dir_info": {}}), "Git の URL 以外"),
        (json.dumps({"url": SECRET_URL, "archive_info": {"hashes": {}}}), "Git の URL 以外"),
        (json.dumps({"url": SECRET_URL}), "vcs_info がない"),
        (git_record(vcs="hg"), "git でない"),
        (git_record(commit_id="ffcc5ca"), "完全なコミットハッシュでない"),
        (git_record(commit_id="d0c5cfa9483aacae0cce2fd8d28166b1d8465500"), "固定したコミット"),
    ],
)
def test_unconfirmed_sources_fail(text, reason):
    with pytest.raises(EngineSourceError, match=reason) as caught:
        check(text)
    assert "token" not in str(caught.value) and SECRET_URL not in str(caught.value)  # 資格情報を文に出さない


def test_version_and_location_mismatch_fail():
    with pytest.raises(EngineSourceError, match="配布メタデータの版"):
        check(git_record(), version="0.165.0")
    with pytest.raises(EngineSourceError, match="パッケージの版"):
        check(git_record(), module=module_at(version="0.163.0"))
    with pytest.raises(EngineSourceError, match="別のソース"):
        check(git_record(), module=module_at(root="elsewhere"))


def test_expected_commit_must_be_full():
    with pytest.raises(EngineSourceError, match="40 桁"):
        verify_engine_source("ffcc5ca", "0.164.0", distribution=FakeDist(git_record()), module=module_at())


def test_missing_distribution_fails(monkeypatch):
    from importlib import metadata

    def missing(name):
        raise metadata.PackageNotFoundError(name)

    monkeypatch.setattr(metadata, "distribution", missing)
    with pytest.raises(EngineSourceError, match="配布メタデータがない"):
        verify_engine_source(COMMIT, "0.164.0", module=module_at())
