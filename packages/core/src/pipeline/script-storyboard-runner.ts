import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AgentContext } from "../agents/base.js";
import {
  ScriptCreationAgent,
  StoryboardCreationAgent,
  extractStoryboardImagePrompts,
  renderScriptSpec,
  renderStoryboardSpec,
  type ScriptCreationInput,
  type ScriptTargetFormat,
  type StoryboardCreationInput,
} from "../agents/script-storyboard.js";
import { safeChildPath } from "../utils/path-safety.js";

export interface ScriptCreationRunOptions {
  readonly projectRoot: string;
  readonly runtime: AgentContext;
  readonly title: string;
  readonly instruction: string;
  readonly sourceKind?: string;
  readonly targetFormat?: ScriptTargetFormat;
  readonly sourceText?: string;
  readonly sourcePath?: string;
  readonly requirements?: string;
  readonly episodeCount?: number;
  readonly episodeDuration?: string;
  readonly projectId?: string;
  readonly outDir?: string;
  readonly onProgress?: (message: string) => void;
}

export interface StoryboardCreationRunOptions {
  readonly projectRoot: string;
  readonly runtime: AgentContext;
  readonly title: string;
  readonly instruction: string;
  readonly sourceKind?: string;
  readonly sourceText?: string;
  readonly sourcePath?: string;
  readonly requirements?: string;
  readonly visualStyle?: string;
  readonly aspectRatio?: string;
  readonly granularity?: string;
  readonly maxShots?: number;
  readonly projectId?: string;
  readonly outDir?: string;
  readonly onProgress?: (message: string) => void;
}

export interface ScriptCreationRunResult {
  readonly projectId: string;
  readonly baseDir: string;
  readonly specPath: string;
  readonly scriptPath: string;
}

export interface StoryboardCreationRunResult {
  readonly projectId: string;
  readonly baseDir: string;
  readonly specPath: string;
  readonly storyboardPath: string;
  readonly imagePromptsPath: string;
}

export async function runScriptCreation(
  options: ScriptCreationRunOptions,
): Promise<ScriptCreationRunResult> {
  const projectId = safeSegment(options.projectId ?? slugify(options.title));
  const baseDir = join(normalizeOutputDir(options.outDir ?? "dramas"), projectId);
  const sourceText = await resolveSourceText(options.projectRoot, options.sourceText, options.sourcePath);
  const input: ScriptCreationInput = {
    title: options.title,
    sourceKind: options.sourceKind,
    targetFormat: options.targetFormat,
    sourceText,
    requirements: mergeRequirements(options.instruction, options.requirements),
    episodeCount: options.episodeCount,
    episodeDuration: options.episodeDuration,
  };

  options.onProgress?.("Writing script creation spec...");
  const spec = renderScriptSpec(input);
  await writeProjectText(options.projectRoot, join(baseDir, "script-spec.md"), spec);

  options.onProgress?.("Writing script draft...");
  const agent = new ScriptCreationAgent(options.runtime);
  const script = await agent.writeScript(input);
  await writeProjectText(options.projectRoot, join(baseDir, "script.md"), script);
  await writeProjectText(options.projectRoot, join(baseDir, "status.json"), JSON.stringify({
    status: "completed",
    kind: "script",
    title: options.title,
    completedAt: new Date().toISOString(),
  }, null, 2));

  return {
    projectId,
    baseDir,
    specPath: join(baseDir, "script-spec.md"),
    scriptPath: join(baseDir, "script.md"),
  };
}

export async function runStoryboardCreation(
  options: StoryboardCreationRunOptions,
): Promise<StoryboardCreationRunResult> {
  const projectId = safeSegment(options.projectId ?? slugify(options.title));
  const baseDir = join(normalizeOutputDir(options.outDir ?? "storyboards"), projectId);
  const sourceText = await resolveSourceText(options.projectRoot, options.sourceText, options.sourcePath);
  const input: StoryboardCreationInput = {
    title: options.title,
    sourceKind: options.sourceKind,
    sourceText,
    requirements: mergeRequirements(options.instruction, options.requirements),
    visualStyle: options.visualStyle,
    aspectRatio: options.aspectRatio,
    granularity: options.granularity,
    maxShots: options.maxShots,
  };

  options.onProgress?.("Writing storyboard creation spec...");
  const spec = renderStoryboardSpec(input);
  await writeProjectText(options.projectRoot, join(baseDir, "storyboard-spec.md"), spec);

  options.onProgress?.("Writing storyboard and image prompts...");
  const agent = new StoryboardCreationAgent(options.runtime);
  const storyboard = await agent.writeStoryboard(input);
  await writeProjectText(options.projectRoot, join(baseDir, "storyboard.md"), storyboard);
  await writeProjectText(options.projectRoot, join(baseDir, "image-prompts.md"), extractStoryboardImagePrompts(storyboard));
  await writeProjectText(options.projectRoot, join(baseDir, "status.json"), JSON.stringify({
    status: "completed",
    kind: "storyboard",
    title: options.title,
    completedAt: new Date().toISOString(),
  }, null, 2));

  return {
    projectId,
    baseDir,
    specPath: join(baseDir, "storyboard-spec.md"),
    storyboardPath: join(baseDir, "storyboard.md"),
    imagePromptsPath: join(baseDir, "image-prompts.md"),
  };
}

async function resolveSourceText(
  projectRoot: string,
  sourceText: string | undefined,
  sourcePath: string | undefined,
): Promise<string | undefined> {
  const direct = sourceText?.trim();
  if (direct) return direct;
  const path = sourcePath?.trim();
  if (!path) return undefined;
  return readFile(safeChildPath(projectRoot, path), "utf-8");
}

async function writeProjectText(projectRoot: string, relativePath: string, content: string): Promise<void> {
  const fullPath = safeChildPath(projectRoot, relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content.endsWith("\n") ? content : `${content}\n`, "utf-8");
}

function mergeRequirements(instruction: string, requirements: string | undefined): string {
  return [
    instruction.trim(),
    requirements?.trim() ? `\n补充要求：\n${requirements.trim()}` : "",
  ].filter(Boolean).join("\n");
}

function normalizeOutputDir(value: string): string {
  const text = value.trim().replace(/^\/+|\/+$/g, "");
  if (!text || text.includes("..") || text.includes("\0")) {
    throw new Error(`Invalid output directory: ${JSON.stringify(value)}`);
  }
  return text;
}

function safeSegment(value: string): string {
  const text = value.trim();
  if (!text || text === "." || text === ".." || text.includes("/") || text.includes("\\") || text.includes("\0")) {
    throw new Error(`Invalid project id: ${JSON.stringify(value)}`);
  }
  return text.slice(0, 80);
}

function slugify(value: string): string {
  const text = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return text || `script-${Date.now()}`;
}

export async function projectFileExists(projectRoot: string, relativePath: string): Promise<boolean> {
  try {
    await access(safeChildPath(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}
