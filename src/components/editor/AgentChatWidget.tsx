import { useEffect, useMemo, useRef, useState, type ChangeEvent as ReactChangeEvent, type MouseEvent as ReactMouseEvent } from "react";
import { AlertCircle, ArrowLeftRight, Check, ChevronLeft, ChevronRight, ChevronUp, Download, FolderPlus, History, ImagePlus, ImageUp, Maximize2, MessageSquareMore, Minimize2, Plus, RotateCcw, SendHorizonal, Sparkles, Square, ThumbsDown, ThumbsUp, WandSparkles, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockAssets, type AssetKind } from "@/mock/editorMock";
import { useEditorStore } from "@/stores/editorStore";
import QuickPhrasePopover from "@/components/editor/QuickPhrasePopover";

type ModelId = "gpt-4.1" | "claude-3.7" | "deepseek-r1" | "gemini-2.5";
type MessageRole = "assistant" | "user";
type MessageKind =
  | "text"
  | "image-generation-skill"
  | "image-write-confirmation-skill";
type DockSide = "left" | "right";
type FeedbackType = "up" | "down";
type QuickPhraseAnchor = "compact" | "expanded";
type ImageClarificationStep = "collecting" | "confirming" | "generating";
type ImageGenerationStatus = "generating" | "success" | "failed";

interface ModelOption {
  id: ModelId;
  label: string;
  hint: string;
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  kind?: MessageKind;
  modelId?: ModelId;
  status?: "failed" | "generating";
  requestText?: string;
  imageRatio?: string;
  imageModel?: string;
  imagePrompt?: string;
  imageStyle?: string;
  imageComposition?: string;
  imageAngle?: string;
  imageCount?: number;
  imageReferences?: string;
  imageGenerationStatus?: ImageGenerationStatus;
  imageGenerationType?: string;
  imageTargetLabel?: string;
  imageDescription?: string;
  imageBindings?: string[];
  imageAssetId?: string;
  imageAssetName?: string;
  imageAssetUrl?: string;
  imageWriteAction?: string;
  imageWriteStatus?: "pending" | "applied";
  attachment?: ComposerAttachment;
}

interface ChatSession {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  modelId: ModelId;
  messages: ChatMessage[];
}

interface SkillCommand {
  id: string;
  command: string;
  name: string;
  description: string;
  icon: "refine" | "image";
  category: "official" | "mine";
}

type SkillMenuCategory = "official-skill" | "official-prompt" | "mine";

interface PromptSquareTemplate {
  id: string;
  name: string;
  type: "SRT 分镜提示词" | "全能参考分镜提示词";
  author: "官方运营" | "杨杨";
}

interface ImageClarificationState {
  step: ImageClarificationStep;
  imageType?: string;
  naturalDetails?: string;
  config?: ImageGenerationConfig;
}

interface ImageGenerationConfig {
  imageType: string;
  style: string;
  ratio: string;
  composition: string;
  angle: string;
  imageModel: string;
  count: number;
  references: string;
  prompt: string;
}

interface GeneratedAssetSample {
  id: string;
  imageUrl?: string;
  name: string;
}

interface PreviewAsset extends GeneratedAssetSample {
  imageType: string;
}

interface ComposerAttachment {
  name: string;
  url: string;
}

const modelOptions: ModelOption[] = [
  { id: "gpt-4.1", label: "GPT-4.1", hint: "更均衡，适合页面修改和说明" },
  { id: "claude-3.7", label: "Claude 3.7", hint: "更偏结构化梳理和细节建议" },
  { id: "deepseek-r1", label: "DeepSeek R1", hint: "更偏推理和方案拆解" },
  { id: "gemini-2.5", label: "Gemini 2.5", hint: "更偏快速发散和多角度建议" },
];

const quickPrompts = [
  "帮我梳理这段剧情的情绪起伏",
  "检查这个剧本有没有逻辑 bug",
  "这场对白还可以怎么改得更有张力",
];

const generatingPreviewContent =
  "我可以继续帮你细化界面结构、补交互，或者把需求拆成可执行的小步骤。\n\n我会继续记住这段对话的";

const skillCommands: SkillCommand[] = [
  {
    id: "prompt-refinement",
    command: "/Prompt Refinement",
    name: "Prompt Refinement",
    description: "提示词修改",
    icon: "refine",
    category: "official",
  },
  {
    id: "imggen",
    command: "/对话文生图",
    name: "对话文生图",
    description: "从对话生成角色、场景、道具或分镜首帧",
    icon: "image",
    category: "official",
  },
];

const promptSquareTemplates: PromptSquareTemplate[] = [
  { id: "detailed", name: "详细版提示词", type: "SRT 分镜提示词", author: "官方运营" },
  { id: "concise", name: "简洁版提示词", type: "SRT 分镜提示词", author: "官方运营" },
  { id: "jiuxiaozhou", name: "九小洲版提示词", type: "SRT 分镜提示词", author: "官方运营" },
  {
    id: "general-video-storyboard",
    name: "通用视频分镜生成模板",
    type: "全能参考分镜提示词",
    author: "官方运营",
  },
  { id: "jiujiao-direct", name: "九焦直出版提示词", type: "SRT 分镜提示词", author: "官方运营" },
  {
    id: "rich-camera",
    name: "丰富镜头调度版模板",
    type: "全能参考分镜提示词",
    author: "官方运营",
  },
  { id: "srt-template", name: "SRT的模板", type: "SRT 分镜提示词", author: "杨杨" },
  {
    id: "omni-reference",
    name: "全能参考的模板",
    type: "全能参考分镜提示词",
    author: "杨杨",
  },
];

function SelectedSkillChip({
  skill,
  className,
  onRemove,
}: {
  skill: SkillCommand;
  className?: string;
  onRemove: () => void;
}) {
  const SkillIcon = skill.icon === "refine" ? WandSparkles : ImagePlus;

  return (
    <div
      data-testid="selected-skill-chip"
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-[11px] border border-[#cfd5e5] bg-white px-2.5 py-1.5 text-[#35415a] shadow-[0_3px_10px_rgba(65,76,105,.08)]",
        className
      )}
    >
      <SkillIcon className="h-4 w-4 shrink-0 text-[#7256d7]" />
      <span className="truncate text-xs font-semibold">{skill.name}</span>
      <span className="shrink-0 rounded-full bg-[#f1edff] px-1.5 py-0.5 text-[9px] font-medium text-[#6e54cc]">
        Skill
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="-mr-1 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#8c95a8] transition hover:bg-[#f2f4f8] hover:text-[#cf4f78]"
        aria-label={`移除 ${skill.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function SkillCommandMenu({
  className,
  onSelect,
  onTemplateSelect,
}: {
  className?: string;
  onSelect: (skill: SkillCommand) => void;
  onTemplateSelect: (template: PromptSquareTemplate) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<SkillMenuCategory>("official-skill");
  const visibleSkills =
    activeCategory === "official-skill"
      ? skillCommands.filter((skill) => skill.category === "official")
      : [];
  const visibleTemplates = activeCategory === "official-prompt" ? promptSquareTemplates : [];
  const officialSkillCount = skillCommands.filter((skill) => skill.category === "official").length;
  const mineSkillCount = skillCommands.filter((skill) => skill.category === "mine").length;
  const activeCount =
    activeCategory === "official-skill"
      ? officialSkillCount
      : activeCategory === "official-prompt"
        ? promptSquareTemplates.length
        : mineSkillCount;
  const activeCountLabel =
    activeCategory === "official-prompt" ? `${activeCount} 个模板` : `${activeCount} 个可用`;

  return (
    <div
      id="agent-skill-command-menu"
      data-testid="skill-command-menu"
      className={cn(
        "z-20 overflow-hidden rounded-[22px] border border-[#d7ddea] bg-white shadow-[0_18px_40px_rgba(41,52,79,.14)]",
        className
      )}
      role="menu"
      aria-label="可调用的 Skills"
    >
      <div className="flex items-center justify-between border-b border-[#edf1f7] px-4 py-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.08em] text-[#3d4962]">SKILLS</div>
          <div className="mt-0.5 text-[11px] text-[#8a94aa]">选择要调用的创作能力</div>
        </div>
        <span className="rounded-full bg-[#f2f4fb] px-2 py-1 text-[10px] font-medium text-[#69758d]">
          {activeCountLabel}
        </span>
      </div>

      <div className="border-b border-[#edf1f7] px-3 pt-2.5">
        <div className="flex items-center gap-1 rounded-[14px] bg-[#f4f6fb] p-1" role="tablist" aria-label="Skill 分类">
          {[
            { id: "official-skill" as const, label: "官方 Skill", count: officialSkillCount },
            { id: "official-prompt" as const, label: "官方 Prompt", count: promptSquareTemplates.length },
            { id: "mine" as const, label: "我的", count: mineSkillCount },
          ].map((category) => (
            <button
              key={category.id}
              type="button"
              role="tab"
              data-testid={`skill-tab-${category.id}`}
              aria-selected={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-[11px] px-2 text-[11px] font-medium transition",
                activeCategory === category.id
                  ? "bg-white text-[#3c4860] shadow-[0_4px_12px_rgba(60,72,96,.1)]"
                  : "text-[#8993a7] hover:text-[#566278]"
              )}
            >
              <span className="truncate">{category.label}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[9px]",
                  activeCategory === category.id
                    ? "bg-[#f0edff] text-[#7052d2]"
                    : "bg-[#e7eaf1] text-[#8993a7]"
                )}
              >
                {category.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[132px] p-2">
        {activeCategory === "official-prompt" && visibleTemplates.length > 0 ? (
          <div
            data-testid="prompt-square-list"
            className="max-h-[198px] space-y-1.5 overflow-y-auto pr-0.5"
          >
            {visibleTemplates.map((template) => {
              const isSrt = template.type === "SRT 分镜提示词";

              return (
                <button
                  key={template.id}
                  type="button"
                  data-testid={`prompt-template-${template.id}`}
                  onClick={() => onTemplateSelect(template)}
                  className="group flex w-full items-center gap-3 rounded-[16px] border border-transparent px-3 py-3 text-left transition hover:border-[#e0e4f2] hover:bg-[#f7f8ff] focus-visible:border-[#8b95ff] focus-visible:bg-[#f7f8ff] focus-visible:outline-none"
                  role="menuitem"
                  aria-label={`${template.name}，${template.type}`}
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border shadow-[inset_0_1px_0_rgba(255,255,255,.7)]",
                      isSrt
                        ? "border-[#f1deb1] bg-[#fff7df] text-[#b47b09]"
                        : "border-[#cfdaff] bg-[#eef3ff] text-[#5471c2]"
                    )}
                  >
                    <WandSparkles className="h-[18px] w-[18px]" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#24314d]">
                      {template.name}
                    </span>
                    <span className="mt-1 block text-xs text-[#77839b]">{template.author}</span>
                  </span>

                  <span
                    className={cn(
                      "max-w-[126px] shrink-0 truncate rounded-lg px-2 py-1 text-[10px] font-medium",
                      isSrt
                        ? "bg-[#fff6dc] text-[#9b6a08]"
                        : "bg-[#edf2ff] text-[#4e6dbd]"
                    )}
                    title={template.type}
                  >
                    {template.type}
                  </span>
                </button>
              );
            })}
          </div>
        ) : activeCategory === "official-skill" && visibleSkills.length > 0 ? (
          <div className="space-y-1.5">
            {visibleSkills.map((skill) => {
              const isRefinement = skill.icon === "refine";
              const SkillIcon = isRefinement ? WandSparkles : ImagePlus;

              return (
                <button
                  key={skill.id}
                  type="button"
                  data-testid={`skill-command-${skill.id}`}
                  onClick={() => onSelect(skill)}
                  className="group flex w-full items-center gap-3 rounded-[16px] border border-transparent px-3 py-3 text-left transition hover:border-[#e0e4f2] hover:bg-[#f7f8ff] focus-visible:border-[#8b95ff] focus-visible:bg-[#f7f8ff] focus-visible:outline-none"
                  role="menuitem"
                  aria-label={`${skill.name}，${skill.description}`}
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border shadow-[inset_0_1px_0_rgba(255,255,255,.7)]",
                      isRefinement
                        ? "border-[#ddceff] bg-[#f3edff] text-[#7354d8]"
                        : "border-[#ffd0e4] bg-[#fff0f6] text-[#d84f88]"
                    )}
                  >
                    <SkillIcon className="h-[18px] w-[18px]" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[#24314d]">{skill.name}</span>
                      <span className="rounded-full bg-[#f1f3f8] px-2 py-0.5 text-[10px] font-medium text-[#6f7a91]">
                        Skill
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-[#77839b]">{skill.description}</span>
                  </span>

                  <span className="rounded-lg bg-[#f5f6fa] px-2 py-1 font-mono text-[10px] text-[#7b8498] transition group-hover:bg-white">
                    {skill.command}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            data-testid="my-library-empty"
            className="flex min-h-[124px] flex-col items-center justify-center px-4 text-center"
          >
            <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-dashed border-[#cfd6e5] bg-[#f7f9fd] text-[#8792a8]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="mt-2.5 text-xs font-semibold text-[#4d5971]">还没有自建内容</div>
            <div className="mt-1 text-[11px] leading-4 text-[#98a1b2]">
              你创建或收藏的 Skill 与 Prompt 会显示在这里
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function inferImageType(input: string) {
  const normalized = input.replace(/\s+/g, "").toLowerCase();

  if (/(当前分镜|这个分镜|本分镜|分镜).*(首帧|关键帧|参考图|出图|生成图)|首帧图|首帧参考图|分镜首帧|分镜关键帧|关键帧图|关键帧图片/.test(normalized)) {
    return "当前分镜首帧";
  }

  if (/(角色图|人物图|角色图片|人物图片|角色设定图|人物设定图|立绘)/.test(normalized)) {
    return "角色图";
  }

  if (/(场景图|场景图片|场景设定图|场景参考图|空间概念图)/.test(normalized)) {
    return "场景图";
  }

  if (/(道具图|道具图片|道具特写|物件图|器物图|武器图)/.test(normalized)) {
    return "道具图";
  }

  if (/(海报图|海报图片|生成海报|制作海报|创建海报|做海报|封面图|封面图片|做封面)/.test(normalized)) {
    return "海报/封面";
  }

  if (/(参考图|氛围图|自由创作图)/.test(normalized)) {
    return "其他";
  }

  return null;
}

function isImageGenerationIntent(input: string) {
  const normalized = input.replace(/\s+/g, "").toLowerCase();
  const mentionsImageTask =
    inferImageType(input) !== null || /((一|这|那)?张图|图片|图像|出图|生图|文生图)/.test(normalized);
  const asksToGenerate = /(帮我|请|想要|需要|生成|制作|创建|画|做|出图|给我一张|来一张)/.test(normalized);
  const modifiesPreviousImage = /(人物不变|主体不变|上一张|刚才那张|这张图|重新生成|改成|换成|继续改|继续修改)/.test(normalized);

  return normalized.includes("/imggen") || normalized.includes("/对话文生图") || normalized.includes("已上传图片") || (mentionsImageTask && asksToGenerate) || modifiesPreviousImage;
}

function isImageConfirmation(input: string) {
  return /^(确认|可以|没问题|开始生成|开始|生成|就这样|按这个来|ok|OK)\s*[。！!？?]*$/.test(input.trim());
}

function buildImageTypeQuestion() {
  return "你想生成的是角色图、场景图、道具图、分镜关键帧、海报，还是其他图片？可以直接说用途和画面要求。";
}

function extractImageStyle(input: string, imageType: string) {
  if (/古风真人|武侠真人|古装真人/.test(input)) return "古风真人";
  if (/现代都市真人|都市真人|现代真人/.test(input)) return "现代都市真人";
  if (/3D动漫|3d动漫|三维动漫|3D/.test(input)) return "3D动漫";
  if (/欧美真人|欧美写实/.test(input)) return "欧美真人";
  if (/水墨/.test(input)) return "水墨风";
  if (/写实/.test(input)) return "真人写实";
  if (/动漫|二次元/.test(input)) return "动漫风";
  if (imageType === "角色图" || imageType === "当前分镜首帧") return "现代都市真人";
  return "真人写实";
}

function extractImageRatio(input: string, imageType: string) {
  const ratio = input.match(/(?:9:16|16:9|4:3|3:4|2:3|3:2|21:9)/)?.[0];
  if (ratio) return ratio;
  return getDefaultImageRatio(imageType);
}

function extractComposition(input: string, imageType: string) {
  if (/全身|单人全身/.test(input)) return "单人全身";
  if (/头肩|半身/.test(input)) return "头肩特写";
  if (/多视图|正侧背/.test(input)) return "正侧背多视图";
  if (/特写/.test(input)) return "特写";
  if (/近景/.test(input)) return "近景";
  if (/中景/.test(input)) return "中景";
  if (/远景|拉远/.test(input)) return "远景";
  if (imageType === "角色图") return "全身角色设定图";
  if (imageType === "道具图") return "道具主体居中展示";
  if (imageType === "海报/封面") return "主视觉居中，标题区域预留";
  return "中景";
}

function extractImageAngle(input: string) {
  if (/俯视|鸟瞰/.test(input)) return "俯视";
  if (/仰视/.test(input)) return "仰视";
  if (/侧脸|侧面/.test(input)) return "侧面视角";
  return "平视";
}

function extractImageModel(input: string, imageType: string) {
  if (/九极2|GPT\s*Image\s*2/i.test(input)) return "九极2";
  if (/九蕉2|Nano\s*Banana(?!\s*Pro)/i.test(input)) return "九蕉2";
  if (/九蕉pro|九蕉Pro|Nano\s*Banana\s*Pro/i.test(input)) return "九蕉pro";
  if (/九梦5\.?0|Seedream\s*5\.?0/i.test(input)) return "九梦5.0 Pro";
  if (imageType === "角色图" || imageType === "道具图") return "九极2";
  return "九梦5.0 Pro";
}

function extractImageCount(input: string) {
  const digitMatch = input.match(/(\d+)\s*张/);
  if (digitMatch?.[1]) return Math.max(1, Math.min(6, Number(digitMatch[1])));
  if (/两张|2张/.test(input)) return 2;
  if (/三张|3张/.test(input)) return 3;
  if (/四张|4张/.test(input)) return 4;
  return 1;
}

function buildReferenceLabel(hasAttachment: boolean, input: string) {
  if (hasAttachment) return "使用上传图片作为参考";
  if (/参考图|参考图片|参考/.test(input)) return "使用对话中提到的参考内容";
  return "无";
}

function normalizeImageTypeLabel(imageType: string) {
  if (imageType === "当前分镜首帧") return "分镜关键帧";
  if (imageType === "海报/封面") return "海报";
  return imageType.replace("图", "");
}

function buildImagePrompt(config: Omit<ImageGenerationConfig, "prompt">, details: string) {
  const cleanedDetails = details.replace(/^\/(imggen|对话文生图)\s*/i, "").trim();
  const subject = cleanedDetails || buildImageDescription(config.imageType);

  return [
    subject,
    `${config.style}风格`,
    `${config.composition}构图`,
    `${config.angle}视角`,
    `画幅比例${config.ratio}`,
    "高质量细节，画面干净，适合作为剧梦项目图片资产",
  ].join("，");
}

function buildImageConfig(
  input: string,
  imageType: string,
  hasAttachment: boolean,
  previousConfig?: ImageGenerationConfig
): ImageGenerationConfig {
  const mergedInput = [previousConfig?.prompt, input].filter(Boolean).join("；");
  const base = {
    imageType,
    style: extractImageStyle(mergedInput, imageType),
    ratio: extractImageRatio(mergedInput, imageType),
    composition: extractComposition(mergedInput, imageType),
    angle: extractImageAngle(mergedInput),
    imageModel: extractImageModel(mergedInput, imageType),
    count: extractImageCount(input),
    references: buildReferenceLabel(hasAttachment, mergedInput),
  };

  return {
    ...base,
    prompt: buildImagePrompt(base, mergedInput),
  };
}

function buildImageConfirmationText(config: ImageGenerationConfig) {
  return [
    `当前理解你希望生成一张${normalizeImageTypeLabel(config.imageType)}：`,
    `- 风格：${config.style}`,
    `- 画幅：${config.ratio}`,
    `- 构图/视角：${config.composition} / ${config.angle}`,
    `- 模型：${config.imageModel}`,
    `- 生成张数：${config.count} 张`,
    `- 参考内容：${config.references}`,
    "",
    "Prompt：",
    config.prompt,
    "",
    "请确认是否符合你的要求。你回复“确认”后，我将开始生成；如果需要调整，也可以直接告诉我修改点。",
  ].join("\n");
}

const imageAssetPrefixes: Record<string, string> = {
  角色图: "character",
  场景图: "scene",
  道具图: "prop",
  当前分镜首帧: "storyboard_first_frame",
  "海报/封面": "poster",
  其他: "generated_image",
};

function getGeneratedAssetSamples(imageType: string) {
  const matchingKind =
    imageType === "角色图"
      ? "角色"
      : imageType === "场景图" || imageType === "当前分镜首帧" || imageType === "海报/封面"
        ? "场景"
        : imageType === "道具图"
          ? "道具"
          : null;
  const allAssetsWithImages = mockAssets.filter((item) => item.imageUrl);
  const preferredAssets = matchingKind
    ? allAssetsWithImages.filter((item) => item.kind === matchingKind)
    : allAssetsWithImages;
  const sourceAssets = preferredAssets.length > 0 ? preferredAssets : allAssetsWithImages;
  const prefix = imageAssetPrefixes[imageType] ?? imageAssetPrefixes.其他;

  return Array.from({ length: 4 }, (_, index) => {
    const source = sourceAssets[index % sourceAssets.length];

    return {
      id: `${prefix}-${index + 1}`,
      imageUrl: source?.imageUrl,
      name: `${prefix}_${String(index + 1).padStart(2, "0")}.png`,
    };
  });
}

function getAssetKindForImageType(imageType: string): AssetKind {
  if (imageType === "角色图") {
    return "角色";
  }

  if (imageType === "场景图" || imageType === "当前分镜首帧" || imageType === "海报/封面") {
    return "场景";
  }

  if (imageType === "道具图") {
    return "道具";
  }

  return "场景";
}

function getDefaultImageRatio(imageType: string) {
  if (imageType === "角色图" || imageType === "道具图") {
    return "3:4";
  }

  if (imageType === "海报/封面") {
    return "9:16";
  }

  return "16:9";
}

function getDefaultImageModel() {
  return "九梦5.0 Pro";
}

function getImageTargetLabel(imageType: string) {
  if (imageType === "角色图") {
    return "@鲁四凤";
  }

  if (imageType === "场景图") {
    return "@周公馆客厅";
  }

  if (imageType === "道具图") {
    return "@手机";
  }

  if (imageType === "当前分镜首帧") {
    return "@分镜 1";
  }

  return "项目素材库";
}

function getImageBindingLabels(imageType: string) {
  if (imageType === "角色图") {
    return ["@鲁四凤"];
  }

  if (imageType === "场景图") {
    return ["@周公馆客厅"];
  }

  if (imageType === "道具图") {
    return ["@手机"];
  }

  if (imageType === "当前分镜首帧") {
    return ["@分镜 1", "@鲁四凤", "@周公馆客厅"];
  }

  return [];
}

function buildImageDescription(imageType: string, details?: string) {
  const cleanedDetails = details?.replace(/^\/(imggen|对话文生图)\s*/i, "").trim();

  if (cleanedDetails) {
    return cleanedDetails.length > 72 ? `${cleanedDetails.slice(0, 72)}...` : cleanedDetails;
  }

  if (imageType === "当前分镜首帧") {
    return "周公馆客厅内的压抑光线、人物动作和当前分镜节拍融合为首帧参考图。";
  }

  if (imageType === "角色图") {
    return "结合角色身份、服饰和项目写实风格生成稳定角色参考。";
  }

  if (imageType === "场景图") {
    return "结合时代空间、光影氛围和项目视觉基调生成场景参考。";
  }

  if (imageType === "道具图") {
    return "突出关键道具的材质、形态和剧情识别度。";
  }

  return "根据本轮对话生成可保存到项目素材库的图片结果。";
}

function getImageGenerationOutcome(input: string): Exclude<ImageGenerationStatus, "generating"> | null {
  const normalized = input.replace(/\s+/g, "");

  if (normalized.includes("生成成功")) {
    return "success";
  }

  if (normalized.includes("生成失败")) {
    return "failed";
  }

  return null;
}

function MediaAssetsGenerationCard({
  status,
  imageType,
  targetLabel,
  isPersonalSaved,
  isProjectSaved,
  onPreview,
  onSavePersonal,
  onSaveProject,
  onReference,
}: {
  status: ImageGenerationStatus;
  imageType: string;
  targetLabel?: string;
  isPersonalSaved?: boolean;
  isProjectSaved?: boolean;
  onPreview: (asset: GeneratedAssetSample) => void;
  onSavePersonal: (asset: GeneratedAssetSample) => void;
  onSaveProject: (asset: GeneratedAssetSample) => void;
  onReference: (asset: GeneratedAssetSample) => void;
}) {
  const generatedAssets = getGeneratedAssetSamples(imageType);
  const primaryAsset = generatedAssets[0];
  const isGenerating = status === "generating";
  const isSuccess = status === "success";

  if (isSuccess) {
    return (
      <div data-testid={`image-generation-${status}`} className="space-y-3">
        <div className="inline-flex max-w-[88%] rounded-2xl border border-[#d7ddea] bg-white px-4 py-3 text-sm leading-6 text-[#344158] shadow-[0_10px_28px_rgba(74,85,120,.08)]">
          生成成功，图片如下。
        </div>

        <div className="space-y-3">
          <div>
            {primaryAsset ? (
              <button
                type="button"
                data-testid={`generated-asset-${primaryAsset.id}`}
                onClick={() => onPreview(primaryAsset)}
                className="h-[132px] w-[116px] overflow-hidden rounded-[16px] border border-[#dce3ef] bg-[#f2f4f8] transition hover:border-[#8b95ff] focus-visible:border-[#8b95ff] focus-visible:outline-none"
                aria-label={`预览 ${primaryAsset.name}`}
              >
                {primaryAsset.imageUrl ? (
                  <img
                    src={primaryAsset.imageUrl}
                    alt={`${imageType}生成结果`}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {primaryAsset ? (
              <>
                <button
                  type="button"
                  onClick={() => onSavePersonal(primaryAsset)}
                  disabled={isPersonalSaved}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition disabled:cursor-not-allowed",
                    isPersonalSaved
                      ? "border-[#bfe3ce] bg-[#edf9f2] text-[#37885d]"
                      : "border-[#cfd7e6] bg-[#f7f9fd] text-[#4f5d76] hover:border-[#8b95ff] hover:bg-white"
                  )}
                >
                  {isPersonalSaved ? <Check className="h-3.5 w-3.5" /> : <FolderPlus className="h-3.5 w-3.5" />}
                  {isPersonalSaved ? "已存个人资产库" : "保存到个人资产库"}
                </button>
                <button
                  type="button"
                  onClick={() => onSaveProject(primaryAsset)}
                  disabled={isProjectSaved}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition disabled:cursor-not-allowed",
                    isProjectSaved
                      ? "border-[#bfe3ce] bg-[#edf9f2] text-[#37885d]"
                      : "border-[#cfd7e6] bg-[#f7f9fd] text-[#4f5d76] hover:border-[#8b95ff] hover:bg-white"
                  )}
                >
                  {isProjectSaved ? <Check className="h-3.5 w-3.5" /> : <FolderPlus className="h-3.5 w-3.5" />}
                  {isProjectSaved ? "已存项目库" : "保存到项目库"}
                </button>
                <button
                  type="button"
                  onClick={() => onReference(primaryAsset)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[linear-gradient(100deg,#7658dc,#e75c98)] px-3.5 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(123,97,255,.2)] transition hover:brightness-105"
                >
                  <Check className="h-3.5 w-3.5" />
                  引用
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`image-generation-${status}`}
      className={cn(
        "w-full overflow-hidden rounded-[22px] border bg-white shadow-[0_16px_38px_rgba(55,67,101,.12)]",
        isGenerating
          ? "border-[#d8dff0]"
          : isSuccess
            ? "border-[#cfe8db]"
            : "border-[#f2ccd7]"
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-[#edf0f6] bg-[linear-gradient(112deg,#f8fbff,#f7f3ff_58%,#fff7fa)] px-4 py-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-[#edf4ff] text-[#5483cc]">
          <ImagePlus className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold tracking-[0.01em] text-[#4976b7]">Skill · 对话文生图</span>
        <span
          className={cn(
            "text-xs font-medium",
            isGenerating ? "text-[#66738d]" : isSuccess ? "text-[#3e8b67]" : "text-[#c45675]"
          )}
        >
          {isGenerating ? "生成中" : isSuccess ? "生成完成" : "生成失败"}
        </span>
        <ChevronUp className="ml-auto h-4 w-4 text-[#8993a8]" />
      </div>

      {isGenerating ? (
        <div className="relative px-5 py-5 pl-12">
          <span className="absolute left-5 top-5 grid h-6 w-6 place-items-center rounded-full border border-[#bcc6d8] bg-[#f8faff]">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#7b61ff]" />
          </span>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#e16076]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d4ab43] [animation-delay:140ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#67bd79] [animation-delay:280ms]" />
            </span>
            <span className="text-sm font-semibold text-[#2f3b54]">Agent 分析中</span>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-[#818ba0]">
            正在为{targetLabel ?? "当前项目"}生成{imageType}，会保留结果预览，确认后再写入页面。
          </p>
        </div>
      ) : isSuccess ? (
        <div className="space-y-3 px-4 py-4">
          <div>
            {primaryAsset ? (
              <button
                type="button"
                data-testid={`generated-asset-${primaryAsset.id}`}
                onClick={() => onPreview(primaryAsset)}
                className="h-[132px] w-[116px] overflow-hidden rounded-[16px] border border-[#dce3ef] bg-[#f2f4f8] transition hover:border-[#8b95ff] focus-visible:border-[#8b95ff] focus-visible:outline-none"
                aria-label={`预览 ${primaryAsset.name}`}
              >
                {primaryAsset.imageUrl ? (
                  <img
                    src={primaryAsset.imageUrl}
                    alt={`${imageType}生成结果`}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {primaryAsset ? (
              <>
                <button
                  type="button"
                  onClick={() => onSavePersonal(primaryAsset)}
                  disabled={isPersonalSaved}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition disabled:cursor-not-allowed",
                    isPersonalSaved
                      ? "border-[#bfe3ce] bg-[#edf9f2] text-[#37885d]"
                      : "border-[#cfd7e6] bg-[#f7f9fd] text-[#4f5d76] hover:border-[#8b95ff] hover:bg-white"
                  )}
                >
                  {isPersonalSaved ? <Check className="h-3.5 w-3.5" /> : <FolderPlus className="h-3.5 w-3.5" />}
                  {isPersonalSaved ? "已存个人资产库" : "保存到个人资产库"}
                </button>
                <button
                  type="button"
                  onClick={() => onSaveProject(primaryAsset)}
                  disabled={isProjectSaved}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition disabled:cursor-not-allowed",
                    isProjectSaved
                      ? "border-[#bfe3ce] bg-[#edf9f2] text-[#37885d]"
                      : "border-[#cfd7e6] bg-[#f7f9fd] text-[#4f5d76] hover:border-[#8b95ff] hover:bg-white"
                  )}
                >
                  {isProjectSaved ? <Check className="h-3.5 w-3.5" /> : <FolderPlus className="h-3.5 w-3.5" />}
                  {isProjectSaved ? "已存项目库" : "保存到项目库"}
                </button>
                <button
                  type="button"
                  onClick={() => onReference(primaryAsset)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[linear-gradient(100deg,#7658dc,#e75c98)] px-3.5 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(123,97,255,.2)] transition hover:brightness-105"
                >
                  <Check className="h-3.5 w-3.5" />
                  引用
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="relative px-5 py-5 pl-12">
          <span className="absolute left-5 top-5 grid h-6 w-6 place-items-center rounded-full border border-[#efbac8] bg-[#fff1f5] text-[#d9587d]">
            <AlertCircle className="h-4 w-4" />
          </span>
          <div className="text-sm font-semibold text-[#a84463]">图片生成失败</div>
          <p className="mt-1.5 text-xs leading-5 text-[#a96f82]">
            本次生成未完成，请检查描述或模型设置后重新尝试。
          </p>
        </div>
      )}
    </div>
  );
}

function ImageWriteConfirmationCard({
  status,
  action,
  targetLabel,
  assetName,
  onConfirm,
}: {
  status: "pending" | "applied";
  action: string;
  targetLabel?: string;
  assetName?: string;
  onConfirm: () => void;
}) {
  const isApplied = status === "applied";

  return (
    <div
      data-testid={`image-write-confirmation-${status}`}
      className="w-full overflow-hidden rounded-[22px] border border-[#d9dfee] bg-white shadow-[0_16px_38px_rgba(55,67,101,.12)]"
    >
      <div className="flex items-center gap-3 border-b border-[#edf0f6] bg-[#fbfcff] px-4 py-3.5">
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-[13px]",
            isApplied ? "bg-[#edf9f2] text-[#37885d]" : "bg-[#fff7df] text-[#ad7708]"
          )}
        >
          {isApplied ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#293551]">
            {isApplied ? "已完成写入" : "确认写入页面"}
          </div>
          <div className="mt-0.5 text-xs text-[#7b8497]">
            {isApplied ? `${assetName ?? "生成图片"} 已应用到 ${targetLabel ?? "目标位置"}` : `${action} · ${targetLabel ?? "目标位置"}`}
          </div>
        </div>
      </div>

      {!isApplied ? (
        <div className="px-4 py-4">
          <p className="text-xs leading-5 text-[#6f7b92]">
            这一步会把本次生成图片写入对应对象；确认前不会覆盖页面已有图片，旧版本会保留用于回退。
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[linear-gradient(100deg,#7658dc,#e75c98)] px-4 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(123,97,255,.2)] transition hover:brightness-105"
            >
              <Check className="h-3.5 w-3.5" />
              确认写入
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const initialMessages: ChatMessage[] = [
  {
    id: "msg-initial",
    role: "assistant",
    modelId: "gpt-4.1",
    content:
      "嗨，我是剧小梦，你的漫剧创作搭档。创作过程中有任何卡点，都可以告诉我，剧本逻辑、分镜设计、图片提示词，都可以和我讨论哦！",
    createdAt: Date.now(),
  },
];

const initialHistorySessions: ChatSession[] = [
  {
    id: "history-1",
    title: "帮我梳理这段剧情从压抑到爆发的情绪节奏",
    preview: "围绕高潮前压抑、爆发、余波三个阶段梳理情绪起伏。",
    updatedAt: Date.now() - 1000 * 60 * 25,
    modelId: "claude-3.7",
    messages: [
      initialMessages[0],
      {
        id: "history-1-user",
        role: "user",
        content: "帮我梳理这段剧情的情绪起伏",
        createdAt: Date.now() - 1000 * 60 * 26,
      },
      {
        id: "history-1-assistant",
        role: "assistant",
        modelId: "claude-3.7",
        content:
          "可以先按铺垫压抑、冲突升级、情绪爆发、余韵回落这四段来拆，这样更容易定位每个分镜的情绪抓手。",
        createdAt: Date.now() - 1000 * 60 * 25,
      },
    ],
  },
  {
    id: "history-2",
    title: "这场关键对白还能怎么改得更有情绪张力",
    preview: "把对白从解释信息改成带情绪和潜台词的对抗。",
    updatedAt: Date.now() - 1000 * 60 * 80,
    modelId: "gpt-4.1",
    messages: [
      initialMessages[0],
      {
        id: "history-2-user",
        role: "user",
        content: "这场对白还可以怎么改得更有张力",
        createdAt: Date.now() - 1000 * 60 * 81,
      },
      {
        id: "history-2-assistant",
        role: "assistant",
        modelId: "gpt-4.1",
        content:
          "建议减少直接解释，把重点改成试探、反问和打断，让对白像攻防而不是复述信息。",
        createdAt: Date.now() - 1000 * 60 * 80,
      },
    ],
  },
];

function getModelMeta(modelId: ModelId) {
  return modelOptions.find((item) => item.id === modelId) ?? modelOptions[0];
}

function buildAgentReply(input: string, modelId: ModelId, history: ChatMessage[]) {
  const model = getModelMeta(modelId);
  const recentContext = history
    .filter((item) => item.role === "user")
    .slice(-2)
    .map((item) => item.content.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let focus = "我可以继续帮你细化界面结构、补交互，或者把需求拆成可执行的小步骤。";

  if (input.includes("布局") || input.includes("左侧") || input.includes("右侧")) {
    focus = "这轮更像是布局调整，我建议先明确面板位置、悬浮层级和是否遮挡主编辑区，再继续落样式。";
  } else if (input.includes("角色") || input.includes("场景") || input.includes("道具")) {
    focus = "这轮更偏素材面板，我建议同步定义筛选、选中态和素材卡片的层级信息，这样后续交互会更稳定。";
  } else if (input.includes("分镜") || input.includes("脚本") || input.includes("时间轴")) {
    focus = "这轮更偏编辑器主流程，我建议把分镜区、预览区和时间轴之间的联动状态一起梳理。";
  } else if (input.includes("按钮") || input.includes("交互") || input.includes("悬浮")) {
    focus = "这轮更偏交互体验，我会优先关注可见状态、收起展开、反馈提示和连续操作的顺手程度。";
  }

  const styleLead: Record<ModelId, string> = {
    "gpt-4.1": "我先给你一个稳妥的处理思路。",
    "claude-3.7": "我先把这件事拆得更清楚一点。",
    "deepseek-r1": "我先沿着你的目标做一步步推演。",
    "gemini-2.5": "我先给你几个可以马上推进的方向。",
  };

  return [
    styleLead[modelId],
    focus,
    recentContext.length > 0
      ? `我会继续记住这段对话的上下文：${recentContext.join(" / ")}。`
      : "我会继续记住这段对话的上下文。",
    `当前使用模型：${model.label}，风格上会${model.hint}。`,
  ].join("\n\n");
}

export default function AgentChatWidget() {
  const [isOpen, setIsOpen] = useState(true);
  const [dockSide, setDockSide] = useState<DockSide>("right");
  const [panelWidth, setPanelWidth] = useState(500);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSkillMenuOpen, setIsSkillMenuOpen] = useState(false);
  const [quickPhraseAnchor, setQuickPhraseAnchor] = useState<QuickPhraseAnchor | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>("gpt-4.1");
  const [draft, setDraft] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillCommand | null>(null);
  const [composerAttachment, setComposerAttachment] = useState<ComposerAttachment | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>(initialHistorySessions);
  const [imageClarification, setImageClarification] = useState<ImageClarificationState | null>(null);
  const [previewAsset, setPreviewAsset] = useState<PreviewAsset | null>(null);
  const [personalAssetIds, setPersonalAssetIds] = useState<Set<string>>(() => new Set());
  const [savedAssetIds, setSavedAssetIds] = useState<Set<string>>(() => new Set());
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, FeedbackType>>({});
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const compactQuickPhraseRef = useRef<HTMLDivElement | null>(null);
  const expandedQuickPhraseRef = useRef<HTMLDivElement | null>(null);
  const attachmentUrlsRef = useRef<string[]>([]);
  const replyTimerRef = useRef<number | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const addAsset = useEditorStore((state) => state.actions.addAsset);

  const activeModel = useMemo(() => getModelMeta(selectedModel), [selectedModel]);
  const isRightDock = dockSide === "right";
  const hasUserSentMessage = messages.some((message) => message.role === "user");
  const hasGeneratingMessage = messages.some((message) => message.status === "generating");
  const isReplyActive = isThinking || isStreaming || hasGeneratingMessage;
  const currentSession =
    hasUserSentMessage
      ? {
          id: "current-session",
          title: "当前对话",
          preview: messages.find((message) => message.role === "user")?.content ?? "继续当前创作讨论",
          updatedAt: messages[messages.length - 1]?.createdAt ?? Date.now(),
          modelId: selectedModel,
          messages,
        }
      : null;
  const visibleHistorySessions = currentSession ? [currentSession, ...historySessions] : historySessions;

  useEffect(() => {
    if (!scrollerRef.current) {
      return;
    }

    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, isThinking]);

  useEffect(() => {
    if (!quickPhraseAnchor) {
      return;
    }

    const activeRef = quickPhraseAnchor === "compact" ? compactQuickPhraseRef : expandedQuickPhraseRef;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!activeRef.current?.contains(event.target as Node)) {
        setQuickPhraseAnchor(null);
      }
    };

    window.addEventListener("pointerdown", closeOnOutsideClick);
    return () => window.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [quickPhraseAnchor]);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current !== null) {
        window.clearTimeout(replyTimerRef.current);
      }
      if (streamTimerRef.current !== null) {
        window.clearInterval(streamTimerRef.current);
      }
      attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      attachmentUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!previewAsset) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewAsset(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [previewAsset]);

  useEffect(() => {
    const clampPanelWidth = () => {
      const maxWidth = Math.max(420, Math.min(720, window.innerWidth - 220));
      setPanelWidth((current) => Math.min(Math.max(current, 420), maxWidth));
    };

    clampPanelWidth();
    window.addEventListener("resize", clampPanelWidth);

    return () => {
      window.removeEventListener("resize", clampPanelWidth);
    };
  }, []);

  const stopReplyGeneration = () => {
    if (replyTimerRef.current !== null) {
      window.clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }

    if (streamTimerRef.current !== null) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    setIsThinking(false);
    setIsStreaming(false);
  };

  const buildImageGenerationMessage = (
    imageType: string,
    details: string,
    id = `msg-image-generation-${Date.now()}`,
    config?: ImageGenerationConfig
  ): ChatMessage => ({
    id,
    role: "assistant",
    kind: "image-generation-skill",
    content: `正在生成${imageType}`,
    createdAt: Date.now(),
    modelId: selectedModel,
    imageGenerationStatus: "generating",
    imageGenerationType: imageType,
    imageTargetLabel: getImageTargetLabel(imageType),
    imageDescription: buildImageDescription(imageType, details),
    imageBindings: getImageBindingLabels(imageType),
    imageRatio: config?.ratio ?? getDefaultImageRatio(imageType),
    imageModel: config?.imageModel ?? getDefaultImageModel(),
    imagePrompt: config?.prompt,
    imageStyle: config?.style,
    imageComposition: config?.composition,
    imageAngle: config?.angle,
    imageCount: config?.count,
    imageReferences: config?.references,
  });

  const submitMessage = (rawText?: string) => {
    const attachment = composerAttachment;
    const baseText = (rawText ?? draft).trim();
    const text =
      [selectedSkill?.command, baseText].filter(Boolean).join(" ").trim() ||
      (attachment ? "已上传图片" : "");

    if (!text || isReplyActive) {
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        id: `msg-user-${Date.now()}`,
        role: "user",
        content: text,
        createdAt: Date.now(),
        attachment: attachment ?? undefined,
      },
    ];

    stopReplyGeneration();
    setMessages(nextMessages);
    setDraft("");
    setSelectedSkill(null);
    setComposerAttachment(null);
    if (imageUploadRef.current) {
      imageUploadRef.current.value = "";
    }
    setIsStreaming(false);
    setIsHistoryOpen(false);
    setIsSkillMenuOpen(false);

    if (imageClarification?.step === "generating") {
      const outcome = getImageGenerationOutcome(text);

      if (outcome) {
        const activeGenerationMessage = [...nextMessages]
          .reverse()
          .find(
            (message) =>
              message.kind === "image-generation-skill" &&
              message.imageGenerationStatus === "generating"
          );

        setMessages([
          ...nextMessages.filter((message) => message.id !== activeGenerationMessage?.id),
          {
            id: activeGenerationMessage?.id ?? `msg-image-generation-${Date.now()}`,
            role: "assistant",
            kind: "image-generation-skill",
            content: outcome === "success" ? "图片生成完成" : "图片生成失败",
            createdAt: Date.now(),
            modelId: selectedModel,
            imageGenerationStatus: outcome,
            imageGenerationType:
              activeGenerationMessage?.imageGenerationType ??
              imageClarification.imageType ??
              "图片",
            imageTargetLabel:
              activeGenerationMessage?.imageTargetLabel ??
              getImageTargetLabel(imageClarification.imageType ?? "其他"),
            imageDescription:
              activeGenerationMessage?.imageDescription ??
              buildImageDescription(imageClarification.imageType ?? "其他", imageClarification.naturalDetails),
            imageBindings:
              activeGenerationMessage?.imageBindings ??
              getImageBindingLabels(imageClarification.imageType ?? "其他"),
            imageRatio:
              activeGenerationMessage?.imageRatio ??
              getDefaultImageRatio(imageClarification.imageType ?? "其他"),
            imageModel: activeGenerationMessage?.imageModel ?? getDefaultImageModel(),
            imagePrompt: activeGenerationMessage?.imagePrompt ?? imageClarification.config?.prompt,
            imageStyle: activeGenerationMessage?.imageStyle ?? imageClarification.config?.style,
            imageComposition: activeGenerationMessage?.imageComposition ?? imageClarification.config?.composition,
            imageAngle: activeGenerationMessage?.imageAngle ?? imageClarification.config?.angle,
            imageCount: activeGenerationMessage?.imageCount ?? imageClarification.config?.count,
            imageReferences: activeGenerationMessage?.imageReferences ?? imageClarification.config?.references,
          },
        ]);
        setImageClarification(null);
        setIsThinking(false);
        return;
      }
    }

    if (imageClarification?.step === "confirming") {
      const imageType = imageClarification.imageType ?? "其他";

      if (isImageConfirmation(text)) {
        const config =
          imageClarification.config ??
          buildImageConfig(imageClarification.naturalDetails ?? "", imageType, Boolean(attachment));

        setMessages([
          ...nextMessages,
          buildImageGenerationMessage(imageType, imageClarification.naturalDetails ?? text, undefined, config),
        ]);
        setImageClarification({
          step: "generating",
          imageType,
          naturalDetails: imageClarification.naturalDetails,
          config,
        });
        setIsThinking(false);
        return;
      }

      const revisedDetails = [imageClarification.naturalDetails, text].filter(Boolean).join("；修改要求：");
      const revisedConfig = buildImageConfig(revisedDetails, imageType, Boolean(attachment), imageClarification.config);

      setMessages([
        ...nextMessages,
        {
          id: `msg-image-confirm-${Date.now()}`,
          role: "assistant",
          content: buildImageConfirmationText(revisedConfig),
          createdAt: Date.now(),
          modelId: selectedModel,
        },
      ]);
      setImageClarification({
        step: "confirming",
        imageType,
        naturalDetails: revisedDetails,
        config: revisedConfig,
      });
      setIsThinking(false);
      return;
    }

    if (imageClarification?.step === "collecting") {
      const imageType = inferImageType(text) ?? imageClarification.imageType;

      if (!imageType) {
        setMessages([
          ...nextMessages,
          {
            id: `msg-image-type-question-${Date.now()}`,
            role: "assistant",
            content: buildImageTypeQuestion(),
            createdAt: Date.now(),
            modelId: selectedModel,
          },
        ]);
        setIsThinking(false);
        return;
      }

      const details = [imageClarification.naturalDetails, text].filter(Boolean).join("；");
      const config = buildImageConfig(details, imageType, Boolean(attachment));

      setMessages([
        ...nextMessages,
        {
          id: `msg-image-confirm-${Date.now()}`,
          role: "assistant",
          content: buildImageConfirmationText(config),
          createdAt: Date.now(),
          modelId: selectedModel,
        },
      ]);
      setImageClarification({
        step: "confirming",
        imageType,
        naturalDetails: details,
        config,
      });
      setIsThinking(false);
      return;
    }

    if (isImageGenerationIntent(text)) {
      const previousImageResult = [...messages]
        .reverse()
        .find(
          (message) =>
            message.kind === "image-generation-skill" &&
            message.imageGenerationStatus === "success" &&
            message.imageGenerationType
        );
      const inferredImageType = inferImageType(text) ?? previousImageResult?.imageGenerationType ?? null;

      if (!inferredImageType) {
        setMessages([
          ...nextMessages,
          {
            id: `msg-image-type-question-${Date.now()}`,
            role: "assistant",
            content: buildImageTypeQuestion(),
            createdAt: Date.now(),
            modelId: selectedModel,
          },
        ]);
        setImageClarification({
          step: "collecting",
          naturalDetails: text,
        });
        setIsThinking(false);
        return;
      }

      const previousConfig =
        previousImageResult && previousImageResult.imageGenerationType === inferredImageType
          ? {
              imageType: previousImageResult.imageGenerationType,
              style: previousImageResult.imageStyle ?? extractImageStyle("", inferredImageType),
              ratio: previousImageResult.imageRatio ?? getDefaultImageRatio(inferredImageType),
              composition: previousImageResult.imageComposition ?? extractComposition("", inferredImageType),
              angle: previousImageResult.imageAngle ?? "平视",
              imageModel: previousImageResult.imageModel ?? getDefaultImageModel(),
              count: 1,
              references: previousImageResult.imageReferences ?? "上一张生成结果",
              prompt: previousImageResult.imagePrompt ?? previousImageResult.imageDescription ?? "",
            }
          : undefined;
      const config = buildImageConfig(text, inferredImageType, Boolean(attachment), previousConfig);

      setMessages([
        ...nextMessages,
        {
          id: `msg-image-confirm-${Date.now()}`,
          role: "assistant",
          content: buildImageConfirmationText(config),
          createdAt: Date.now(),
          modelId: selectedModel,
        },
      ]);
      setImageClarification({
        step: "confirming",
        imageType: inferredImageType,
        naturalDetails: text,
        config,
      });
      setIsThinking(false);
      return;
    }

    setIsThinking(true);

    replyTimerRef.current = window.setTimeout(() => {
      const shouldFail = text.includes("生成失败");
      const shouldShowGenerating = text.includes("生成中");

      if (shouldFail) {
        setMessages([
          ...nextMessages,
          {
            id: `msg-assistant-failed-${Date.now()}`,
            role: "assistant",
            content: "本次内容生成失败，请检查描述后重试，或直接重新生成。",
            createdAt: Date.now(),
            modelId: selectedModel,
            status: "failed",
            requestText: text,
          },
        ]);
        setIsThinking(false);
        replyTimerRef.current = null;
        return;
      }

      if (shouldShowGenerating) {
        setMessages([
          ...nextMessages,
          {
            id: `msg-assistant-generating-${Date.now()}`,
            role: "assistant",
            content: generatingPreviewContent,
            createdAt: Date.now(),
            modelId: selectedModel,
            status: "generating",
            requestText: text,
          },
        ]);
        setIsThinking(false);
        replyTimerRef.current = null;
        return;
      }

      const fullReply = buildAgentReply(text, selectedModel, nextMessages);
      const assistantMessageId = `msg-assistant-${Date.now()}`;
      const chunkSize = 3;
      let cursor = 0;

      setMessages([
        ...nextMessages,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
          modelId: selectedModel,
        },
      ]);
      setIsThinking(false);
      setIsStreaming(true);
      replyTimerRef.current = null;

      streamTimerRef.current = window.setInterval(() => {
        cursor = Math.min(cursor + chunkSize, fullReply.length);
        const partialReply = fullReply.slice(0, cursor);

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId ? { ...message, content: partialReply } : message
          )
        );

        if (cursor >= fullReply.length) {
          if (streamTimerRef.current !== null) {
            window.clearInterval(streamTimerRef.current);
            streamTimerRef.current = null;
          }
          setIsStreaming(false);
        }
      }, 26);
    }, 480);
  };

  const retryFailedGeneration = (requestText?: string) => {
    if (!requestText || isReplyActive) {
      return;
    }

    setMessages((current) => current.filter((message) => message.requestText !== requestText || message.status !== "failed"));
    setDraft(requestText);

    window.setTimeout(() => {
      submitMessage(requestText);
    }, 0);
  };

  const interruptGeneration = () => {
    stopReplyGeneration();
    setMessages((current) =>
      current.map((message) =>
        message.status === "generating" ? { ...message, status: undefined } : message
      )
    );
  };

  const removeComposerAttachment = () => {
    if (composerAttachment) {
      URL.revokeObjectURL(composerAttachment.url);
      attachmentUrlsRef.current = attachmentUrlsRef.current.filter(
        (url) => url !== composerAttachment.url
      );
    }

    setComposerAttachment(null);

    if (imageUploadRef.current) {
      imageUploadRef.current.value = "";
    }
  };

  const handleImageUpload = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (composerAttachment) {
      URL.revokeObjectURL(composerAttachment.url);
      attachmentUrlsRef.current = attachmentUrlsRef.current.filter(
        (url) => url !== composerAttachment.url
      );
    }

    const imageUrl = URL.createObjectURL(file);
    attachmentUrlsRef.current.push(imageUrl);
    setComposerAttachment({
      name: file.name,
      url: imageUrl,
    });
  };

  const startNewConversation = () => {
    stopReplyGeneration();

    if (hasUserSentMessage) {
      const summaryMessage = messages.find((message) => message.role === "user")?.content ?? "新的创作讨论";

      setHistorySessions((current) => [
        {
          id: `history-${Date.now()}`,
          title: summaryMessage.slice(0, 14) || "未命名对话",
          preview: summaryMessage,
          updatedAt: Date.now(),
          modelId: selectedModel,
          messages,
        },
        ...current.filter((item) => item.id !== "current-session").slice(0, 7),
      ]);
    }

    setMessages(initialMessages);
    setImageClarification(null);
    setDraft("");
    setSelectedSkill(null);
    removeComposerAttachment();
    setIsComposerExpanded(false);
    setIsHistoryOpen(false);
    setIsSkillMenuOpen(false);
  };

  const openHistorySession = (session: ChatSession) => {
    stopReplyGeneration();

    setMessages(session.messages);
    setImageClarification(null);
    setSelectedModel(session.modelId);
    setDraft("");
    setSelectedSkill(null);
    removeComposerAttachment();
    setIsComposerExpanded(false);
    setIsHistoryOpen(false);
    setIsSkillMenuOpen(false);
  };

  const setFeedback = (messageId: string, feedback: FeedbackType) => {
    setMessageFeedback((current) => ({
      ...current,
      [messageId]: feedback,
    }));
  };

  const handleDraftChange = (value: string) => {
    const lastLine = value.split("\n").at(-1)?.trimStart() ?? "";
    const isSlashQuery = /^\/[^\s]*$/.test(lastLine);

    setDraft(value);
    setIsSkillMenuOpen(isSlashQuery);
    if (isSlashQuery) {
      setQuickPhraseAnchor(null);
    }
  };

  const triggerCommandInput = () => {
    setQuickPhraseAnchor(null);
    setIsSkillMenuOpen((current) => !current);

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const toggleQuickPhrase = (anchor: QuickPhraseAnchor) => {
    setIsSkillMenuOpen(false);
    setQuickPhraseAnchor((current) => (current === anchor ? null : anchor));
  };

  const applyQuickPhrase = (phrase: string) => {
    setDraft((current) => (current.trim() ? `${current.trimEnd()}\n${phrase}` : phrase));
    setQuickPhraseAnchor(null);
    setIsSkillMenuOpen(false);

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const removeSelectedSkill = () => {
    setSelectedSkill(null);

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const applySkillCommand = (skill: SkillCommand) => {
    setDraft((current) => {
      const lines = current.split("\n");
      const lastLine = lines.at(-1)?.trimStart() ?? "";

      if (/^\/[^\s]*$/.test(lastLine)) {
        lines[lines.length - 1] = "";
        return lines.join("\n").replace(/\n+$/, "");
      }

      return current;
    });
    setSelectedSkill(skill);
    setIsSkillMenuOpen(false);

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const applyPromptSquareTemplate = (template: PromptSquareTemplate) => {
    setDraft((current) => {
      const promptLead = `使用「${template.name}」模板：`;
      const lines = current.split("\n");
      const lastLine = lines.at(-1)?.trimStart() ?? "";

      if (/^\/[^\s]*$/.test(lastLine)) {
        lines[lines.length - 1] = promptLead;
        return lines.join("\n");
      }

      return current.trim() ? `${current.trimEnd()}\n${promptLead}` : promptLead;
    });
    setIsSkillMenuOpen(false);

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const downloadPreviewImage = async () => {
    if (!previewAsset?.imageUrl) {
      return;
    }

    const triggerDownload = (href: string, useDownloadAttribute: boolean) => {
      const link = document.createElement("a");
      link.href = href;
      link.rel = "noreferrer";

      if (useDownloadAttribute) {
        link.download = previewAsset.name;
      } else {
        link.target = "_blank";
      }

      document.body.appendChild(link);
      link.click();
      link.remove();
    };

    try {
      const response = await fetch(previewAsset.imageUrl);

      if (!response.ok) {
        throw new Error("Image download failed");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl, true);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      triggerDownload(previewAsset.imageUrl, false);
    }
  };

  const saveGeneratedAssetToAssets = (asset: GeneratedAssetSample, imageType: string) => {
    if (!asset.imageUrl) {
      return;
    }

    const assetId = `dialogue-image-${asset.id}`;

    addAsset({
      id: assetId,
      kind: getAssetKindForImageType(imageType),
      name: asset.name.replace(/\.[^.]+$/, ""),
      subtitle: `对话文生图 · ${imageType}`,
      count: 1,
      imageUrl: asset.imageUrl,
    });
    setSavedAssetIds((current) => new Set(current).add(asset.id));
  };

  const savePreviewToAssets = () => {
    if (!previewAsset) {
      return;
    }

    saveGeneratedAssetToAssets(previewAsset, previewAsset.imageType);
  };

  const saveGeneratedAssetToPersonalAssets = (asset: GeneratedAssetSample) => {
    if (!asset.imageUrl) {
      return;
    }

    setPersonalAssetIds((current) => new Set(current).add(asset.id));
  };

  const requestImageWrite = (sourceMessage: ChatMessage, asset: GeneratedAssetSample) => {
    const action = "引用";

    setMessages((current) => [
      ...current,
      {
        id: `msg-image-write-${Date.now()}`,
        role: "assistant",
        kind: "image-write-confirmation-skill",
        content: `${action}确认`,
        createdAt: Date.now(),
        modelId: selectedModel,
        imageTargetLabel: sourceMessage.imageTargetLabel,
        imageAssetId: asset.id,
        imageAssetName: asset.name,
        imageAssetUrl: asset.imageUrl,
        imageGenerationType: sourceMessage.imageGenerationType,
        imageWriteAction: action,
        imageWriteStatus: "pending",
      },
    ]);
  };

  const confirmImageWrite = (messageId: string) => {
    const targetMessage = messages.find((message) => message.id === messageId);

    if (targetMessage?.imageAssetId && targetMessage.imageAssetUrl) {
      saveGeneratedAssetToAssets(
        {
          id: targetMessage.imageAssetId,
          imageUrl: targetMessage.imageAssetUrl,
          name: targetMessage.imageAssetName ?? "dialogue_image.png",
        },
        targetMessage.imageGenerationType ?? "其他"
      );
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              imageWriteStatus: "applied",
              content: `已${message.imageWriteAction ?? "写入"} ${message.imageTargetLabel ?? "目标位置"}`,
            }
          : message
      )
    );
  };

  const startResize = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const minWidth = 420;
    const maxWidth = Math.max(minWidth, Math.min(720, window.innerWidth - 220));

    setIsResizing(true);

    const handlePointerMove = (moveEvent: MouseEvent) => {
      const nextWidth =
        dockSide === "right" ? window.innerWidth - moveEvent.clientX : moveEvent.clientX;

      setPanelWidth(Math.min(Math.max(nextWidth, minWidth), maxWidth));
    };

    const stopResize = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", stopResize);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", stopResize);
  };

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed top-[92px] z-[60] inline-flex h-14 items-center gap-3 rounded-[20px] border border-[#8b95ff]/30 px-3.5",
            "bg-[linear-gradient(135deg,#7b61ff,#ff4f9a)] text-white shadow-[0_18px_40px_rgba(101,73,211,.32)] backdrop-blur-xl transition hover:brightness-105",
            isRightDock ? "right-3" : "left-3"
          )}
          aria-label="打开 Agent 侧边栏"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-white/16 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)]">
            <MessageSquareMore className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-col items-start text-left">
            <span className="text-[11px] leading-none text-white/72">展开助手</span>
            <span className="mt-1 text-sm font-semibold leading-none text-white">剧小梦</span>
          </span>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/14 text-white">
            {isRightDock ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </button>
      ) : null}

      <aside
        className={cn(
          "group fixed bottom-0 top-[88px] z-50 flex min-h-0 flex-col overflow-hidden bg-[#eef2fb] transition-transform duration-300",
          isRightDock
            ? "right-0 border-l border-[#d9ddea] shadow-[-18px_0_48px_rgba(0,0,0,.16)]"
            : "left-0 border-r border-[#d9ddea] shadow-[18px_0_48px_rgba(0,0,0,.16)]",
          isOpen ? "translate-x-0" : isRightDock ? "translate-x-full" : "-translate-x-full"
        )}
        style={{ width: `${panelWidth}px` }}
      >
        <button
          type="button"
          onMouseDown={startResize}
          className={cn(
            "absolute bottom-0 top-0 z-30 w-3 cursor-col-resize transition",
            isRightDock ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2",
            isResizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          aria-label="拖拽调整 Agent 宽度"
        >
          <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-[#8b95ff]/0 transition group-hover:bg-[#8b95ff]/60" />
          <span
            className={cn(
              "absolute left-1/2 top-1/2 h-16 w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8b95ff] shadow-[0_8px_20px_rgba(123,97,255,.28)] transition",
              isResizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          />
        </button>

        <div className="relative bg-[#eef2fb] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#7b61ff] to-[#ff4f9a] text-white shadow-[0_0_24px_rgba(255,79,154,.25)]">
                  <MessageSquareMore className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-[#24314d]">剧小梦</div>
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDockSide((side) => (side === "right" ? "left" : "right"))}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#d4dced] bg-white px-3 text-xs text-[#526078] transition hover:border-[#8b95ff] hover:bg-[#f7f9ff] hover:text-[#24314d]"
                aria-label={isRightDock ? "切换到左侧悬浮" : "切换到右侧悬浮"}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {isRightDock ? "左侧" : "右侧"}
              </button>
              <button
                type="button"
                onClick={startNewConversation}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#d4dced] bg-white px-3 text-xs text-[#526078] transition hover:border-[#8b95ff] hover:bg-[#f7f9ff] hover:text-[#24314d]"
                aria-label="新建对话"
              >
                <Plus className="h-3.5 w-3.5" />
                新建
              </button>
              <button
                type="button"
                onClick={() => setIsHistoryOpen((value) => !value)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#d4dced] bg-white px-3 text-xs text-[#526078] transition hover:border-[#8b95ff] hover:bg-[#f7f9ff] hover:text-[#24314d]"
                aria-label="历史对话"
              >
                <History className="h-3.5 w-3.5" />
                历史
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#d4dced] bg-white px-3 text-xs text-[#526078] transition hover:border-[#8b95ff] hover:bg-[#f7f9ff] hover:text-[#24314d]"
                aria-label="收起对话面板"
              >
                {isRightDock ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                收起
              </button>
            </div>
          </div>

          {isHistoryOpen ? (
            <div className="absolute right-4 top-[calc(100%-4px)] z-20 w-[280px] overflow-hidden rounded-[20px] border border-[#d7ddea] bg-white shadow-[0_20px_48px_rgba(41,52,79,.18)]">
              <div className="border-b border-[#e5e9f2] px-4 py-3 text-sm font-semibold text-[#24314d]">历史对话</div>
              <div className="max-h-[320px] space-y-2 overflow-y-auto p-3">
                {visibleHistorySessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => openHistorySession(session)}
                    className="flex h-11 w-full min-w-0 items-center rounded-2xl border border-[#e2e7f0] bg-[#f9fbff] px-3 text-left transition hover:border-[#8b95ff] hover:bg-white"
                  >
                    <span className="block w-full truncate text-sm font-medium text-[#24314d]">{session.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto bg-[#eef2fb] px-4 py-4">
          {messages.map((message) => {
            if (message.kind === "image-generation-skill") {
              return (
                <div key={message.id} className="flex w-full justify-start">
                  <div className="w-full max-w-[96%]">
                    <MediaAssetsGenerationCard
                      status={message.imageGenerationStatus ?? "generating"}
                      imageType={message.imageGenerationType ?? "图片"}
                      targetLabel={message.imageTargetLabel}
                      isPersonalSaved={getGeneratedAssetSamples(message.imageGenerationType ?? "图片")[0]?.id
                        ? personalAssetIds.has(getGeneratedAssetSamples(message.imageGenerationType ?? "图片")[0].id)
                        : false}
                      isProjectSaved={getGeneratedAssetSamples(message.imageGenerationType ?? "图片")[0]?.id
                        ? savedAssetIds.has(getGeneratedAssetSamples(message.imageGenerationType ?? "图片")[0].id)
                        : false}
                      onPreview={(asset) =>
                        setPreviewAsset({
                          ...asset,
                          imageType: message.imageGenerationType ?? "图片",
                        })
                      }
                      onSavePersonal={saveGeneratedAssetToPersonalAssets}
                      onSaveProject={(asset) => saveGeneratedAssetToAssets(asset, message.imageGenerationType ?? "其他")}
                      onReference={(asset) => requestImageWrite(message, asset)}
                    />
                  </div>
                </div>
              );
            }

            if (message.kind === "image-write-confirmation-skill") {
              return (
                <div key={message.id} className="flex w-full justify-start">
                  <div className="w-full max-w-[96%]">
                    <ImageWriteConfirmationCard
                      status={message.imageWriteStatus ?? "pending"}
                      action={message.imageWriteAction ?? "写入页面"}
                      targetLabel={message.imageTargetLabel}
                      assetName={message.imageAssetName}
                      onConfirm={() => confirmImageWrite(message.id)}
                    />
                  </div>
                </div>
              );
            }

            const isUser = message.role === "user";
            const isFailed = message.status === "failed";
            const isGeneratingState = message.status === "generating";
            const showFeedback = !isUser && message.id !== "msg-initial" && !isFailed && !isGeneratingState;
            const feedback = messageFeedback[message.id];

            return (
              <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl border px-4 py-3 text-sm leading-6 shadow-[0_10px_28px_rgba(74,85,120,.08)]",
                    isUser
                      ? "border-[#d9c6ff] bg-[linear-gradient(135deg,#7b61ff,#a56dff)] text-white"
                      : isFailed
                        ? "border-[#ffd6de] bg-[#fff7f9] text-[#8c3c56]"
                        : "border-[#d7ddea] bg-white text-[#344158]"
                  )}
                >
                  {isFailed ? (
                    <div className="mb-2 flex items-center gap-2 text-[#e45483]">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-semibold">生成失败</span>
                    </div>
                  ) : null}
                  {message.attachment ? (
                    <div
                      data-testid="sent-image-attachment"
                      className={cn(
                        "mb-2 overflow-hidden rounded-[14px] border",
                        isUser ? "border-white/25 bg-white/10" : "border-[#d7ddea] bg-[#f7f9fd]"
                      )}
                    >
                      <img
                        src={message.attachment.url}
                        alt="已上传图片"
                        className="max-h-44 w-full object-cover"
                      />
                      <div
                        className={cn(
                          "truncate px-2.5 py-1.5 text-[11px]",
                          isUser ? "text-white/80" : "text-[#758097]"
                        )}
                      >
                        {message.attachment.name}
                      </div>
                    </div>
                  ) : null}
                  <div className="whitespace-pre-wrap break-words">
                    {message.content || (!isUser && isStreaming ? "正在输出..." : "")}
                    {isGeneratingState ? (
                      <span className="ml-1 inline-block h-4 w-2 rounded-full bg-[#7b61ff]/60 align-middle animate-pulse" />
                    ) : null}
                  </div>
                  {isFailed ? (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => retryFailedGeneration(message.requestText)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#f0b8c8] bg-white px-3 text-xs font-medium text-[#b9456d] transition hover:border-[#e45483] hover:text-[#8c3c56]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        重新生成
                      </button>
                      <span className="text-[11px] text-[#c06a86]">你也可以修改描述后再次发送</span>
                    </div>
                  ) : null}
                  {showFeedback ? (
                    <div className={cn("mt-2 flex flex-wrap items-center gap-1.5 text-[11px]", isUser ? "text-white/75" : "text-[#7a869d]")}>
                      <button
                        type="button"
                        onClick={() => setFeedback(message.id, "up")}
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full border transition",
                          feedback === "up"
                            ? "border-[#7b61ff]/30 bg-[#f1edff] text-[#6b4eff]"
                            : "border-[#d4dced] bg-[#f5f7fc] text-[#5f6b83] hover:border-[#8b95ff] hover:text-[#40507a]"
                        )}
                        aria-label="点赞"
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedback(message.id, "down")}
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full border transition",
                          feedback === "down"
                            ? "border-[#ff7b9e]/35 bg-[#fff0f4] text-[#e45483]"
                            : "border-[#d4dced] bg-[#f5f7fc] text-[#5f6b83] hover:border-[#8b95ff] hover:text-[#40507a]"
                        )}
                        aria-label="点踩"
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </button>
                      {feedback ? (
                        <span
                          className={cn(
                            "ml-1 inline-flex items-center rounded-full px-2.5 py-1 text-[11px]",
                            feedback === "up" ? "bg-[#f1edff] text-[#6b4eff]" : "bg-[#fff0f4] text-[#e45483]"
                          )}
                        >
                          {feedback === "up" ? "已收到点赞反馈" : "已收到点踩反馈"}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {isThinking ? (
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl border border-[#d7ddea] bg-white px-4 py-3 text-sm text-[#4d5a72] shadow-[0_10px_28px_rgba(74,85,120,.08)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#ff4f9a]" />
                  <span>{activeModel.label} 正在组织回复...</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-3 py-4">
          {!hasUserSentMessage ? (
            <div className="mb-4 flex flex-col items-start gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submitMessage(prompt)}
                  className="inline-flex max-w-full items-center rounded-full border border-[#d4dced] bg-white px-4 py-2 text-left text-xs text-[#526078] shadow-[0_6px_18px_rgba(74,85,120,.06)] transition hover:border-[#8b95ff] hover:bg-[#f7f9ff] hover:text-[#24314d]"
                >
                  <span className="break-words">{prompt}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="relative">
            {!isComposerExpanded && isSkillMenuOpen ? (
              <SkillCommandMenu
                className="absolute bottom-full left-0 right-0 mb-3"
                onSelect={applySkillCommand}
                onTemplateSelect={applyPromptSquareTemplate}
              />
            ) : null}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitMessage();
              }}
              className="rounded-[26px] bg-[#eef2f9] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.45)]"
            >
            <div className="overflow-visible rounded-[22px] border border-[#d4dced] bg-white shadow-[0_8px_24px_rgba(74,85,120,.08)]">
              <div
                ref={compactQuickPhraseRef}
                className="relative flex min-h-11 items-center gap-2 rounded-t-[22px] border-b border-[#edf0f6] px-3 py-2"
              >
                <input
                  ref={imageUploadRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  aria-label="选择上传图片"
                />
                <button
                  type="button"
                  data-testid="image-upload-button"
                  onClick={() => imageUploadRef.current?.click()}
                  className="group inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[#d9dfeb] bg-[#f7f9fd] text-[#657189] transition hover:border-[#8b95ff] hover:bg-white hover:text-[#5d4ac8]"
                  aria-label="上传图片"
                  title="上传图片"
                >
                  <ImageUp className="h-4 w-4 transition group-hover:-translate-y-0.5" />
                </button>
                {composerAttachment ? (
                  <div
                    data-testid="composer-image-attachment"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-[#dde3ee] bg-[#f8f9fd] p-1"
                  >
                    <img
                      src={composerAttachment.url}
                      alt="待发送图片"
                      className="h-7 w-7 shrink-0 rounded-[7px] object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-[#5d687f]">
                      {composerAttachment.name}
                    </span>
                    <button
                      type="button"
                      onClick={removeComposerAttachment}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#8993a7] transition hover:bg-white hover:text-[#d05277]"
                      aria-label="移除上传图片"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-[#9aa3b4]">上传参考图片</span>
                )}
                <button
                  type="button"
                  data-testid="agent-quick-phrase-button"
                  onClick={() => toggleQuickPhrase("compact")}
                  className={cn(
                    "ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] border px-2.5 text-[11px] font-medium transition",
                    quickPhraseAnchor === "compact"
                      ? "border-[#9b89ef] bg-[#f0edff] text-[#5f49bf] shadow-[0_0_0_3px_rgba(123,97,255,.08)]"
                      : "border-[#d9dfeb] bg-[#f7f9fd] text-[#657189] hover:border-[#9b89ef] hover:bg-white hover:text-[#5f49bf]"
                  )}
                  aria-label="打开快捷短语"
                  aria-expanded={quickPhraseAnchor === "compact"}
                  aria-controls="quick-phrase-popover"
                >
                  <Zap className="h-3.5 w-3.5" />
                  快捷短语
                </button>
                {quickPhraseAnchor === "compact" ? (
                  <QuickPhrasePopover
                    placement="above"
                    onClose={() => setQuickPhraseAnchor(null)}
                    onSelect={applyQuickPhrase}
                  />
                ) : null}
              </div>
              <div className="relative">
              {selectedSkill ? (
                <div className="px-4 pt-3">
                  <SelectedSkillChip skill={selectedSkill} onRemove={removeSelectedSkill} />
                </div>
              ) : null}
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && isSkillMenuOpen) {
                    event.preventDefault();
                    setIsSkillMenuOpen(false);
                    return;
                  }
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitMessage();
                  }
                }}
                rows={selectedSkill ? 4 : 5}
                placeholder="输入你的问题，例如：把时间轴做得更像截图，或者帮我补一个悬浮设置面板..."
                className={cn(
                  "w-full resize-none bg-transparent px-4 pr-14 text-sm text-[#24314d] outline-none transition placeholder:text-[#8a94aa]",
                  selectedSkill ? "py-2.5" : "py-3.5"
                )}
              />
              <button
                type="button"
                onClick={() => setIsComposerExpanded(true)}
                className="absolute bottom-3 right-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d2d9ea] bg-[#f7f9fd] text-[#5b6780] transition hover:border-[#8b95ff] hover:text-[#24314d]"
                aria-label="放大提示词框"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[#e1e6f0] px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <select
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value as ModelId)}
                    className="rounded-full border border-[#d2d9ea] bg-[#f7f9fd] px-3.5 py-2 text-xs text-[#35425c] outline-none"
                    aria-label="切换模型"
                  >
                    {modelOptions.map((model) => (
                      <option key={model.id} value={model.id} className="bg-white text-[#35425c]">
                        {model.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={triggerCommandInput}
                    className={cn(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border text-sm font-semibold transition",
                      isSkillMenuOpen
                        ? "border-[#7b61ff] bg-[#f1edff] text-[#6748cf] shadow-[0_0_0_3px_rgba(123,97,255,.1)]"
                        : "border-[#d2d9ea] bg-[#f7f9fd] text-[#35425c] hover:border-[#8b95ff] hover:bg-white hover:text-[#24314d]"
                    )}
                    aria-label="调用命令"
                    aria-expanded={isSkillMenuOpen}
                    aria-controls="agent-skill-command-menu"
                  >
                    /
                  </button>
                </div>

                <button
                  type={isReplyActive ? "button" : "submit"}
                  onClick={isReplyActive ? interruptGeneration : undefined}
                  disabled={!isReplyActive && !draft.trim() && !composerAttachment && !selectedSkill}
                  className={cn(
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
                    isReplyActive
                      ? "bg-[#fff1f4] text-[#e45483] shadow-[0_10px_20px_rgba(228,84,131,.18)] hover:bg-[#ffe4ec]"
                      : "bg-gradient-to-r from-[#7b61ff] to-[#ff4f9a] text-white shadow-[0_12px_24px_rgba(255,79,154,.24)] hover:brightness-110"
                  )}
                  aria-label={isReplyActive ? "打断生成" : "发送消息"}
                >
                  {isReplyActive ? <Square className="h-3.5 w-3.5 fill-current" /> : <SendHorizonal className="h-4 w-4" />}
                </button>
              </div>
            </div>
            </form>
          </div>
        </div>
      </aside>

      {previewAsset ? (
        <div
          data-testid="generated-asset-preview-modal"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111522]/72 px-6 py-8 backdrop-blur-[5px]"
          role="dialog"
          aria-modal="true"
          aria-label={`预览 ${previewAsset.name}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreviewAsset(null);
            }
          }}
        >
          <div className="flex max-h-[88vh] w-[min(820px,100%)] flex-col overflow-hidden rounded-[28px] border border-white/15 bg-[#f7f9fd] shadow-[0_34px_100px_rgba(7,10,20,.52)]">
            <div className="flex items-center gap-3 border-b border-[#dde3ee] bg-white px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#edf4ff] text-[#5483cc]">
                <ImagePlus className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#26334d]">{previewAsset.name}</div>
                <div className="mt-0.5 text-xs text-[#8a94a8]">对话文生图 · {previewAsset.imageType}预览</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#d8deea] bg-[#f7f9fd] text-[#657189] transition hover:border-[#9da7bd] hover:bg-white hover:text-[#26334d]"
                aria-label="关闭图片预览"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center bg-[#151a25] p-6">
              {previewAsset.imageUrl ? (
                <img
                  data-testid="generated-asset-preview-image"
                  src={previewAsset.imageUrl}
                  alt={`${previewAsset.imageType}大图预览`}
                  className="max-h-[62vh] max-w-full rounded-[18px] object-contain shadow-[0_24px_70px_rgba(0,0,0,.36)]"
                />
              ) : (
                <div className="grid h-[360px] w-full place-items-center rounded-[18px] border border-dashed border-white/20 text-sm text-white/55">
                  暂无可预览图片
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dde3ee] bg-white px-5 py-4">
              <div className="text-xs text-[#8993a7]">
                {savedAssetIds.has(previewAsset.id)
                  ? "该图片已保存至项目库"
                  : "可以下载原图，或保存到项目库"}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void downloadPreviewImage()}
                  disabled={!previewAsset.imageUrl}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-[#cfd7e6] bg-[#f7f9fd] px-4 text-sm font-medium text-[#4f5d76] transition hover:border-[#8b95ff] hover:bg-white hover:text-[#31405c] disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label="下载图片"
                >
                  <Download className="h-4 w-4" />
                  下载图片
                </button>
                <button
                  type="button"
                  data-testid="save-generated-asset"
                  onClick={savePreviewToAssets}
                  disabled={!previewAsset.imageUrl || savedAssetIds.has(previewAsset.id)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition",
                    savedAssetIds.has(previewAsset.id)
                      ? "border border-[#bfe3ce] bg-[#edf9f2] text-[#37885d]"
                      : "bg-[linear-gradient(100deg,#7658dc,#e75c98)] text-white shadow-[0_10px_22px_rgba(123,97,255,.2)] hover:brightness-105"
                  )}
                >
                  {savedAssetIds.has(previewAsset.id) ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <FolderPlus className="h-4 w-4" />
                  )}
                  {savedAssetIds.has(previewAsset.id) ? "已存项目库" : "保存到项目库"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isComposerExpanded ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#10131d]/38 px-6 py-8 backdrop-blur-[2px]">
          <div className="flex h-[min(72vh,680px)] w-[min(760px,100%)] flex-col overflow-hidden rounded-[28px] border border-[#d9ddea] bg-white shadow-[0_28px_80px_rgba(45,56,84,.22)]">
            <div className="flex items-center justify-between border-b border-[#e1e6f0] bg-[linear-gradient(180deg,#ffffff,#f5f7fc)] px-5 py-4">
              <div>
                <div className="text-base font-semibold text-[#24314d]">放大编辑提示词</div>
                <div className="mt-1 text-xs text-[#7a869d]">适合编写更长的需求、提示词和创作说明</div>
              </div>

              <button
                type="button"
                onClick={() => setIsComposerExpanded(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d2d9ea] bg-[#f7f9fd] text-[#5b6780] transition hover:border-[#8b95ff] hover:text-[#24314d]"
                aria-label="收起放大提示词框"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>

            <div className="relative flex flex-1 flex-col bg-[#f7f9fd] p-5">
              {isSkillMenuOpen ? (
                <SkillCommandMenu
                  className="absolute left-5 right-5 top-5"
                  onSelect={applySkillCommand}
                  onTemplateSelect={applyPromptSquareTemplate}
                />
              ) : null}

              <div
                ref={expandedQuickPhraseRef}
                className="relative mb-2 flex min-h-10 items-center gap-2 rounded-[14px] border border-[#dce2ee] bg-white px-2.5 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => imageUploadRef.current?.click()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[#d9dfeb] bg-[#f7f9fd] text-[#657189] transition hover:border-[#8b95ff] hover:bg-white hover:text-[#5d4ac8]"
                  aria-label="上传图片"
                  title="上传图片"
                >
                  <ImageUp className="h-4 w-4" />
                </button>
                {composerAttachment ? (
                  <>
                    <img
                      src={composerAttachment.url}
                      alt="待发送图片"
                      className="h-7 w-7 shrink-0 rounded-[7px] object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-[#5d687f]">
                      {composerAttachment.name}
                    </span>
                    <button
                      type="button"
                      onClick={removeComposerAttachment}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#8993a7] transition hover:bg-[#f7f9fd] hover:text-[#d05277]"
                      aria-label="移除上传图片"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-[#929caf]">添加图片附件</span>
                )}
                <button
                  type="button"
                  data-testid="agent-quick-phrase-button-expanded"
                  onClick={() => toggleQuickPhrase("expanded")}
                  className={cn(
                    "ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] border px-2.5 text-[11px] font-medium transition",
                    quickPhraseAnchor === "expanded"
                      ? "border-[#9b89ef] bg-[#f0edff] text-[#5f49bf] shadow-[0_0_0_3px_rgba(123,97,255,.08)]"
                      : "border-[#d9dfeb] bg-[#f7f9fd] text-[#657189] hover:border-[#9b89ef] hover:bg-white hover:text-[#5f49bf]"
                  )}
                  aria-label="打开放大编辑器快捷短语"
                  aria-expanded={quickPhraseAnchor === "expanded"}
                  aria-controls="quick-phrase-popover"
                >
                  <Zap className="h-3.5 w-3.5" />
                  快捷短语
                </button>
                {quickPhraseAnchor === "expanded" ? (
                  <QuickPhrasePopover
                    placement="below"
                    onClose={() => setQuickPhraseAnchor(null)}
                    onSelect={applyQuickPhrase}
                  />
                ) : null}
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[#d4dced] bg-white">
                {selectedSkill ? (
                  <div className="px-5 pt-4">
                    <SelectedSkillChip skill={selectedSkill} onRemove={removeSelectedSkill} />
                  </div>
                ) : null}
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => handleDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && isSkillMenuOpen) {
                      event.preventDefault();
                      setIsSkillMenuOpen(false);
                      return;
                    }
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitMessage();
                      setIsComposerExpanded(false);
                    }
                  }}
                  placeholder="在这里输入更完整的提示词、分镜要求、角色设定或图片提示词..."
                  className="min-h-0 w-full flex-1 resize-none bg-transparent px-5 py-4 text-sm leading-7 text-[#24314d] outline-none placeholder:text-[#8a94aa]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#e1e6f0] bg-white px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <select
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value as ModelId)}
                  className="rounded-full border border-[#d2d9ea] bg-[#f7f9fd] px-3 py-1.5 text-xs text-[#35425c] outline-none"
                  aria-label="切换模型"
                >
                  {modelOptions.map((model) => (
                    <option key={model.id} value={model.id} className="bg-white text-[#35425c]">
                      {model.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={triggerCommandInput}
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border text-sm font-semibold transition",
                    isSkillMenuOpen
                      ? "border-[#7b61ff] bg-[#f1edff] text-[#6748cf] shadow-[0_0_0_3px_rgba(123,97,255,.1)]"
                      : "border-[#d2d9ea] bg-[#f7f9fd] text-[#35425c] hover:border-[#8b95ff] hover:bg-white hover:text-[#24314d]"
                  )}
                  aria-label="调用命令"
                  aria-expanded={isSkillMenuOpen}
                  aria-controls="agent-skill-command-menu"
                >
                  /
                </button>
                <div className="truncate text-[11px] text-[#7a869d]">{activeModel.hint}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsComposerExpanded(false)}
                  className="inline-flex h-9 items-center rounded-full border border-[#d2d9ea] bg-[#f7f9fd] px-4 text-sm text-[#526078] transition hover:border-[#8b95ff] hover:text-[#24314d]"
                >
                  关闭
                </button>
                <button
                  type="button"
                  disabled={!isReplyActive && !draft.trim() && !composerAttachment && !selectedSkill}
                  onClick={() => {
                    if (isReplyActive) {
                      interruptGeneration();
                      return;
                    }
                    submitMessage();
                    setIsComposerExpanded(false);
                  }}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
                    isReplyActive
                      ? "bg-[#fff1f4] text-[#e45483] shadow-[0_10px_20px_rgba(228,84,131,.18)] hover:bg-[#ffe4ec]"
                      : "bg-gradient-to-r from-[#7b61ff] to-[#ff4f9a] text-white shadow-[0_12px_24px_rgba(255,79,154,.24)] hover:brightness-110"
                  )}
                >
                  {isReplyActive ? <Square className="h-3.5 w-3.5 fill-current" /> : <SendHorizonal className="h-4 w-4" />}
                  {isReplyActive ? "打断" : "发送"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
