import { describe, expect, it } from "vitest";
import { buildView } from "../PlayHud";

describe("PlayHud buildView", () => {
  it("does not classify every clue/evidence entity as held inventory", () => {
    const view = buildView({
      currentState: { turn: 1, mode: "guided", premise: "查一个配送柜。" },
      graph: {
        entities: [
          { id: "loc-cabinet", type: "location", label: "F-07配送柜", status: "就在面前" },
          { id: "blood", type: "evidence", label: "柜内血迹", status: "已看见，还未采集" },
          { id: "note", type: "clue", label: "夹层纸条", status: "已收起" },
        ],
        edges: [],
        stateSlots: [],
        events: [],
      },
    });

    expect(view?.facing.map((row) => row.label)).toEqual([
      "F-07配送柜",
      "柜内血迹",
    ]);
    expect(view?.holdings.map((row) => row.label)).toEqual(["夹层纸条"]);
  });
});
