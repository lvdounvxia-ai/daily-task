import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, History, Maximize2, MessageSquareMore, Minimize2, Plus, SendHorizonal, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

type ModelId = "gpt-4.1" | "claude-3.7" | "deepseek-r1" | "gemini-2.5";
type MessageRole = "assistant" | "user";
type DockSide = "left" | "right";
type FeedbackType = "up" | "down";

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

interface ChatSession {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  modelId: ModelId;
  messages: ChatMessage[];
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
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("gpt-4.1");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>(initialHistorySessions);
  const [isThinking, setIsThinking] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, FeedbackType>>({});
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const replyTimerRef = useRef<number | null>(null);

  const activeModel = useMemo(() => getModelMeta(selectedModel), [selectedModel]);
  const isRightDock = dockSide === "right";
  const hasUserSentMessage = messages.some((message) => message.role === "user");
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
    setIsHistoryOpen(false);

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

  const startNewConversation = () => {
    if (replyTimerRef.current !== null) {
      window.clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }

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
    setDraft("");
    setIsThinking(false);
    setIsComposerExpanded(false);
    setIsHistoryOpen(false);
  };

  const openHistorySession = (session: ChatSession) => {
    if (replyTimerRef.current !== null) {
      window.clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }

    setMessages(session.messages);
    setSelectedModel(session.modelId);
    setDraft("");
    setIsThinking(false);
    setIsComposerExpanded(false);
    setIsHistoryOpen(false);
  };

  const setFeedback = (messageId: string, feedback: FeedbackType) => {
    setMessageFeedback((current) => ({
      ...current,
      [messageId]: feedback,
    }));
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
          "fixed bottom-0 top-[88px] z-50 flex w-[500px] min-h-0 flex-col overflow-hidden bg-[#eef2fb] transition-transform duration-300",
          isRightDock
            ? "right-0 border-l border-[#d9ddea] shadow-[-18px_0_48px_rgba(0,0,0,.16)]"
            : "left-0 border-r border-[#d9ddea] shadow-[18px_0_48px_rgba(0,0,0,.16)]",
          isOpen ? "translate-x-0" : isRightDock ? "translate-x-full" : "-translate-x-full"
        )}
      >
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
            const isUser = message.role === "user";
            const showFeedback = !isUser && message.id !== "msg-initial";
            const feedback = messageFeedback[message.id];

            return (
              <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl border px-4 py-3 text-sm leading-6 shadow-[0_10px_28px_rgba(74,85,120,.08)]",
                    isUser
                      ? "border-[#d9c6ff] bg-[linear-gradient(135deg,#7b61ff,#a56dff)] text-white"
                      : "border-[#d7ddea] bg-white text-[#344158]"
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
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

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitMessage();
            }}
            className="rounded-[26px] bg-[#eef2f9] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.45)]"
          >
            <div className="overflow-hidden rounded-[22px] border border-[#d4dced] bg-white shadow-[0_8px_24px_rgba(74,85,120,.08)]">
              <div className="relative">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitMessage();
                  }
                }}
                rows={5}
                placeholder="输入你的问题，例如：把时间轴做得更像截图，或者帮我补一个悬浮设置面板..."
                className="w-full resize-none bg-transparent px-4 py-3.5 pr-14 text-sm text-[#24314d] outline-none transition placeholder:text-[#8a94aa]"
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
                </div>

                <button
                  type="submit"
                  disabled={!draft.trim() || isThinking}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#7b61ff] to-[#ff4f9a] text-white shadow-[0_12px_24px_rgba(255,79,154,.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="发送消息"
                >
                  <SendHorizonal className="h-4 w-4" />
                </button>
              </div>
            </div>
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
