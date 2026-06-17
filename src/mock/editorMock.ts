export type AssetTab = "角色" | "场景" | "道具" | "历史";

export type AssetKind = "角色" | "场景" | "道具";

export interface AssetItem {
  id: string;
  kind: AssetKind;
  name: string;
  subtitle?: string;
  count?: number;
  imageUrl?: string;
}

export interface ShotItem {
  id: string;
  index: number;
  title: string;
  summary: string;
  imagePrompt: string;
  details: Array<{ label: string; value: string; tone?: "blue" | "pink" | "amber" }>;
  actions: string[];
  durationSec: number;
  posterUrl: string;
  status?: "error" | "empty" | "done";
}

export interface TimelineClip {
  id: string;
  shotId: string;
  label: string;
  durationSec: number;
  status: "error" | "empty" | "done";
}

const img = {
  preview1:
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=dark%20luxury%20bedroom%20cinematic%20scene%2C%20blue%20curtains%2C%20soft%20lamp%20light%2C%20moody%20interior%2C%20film%20still%2C%20high%20detail&image_size=portrait_16_9",
  preview2:
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=cinematic%20corridor%20with%20light%20beam%20through%20window%2C%20dark%20blue%20tones%2C%20suspense%20film%20still%2C%20high%20detail&image_size=portrait_16_9",
  role1:
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=full%20body%20character%20sheet%2C%20young%20man%20in%20light%20shirt%2C%20front%20view%2C%20plain%20background%2C%20photo%20realistic&image_size=square",
  role2:
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=full%20body%20character%20sheet%2C%20middle%20aged%20man%20in%20dark%20coat%2C%20front%20view%2C%20plain%20background%2C%20photo%20realistic&image_size=square",
  role3:
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=full%20body%20character%20sheet%2C%20older%20man%20in%20formal%20dark%20suit%2C%20front%20view%2C%20plain%20background%2C%20photo%20realistic&image_size=square",
  role4:
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=full%20body%20character%20sheet%2C%20young%20woman%20in%20modern%20blue%20dress%2C%20front%20view%2C%20plain%20background%2C%20photo%20realistic&image_size=square",
  role5:
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=full%20body%20character%20sheet%2C%20woman%20in%20dark%20purple%20dress%2C%20front%20view%2C%20plain%20background%2C%20photo%20realistic&image_size=square",
  propPhone:
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=product%20photo%2C%20vintage%20mobile%20phone%2C%20dark%20table%2C%20soft%20light%2C%20high%20detail&image_size=square",
  sceneVilla:
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=luxury%20villa%20interior%20reference%2C%20dark%20blue%20lighting%2C%20cinematic%20living%20room%2C%20high%20detail&image_size=square",
  sceneCorridor:
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=dark%20cinematic%20corridor%20reference%2C%20light%20beam%2C%20suspense%20atmosphere%2C%20high%20detail&image_size=square",
  dress:
    "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=product%20photo%2C%20dark%20purple%20velvet%20dress%20on%20mannequin%2C%20studio%20lighting%2C%20high%20detail&image_size=portrait_4_3",
};

export const mockAssets: AssetItem[] = [
  { id: "c-1", kind: "角色", name: "鲁四凤", subtitle: "鲁四凤", count: 2, imageUrl: img.role1 },
  { id: "c-2", kind: "角色", name: "周萍", subtitle: "周萍", count: 2, imageUrl: img.role2 },
  { id: "c-3", kind: "角色", name: "周朴园", subtitle: "周朴园", count: 2, imageUrl: img.role3 },
  { id: "c-4", kind: "角色", name: "鲁侍萍", subtitle: "鲁侍萍", count: 1, imageUrl: img.role2 },
  { id: "c-5", kind: "角色", name: "蘩漪", subtitle: "蘩漪", count: 4, imageUrl: img.role5 },
  { id: "c-6", kind: "角色", name: "鲁大海", subtitle: "鲁大海", count: 2, imageUrl: img.role1 },
  { id: "p-1", kind: "道具", name: "手机", subtitle: "关键道具", count: 1, imageUrl: img.propPhone },
  { id: "p-2", kind: "道具", name: "紫色礼服", subtitle: "服装", count: 1, imageUrl: img.dress },
  { id: "s-1", kind: "场景", name: "周公馆客厅", subtitle: "夜景", count: 2, imageUrl: img.sceneVilla },
  { id: "s-2", kind: "场景", name: "走廊", subtitle: "冷光", count: 1, imageUrl: img.sceneCorridor },
];

export const mockHistory: { id: string; title: string; detail: string; time: string }[] = [
  { id: "h-1", title: "重新生成", detail: "分镜 1 生成失败", time: "刚刚" },
  { id: "h-2", title: "切换角色", detail: "查看角色库：周萍", time: "1 分钟前" },
  { id: "h-3", title: "导出尝试", detail: "一键导出未执行", time: "5 分钟前" },
];

export const mockShots: ShotItem[] = [
  {
    id: "shot-1",
    index: 1,
    title: "分镜 1",
    summary: "画风：国产内豆重生复仇，电影级写实内景，颜熙压迫感强，女子强行压下情绪，冷静自控。",
    imagePrompt:
      "[BGM/音效:闷热的夏晨，隐约的蝉鸣声，令人烦躁]【全景】周公馆客厅，窗帘厚重，光线昏暗，透着一股死气沉沉的压抑感。",
    details: [
      { label: "基础信息", value: "昏暗压抑的打光", tone: "blue" },
      { label: "画面分镜", value: "[00:00]", tone: "blue" },
      { label: "中景", value: "鲁四凤站在红木桌旁", tone: "pink" },
      { label: "特写", value: "黑褐色的药汁滴落", tone: "amber" },
    ],
    actions: ["引用结果", "重新编辑", "克隆"],
    durationSec: 4,
    posterUrl: img.preview1,
    status: "error",
  },
  {
    id: "shot-2",
    index: 2,
    title: "分镜 2",
    summary: "提示词字数过多，请检查提示词字数，即梦限制提示词为 2000 字，请修改为小于 2000 字后重新提交。",
    imagePrompt:
      "[00:03]【中景】鲁四凤站在红木桌旁，正小心翼翼地将熬好的中药递入瓷碗中，额头渗出细密的汗珠。",
    details: [
      { label: "基础信息", value: "昏暗压抑的打光", tone: "blue" },
      { label: "画面分镜", value: "[00:03]", tone: "blue" },
      { label: "中景", value: "鲁四凤站在红木桌旁", tone: "pink" },
      { label: "镜头提醒", value: "请别漏气地从门缝进来", tone: "amber" },
    ],
    actions: ["引用结果", "重新编辑", "克隆"],
    durationSec: 4,
    posterUrl: img.preview2,
    status: "error",
  },
  {
    id: "shot-3",
    index: 3,
    title: "分镜 3",
    summary: "暂无素材",
    imagePrompt: "等待生成",
    details: [],
    actions: [],
    durationSec: 2,
    posterUrl: img.dress,
    status: "empty",
  },
  {
    id: "shot-4",
    index: 4,
    title: "分镜 4",
    summary: "生成失败",
    imagePrompt: "等待修正提示词",
    details: [],
    actions: [],
    durationSec: 4,
    posterUrl: img.preview1,
    status: "error",
  },
  {
    id: "shot-5",
    index: 5,
    title: "分镜 5",
    summary: "生成失败",
    imagePrompt: "等待修正提示词",
    details: [],
    actions: [],
    durationSec: 4,
    posterUrl: img.preview2,
    status: "error",
  },
  {
    id: "shot-6",
    index: 6,
    title: "分镜 6",
    summary: "暂无素材",
    imagePrompt: "等待生成",
    details: [],
    actions: [],
    durationSec: 2,
    posterUrl: img.preview1,
    status: "empty",
  },
];

export const previewThumbs = [
  { id: "thumb-1", imageUrl: img.preview1 },
  { id: "thumb-2", imageUrl: img.preview2 },
];

export const mockTimeline: TimelineClip[] = mockShots.map((s) => ({
  id: `clip-${s.index}`,
  shotId: s.id,
  label: String(s.index),
  durationSec: s.durationSec,
  status: s.status ?? "done",
}));
