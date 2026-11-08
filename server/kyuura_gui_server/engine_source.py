"""導入したエンジンの導入元の確認（Git の URL からの通常のインストールで、固定した完全なコミットか）。

``importlib.metadata`` の配布メタデータの ``direct_url.json``（PEP 610）の ``vcs_info`` を読む。
site-packages のディレクトリで ``git rev-parse`` をしない（仮想環境を置いたリポジトリ、つまり GUI 自身の HEAD を返すことがある）。

確認できなかった場合（メタデータ・direct_url.json がない、JSON が正しくない、Git 以外・編集可能・ローカルのディレクトリ・
アーカイブからの導入、コミット・版が違う、別の場所のソースが読み込まれている）は ``EngineSourceError`` にする（確認できたと扱わない）。
URL には資格情報が入りうるので、direct_url.json の全体・URL を例外の文・戻り値・ログに出さない。

将来 wheel から導入する場合の汎用の来歴の検証は、この範囲に含めない（Git の URL の導入だけを受け付ける）。

    python -m kyuura_gui_server.engine_source   # contract/kyuura-client-api-v1.json の engine と照らして要約を出す
"""

from __future__ import annotations

import json
import re
import sys
from importlib import metadata
from pathlib import Path
from typing import Any

DIST_NAME = "kyuura-engine"
_COMMIT = re.compile(r"^[0-9a-f]{40}$")


class EngineSourceError(RuntimeError):
    """導入元を確認できない（理由は決まった文。URL・direct_url.json の中身を含めない）。"""


def verify_engine_source(expected_commit: str, expected_version: str, *, distribution=None, module=None) -> dict[str, Any]:
    """導入元を確かめ、ログに出してよい要約（導入形式・コミット・版・読み込んだ場所）を返す。"""
    if not _COMMIT.match(expected_commit):
        raise EngineSourceError("期待するコミットが 40 桁の完全なハッシュでない")
    try:
        dist = distribution if distribution is not None else metadata.distribution(DIST_NAME)
    except metadata.PackageNotFoundError as error:
        raise EngineSourceError("kyuura-engine の配布メタデータがない（導入されていない）") from error
    text = dist.read_text("direct_url.json")
    if text is None:
        raise EngineSourceError("direct_url.json がない（URL からの導入でない、または導入の記録がない）")
    try:
        record = json.loads(text)
    except ValueError:
        raise EngineSourceError("direct_url.json が JSON として読めない") from None
    if not isinstance(record, dict):
        raise EngineSourceError("direct_url.json の形が正しくない")
    dir_info = record.get("dir_info")
    if isinstance(dir_info, dict) and dir_info.get("editable"):
        raise EngineSourceError("編集可能インストール（-e）になっている")
    if "dir_info" in record or "archive_info" in record:
        raise EngineSourceError("Git の URL 以外からの導入（ローカルのディレクトリ・アーカイブ）になっている")
    vcs_info = record.get("vcs_info")
    if not isinstance(vcs_info, dict):
        raise EngineSourceError("direct_url.json に vcs_info がない")
    if vcs_info.get("vcs") != "git":
        raise EngineSourceError("vcs_info.vcs が git でない")
    commit = vcs_info.get("commit_id")
    if not isinstance(commit, str) or not _COMMIT.match(commit):
        raise EngineSourceError("vcs_info.commit_id が完全なコミットハッシュでない")
    if commit != expected_commit:
        raise EngineSourceError(f"導入したコミット {commit} が固定したコミット {expected_commit} と違う")
    if dist.version != expected_version:
        raise EngineSourceError(f"配布メタデータの版 {dist.version} が {expected_version} でない")
    if module is None:
        import kyuura_engine as module  # noqa: PLC0415
    if getattr(module, "__version__", None) != expected_version:
        raise EngineSourceError(f"パッケージの版 {getattr(module, '__version__', None)} が {expected_version} でない")
    loaded = Path(module.__file__).resolve()
    installed = Path(dist.locate_file("kyuura_engine/__init__.py")).resolve()
    if loaded != installed:
        raise EngineSourceError("読み込んだ kyuura_engine が、導入した配布物の場所のものでない（別のソースが優先されている）")
    return {"install": "git", "commit_id": commit, "version": dist.version, "module": str(loaded)}


def _expected() -> tuple[str, str]:
    contract = Path(__file__).resolve().parents[2] / "contract" / "kyuura-client-api-v1.json"
    engine = json.loads(contract.read_text(encoding="utf-8"))["engine"]
    return engine["commit"], engine["version"]


def main() -> int:
    commit, version = _expected()
    try:
        summary = verify_engine_source(commit, version)
    except EngineSourceError as error:
        print(f"導入元を確認できない: {error}", file=sys.stderr)
        return 1
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
