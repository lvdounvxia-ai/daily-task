import { Bell, ChevronDown, ChevronLeft, CircleHelp, Clapperboard, Film, Gem, Grid2x2, Link2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TopBar() {
  return (
    <header className="border-b border-[#2e2430] bg-[#1b171d]">
      <div className="flex h-[42px] items-center justify-between border-b border-[#2a2129] px-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#4cc7ff] to-[#ff47b6] shadow-[0_0_18px_rgba(255,72,170,.25)]">
              <span className="text-sm font-bold text-white">Q</span>
            </div>
            <div className="text-[20px] font-semibold tracking-wide text-white">剧梦</div>
          </div>
          <button type="button" className="inline-flex items-center gap-1.5 text-sm text-zinc-300 transition hover:text-white">
            <ChevronLeft className="h-4 w-4" />
            返回
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-[#3b3139] bg-[#221d23] px-3 py-1.5 text-xs text-zinc-200 lg:flex">
            <span className="text-zinc-400">创作状态</span>
            <span>海外真人剧</span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#3b3139] bg-[#221d23] px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-[#2a232b]"
          >
            <Grid2x2 className="h-4 w-4" />
            任务队列
            <span className="text-zinc-500">· 0 · 0</span>
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full border border-[#3b3139] bg-[#221d23] text-zinc-300 hover:text-white"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full border border-[#3b3139] bg-[#221d23] text-zinc-300 hover:text-white"
          >
            <CircleHelp className="h-4 w-4" />
          </button>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#ff4d9b] px-3 py-1 text-sm font-semibold text-white shadow-[0_0_18px_rgba(255,77,155,.28)]">
            <Gem className="h-4 w-4" />
            4562
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#ff4d9b] text-xs font-semibold text-white">顶</div>
        </div>
      </div>

      <div className="flex h-[46px] items-center justify-between px-4">
        <div />
        <nav className="flex items-center gap-6 text-[14px]">
          <button type="button" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200">
            <Clapperboard className="h-4 w-4" />
            剧本内容
          </button>
          <button type="button" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200">
            <Link2 className="h-4 w-4" />
            页帧要素
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-2 py-1 text-[#ff4d9b]",
              "shadow-[inset_0_-2px_0_0_rgba(255,77,155,.9)]"
            )}
          >
            <Film className="h-4 w-4" />
            分镜视频
          </button>
          <button type="button" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300">
            <Sparkles className="h-4 w-4" />
            创作
          </button>
        </nav>
      </div>
    </header>
  );
}
