import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AlertCircle, ArrowLeftRight, ChevronLeft, ChevronRight, History, Maximize2, MessageSquareMore, Minimize2, Plus, RotateCcw, SendHorizonal, Sparkles, Square, ThumbsDown, ThumbsUp } from "lucide-react";
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
  status?: "failed" | "generating";
  requestText?: string;
}

interface ChatSession {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  modelId: ModelId;
  messages: ChatMessage[];
}

interface PromptCommandTemplate {
  id: string;
  slash: string;
  title: string;
  description: string;
  prompt: string;
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

const promptCommandTemplates: PromptCommandTemplate[] = [
  {
    id: "emotion-arc",
    slash: "/情绪起伏",
    title: "梳理情绪起伏",
    description: "分析剧情从铺垫到高潮的情绪变化。",
    prompt: "帮我梳理这段剧情从铺垫、升级到爆发的情绪起伏，并标出适合强化的分镜节点。",
  },
  {
    id: "logic-check",
    slash: "/逻辑检查",
    title: "检查逻辑 bug",
    description: "排查人物动机、因果与信息前后矛盾。",
    prompt: "请检查这个剧本有没有逻辑 bug，重点看人物动机、事件因果和信息前后是否矛盾。",
  },
  {
    id: "dialogue-polish",
    slash: "/对白优化",
    title: "优化对白张力",
    description: "把台词改得更有潜台词和冲突感。",
    prompt: "这场对白还可以怎么改得更有张力？请给我更有潜台词、对抗感和情绪推进的版本。",
  },
  {
    id: "storyboard-prompt",
    slash: "/分镜提示词",
    title: "生成分镜提示词",
    description: "按镜头语言输出可直接使用的提示词。",
    prompt: "请根据这段剧情帮我生成分镜提示词，包含镜头景别、人物动作、情绪、构图和画面氛围。",
  },
  {
    id: "character-consistency",
    slash: "/角色一致性",
    title: "检查角色一致性",
    description: "校验角色设定、说话方式与行为是否统一。",
    prompt: "请检查这段内容里的角色设定是否一致，包括说话方式、行为反应和情绪延续是否统一。",
  },
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
  const [panelWidth, setPanelWidth] = useState(500);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("gpt-4.1");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>(initialHistorySessions);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, FeedbackType>>({});
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const replyTimerRef = useRef<number | null>(null);
  const streamTimerRef = useRef<number | null>(null);

  const activeModel = useMemo(() => getModelMeta(selectedModel), [selectedModel]);
  const isRightDock = dockSide === "right";
  const hasUserSentMessage = messages.some((message) => message.role === "user");
  const hasGeneratingMessage = messages.some((message) => message.status === "generating");
  const isReplyActive = isThinking || isStreaming || hasGeneratingMessage;
  const currentSlashCommand = useMemo(() => {
    const lastLine = draft.split("\n").at(-1)?.trimStart() ?? "";
    return lastLine.startsWith("/") ? lastLine.slice(1).trim().toLowerCase() : null;
  }, [draft]);
  const filteredPromptTemplates = useMemo(() => {
    if (currentSlashCommand === null) {
      return [];
    }

    if (!currentSlashCommand) {
      return promptCommandTemplates;
    }

    return promptCommandTemplates.filter((template) =>
      [template.slash, template.title, template.description, template.prompt]
        .join(" ")
        .toLowerCase()
        .includes(currentSlashCommand)
    );
  }, [currentSlashCommand]);
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
      if (streamTimerRef.current !== null) {
        window.clearInterval(streamTimerRef.current);
      }
    };
  }, []);

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

  const submitMessage = (rawText?: string) => {
    const text = (rawText ?? draft).trim();

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
      },
    ];

    setMessages(nextMessages);
    setDraft("");
    setIsThinking(true);
    setIsStreaming(false);
    setIsHistoryOpen(false);

    stopReplyGeneration();
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
    setDraft("");
    setIsComposerExpanded(false);
    setIsHistoryOpen(false);
  };

  const openHistorySession = (session: ChatSession) => {
    stopReplyGeneration();

    setMessages(session.messages);
    setSelectedModel(session.modelId);
    setDraft("");
    setIsComposerExpanded(false);
    setIsHistoryOpen(false);
  };

  const setFeedback = (messageId: string, feedback: FeedbackType) => {
    setMessageFeedback((current) => ({
      ...current,
      [messageId]: feedback,
    }));
  };

  const triggerCommandInput = () => {
    setDraft((current) => (current.trim() ? `${current}\n/调用命令 ` : "/调用命令 "));

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const applyPromptTemplate = (template: PromptCommandTemplate) => {
    setDraft((current) => {
      const lines = current.split("\n");
      const lastLine = lines.at(-1)?.trimStart() ?? "";

      if (lastLine.startsWith("/")) {
        lines[lines.length - 1] = template.prompt;
        return lines.join("\n");
      }

      return current.trim() ? `${current}\n${template.prompt}` : template.prompt;
    });

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
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
            {currentSlashCommand !== null ? (
              <div className="absolute bottom-full left-0 right-0 z-20 mb-3 overflow-hidden rounded-[22px] border border-[#d7ddea] bg-white shadow-[0_18px_40px_rgba(41,52,79,.14)]">
                <div className="border-b border-[#edf1f7] px-4 py-3 text-xs font-medium text-[#6b7690]">
                  可调用的 Prompt 模板
                </div>
                <div className="max-h-[260px] overflow-y-auto p-2">
                  {filteredPromptTemplates.length > 0 ? (
                    filteredPromptTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyPromptTemplate(template)}
                        className="flex w-full items-start gap-3 rounded-[16px] px-3 py-3 text-left transition hover:bg-[#f6f8ff]"
                      >
                        <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#f2f5fb] px-2.5 text-xs font-semibold text-[#55627b]">
                          {template.slash}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-[#24314d]">{template.title}</span>
                          <span className="mt-1 block text-xs leading-5 text-[#77839b]">{template.description}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-[#7a869d]">没有匹配的模板，试试输入更短一点的关键词。</div>
                  )}
                </div>
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
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (currentSlashCommand !== null) {
                      if (filteredPromptTemplates.length > 0) {
                        applyPromptTemplate(filteredPromptTemplates[0]);
                      }
                      return;
                    }
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
                  <button
                    type="button"
                    onClick={triggerCommandInput}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#d2d9ea] bg-[#f7f9fd] text-sm font-semibold text-[#35425c] transition hover:border-[#8b95ff] hover:bg-white hover:text-[#24314d]"
                    aria-label="调用命令"
                  >
                    /
                  </button>
                </div>

                <button
                  type={isReplyActive ? "button" : "submit"}
                  onClick={isReplyActive ? interruptGeneration : undefined}
                  disabled={!isReplyActive && !draft.trim()}
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

            <div className="relative flex-1 bg-[#f7f9fd] p-5">
              {currentSlashCommand !== null ? (
                <div className="absolute left-5 right-5 top-5 z-20 overflow-hidden rounded-[22px] border border-[#d7ddea] bg-white shadow-[0_18px_40px_rgba(41,52,79,.14)]">
                  <div className="border-b border-[#edf1f7] px-4 py-3 text-xs font-medium text-[#6b7690]">可调用的 Prompt 模板</div>
                  <div className="max-h-[260px] overflow-y-auto p-2">
                    {filteredPromptTemplates.length > 0 ? (
                      filteredPromptTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyPromptTemplate(template)}
                          className="flex w-full items-start gap-3 rounded-[16px] px-3 py-3 text-left transition hover:bg-[#f6f8ff]"
                        >
                          <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#f2f5fb] px-2.5 text-xs font-semibold text-[#55627b]">
                            {template.slash}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[#24314d]">{template.title}</span>
                            <span className="mt-1 block text-xs leading-5 text-[#77839b]">{template.description}</span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-[#7a869d]">没有匹配的模板，试试输入更短一点的关键词。</div>
                    )}
                  </div>
                </div>
              ) : null}

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (currentSlashCommand !== null) {
                      if (filteredPromptTemplates.length > 0) {
                        applyPromptTemplate(filteredPromptTemplates[0]);
                      }
                      return;
                    }
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
                <button
                  type="button"
                  onClick={triggerCommandInput}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#d2d9ea] bg-[#f7f9fd] text-sm font-semibold text-[#35425c] transition hover:border-[#8b95ff] hover:bg-white hover:text-[#24314d]"
                  aria-label="调用命令"
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
                  disabled={!isReplyActive && !draft.trim()}
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
