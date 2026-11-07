"""ローカル接続層の HTTP の口（FastAPI）。127.0.0.1 だけで待ち受ける（__main__.py）。

口の一覧（README「接続層の HTTP の口」）:

- ``GET  /api/health``                         接続層・エンジンの版と契約の識別
- ``GET  /api/decks/presets``                  エンジンの固定デッキ（サンプル）
- ``GET  /api/cards``                          カード名の表（表示用の最小の項目）
- ``GET  /api/card-definitions``               描画用の公開カード定義（GUI 接続層の拡張。client_api の入口ではない）
- ``GET  /api/scenarios``                      検証用の固定例の一覧
- ``POST /api/local-match``                    ローカル対戦を作る（古い対戦は捨てる）
- ``DELETE /api/local-match``                  対戦を捨てる
- ``POST /api/seat/{token}``                   プレイヤー・観戦者の入口へ client_api の要求をそのまま渡す
- ``GET  /api/seat/{token}/updates?after=n``   その閲覧者の保持中の公開の更新
- ``POST /api/host/{token}``                   ホストの入口（別の口。プレイヤーの識別子では使えない）
- ``GET  /api/host/{token}/updates?after=n``

接続層の誤りは ``{"gui_server": 1, "ok": false, "error": {"code", "message"}}``（決まった文。例外の文・traceback を返さない）。
エンジンの応答（client_api の封筒）はそのまま返す。
"""

from __future__ import annotations

import json
import logging
import secrets

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool

import kyuura_engine
from kyuura_engine.client_api import CONTRACT, FORMAT, ClientHub

from . import GUI_SERVER_FORMAT, card_definitions, decks, scenarios
from .local_match import SEAT_HOST, LocalMatch, MatchClosed, MatchRegistry
from .safety import forbidden_paths

log = logging.getLogger("kyuura_gui_server")
MAX_BODY = 32 * 1024
CONVENTION_SETS = {"": None, "CS-KYUURA-PLAY-S2A@1": "CS-KYUURA-PLAY-S2A@1", "CS-KYUURA-PLAY-PO@1": "CS-KYUURA-PLAY-PO@1"}
ALLOWED_HOSTS = ("127.0.0.1", "localhost")

ERRORS = {
    "GUI_REQUEST_INVALID": (400, "要求が JSON のオブジェクトでない、または大きすぎる"),
    "GUI_FIELD_INVALID": (400, "要求の項目が正しくない"),
    "GUI_DECK_INPUT_INVALID": (400, "デッキの入力の形が正しくない"),
    "GUI_CARD_DATA_UNAVAILABLE": (503, "同梱のカード定義を読めない（カード画像は文字の表示になる）"),
    "GUI_SCENARIO_UNAVAILABLE": (409, "固定例を使えない（エンジンの版と固定例が合わない）"),
    "GUI_SEAT_UNKNOWN": (404, "ローカルの入口が見つからない（対戦が新しい対戦で置き換えられたか、捨てられた）"),
    "GUI_USE_UPDATES_ROUTE": (400, "更新は updates の口で取る（接続層が閲覧者ごとに保持している）"),
    "GUI_RESPONSE_WITHHELD": (500, "応答に返してはいけない項目があったため、返さなかった"),
    "GUI_HOST_FORBIDDEN": (403, "許可していない接続元"),
    "GUI_INTERNAL_ERROR": (500, "接続層で処理できなかった"),
}


def gui_error(code: str) -> JSONResponse:
    status, message = ERRORS[code]
    return JSONResponse({"gui_server": GUI_SERVER_FORMAT, "ok": False, "error": {"code": code, "message": message}}, status_code=status)


def gui_ok(body: dict) -> JSONResponse:
    return JSONResponse({"gui_server": GUI_SERVER_FORMAT, "ok": True, **body})


def create_app(registry: MatchRegistry | None = None) -> FastAPI:
    app = FastAPI(title="kyuura-engine-gui local bridge", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.registry = registry or MatchRegistry()

    @app.middleware("http")
    async def guard(request: Request, call_next):
        # ローカル専用: Host が 127.0.0.1・localhost 以外の要求を断る（DNS の付け替えで別のサイトから使われないように）
        host = (request.headers.get("host") or "").rsplit(":", 1)[0].strip("[]")
        if host not in ALLOWED_HOSTS:
            return gui_error("GUI_HOST_FORBIDDEN")
        try:
            response = await call_next(request)
        except Exception:  # 例外の文・traceback をブラウザへ返さない（サーバーの記録だけ）
            log.exception("接続層の内部エラー")
            return gui_error("GUI_INTERNAL_ERROR")
        response.headers["Cache-Control"] = "no-store"
        return response

    async def read_json(request: Request):
        body = await request.body()
        if len(body) > MAX_BODY:
            return None, gui_error("GUI_REQUEST_INVALID")
        try:
            value = json.loads(body)
        except (ValueError, UnicodeDecodeError):
            return None, gui_error("GUI_REQUEST_INVALID")
        return value, None

    def registry_of(request: Request) -> MatchRegistry:
        return request.app.state.registry

    def checked(value: dict, *, sender: bool) -> JSONResponse:
        found = forbidden_paths(value, sender=sender)
        if found:
            log.error("ブラウザ向けの応答に禁じた項目: %s", found)
            return gui_error("GUI_RESPONSE_WITHHELD")
        return JSONResponse(value)

    @app.get("/api/health")
    def health():
        return gui_ok({"engine_version": kyuura_engine.__version__, "client_contract": CONTRACT, "client_format": FORMAT,
                       "local_only": True, "note": "ローカル確認用。認証済みのオンライン対戦・公開サーバーではない"})

    @app.get("/api/decks/presets")
    def presets():
        return gui_ok({"presets": decks.presets(), "convention_sets": [k for k in CONVENTION_SETS if k]})

    @app.get("/api/cards")
    def cards():
        return gui_ok({"cards": decks.card_catalog()})

    @app.get("/api/card-definitions")
    def card_definitions_route():
        # 公開の静的なデータの全体の表（対戦に依存しない・対戦で使うカードに絞らない）。表は 1 回だけ作って使い回す
        try:
            body = card_definitions.catalog_json()
        except card_definitions.CardDataUnavailable:
            log.exception("カード定義を作れない")
            return gui_error("GUI_CARD_DATA_UNAVAILABLE")
        return Response(body, media_type="application/json")

    @app.get("/api/scenarios")
    def scenario_list():
        return gui_ok({"scenarios": scenarios.scenario_list()})

    @app.post("/api/local-match")
    async def create_match(request: Request):
        body, error = await read_json(request)
        if error is not None:
            return error
        if not isinstance(body, dict) or body.get("mode") not in ("decks", "scenario"):
            return gui_error("GUI_FIELD_INVALID")
        if body["mode"] == "scenario":
            if set(body) - {"mode", "scenario"} or body.get("scenario") not in scenarios.SCENARIOS:
                return gui_error("GUI_FIELD_INVALID")
            try:
                hub, notice = await run_in_threadpool(scenarios.build, body["scenario"])
            except scenarios.ScenarioError:
                log.exception("固定例を使えない")
                return gui_error("GUI_SCENARIO_UNAVAILABLE")
            spec = scenarios.SCENARIOS[body["scenario"]]
            origin = {"kind": "fixed_example", "scenario": body["scenario"], "label": spec["label"], "description": spec["description"]}
            return start_response(request, hub, notice, origin, None)
        if set(body) - {"mode", "decks", "conventions"} or not isinstance(body.get("decks"), list) or len(body["decks"]) != 2:
            return gui_error("GUI_FIELD_INVALID")
        conventions = body.get("conventions", "")
        if conventions not in CONVENTION_SETS:
            return gui_error("GUI_FIELD_INVALID")
        try:
            lists = [decks.parse_entries(d.get("entries") if isinstance(d, dict) else None) for d in body["decks"]]
        except decks.DeckInputError:
            return gui_error("GUI_DECK_INPUT_INVALID")
        # デッキの診断は作成の画面だけへ返す（対戦の観測へ混ぜない）。エンジンの検査（deck_problems）の結果のまま
        diagnostics = [decks.problems(cards) for cards in lists]
        options = {} if CONVENTION_SETS[conventions] is None else {"conventions": CONVENTION_SETS[conventions]}
        seed = secrets.randbelow(2**31)  # 接続層だけが持つ（ブラウザへ返さない・記録しない）
        hub, notice = await run_in_threadpool(lambda: ClientHub.start(lists[0], lists[1], seed, **options))
        del seed
        origin = {"kind": "new_game", "label": "新しいローカル対戦", "conventions": conventions or None}
        return start_response(request, hub, notice, origin, diagnostics)

    def start_response(request, hub, notice, origin, diagnostics):
        registry = registry_of(request)
        if hub is None:
            registry.replace(None)  # 開始できなかった: 古い対戦も捨てる（どれが今の対戦か迷わないように）
            return checked({"gui_server": GUI_SERVER_FORMAT, "ok": False, "start": notice, "deck_diagnostics": diagnostics,
                            "error": {"code": "GUI_START_REJECTED", "message": "エンジンが対戦を開始しなかった"}}, sender=False)
        match = LocalMatch(hub, origin=origin)
        registry.replace(match)
        return checked({"gui_server": GUI_SERVER_FORMAT, "ok": True, "start": notice, "deck_diagnostics": diagnostics,
                        "match": match.public_info()}, sender=False)

    @app.delete("/api/local-match")
    def discard_match(request: Request):
        registry_of(request).replace(None)
        return gui_ok({"discarded": True})

    async def forward(request: Request, token: str, *, host: bool):
        resolved = registry_of(request).resolve(token)
        if resolved is None or (resolved[1] == SEAT_HOST) != host:
            return gui_error("GUI_SEAT_UNKNOWN")  # ホストの識別子はプレイヤーの口で、プレイヤーの識別子はホストの口で使えない
        match, seat = resolved
        body, error = await read_json(request)
        if error is not None:
            return error
        if isinstance(body, dict) and body.get("type") == "updates":
            return gui_error("GUI_USE_UPDATES_ROUTE")
        # updates 以外は種類を問わずエンジンへ渡す（知らない種類・その入口にない種類はエンジンが CLIENT_REQUEST_UNKNOWN で答える）
        try:
            answer = await run_in_threadpool(match.handle, seat, body)
        except MatchClosed:
            return gui_error("GUI_SEAT_UNKNOWN")
        return checked(answer, sender=True)

    def updates(request: Request, token: str, after: int, *, host: bool):
        resolved = registry_of(request).resolve(token)
        if resolved is None or (resolved[1] == SEAT_HOST) != host:
            return gui_error("GUI_SEAT_UNKNOWN")
        match, seat = resolved
        try:
            body = match.updates_after(seat, after)
        except MatchClosed:
            return gui_error("GUI_SEAT_UNKNOWN")
        return checked({"gui_server": GUI_SERVER_FORMAT, "ok": True, "kind": "updates", **body}, sender=False)

    @app.post("/api/seat/{token}")
    async def seat_request(token: str, request: Request):
        return await forward(request, token, host=False)

    @app.get("/api/seat/{token}/updates")
    def seat_updates(token: str, request: Request, after: int = 0):
        return updates(request, token, after, host=False)

    @app.post("/api/host/{token}")
    async def host_request(token: str, request: Request):
        return await forward(request, token, host=True)

    @app.get("/api/host/{token}/updates")
    def host_updates(token: str, request: Request, after: int = 0):
        return updates(request, token, after, host=True)

    return app


app = create_app()
