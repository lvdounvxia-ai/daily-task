import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Plus, Search, Trash2, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickPhrase {
  id: string;
  content: string;
  source: "official" | "custom";
}

interface QuickPhrasePopoverProps {
  onClose: () => void;
  onSelect: (phrase: string) => void;
  placement?: "above" | "below";
}

const storageKey = "juxiaomeng.quick-phrases.v1";

const officialPhrases: QuickPhrase[] = [
  { id: "character-image", content: "帮我生成一张角色图", source: "official" },
  { id: "scene-image", content: "帮我生成一张场景图", source: "official" },
  { id: "refine-storyboard", content: "优化当前分镜提示词", source: "official" },
  { id: "consistency-check", content: "检查角色与场景是否一致", source: "official" },
  { id: "camera-language", content: "帮我补充镜头构图和视角", source: "official" },
];

function readCustomPhrases(): QuickPhrase[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is QuickPhrase => {
        if (!item || typeof item !== "object") {
          return false;
        }
        const phrase = item as Partial<QuickPhrase>;
        return typeof phrase.id === "string" && typeof phrase.content === "string";
      })
      .map((item) => ({ ...item, source: "custom" as const }));
  } catch {
    return [];
  }
}

export default function QuickPhrasePopover({
  onClose,
  onSelect,
  placement = "above",
}: QuickPhrasePopoverProps) {
  const [query, setQuery] = useState("");
  const [customPhrases, setCustomPhrases] = useState<QuickPhrase[]>(readCustomPhrases);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [newPhrase, setNewPhrase] = useState("");
  const [addError, setAddError] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);

  const filteredPhrases = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const phrases = [...officialPhrases, ...customPhrases];
    if (!normalized) {
      return phrases;
    }
    return phrases.filter((phrase) => phrase.content.toLocaleLowerCase().includes(normalized));
  }, [customPhrases, query]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(filteredPhrases.length - 1, 0)));
  }, [filteredPhrases.length]);

  useEffect(() => {
    if (isAdding) {
      addInputRef.current?.focus();
    }
  }, [isAdding]);

  const persistCustomPhrases = (next: QuickPhrase[]) => {
    setCustomPhrases(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const saveNewPhrase = () => {
    const content = newPhrase.trim();
    if (!content) {
      return;
    }

    const exists = [...officialPhrases, ...customPhrases].some((phrase) => phrase.content === content);
    if (exists) {
      setAddError("这条短语已经存在");
      return;
    }

    persistCustomPhrases([
      ...customPhrases,
      {
        id: `custom-${Date.now()}`,
        content,
        source: "custom",
      },
    ]);
    setNewPhrase("");
    setAddError("");
    setIsAdding(false);
    setQuery("");
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const removeCustomPhrase = (id: string) => {
    persistCustomPhrases(customPhrases.filter((phrase) => phrase.id !== id));
  };

  const selectActivePhrase = () => {
    const phrase = filteredPhrases[activeIndex];
    if (phrase) {
      onSelect(phrase.content);
    }
  };

  return (
    <div
      id="quick-phrase-popover"
      data-testid="quick-phrase-popover"
      role="dialog"
      aria-label="快捷短语"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (isAdding) {
            setIsAdding(false);
            setNewPhrase("");
            setAddError("");
            window.setTimeout(() => searchRef.current?.focus(), 0);
          } else {
            onClose();
          }
          return;
        }

        if (isAdding) {
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveIndex((current) => Math.min(current + 1, Math.max(filteredPhrases.length - 1, 0)));
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveIndex((current) => Math.max(current - 1, 0));
        } else if (event.key === "Enter") {
          event.preventDefault();
          selectActivePhrase();
        }
      }}
      className={cn(
        "absolute left-0 z-[120] w-[316px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[14px] border border-[#d7deeb] bg-white text-left shadow-[0_18px_50px_rgba(45,55,90,.2)]",
        placement === "above" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
      )}
    >
      <div className="flex items-center justify-between border-b border-[#e6eaf2] px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[#f0edff] text-[#6f55d9]">
            <Zap className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-[13px] font-medium text-[#24314d]">快捷短语</div>
            <div className="mt-0.5 text-[10px] text-[#8b95a9]">选择后写入剧小梦</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-[8px] text-[#8b95a9] transition hover:bg-[#f0f3f8] hover:text-[#24314d]"
          aria-label="关闭快捷短语"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-2.5">
        <label className="flex h-9 items-center gap-2 rounded-[9px] border border-[#dce2ee] bg-[#f7f9fd] px-2.5 text-[#8b95a9] focus-within:border-[#8b78e8] focus-within:bg-white focus-within:text-[#6552bd]">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            ref={searchRef}
            data-testid="quick-phrase-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索快捷短语"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[#24314d] outline-none placeholder:text-[#9ba5b7]"
          />
        </label>

        <div
          role="listbox"
          aria-label="快捷短语列表"
          className="mt-2 max-h-[132px] space-y-1 overflow-y-auto pr-0.5"
        >
          {filteredPhrases.map((phrase, index) => (
            <div
              key={phrase.id}
              data-testid={`quick-phrase-item-${phrase.id}`}
              role="option"
              aria-selected={index === activeIndex}
              tabIndex={-1}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onSelect(phrase.content)}
              className={cn(
                "group flex min-h-10 cursor-pointer items-center gap-2 rounded-[9px] border px-2.5 py-2 transition",
                index === activeIndex
                  ? "border-[#d8d0ff] bg-[#f0edff] text-[#3f3378]"
                  : "border-transparent text-[#526078] hover:bg-[#f4f6fa]"
              )}
            >
              <Zap className={cn("h-3.5 w-3.5 shrink-0", index === activeIndex ? "text-[#765de0]" : "text-[#a3acbb]")} />
              <span className="min-w-0 flex-1 truncate text-[12px]">{phrase.content}</span>
              {phrase.source === "custom" ? (
                <button
                  type="button"
                  data-testid={`quick-phrase-remove-${phrase.id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeCustomPhrase(phrase.id);
                  }}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] text-[#a2aaba] opacity-0 transition hover:bg-[#fff0f4] hover:text-[#e25582] group-hover:opacity-100 focus:opacity-100"
                  aria-label={`删除快捷短语：${phrase.content}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="shrink-0 text-[9px] text-[#a0a9b9]">官方</span>
              )}
            </div>
          ))}

          {filteredPhrases.length === 0 ? (
            <div data-testid="quick-phrase-empty" className="px-3 py-6 text-center text-[12px] text-[#929caf]">
              没有匹配的短语
            </div>
          ) : null}
        </div>

        {isAdding ? (
          <div className="mt-2 rounded-[10px] border border-[#ded8fb] bg-[#f8f7ff] p-2">
            <input
              ref={addInputRef}
              data-testid="quick-phrase-new-input"
              value={newPhrase}
              maxLength={80}
              onChange={(event) => {
                setNewPhrase(event.target.value);
                setAddError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveNewPhrase();
                }
              }}
              placeholder="输入常用内容，最多 80 字"
              className="h-8 w-full rounded-[7px] border border-[#d9dfeb] bg-white px-2.5 text-[12px] text-[#24314d] outline-none placeholder:text-[#9ba5b7] focus:border-[#8b78e8]"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span role="status" className="min-w-0 flex-1 truncate text-[10px] text-[#e25582]">
                {addError}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewPhrase("");
                  setAddError("");
                }}
                className="rounded-[7px] px-2.5 py-1.5 text-[11px] text-[#7d8799] transition hover:bg-white hover:text-[#24314d]"
              >
                取消
              </button>
              <button
                type="button"
                data-testid="quick-phrase-save"
                onClick={saveNewPhrase}
                disabled={!newPhrase.trim()}
                className="rounded-[7px] bg-[#7058d6] px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#634bc8] disabled:cursor-not-allowed disabled:opacity-40"
              >
                保存短语
              </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-testid="quick-phrase-add"
            onClick={() => setIsAdding(true)}
            className="mt-2 flex h-9 w-full items-center gap-2 rounded-[9px] border border-dashed border-[#d1d8e5] px-2.5 text-[12px] text-[#788397] transition hover:border-[#8b78e8] hover:bg-[#f7f5ff] hover:text-[#51429b]"
          >
            <Plus className="h-3.5 w-3.5" />
            添加短语
          </button>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#e6eaf2] bg-[#f8f9fc] px-3.5 py-2 text-[9px] text-[#939caf]">
        <span>Esc 关闭 · ↑↓ 选择</span>
        <span className="inline-flex items-center gap-1">
          <CornerDownLeft className="h-3 w-3" />
          确认插入
        </span>
      </div>
    </div>
  );
}
