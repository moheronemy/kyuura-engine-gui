// 通信層。ローカル接続層（Vite のプロキシ経由の /api）へ HTTP で要求し、検証した型で返す。
// - 送り先は「入口」（seat か host と、ローカル用の関連付けの識別子）。要求に actor・viewer を書かない
// - submit は自動で再送しない（operation_id は対応付け用で、重複の排除はない）。結果が分からない失敗は UnknownOutcomeError
import { CONTRACT, FORMAT } from "./contract";
import type {
  CandidatesResponse,
  CatalogCard,
  CheckResponse,
  Choice,
  CreateMatchRequest,
  CreateMatchResult,
  InputsResponse,
  LogPosition,
  LogResponse,
  PresetDeck,
  ScenarioInfo,
  SubmitResponse,
  UpdatesResponse,
  ViewResponse,
} from "./types";
import * as V from "./validate";

/** 通信が届かなかった・応答が読めなかった。送信なら、受理されたかどうか分からない。 */
export class NetworkError extends Error {
  constructor(message = "接続層と通信できなかった") {
    super(message);
    this.name = "NetworkError";
  }
}

/** 接続層の定型の誤り（gui_server の封筒）。 */
export class GuiServerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GuiServerError";
  }
}

/** client_api の要求の誤り（ok が偽の封筒）。 */
export class ClientApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

/** 応答の JSON を取り出す口（テストでは模擬の実装を渡す）。 */
export interface Transport {
  request(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<unknown>;
}

export const fetchTransport: Transport = {
  async request(method, path, body) {
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      throw new NetworkError();
    }
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new NetworkError(`接続層の応答を読めなかった（HTTP ${response.status}）`);
    }
  },
};

export interface EndpointRef {
  route: "seat" | "host";
  token: string;
}

export interface Handle {
  game: string;
  revision: string;
  candidate: string;
}

function raiseIfError(json: unknown, type: string): void {
  const gui = V.guiError(json);
  if (gui) throw new GuiServerError(gui.code, gui.message);
  const client = V.clientError(json, type);
  if (client) throw new ClientApiError(client.error.code, client.error.message);
}

export interface EndpointClient {
  view(): Promise<ViewResponse>;
  candidates(): Promise<CandidatesResponse>;
  inputs(handle: Handle): Promise<InputsResponse>;
  check(handle: Handle, choices: Choice[]): Promise<CheckResponse>;
  submit(handle: Handle, choices: Choice[], operationId: string): Promise<SubmitResponse>;
  updates(after: number): Promise<UpdatesResponse>;
  /** 0.183.0: この入口の閲覧者の可視ログを位置 from から（null なら先頭から）。読み取りだけ（candidates・inputs・check を呼ばない）。 */
  log(from: LogPosition | null): Promise<LogResponse>;
}

export function endpointClient(transport: Transport, endpoint: EndpointRef): EndpointClient {
  const path = `/api/${endpoint.route}/${encodeURIComponent(endpoint.token)}`;
  async function call<T>(type: string, fields: Record<string, unknown>, parse: (json: unknown) => T): Promise<T> {
    const json = await transport.request("POST", path, { contract: CONTRACT, format: FORMAT, type, ...fields });
    raiseIfError(json, type);
    return parse(json);
  }
  return {
    view: () => call("view", {}, V.viewResponse),
    candidates: () => call("candidates", {}, V.candidatesResponse),
    inputs: (h) => call("inputs", { ...h }, V.inputsResponse),
    check: (h, choices) => call("check", { ...h, choices }, V.checkResponse),
    async submit(h, choices, operationId) {
      let json: unknown;
      try {
        json = await transport.request("POST", path, { contract: CONTRACT, format: FORMAT, type: "submit", ...h, choices, operation_id: operationId });
      } catch (error) {
        throw error instanceof NetworkError ? error : new NetworkError();
      }
      const gui = V.guiError(json);
      // 接続層の内部の誤り・返さなかった応答は、エンジンが受理したかどうか分からない（再送しない）
      if (gui && (gui.code === "GUI_INTERNAL_ERROR" || gui.code === "GUI_RESPONSE_WITHHELD")) throw new NetworkError(gui.message);
      raiseIfError(json, "submit");
      return V.submitResponse(json);
    },
    log: (from) => call("log", from ? { from } : {}, (json) => V.logResponse(json, from)),
    async updates(after) {
      const json = await transport.request("GET", `${path}/updates?after=${encodeURIComponent(String(after))}`);
      const gui = V.guiError(json); // 更新の口は接続層の封筒（gui_server）。中の各更新は client_api の封筒
      if (gui) throw new GuiServerError(gui.code, gui.message);
      return V.updatesResponse(json);
    },
  };
}

// ---------------------------------------------------------------- 作成の画面の口

export async function createMatch(transport: Transport, body: CreateMatchRequest): Promise<CreateMatchResult> {
  const json = await transport.request("POST", "/api/local-match", body);
  const gui = V.guiError(json);
  if (gui && !(typeof json === "object" && json !== null && "start" in json)) throw new GuiServerError(gui.code, gui.message);
  return V.createMatchResult(json);
}

export async function loadPresets(transport: Transport): Promise<{ presets: PresetDeck[]; convention_sets: string[] }> {
  return V.presetsResponse(await transport.request("GET", "/api/decks/presets"));
}

export async function loadCatalog(transport: Transport): Promise<CatalogCard[]> {
  return V.cardsResponse(await transport.request("GET", "/api/cards"));
}

export async function loadScenarios(transport: Transport): Promise<ScenarioInfo[]> {
  return V.scenariosResponse(await transport.request("GET", "/api/scenarios"));
}
