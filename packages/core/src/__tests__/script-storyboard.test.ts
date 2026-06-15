import { describe, expect, it } from "vitest";
import {
  extractStoryboardImagePrompts,
  renderScriptSpec,
  renderStoryboardSpec,
} from "../agents/script-storyboard.js";

describe("script and storyboard creation helpers", () => {
  it("renders a human-readable script spec without excerpting source text", () => {
    const sourceText = "第一章。".repeat(500);
    const spec = renderScriptSpec({
      title: "冷库账页",
      sourceKind: "小说",
      targetFormat: "vertical_short_drama",
      sourceText,
      requirements: "调查线七成，家怨三成。",
      episodeCount: 12,
      episodeDuration: "2分钟",
    });

    expect(spec).toContain("# 冷库账页 剧本创作规格");
    expect(spec).toContain("交付类型：竖屏短剧");
    expect(spec).toContain("集数/段落数：12");
    expect(spec).toContain("调查线七成，家怨三成");
    expect(spec).toContain("已提供完整源素材");
    expect(spec).toContain(`${sourceText.replace(/\s+/g, " ").trim().length} 字符`);
    expect(spec).not.toContain("第一章。第一章。第一章。");
    expect(spec).not.toContain("...");
  });

  it("renders storyboard specs as editable Markdown", () => {
    const spec = renderStoryboardSpec({
      title: "冷库账页",
      sourceKind: "剧本",
      visualStyle: "写实冷色",
      aspectRatio: "9:16",
      granularity: "按场景关键镜头拆分",
      maxShots: 18,
      requirements: "每镜头都要有关键道具。",
    });

    expect(spec).toContain("# 冷库账页 分镜创作规格");
    expect(spec).toContain("分镜粒度：按场景关键镜头拆分");
    expect(spec).toContain("画幅：9:16");
    expect(spec).toContain("视觉风格：写实冷色");
    expect(spec).toContain("镜头上限：18");
    expect(spec).toContain("每镜头都要有关键道具");
  });

  it("extracts only the storyboard image prompt section when present", () => {
    const prompts = extractStoryboardImagePrompts([
      "# 冷库账页分镜",
      "",
      "## 分镜表",
      "镜头 1：出纳推开冷库门。",
      "",
      "## 图像提示词",
      "1. 冷库门口，女出纳，冷色写实，9:16",
      "2. 旧账页特写，手电光，压迫感",
      "",
      "## 备注",
      "后续可扩展。",
    ].join("\n"));

    expect(prompts).toContain("冷库门口");
    expect(prompts).toContain("旧账页特写");
    expect(prompts).not.toContain("分镜表");
    expect(prompts).not.toContain("备注");
  });
});
