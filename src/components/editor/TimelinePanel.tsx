import { cn } from "@/lib/utils";
import { mockTimeline, mockShots } from "@/mock/editorMock";
import { useEditorStore } from "@/stores/editorStore";

export default function TimelinePanel({ className }: { className?: string }) {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectedShotId = useEditorStore((s) => s.selectedShotId);
  const { selectClip, selectShot } = useEditorStore((s) => s.actions);
  const selectedShot = mockShots.find((s) => s.id === selectedShotId) ?? mockShots[0];

  return (
    <section className={cn("border-t border-[#342b34] bg-[#1d181d]", className)}>
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <div className="flex items-center gap-2 text-[14px] text-white">
          <span className="text-[#ff5fa6]">✦</span>
          <span className="font-semibold">{selectedShot.title}</span>
          <span className="text-[#7e7280]">✎</span>
        </div>
        <div className="flex items-center gap-3 text-[14px] text-[#f4eef2]">
          <div className="grid h-6 w-6 place-items-center rounded-full bg-[#f4eef2] text-[#2b242b]">
            <div className="h-0 w-0 border-b-[4px] border-l-[6px] border-t-[4px] border-b-transparent border-l-[#2b242b] border-t-transparent" />
          </div>
          <span>00:00.00/02:40.00</span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[10px] border border-[#433843] bg-[#2a2329] px-3 py-2 text-[13px] text-[#dfd6df]"
        >
          默认视图
          <div className="h-0 w-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#ddd4dd]" />
        </button>
      </div>
      <div className="px-4 py-3">
        <div className="flex gap-2 overflow-x-auto">
          {mockTimeline.map((clip) => {
            const active = clip.id === selectedClipId;
            const shot = mockShots.find((s) => s.id === clip.shotId);
            const statusText = clip.status === "empty" ? "暂无素材" : clip.status === "error" ? "生成失败" : "";
            const timeText = `00:${String(clip.durationSec).padStart(2, "0")}.00`;

            return (
              <button
                key={clip.id}
                type="button"
                onClick={() => {
                  selectClip(clip.id);
                  if (shot) selectShot(shot.id);
                }}
                className={cn(
                  "relative h-[86px] w-[171px] flex-none overflow-hidden rounded-[8px] border text-left",
                  active ? "border-[#ff4d9b] shadow-[0_0_0_1px_rgba(255,77,155,.3)]" : "border-[#332b34]"
                )}
              >
                <div className="absolute left-2 top-1 z-10 text-[12px] text-white">{clip.label}</div>
                {shot?.posterUrl ? <img alt="" src={shot.posterUrl} className="h-full w-full object-cover opacity-85" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
                {statusText ? (
                  <div className="absolute inset-x-0 bottom-5 text-center text-[20px] font-semibold text-white">
                    {statusText}
                  </div>
                ) : null}
                <div className="absolute bottom-2 right-2 text-[12px] text-white">{timeText}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
