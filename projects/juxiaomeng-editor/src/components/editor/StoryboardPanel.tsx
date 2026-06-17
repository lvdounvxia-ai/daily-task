import { ChevronDown, Pencil, Plus, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockShots } from "@/mock/editorMock";
import { useEditorStore } from "@/stores/editorStore";

function DetailTag({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string;
  tone?: "blue" | "pink" | "amber";
}) {
  const toneMap = {
    blue: "text-[#89b8ff]",
    pink: "text-[#ff69b0]",
    amber: "text-[#ffd26c]",
  };

  return (
    <span className="mr-2 inline-flex items-center gap-1 text-[12px]">
      <span className={cn("font-medium", toneMap[tone])}>▶ {label}：</span>
      <span className="text-[#ddd6dd]">{value}</span>
    </span>
  );
}

function ErrorThumb() {
  return (
    <div className="flex h-[190px] w-[206px] flex-col items-center justify-center rounded-[16px] border border-[#3c3240] bg-[#1d181d] text-center">
      <div className="grid h-16 w-16 place-items-center rounded-[14px] border border-[#554955] bg-[#2b252d] text-[28px] text-[#cbbec8] shadow-[10px_10px_0_rgba(0,0,0,.35)]">
        !
      </div>
      <div className="mt-5 text-[21px] font-semibold text-[#efe8ee]">提示词字数过多</div>
      <div className="mt-3 max-w-[170px] text-[12px] leading-5 text-[#b8aeb7]">
        请检查提示词字数，即梦限制提示词为 2000 字，请修改为小于 2000 字后重新提交~
      </div>
    </div>
  );
}

function ScriptCard({ shot, active, onClick }: { shot: (typeof mockShots)[number]; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-[14px] border p-3 text-left transition",
        active ? "border-[#5b4b5a] bg-[#272128]" : "border-[#332b34] bg-[#231e24] hover:bg-[#28222a]"
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <div className="text-[14px] font-semibold text-white">{shot.title}</div>
        <div className="rounded-full bg-[#3a3139] px-2 py-0.5 text-[11px] text-[#c2b7c1]">{shot.index}</div>
      </div>
      <div className="flex items-start justify-between gap-3 text-[13px] text-[#ddd3dc]">
        <div className="line-clamp-2 flex-1">{shot.summary}</div>
        <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-[#756974]" />
      </div>

      <div className="mt-3 flex gap-3">
        <ErrorThumb />
        <div className="min-w-0 flex-1">
          <div className="rounded-[12px] border border-[#3d3440] bg-[#1b171d] p-3 text-[12px] leading-6">
            {shot.details.map((detail) => (
              <DetailTag key={`${shot.id}-${detail.label}`} label={detail.label} value={detail.value} tone={detail.tone} />
            ))}
            <div className="mt-1 line-clamp-6 text-[#f0e8ef]">{shot.imagePrompt}</div>
          </div>

          <div className="mt-3 flex gap-2">
            {shot.actions.map((action) => (
              <div
                key={`${shot.id}-${action}`}
                className="rounded-[10px] border border-[#433843] bg-[#302a31] px-4 py-2 text-[13px] text-[#ddd5dd]"
              >
                {action}
              </div>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function StoryboardPanel({ className }: { className?: string }) {
  const selectedShotId = useEditorStore((s) => s.selectedShotId);
  const { selectShot } = useEditorStore((s) => s.actions);
  const visibleShots = mockShots.filter((shot) => shot.id !== "shot-2").slice(0, 1);

  return (
    <section className={cn("flex min-w-0 flex-col rounded-l-[14px] bg-[#211c22]", className)}>
      <div className="border-b border-[#342b34] px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex min-w-[395px] items-center justify-between rounded-[10px] border border-[#4e434d] bg-[#231e23] px-4 py-2.5 text-[14px] text-white"
          >
            第1集
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          </button>
          <button
            type="button"
            className="rounded-[8px] bg-[#ad476f] px-4 py-2 text-[13px] font-medium text-white opacity-70"
          >
            批量生成
          </button>
          <button
            type="button"
            className="rounded-[8px] border border-[#433843] bg-[#2a242b] px-4 py-2 text-[13px] text-[#d4cad3]"
          >
            一键导出
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-4">
          {visibleShots.map((shot) => (
            <ScriptCard
              key={shot.id}
              shot={shot}
              active={selectedShotId === shot.id}
              onClick={() => selectShot(shot.id)}
            />
          ))}
        </div>

        <div className="mt-4 rounded-[14px] border border-[#6a4160] bg-[#181218] p-4 shadow-[0_0_0_1px_rgba(255,90,180,.14)]">
          <div className="flex gap-4">
            <div className="grid h-[58px] w-[58px] place-items-center rounded-[12px] border border-[#51424f] bg-[#2b232b] text-[#847684]">
              <Plus className="h-5 w-5" />
            </div>
            <div className="flex-1 text-[13px] leading-6 text-[#a79ca5]">
              上传最多15个参考素材、输入文字或@素材，自由组合图、文、音、视频多元素，可尝试描述：
              <span className="text-[#e4d9e1]"> 角色走在@场景中，音色参考@音频1。</span>
            </div>
          </div>

          <div className="mt-8 text-[12px] text-[#665c66]">0/5000</div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button type="button" className="rounded-[8px] border border-[#433843] bg-[#2a2329] px-3 py-2 text-[13px] text-[#e0d7df]">
                全能生视频
              </button>
              <button type="button" className="rounded-[8px] border border-[#433843] bg-[#2a2329] px-3 py-2 text-[13px] text-[#e0d7df]">
                九梦 2.0 Pro
              </button>
              <button type="button" className="rounded-[8px] border border-[#433843] bg-[#2a2329] px-3 py-2 text-[13px] text-[#e0d7df]">
                720p
              </button>
              <button type="button" className="rounded-[8px] border border-[#433843] bg-[#2a2329] px-3 py-2 text-[13px] text-[#e0d7df]">
                4秒
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" className="grid h-9 w-9 place-items-center rounded-[10px] border border-[#433843] bg-[#2a2329] text-[#ddd3dc]">
                <Upload className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-[10px] bg-[#c34f7e] px-5 py-2 text-[14px] font-medium text-white shadow-[0_0_18px_rgba(195,79,126,.2)]"
              >
                <Sparkles className="h-4 w-4" />
                80
                <span className="text-white/85">重新生成</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
