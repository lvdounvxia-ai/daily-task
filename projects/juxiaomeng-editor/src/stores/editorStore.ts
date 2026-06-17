import { create } from "zustand";
import { mockAssets, mockTimeline, mockShots, type AssetTab } from "@/mock/editorMock";

type AssetSelection = { id: string } | null;

interface EditorState {
  assetTab: AssetTab;
  assetQuery: string;
  isAssetCollapsed: boolean;
  selectedAsset: AssetSelection;
  selectedShotId: string;
  selectedClipId: string;
  actions: {
    setAssetTab: (tab: AssetTab) => void;
    setAssetQuery: (q: string) => void;
    toggleAssetCollapsed: () => void;
    selectAsset: (id: string) => void;
    selectShot: (id: string) => void;
    selectClip: (id: string) => void;
  };
}

const initialShotId = mockShots[0]?.id ?? "shot-1";
const initialClipId = mockTimeline[0]?.id ?? "clip-1";
const initialAssetId = mockAssets[0]?.id ?? "c-1";

export const useEditorStore = create<EditorState>((set) => ({
  assetTab: "角色",
  assetQuery: "",
  isAssetCollapsed: false,
  selectedAsset: initialAssetId ? { id: initialAssetId } : null,
  selectedShotId: initialShotId,
  selectedClipId: initialClipId,
  actions: {
    setAssetTab: (tab) => set({ assetTab: tab }),
    setAssetQuery: (q) => set({ assetQuery: q }),
    toggleAssetCollapsed: () => set((s) => ({ isAssetCollapsed: !s.isAssetCollapsed })),
    selectAsset: (id) => set({ selectedAsset: { id } }),
    selectShot: (id) => set({ selectedShotId: id }),
    selectClip: (id) => set({ selectedClipId: id }),
  },
}));

