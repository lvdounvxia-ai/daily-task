import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, History, Maximize2, MessageSquareMore, Minimize2, Plus, SendHorizonal, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

type ModelId = "gpt-4.1" | "claude-3.7" | "deepseek-r1" | "gemini-2.5";
type MessageRole = "assistant" | "user";
type DockSide = "left" | "right";

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
  modelId?: ModelId;
}

const modelOptions: ModelOption[] = [
  { id: "gpt-4.1", label: "GPT-4.1", hint: "更均衡，适合页面修改和说明" },
  { id: "claude-3.7", label: "Claude 3.7", hint: "更偏结构化梳理和细节建议" },
  { id: "deepseek-r1", label: "DeepSeek R1", hint: "更偏推理和方案拆解" },
  { id: "gemini-2.5", label: "Gemini 2.5", hint: "更偏快速发散和多角度建议" },
];

const quickPrompts = [
  "帮我继续细化这个页面",
  "给这个布局提 3 个优化建议",
  "把当前交互整理成待办",
];

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

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export default function AgentChatWidget() {
  const [isOpen, setIsOpen] = useState(true);
  const [dockSide, setDockSide] = useState<DockSide>("right");
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("gpt-4.1");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isThinking, setIsThinking] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const replyTimerRef = useRef<number | null>(null);

  const activeModel = useMemo(() => getModelMeta(selectedModel), [selectedModel]);
  const isRightDock = dockSide === "right";

  useEffect(() => {
    if (!scrollerRef.current) {
      return;
    }

    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, isThinking]);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current !== null) {
        window.clearTimeout(replyTimerRef.current);
      }
    };
  }, []);

  const submitMessage = (rawText?: string) => {
    const text = (rawText ?? draft).trim();

    if (!text || isThinking) {
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        id: `msg-user-${Date.now()}`,
        role: "user",
        content: text,
        createdAt: Date.now(),
      },
    ];

    setMessages(nextMessages);
    setDraft("");
    setIsThinking(true);

    if (replyTimerRef.current !== null) {
      window.clearTimeout(replyTimerRef.current);
    }

    replyTimerRef.current = window.setTimeout(() => {
      setMessages([
        ...nextMessages,
        {
          id: `msg-assistant-${Date.now()}`,
          role: "assistant",
          content: buildAgentReply(text, selectedModel, nextMessages),
          createdAt: Date.now(),
          modelId: selectedModel,
        },
      ]);
      setIsThinking(false);
      replyTimerRef.current = null;
    }, 700);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className={cn(
          "fixed top-[96px] z-[60] grid h-9 w-9 place-items-center rounded-full border border-[#d8dce8]",
          "bg-[#f7f8fc]/96 text-[#3e4a67] shadow-[0_18px_40px_rgba(0,0,0,.18)] backdrop-blur-xl transition hover:border-[#8b95ff] hover:bg-white"
          ,
          isRightDock ? "right-3" : "left-3"
        )}
        aria-label={isOpen ? "收起 Agent 侧边栏" : "打开 Agent 侧边栏"}
      >
        {isRightDock ? (
          isOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
        ) : isOpen ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      <aside
        className={cn(
          "fixed bottom-0 top-[88px] z-50 flex w-[500px] min-h-0 flex-col overflow-hidden bg-[#f7f8fc]/96 backdrop-blur-xl transition-transform duration-300",
          isRightDock
            ? "right-0 border-l border-[#d9ddea] shadow-[-18px_0_48px_rgba(0,0,0,.16)]"
            : "left-0 border-r border-[#d9ddea] shadow-[18px_0_48px_rgba(0,0,0,.16)]",
          isOpen ? "translate-x-0" : isRightDock ? "translate-x-full" : "-translate-x-full"
        )}
      >
        <div className="border-b border-[#d9ddea] bg-[linear-gradient(180deg,#ffffff,#eef2fb)] px-4 py-4 pr-12">
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

            <div className="flex items-center gap-2">
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
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#d4dced] bg-white px-3 text-xs text-[#526078] transition hover:border-[#8b95ff] hover:bg-[#f7f9ff] hover:text-[#24314d]"
                aria-label="新建对话"
              >
                <Plus className="h-3.5 w-3.5" />
                新建
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#d4dced] bg-white px-3 text-xs text-[#526078] transition hover:border-[#8b95ff] hover:bg-[#f7f9ff] hover:text-[#24314d]"
                aria-label="历史对话"
              >
                <History className="h-3.5 w-3.5" />
                历史
              </button>
            </div>
          </div>
        </div>

        <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto bg-[#f4f6fb] px-4 py-4">
          {messages.map((message) => {
            const isUser = message.role === "user";

            return (
              <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl border px-4 py-3 text-sm leading-6 shadow-[0_10px_28px_rgba(0,0,0,.12)]",
                    isUser
                      ? "border-[#d9c6ff] bg-[linear-gradient(135deg,#7b61ff,#a56dff)] text-white"
                      : "border-[#d7ddea] bg-white text-[#344158]"
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  <div className={cn("mt-2 flex items-center gap-2 text-[11px]", isUser ? "text-white/75" : "text-[#7a869d]")}>
                    {!isUser && message.modelId ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#d4dced] bg-[#f5f7fc] text-[#5f6b83] transition hover:border-[#8b95ff] hover:text-[#40507a]"
                          aria-label="点赞"
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#d4dced] bg-[#f5f7fc] text-[#5f6b83] transition hover:border-[#8b95ff] hover:text-[#40507a]"
                          aria-label="点踩"
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                    <span>{formatTime(message.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {isThinking ? (
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl border border-[#d7ddea] bg-white px-4 py-3 text-sm text-[#4d5a72]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#ff4f9a]" />
                  <span>{activeModel.label} 正在组织回复...</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-[#d9ddea] bg-[#eef2f9] px-4 py-4">
          <div className="mb-3 flex flex-col gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => submitMessage(prompt)}
                className="rounded-2xl border border-[#d4dced] bg-white px-3 py-2 text-left text-xs text-[#526078] transition hover:border-[#8b95ff] hover:bg-[#f7f9ff] hover:text-[#24314d]"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitMessage();
            }}
            className="space-y-3"
          >
            <div className="overflow-hidden rounded-2xl border border-[#d4dced] bg-white shadow-[0_8px_24px_rgba(74,85,120,.08)]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitMessage();
                  }
                }}
                rows={4}
                placeholder="输入你的问题，例如：把时间轴做得更像截图，或者帮我补一个悬浮设置面板..."
                className="w-full resize-none bg-transparent px-4 py-3 text-sm text-[#24314d] outline-none transition placeholder:text-[#8a94aa]"
              />

              <div className="flex items-center justify-between gap-3 border-t border-[#e1e6f0] px-3 py-2">
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
                </div>

                <button
                  type="button"
                  onClick={() => setIsComposerExpanded(true)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d2d9ea] bg-[#f7f9fd] text-[#5b6780] transition hover:border-[#8b95ff] hover:text-[#24314d]"
                  aria-label="放大提示词框"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>

                <button
                  type="submit"
                  disabled={!draft.trim() || isThinking}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#7b61ff] to-[#ff4f9a] text-white shadow-[0_12px_24px_rgba(255,79,154,.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="发送消息"
                >
                  <SendHorizonal className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="text-xs text-[#7a869d]">Enter 发送，Shift + Enter 换行</div>
          </form>
        </div>
      </aside>

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

            <div className="flex-1 bg-[#f7f9fd] p-5">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitMessage();
                    setIsComposerExpanded(false);
                  }
                }}
                placeholder="在这里输入更完整的提示词、分镜要求、角色设定或图片提示词..."
                className="h-full w-full resize-none rounded-[22px] border border-[#d4dced] bg-white px-5 py-4 text-sm leading-7 text-[#24314d] outline-none placeholder:text-[#8a94aa]"
              />
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
                  disabled={!draft.trim() || isThinking}
                  onClick={() => {
                    submitMessage();
                    setIsComposerExpanded(false);
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-gradient-to-r from-[#7b61ff] to-[#ff4f9a] px-4 text-sm text-white shadow-[0_12px_24px_rgba(255,79,154,.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SendHorizonal className="h-4 w-4" />
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
