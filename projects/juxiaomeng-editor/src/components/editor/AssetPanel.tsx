import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockAssets, mockHistory, type AssetTab } from "@/mock/editorMock";
import { useEditorStore } from "@/stores/editorStore";

const tabs: AssetTab[] = ["角色", "场景", "道具", "历史"];
const roleOrder = ["鲁四凤", "周萍", "周朴园", "鲁侍萍", "蘩漪", "鲁大海"];

function AssetRow({
  imageUrl,
  name,
  subtitle,
  count,
  active,
  onClick,
}: {
  imageUrl?: string;
  name: string;
  subtitle?: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[10px] border p-2 text-left transition",
        active ? "border-[#5a4a58] bg-[#2d262d]" : "border-[#413741] bg-[#272127] hover:bg-[#2c252b]"
      )}
    >
      <div className="h-[54px] w-[42px] overflow-hidden rounded-[6px] border border-[#564a56] bg-[#171217]">
        {imageUrl ? <img alt="" src={imageUrl} className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-[14px] font-medium text-[#f4eef2]">{name}</div>
          {typeof count === "number" ? <div className="text-[13px] text-[#d5ccd4]">| {count}个</div> : null}
        </div>
        <div className="mt-1 truncate text-[12px] text-[#8d818d]">{subtitle}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-[#8d818d]" />
    </button>
  );
}

export default function AssetPanel({ className }: { className?: string }) {
  const assetTab = useEditorStore((s) => s.assetTab);
  const selectedAsset = useEditorStore((s) => s.selectedAsset);
  const { setAssetTab, selectAsset } = useEditorStore((s) => s.actions);

  const list =
    assetTab === "历史"
      ? []
      : mockAssets
          .filter((a) => a.kind === assetTab)
          .sort((a, b) => roleOrder.indexOf(a.name) - roleOrder.indexOf(b.name));

  return (
    <aside className={cn("flex h-full w-[252px] flex-col overflow-hidden border-r border-[#332a33] bg-[#211c22]", className)}>
      <div className="border-b border-[#30262f] px-4 pt-3">
        <div className="flex items-center gap-5 text-[14px]">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setAssetTab(tab)}
              className={cn(
                "relative pb-2 text-sm transition",
                assetTab === tab ? "text-white" : "text-[#9f949d] hover:text-zinc-100"
              )}
            >
              {tab}
              {assetTab === tab ? <span className="absolute -bottom-px left-0 h-[2px] w-full rounded-full bg-white" /> : null}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2 pb-3">
          <button
            type="button"
            className="flex-1 rounded-[8px] border border-[#413741] bg-[#2a2329] px-3 py-2 text-[13px] text-[#d8cdd7]"
          >
            本地上传
          </button>
          <button
            type="button"
            className="flex-1 rounded-[8px] border border-[#4e434d] bg-[#30282f] px-3 py-2 text-[13px] text-white"
          >
            新增角色
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {assetTab === "历史" ? (
          <div className="space-y-2">
            {mockHistory.map((item) => (
              <div key={item.id} className="rounded-[10px] border border-[#433843] bg-[#2a242b] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] text-white">{item.title}</div>
                  <div className="text-[11px] text-[#8d818d]">{item.time}</div>
                </div>
                <div className="mt-1 text-[12px] text-[#a79ca6]">{item.detail}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((item) => (
              <AssetRow
                key={item.id}
                imageUrl={item.imageUrl}
                name={item.name}
                subtitle={item.subtitle}
                count={item.count}
                active={selectedAsset?.id === item.id}
                onClick={() => selectAsset(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
