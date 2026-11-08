// U7-5a〜d の 5 種類の入力・表示と、送信の結果の区別（模擬の応答。形は test/u75.ts。実エンジンとの確認は e2e/u75.spec.ts と server/tests/test_u7_5.py）。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Candidate, InputStage, SubmitResponse } from "../api/types";
import * as V from "../api/validate";
import { summarizeSubmit } from "../state/outcome";
import { choicesKey, type CheckResult } from "../state/useEndpointSession";
import { candidates, inputs, observation, player, pokemon } from "../test/fixtures";
import { ATTACH_STAGES, RETREAT_STAGES } from "../test/u73";
import {
  ACCEPT_REQUEST_STAGES,
  ANSWER_CANDIDATE,
  CHAOS_ACCEPTED_OTHER,
  DECLINED_BACK_TO_TURN,
  DISGUISE_STAGES,
  DOLL_STAGES,
  FD1_STAGES,
  REJECTED_BORROW,
  REVEAL_STAGES,
  STADIUM_ENERGY_CANDIDATE,
  STADIUM_ENERGY_STAGES,
  STADIUM_FACE_DOWN_HOLDER_STAGES,
  STADIUM_NO_INPUT_CANDIDATE,
  STADIUM_OPPONENT_OWNED,
  TRAINER_CANDIDATE,
  TRAINER_CHAOS_STAGES,
  TRAINER_LUCKY_STAGES,
  TRAINER_UNVERIFIED_STAGES,
} from "../test/u75";
import { DecisionPanel } from "./DecisionPanel";

const NAMES: Record<string, string> = {
  "PRN-015": "ラッキースタジアム",
  "PMCG1-093": "ポケモン交換おじさん",
  "PMCG5-087": "錯乱ジム",
  "PMCG6-090": "ヤマブキシティジム",
  "PMCG6-043": "ナツメのケーシィ",
  "PMCG1-101": "超エネルギー",
  "PMCG1-091": "ピッピ人形",
  "PMCG5-019": "タケシのキュウコン",
  "PMCG2-076": "トレーナーX",
  "PMCG1-074": "マサキ",
};

const OBS = observation(0, [player(0, { handCards: [], active: pokemon(1, "ナツメのケーシィ", { card_id: "PMCG6-043" }) }), player(1, { handCards: null })]);

function setup(candidate: Candidate, stages: InputStage[], opts: { check?: CheckResult | null; actor?: 0 | 1 } = {}) {
  const onSubmit = vi.fn();
  const onCheck = vi.fn();
  const parsed = V.inputsResponse(inputs(candidate.kind, stages));
  const ui = (check: CheckResult | null) => (
    <DecisionPanel
      selection={{ candidate, handle: { game: "g", revision: "r", candidate: candidate.id }, inputs: parsed, check }}
      actor={opts.actor ?? 0}
      observation={OBS}
      names={(id) => NAMES[id]}
      busy={false}
      blocked={false}
      onCheck={onCheck}
      onSubmit={onSubmit}
      onCancel={() => undefined}
    />
  );
  const view = render(ui(opts.check ?? null));
  return { onSubmit, onCheck, user: userEvent.setup(), container: view.container, rerenderWithCheck: (check: CheckResult | null) => view.rerender(ui(check)) };
}

const send = () => screen.getByRole("button", { name: "送信" });
const valid = (choices: string[]): CheckResult => ({ choices: choicesKey(choices), response: { valid: true, refusal: null } });
const clone = (stages: InputStage[]) => JSON.parse(JSON.stringify(stages)) as Record<string, unknown>[];
const opts = (s: Record<string, unknown>[]) => s[0]!.options as Record<string, unknown>[];
const ok = (kind: string, stages: unknown) => V.inputsResponse(inputs(kind, stages as InputStage[]));

describe("実行時の検証（U7-5 の入力の形）", () => {
  it("実応答の形と文書の形（unverified・FD1・うらのポケモンの holder・段のないスタジアム）を受け付ける", () => {
    const cases: [string, InputStage[]][] = [
      ["play_trainer", TRAINER_LUCKY_STAGES],
      ["play_trainer", TRAINER_CHAOS_STAGES],
      ["play_trainer", TRAINER_UNVERIFIED_STAGES],
      ["use_stadium", STADIUM_ENERGY_STAGES],
      ["use_stadium", STADIUM_FACE_DOWN_HOLDER_STAGES],
      ["use_stadium", []],
      ["reveal_face_down", REVEAL_STAGES],
      ["discard_from_play", DOLL_STAGES],
      ["discard_from_play", FD1_STAGES],
      ["remove_disguise", DISGUISE_STAGES],
    ];
    for (const [kind, stages] of cases) expect(() => ok(kind, stages)).not.toThrow();
    // U7-3 の同じ名前の role（にげるの discard・エネルギーをつけるの energy）は、そのまま通る
    expect(() => ok("retreat", RETREAT_STAGES)).not.toThrow();
    expect(() => ok("attach_energy", ATTACH_STAGES)).not.toThrow();
  });

  it.each([
    ["トレーナーの知らない項目", "play_trainer", TRAINER_LUCKY_STAGES, (s: Record<string, unknown>[]) => (opts(s)[0]!.target = 3)],
    ["トレーナーに holder", "play_trainer", TRAINER_LUCKY_STAGES, (s: Record<string, unknown>[]) => (opts(s)[0]!.holder = { pokemon: 1, card: 2, zone: "active", card_id: "X" })],
    ["トレーナーの eligible がない", "play_trainer", TRAINER_LUCKY_STAGES, (s: Record<string, unknown>[]) => delete opts(s)[0]!.eligible],
    ["トレーナーの段が 2 つを選ぶ", "play_trainer", TRAINER_LUCKY_STAGES, (s: Record<string, unknown>[]) => (s[0]!.count = { min: 1, max: 2 })],
    ["トレーナーの段の role が違う", "play_trainer", TRAINER_LUCKY_STAGES, (s: Record<string, unknown>[]) => (s[0]!.role = "energy")],
    ["スタジアムのエネルギーに holder がない", "use_stadium", STADIUM_ENERGY_STAGES, (s: Record<string, unknown>[]) => delete opts(s)[0]!.holder],
    ["holder の知らない項目", "use_stadium", STADIUM_ENERGY_STAGES, (s: Record<string, unknown>[]) => ((opts(s)[0]!.holder as Record<string, unknown>).hp = 40)],
    ["うらの holder にカード ID", "use_stadium", STADIUM_FACE_DOWN_HOLDER_STAGES, (s: Record<string, unknown>[]) => ((opts(s)[0]!.holder as Record<string, unknown>).card_id = "PMCG1-014")],
    ["おもての holder にカード ID がない", "use_stadium", STADIUM_ENERGY_STAGES, (s: Record<string, unknown>[]) => delete (opts(s)[0]!.holder as Record<string, unknown>).card_id],
    ["うらのポケモンの選べるものにカード ID", "reveal_face_down", REVEAL_STAGES, (s: Record<string, unknown>[]) => (opts(s)[0]!.card_id = "PMCG1-014")],
    ["おもてのポケモンの選べるものにカード ID がない", "remove_disguise", DISGUISE_STAGES, (s: Record<string, unknown>[]) => delete opts(s)[0]!.card_id],
    ["場の操作の知らない項目", "discard_from_play", DOLL_STAGES, (s: Record<string, unknown>[]) => (opts(s)[0]!.survives = true)],
    ["場の操作の meaning が card", "discard_from_play", DOLL_STAGES, (s: Record<string, unknown>[]) => (s[0]!.meaning = "card")],
  ])("知らない形は止める: %s", (_name, kind, stages, mutate) => {
    const s = clone(stages);
    mutate(s);
    expect(() => ok(kind, s)).toThrow(V.ProtocolError);
  });

  it("U7-5 だけの role がほかの種類の段に来たら止める・段のない応答は use_stadium だけ", () => {
    const s = clone(ATTACH_STAGES);
    s[0]!.role = "trainer";
    expect(() => ok("attach_energy", s)).toThrow(V.ProtocolError);
    expect(() => ok("play_trainer", [])).toThrow(V.ProtocolError);
    expect(() => ok("reveal_face_down", [])).toThrow(V.ProtocolError);
  });

  it("候補の stadium は use_stadium だけで、項目・持ち主の形を確かめる", () => {
    const parse = (c: unknown) => V.candidatesResponse(candidates("r", [c as Candidate]));
    expect(() => parse(STADIUM_NO_INPUT_CANDIDATE)).not.toThrow();
    expect(() => parse({ ...TRAINER_CANDIDATE, stadium: { card: 1, card_id: "PRN-015", owner: 0 } })).toThrow(V.ProtocolError);
    expect(() => parse({ ...STADIUM_NO_INPUT_CANDIDATE, stadium: { card: 1, card_id: "PRN-015", owner: 2 } })).toThrow(V.ProtocolError);
    expect(() => parse({ ...STADIUM_NO_INPUT_CANDIDATE, stadium: { card: 1, card_id: "PRN-015", owner: 0, uses_left: 1 } })).toThrow(V.ProtocolError);
  });
});

describe("手札のトレーナー（play_trainer）", () => {
  it("手札のカードだけを選び、受理のあとの決定を宣言の前に聞かない。check が通るまで送れない", async () => {
    const { user, onCheck, onSubmit, rerenderWithCheck } = setup(TRAINER_CANDIDATE, TRAINER_CHAOS_STAGES);
    expect(screen.getByText(/ここで選ぶのは手札のトレーナーカード 1 枚だけです/)).toHaveTextContent("相手が答える決定（錯乱ジム・［ちえくらべ］など）は、受理のあとに");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    await user.click(screen.getByRole("radio", { name: /錯乱ジム/ }));
    expect(send()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenCalledWith(["o2"]);
    rerenderWithCheck(valid(["o2"]));
    expect(send()).toBeEnabled();
    // 入力を変えると前の検査の結果は使わない
    await user.click(screen.getAllByRole("radio")[0]!); // ポケモン交換おじさん（o1）
    expect(send()).toBeDisabled();
    expect(screen.getByText("入力を変えたので、前の検査の結果は使いません。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("unverified は送れるが使えるかは送るまで分からないと示し、未実装は送れない（ゲーム上の禁止ではない）", () => {
    setup(TRAINER_CANDIDATE, TRAINER_UNVERIFIED_STAGES);
    const [unverified, missing] = screen.getAllByRole("radio");
    expect(unverified).toBeEnabled();
    const first = unverified!.closest("li")!;
    expect(first).toHaveTextContent("使うための条件をエンジンが前もって確かめていない");
    expect(missing).toBeDisabled();
    expect(missing!.closest("li")!).toHaveTextContent("ゲーム上の禁止ではありません");
  });
});

describe("場のスタジアム（use_stadium）", () => {
  it("入力のない効果は choices [] の check のあとに送る。持ち主と使う主体を分けて示す", async () => {
    const { user, onCheck, onSubmit, rerenderWithCheck } = setup(STADIUM_NO_INPUT_CANDIDATE, []);
    const info = screen.getByLabelText("場のスタジアム");
    expect(info).toHaveTextContent("ラッキースタジアム");
    expect(info).toHaveTextContent("持ち主（出したプレイヤー）: あなた（プレイヤー0）");
    expect(info).toHaveTextContent("使うのは: 番のプレイヤー（あなた・プレイヤー0）");
    expect(info).toHaveTextContent("回数・使えるかはエンジンが決めます");
    expect(screen.getByText(/この効果に選ぶものはありません（choices: \[\] で送ります）/)).toBeInTheDocument();
    expect(send()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenCalledWith([]);
    rerenderWithCheck(valid([]));
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it("相手が出したスタジアムでも、使うのは番のプレイヤー", () => {
    setup(STADIUM_OPPONENT_OWNED, []);
    const info = screen.getByLabelText("場のスタジアム");
    expect(info).toHaveTextContent("持ち主（出したプレイヤー）: プレイヤー1");
    expect(info).toHaveTextContent("使うのは: 番のプレイヤー（あなた・プレイヤー0）");
  });

  it("エネルギーを選ぶ効果は、エネルギーカードとついているポケモン（holder）を示す。うらの holder は名前・カード ID を補わない", async () => {
    const { user, onSubmit, rerenderWithCheck } = setup(STADIUM_ENERGY_CANDIDATE, STADIUM_ENERGY_STAGES);
    const option = screen.getByRole("radio", { name: /超エネルギー PMCG1-101（ついている: ナツメのケーシィ（バトル場））/ });
    await user.click(option);
    rerenderWithCheck(valid(["o1"]));
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith(["o1"]);
  });

  it("うらのポケモンについているエネルギー", () => {
    const { container } = setup(STADIUM_ENERGY_CANDIDATE, STADIUM_FACE_DOWN_HOLDER_STAGES);
    expect(screen.getByRole("radio", { name: /ついている: 裏向きのポケモン（ベンチ1）/ })).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("holder");
  });
});

describe("場のポケモン 1 匹を指す操作（remove_disguise・discard_from_play・reveal_face_down）", () => {
  const BOARD = (kind: string) => ({ ...TRAINER_CANDIDATE, kind, reasons: [], choices_format: "[場のポケモンの番号]" }) as Candidate;

  it("うらのカードは裏面で、カード ID・名前・画像を補わない。残るかを予告しない", () => {
    const { container } = setup(BOARD("reveal_face_down"), REVEAL_STAGES);
    const radio = screen.getByRole("radio", { name: /裏向きのポケモン（ベンチ1）/ });
    const row = radio.closest("li")!;
    expect(within(row).getByLabelText("裏向きのポケモン")).toBeInTheDocument();
    expect(row.querySelector("canvas[data-card-id], img[alt*='PMCG']")).toBeNull();
    expect(container.innerHTML).not.toMatch(/PMCG1-014|ヒトカゲ/);
    expect(screen.getByText(/ここでは予告しません/)).toBeInTheDocument();
  });

  it("本人のうらのカードをすてる（FD1）は送れない（未裁定。ゲーム上の禁止ではない）。人形は選べる", () => {
    setup(BOARD("discard_from_play"), FD1_STAGES);
    const [faceDown, doll] = screen.getAllByRole("radio");
    expect(faceDown).toBeDisabled();
    expect(faceDown!.closest("li")!).toHaveTextContent("ゲーム上の禁止ではありません");
    expect(doll).toBeEnabled();
    expect(screen.getByText(/バトル場が空けば、バトル場に出すポケモンを選ぶ決定に続きます/)).toBeInTheDocument();
  });

  it("「ばける」の解除は、エンジンが返した場のポケモンを選ぶ", async () => {
    const { user, onCheck } = setup(BOARD("remove_disguise"), DISGUISE_STAGES);
    expect(screen.getByRole("group")).toHaveTextContent("「ばける」でカードをのせている自分の場のポケモン");
    await user.click(screen.getByRole("radio", { name: /タケシのキュウコン PMCG5-019（自分のバトル場）/ }));
    await user.click(screen.getByRole("button", { name: "入力を検査" }));
    expect(onCheck).toHaveBeenCalledWith(["o1"]);
  });
});

describe("錯乱ジムの相手の決定（accept_request）と結果", () => {
  it("答える人の画面に「使う」と「選ばない」（辞退）を示し、辞退は空で送れる", async () => {
    const { user, onSubmit } = setup(ANSWER_CANDIDATE, ACCEPT_REQUEST_STAGES, { actor: 1 });
    expect(screen.getByText("辞退できます（何も選ばずに送れます）。")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "選ばない" }));
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it("使った側の受理（相手が答える）、使えない「使う」の拒否（本人だけ）、辞退の受理を分ける", () => {
    const s = (r: unknown, kind: string, actor: 0 | 1) => summarizeSubmit(V.submitResponse(r) as SubmitResponse, kind, actor);
    const used = s(CHAOS_ACCEPTED_OTHER, "play_trainer", 0);
    expect(used.title).toBe("受理（決定待ち）: 手札のトレーナーを使う");
    expect(used.lines).toContain("次: プレイヤー1の決定への回答（相手が答えます。答えるまで待ちます）");
    const rejected = s(REJECTED_BORROW, "answer_decision", 1);
    expect(rejected.title).toBe("拒否（エンジン）: 決定に答える");
    expect(rejected.lines).toEqual(
      expect.arrayContaining([
        "エンジンが受け付けませんでした（状態は変わりません）。",
        "この結果は送ったあなたにだけ表示しています（相手・観戦者には知らせません）。",
        "区分: 入力の誤り",
        "診断: NO_POKEMON_CARD_IN_HAND",
      ]),
    );
    const declined = s(DECLINED_BACK_TO_TURN, "answer_decision", 1);
    expect(declined.title).toBe("受理: 決定に答える");
    expect(declined.lines).toContain("次: プレイヤー0の番の操作");
  });
});

describe("観測のうらのカード（情報境界）", () => {
  const faceDown = { pokemon_id: 3, face_down: true, damage: 0, energy: [], trainers: [], special_conditions: [], persistent_effects: [], markers: [] };
  const obsWith = (viewer: 0 | 1 | null, slot: unknown) => {
    const p0 = player(0, { handCards: viewer === 0 ? [] : null, active: pokemon(1, "ブーバー", { card_id: "PMCG1-020" }) });
    p0.bench = [slot as never];
    return observation(viewer, [p0, player(1, { handCards: viewer === 1 ? [] : null })]);
  };
  const real = { ...faceDown, real: { card: 2, card_id: "PMCG1-014", name_ja: "ヒトカゲ" } };

  it("本当のカード（real）は持ち主の観測だけで受け付ける", () => {
    expect(() => V.observation(obsWith(0, real))).not.toThrow();
    expect(() => V.observation(obsWith(1, faceDown))).not.toThrow();
    expect(() => V.observation(obsWith(1, real))).toThrow(V.ProtocolError);
    expect(() => V.observation(obsWith(null, real))).toThrow(V.ProtocolError);
  });

  it("うらのカードの項目の外にカード ID・名前が来たら止める", () => {
    expect(() => V.observation(obsWith(0, { ...faceDown, card_id: "PMCG1-014" }))).toThrow(V.ProtocolError);
    expect(() => V.observation(obsWith(1, { ...faceDown, name_ja: "ヒトカゲ" }))).toThrow(V.ProtocolError);
  });
});
