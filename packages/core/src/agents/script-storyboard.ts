import { BaseAgent } from "./base.js";

export type ScriptTargetFormat =
  | "vertical_short_drama"
  | "screenplay"
  | "audio_drama"
  | "interactive_script"
  | "general_script";

export interface ScriptCreationInput {
  readonly title: string;
  readonly sourceKind?: string;
  readonly targetFormat?: ScriptTargetFormat;
  readonly sourceText?: string;
  readonly requirements?: string;
  readonly episodeCount?: number;
  readonly episodeDuration?: string;
}

export interface StoryboardCreationInput {
  readonly title: string;
  readonly sourceKind?: string;
  readonly sourceText?: string;
  readonly requirements?: string;
  readonly visualStyle?: string;
  readonly aspectRatio?: string;
  readonly granularity?: string;
  readonly maxShots?: number;
}

export class ScriptCreationAgent extends BaseAgent {
  get name(): string {
    return "script-creation-writer";
  }

  async writeScript(input: ScriptCreationInput): Promise<string> {
    const response = await this.chat([
      { role: "system", content: buildScriptCreationSystemPrompt() },
      { role: "user", content: buildScriptCreationUserPrompt(input) },
    ], {
      temperature: 0.55,
      maxTokens: estimateScriptMaxTokens(input),
    });
    return response.content.trim();
  }
}

export class StoryboardCreationAgent extends BaseAgent {
  get name(): string {
    return "storyboard-creation-writer";
  }

  async writeStoryboard(input: StoryboardCreationInput): Promise<string> {
    const response = await this.chat([
      { role: "system", content: buildStoryboardCreationSystemPrompt() },
      { role: "user", content: buildStoryboardCreationUserPrompt(input) },
    ], {
      temperature: 0.45,
      maxTokens: estimateStoryboardMaxTokens(input),
    });
    return response.content.trim();
  }
}

export function renderScriptSpec(input: ScriptCreationInput): string {
  return [
    `# ${input.title} 剧本创作规格`,
    "",
    "## 目标",
    `- 交付类型：${formatScriptTarget(input.targetFormat)}`,
    input.episodeCount ? `- 集数/段落数：${input.episodeCount}` : "- 集数/段落数：未指定，按素材和用户要求判断",
    input.episodeDuration ? `- 单集/单段时长：${input.episodeDuration}` : "- 单集/单段时长：未指定",
    input.sourceKind ? `- 原素材：${input.sourceKind}` : "- 原素材：用户输入/对话需求",
    "",
    "## 用户要求",
    input.requirements?.trim() || "未单独指定；以用户确认时的 instruction 为准。",
    "",
    "## 改编边界",
    "- 优先保留用户明确指定的人物、关系、冲突、关键事件和禁忌。",
    "- 不替用户擅自决定“忠实改编 / 商业强化 / 低成本拍摄”等强度；只执行用户已确认的规格。",
    "- 如果原素材是小说，内心戏要转成可演的动作、对白、证据、物件或场面后果。",
    "- 如果目标是短剧，每集必须有可见冲突和集尾继续看的理由。",
    "",
    "## 源素材摘要",
    summarizeSourceForSpec(input.sourceText),
  ].join("\n");
}

export function renderStoryboardSpec(input: StoryboardCreationInput): string {
  return [
    `# ${input.title} 分镜创作规格`,
    "",
    "## 目标",
    `- 分镜粒度：${input.granularity?.trim() || "按场景和关键镜头拆分"}`,
    `- 画幅：${input.aspectRatio?.trim() || "未指定，默认按用户素材目标判断"}`,
    `- 视觉风格：${input.visualStyle?.trim() || "未指定，按用户素材和目标平台判断"}`,
    input.maxShots ? `- 镜头上限：${input.maxShots}` : "- 镜头上限：未指定",
    input.sourceKind ? `- 原素材：${input.sourceKind}` : "- 原素材：用户输入/对话需求",
    "",
    "## 用户要求",
    input.requirements?.trim() || "未单独指定；以用户确认时的 instruction 为准。",
    "",
    "## 分镜边界",
    "- 分镜是创作工具，不替用户锁死最终拍法；输出要便于继续讨论、增删、改镜头。",
    "- 每个镜头只写画面能看见、角色能演、镜头能表达的信息。",
    "- 分镜图提示词服务图像生成：角色、动作、景别、场景、光线、情绪和关键道具要清楚。",
    "- 不强行添加水印、边框、游戏 UI 或文字，除非用户明确要求。",
    "",
    "## 源素材摘要",
    summarizeSourceForSpec(input.sourceText),
  ].join("\n");
}

export function extractStoryboardImagePrompts(raw: string): string {
  const section = extractMarkdownSection(raw, [
    "图像提示词",
    "分镜图提示词",
    "Image Prompts",
    "Shot Image Prompts",
  ]);
  return section?.trim() || raw.trim();
}

function buildScriptCreationSystemPrompt(): string {
  return [
    "你是剧本创作工具，不是小说续写器。",
    "你的任务是根据用户确认过的规格，把小说、创意、大纲或已有文本改成可继续制作的剧本。",
    "不要替用户擅自决定改编强度；只执行规格里已经确认的目标、格式、边界和限制。",
    "动作行只写观众能看见、演员能演、镜头能拍的信息；内心戏要转成行为、对白、物件、证据或场面后果。",
    "对白要服务冲突、关系、信息推进或情绪变化，不写空泛解释。",
    "输出 Markdown。不要写流程说明、模型自述或“以下是”。",
  ].join("\n");
}

function buildScriptCreationUserPrompt(input: ScriptCreationInput): string {
  return [
    "## 创作规格",
    renderScriptSpec(input),
    "",
    "## 完整源素材",
    input.sourceText?.trim() || "用户没有提供完整源素材；请严格根据创作规格和用户要求写一个可继续扩展的剧本稿。",
    "",
    "## 输出格式",
    `# ${input.title}`,
    "",
    "## 剧本正文",
    "",
    "按目标格式输出。竖屏短剧使用“第N集 / 场次 / 人物 / 动作 / 对白 / 集尾钩子”；标准剧本使用“场景标题 / 动作 / 角色 / 对白”。",
  ].join("\n");
}

function buildStoryboardCreationSystemPrompt(): string {
  return [
    "你是分镜创作工具，负责把剧本、小说片段或创意拆成可拍、可画、可生图的分镜。",
    "分镜不是剧情摘要；每个镜头都要有画面、角色位置、动作、景别或视觉重点。",
    "保留用户确认的视觉规格，不擅自加边框、水印、游戏 UI、文字或固定风格。",
    "图像提示词要便于生图：主体、动作、场景、光线、构图、情绪、关键道具明确。",
    "输出 Markdown。不要写模型自述或流程解释。",
  ].join("\n");
}

function buildStoryboardCreationUserPrompt(input: StoryboardCreationInput): string {
  const maxShots = input.maxShots ?? 24;
  return [
    "## 分镜规格",
    renderStoryboardSpec(input),
    "",
    "## 完整源素材",
    input.sourceText?.trim() || "用户没有提供完整源素材；请严格根据分镜规格和用户要求写一个可继续扩展的分镜稿。",
    "",
    "## 输出格式",
    `# ${input.title} 分镜`,
    "",
    "## 分镜表",
    "",
    `输出不超过 ${maxShots} 个镜头。每个镜头包含：镜号、画面、人物/物件、动作、景别/机位、对白/字幕、时长建议、备注。`,
    "",
    "## 图像提示词",
    "",
    "为每个镜头写一条可用于生图的提示词。提示词不需要生成画面文字，不加水印，不加 UI，除非用户明确要求。",
  ].join("\n");
}

function formatScriptTarget(value: ScriptTargetFormat | undefined): string {
  switch (value) {
    case "vertical_short_drama":
      return "竖屏短剧";
    case "screenplay":
      return "标准剧本";
    case "audio_drama":
      return "广播剧/有声剧";
    case "interactive_script":
      return "互动剧本";
    case "general_script":
    default:
      return "通用剧本";
  }
}

function summarizeSourceForSpec(sourceText: string | undefined): string {
  const text = sourceText?.replace(/\s+/g, " ").trim();
  if (!text) return "未提供完整源素材。";
  return `已提供完整源素材，约 ${text.length} 字符；生成时会读取完整内容。`;
}

function estimateScriptMaxTokens(input: ScriptCreationInput): number {
  const episodes = input.episodeCount ?? 6;
  return Math.min(32000, Math.max(12000, episodes * 2200));
}

function estimateStoryboardMaxTokens(input: StoryboardCreationInput): number {
  const shots = input.maxShots ?? 24;
  return Math.min(24000, Math.max(10000, shots * 700));
}

function extractMarkdownSection(raw: string, headings: readonly string[]): string | undefined {
  const lines = raw.split(/\r?\n/);
  let start = -1;
  let level = 0;
  const normalizedHeadings = headings.map((heading) => heading.trim().toLowerCase());
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s*(.+?)\s*$/u.exec(lines[index] ?? "");
    if (!match) continue;
    const text = match[2]!.trim().toLowerCase();
    if (normalizedHeadings.includes(text)) {
      start = index + 1;
      level = match[1]!.length;
      break;
    }
  }
  if (start < 0) return undefined;
  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+/u.exec(lines[index] ?? "");
    if (match && match[1]!.length <= level) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}
