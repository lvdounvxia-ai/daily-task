import AgentChatWidget from "@/components/editor/AgentChatWidget";
import AssetPanel from "@/components/editor/AssetPanel";
import PreviewPanel from "@/components/editor/PreviewPanel";
import StoryboardPanel from "@/components/editor/StoryboardPanel";
import TimelinePanel from "@/components/editor/TimelinePanel";
import TopBar from "@/components/editor/TopBar";

export default function Editor() {
  return (
    <div className="min-h-screen bg-[#161217] text-zinc-100">
      <div className="relative flex min-h-screen flex-col">
        <TopBar />

        <div className="flex min-h-0 flex-1 gap-3 px-3 py-3">
          <main className="flex min-w-0 flex-1 flex-col rounded-[14px] border border-[#2f2630] bg-[#211c22] shadow-[0_12px_40px_rgba(0,0,0,.18)]">
            <div className="grid min-h-0 flex-1 grid-cols-[252px_560px_minmax(0,1fr)]">
              <AssetPanel className="h-full" />
              <StoryboardPanel className="h-full border-r border-[#322933]" />
              <div className="flex min-h-0 flex-col border-r border-[#322933]">
                <PreviewPanel className="min-h-0 flex-1" />
                <TimelinePanel />
              </div>
            </div>
          </main>
        </div>

        <AgentChatWidget />
      </div>
    </div>
  );
}
