import { Crop, Maximize, Scissors, Sticker } from "lucide-react";
import { cn } from "@/lib/utils";
import { previewThumbs } from "@/mock/editorMock";

const tools = [
  { id: "tool-sticker", label: "元素", icon: Sticker },
  { id: "tool-max", label: "高清", icon: Maximize },
  { id: "tool-cut", label: "剪刀", icon: Scissors },
];

export default function PreviewPanel({ className }: { className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col bg-[#221d23]", className)}>
      <div className="flex items-center justify-between gap-2 px-6 py-3">
        <div className="w-[92px]" />
        <button
          type="button"
          className="rounded-[8px] border border-[#433843] bg-[#2a242b] px-5 py-1.5 text-[13px] text-[#d7cfd7]"
        >
          批量下载
        </button>
        <div className="w-[92px]" />
      </div>

      <div className="flex min-h-0 flex-1 gap-4 px-6 pb-2">
        <div className="flex w-[74px] flex-col gap-3 pt-2">
          {previewThumbs.map((thumb, idx) => (
            <button
              key={thumb.id}
              type="button"
              className={cn(
                "relative overflow-hidden rounded-[8px] border bg-black/20",
                idx === 0 ? "border-[#5e4d5d]" : "border-[#3b3139]"
              )}
            >
              <img alt="" src={thumb.imageUrl} className="h-[107px] w-full object-cover" />
              <div className="absolute bottom-1 left-1 grid h-5 w-5 place-items-center rounded-full bg-black/75 text-[10px] text-white">
                <Crop className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>

        <div className="relative flex-1 rounded-[16px] bg-[#2a252b]">
          <div className="mx-auto flex h-full max-w-[760px] items-center justify-center px-10 py-3">
            <div className="relative h-full w-[368px] rounded-[18px] bg-black shadow-[0_0_0_1px_rgba(70,61,70,.45)]">
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-[14px] border border-[#564a56] bg-[#2b252d] text-[28px] text-[#cdbfca] shadow-[10px_10px_0_rgba(0,0,0,.35)]">
                  !
                </div>
                <div className="mt-6 text-[26px] font-semibold text-[#f6eff5]">提示词字数过多</div>
                <div className="mt-4 max-w-[270px] text-[13px] leading-6 text-[#d7cfd8]">
                  请检查提示词字数，即梦限制提示词为2000字，请修改为小于2000字后重新提交~
                </div>
              </div>
            </div>
          </div>

          <div className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2">
            {tools.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  className="grid h-[82px] w-[50px] place-items-center rounded-[10px] border border-[#3e343f] bg-[#342e35] text-[#d4cad4]"
                  aria-label={t.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

    </section>
  );
}
