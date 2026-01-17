import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
} from "react-native";
import { useColors } from "@/packages/hooks/use-colors";
import { IconSymbol } from "@/packages/components/ui/icon-symbol";

// Viewport sizes for testing
const VIEWPORTS = {
  iPhoneSE: { width: 375, height: 667, name: "iPhone SE" },
  iPhone14: { width: 390, height: 844, name: "iPhone 14" },
  iPhone14ProMax: { width: 430, height: 932, name: "iPhone 14 Pro Max" },
  iPadMini: { width: 768, height: 1024, name: "iPad Mini" },
  iPadPro: { width: 1024, height: 1366, name: "iPad Pro 12.9" },
  desktop: { width: 1280, height: 800, name: "Desktop" },
  desktopWide: { width: 1920, height: 1080, name: "Desktop Wide" },
} as const;

interface ViewportContainerProps {
  width: number;
  height: number;
  name: string;
  children: React.ReactNode;
}

function ViewportContainer({ width, height, name, children }: ViewportContainerProps) {
  const colors = useColors();
  const screenWidth = Dimensions.get("window").width;
  const scale = Math.min(1, (screenWidth - 40) / width);

  return (
    <View style={styles.viewportWrapper}>
      <Text style={[styles.viewportLabel, { color: colors.foreground }]}>
        {name} ({width}x{height})
      </Text>
      <View
        style={[
          styles.viewportFrame,
          {
            width: width * scale,
            height: height * scale,
            borderColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={{ transform: [{ scale }], width, height }}>
          {children}
        </View>
      </View>
    </View>
  );
}

// Mock Filter Row Component (problem area)
function FilterRowDemo() {
  const colors = useColors();
  const filters = ["すべて", "文字起こし済", "要約済", "ハイライト", "未完了タスク"];

  return (
    <View style={[filterStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[filterStyles.title, { color: colors.foreground }]}>フィルター問題の再現</Text>

      {/* Problem: Filter buttons overflow on narrow screens */}
      <View style={filterStyles.filterRow}>
        {filters.map((f, i) => (
          <TouchableOpacity
            key={f}
            style={[
              filterStyles.filterButton,
              {
                backgroundColor: i === 0 ? colors.primary : colors.surface,
                borderColor: i === 0 ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                filterStyles.filterText,
                { color: i === 0 ? "#FFFFFF" : colors.muted },
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Problem indicator */}
      <View style={[filterStyles.indicator, { backgroundColor: colors.error + "20" }]}>
        <Text style={[filterStyles.indicatorText, { color: colors.error }]}>
          ⚠️ 375px幅では最後の2つのボタンが見切れる
        </Text>
      </View>
    </View>
  );
}

// Mock Tab Bar Component (problem area)
function TabBarDemo() {
  const colors = useColors();
  const tabs = [
    { key: "audio", label: "音声", icon: "waveform" },
    { key: "transcript", label: "文字起こし", icon: "doc.text.fill" },
    { key: "summary", label: "要約", icon: "star.fill" },
    { key: "qa", label: "Q&A", icon: "text.bubble.fill" },
  ];

  return (
    <View style={[tabStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[tabStyles.title, { color: colors.foreground }]}>タブバー タップ領域問題</Text>

      <View style={[tabStyles.tabBar, { borderBottomColor: colors.border }]}>
        {tabs.map((tab, i) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              tabStyles.tab,
              i === 0 && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
          >
            <IconSymbol
              name={tab.icon as any}
              size={18}
              color={i === 0 ? colors.primary : colors.muted}
            />
            <Text
              style={[
                tabStyles.tabLabel,
                { color: i === 0 ? colors.primary : colors.muted },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tap area visualization */}
      <View style={[tabStyles.tapAreaRow, { borderColor: colors.border }]}>
        {tabs.map((tab) => (
          <View key={tab.key} style={tabStyles.tapAreaItem}>
            <View style={[tabStyles.tapAreaBox, { borderColor: colors.error }]}>
              <Text style={[tabStyles.tapAreaText, { color: colors.error }]}>
                44x44
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[tabStyles.indicator, { backgroundColor: colors.error + "20" }]}>
        <Text style={[tabStyles.indicatorText, { color: colors.error }]}>
          ⚠️ 現在のタップ領域は paddingVertical: 12px のみ（約36px）
        </Text>
      </View>
    </View>
  );
}

// Mock Recording Card Grid (problem area)
function CardGridDemo() {
  const colors = useColors();
  const cards = [
    { title: "週次ミーティング", duration: "30:00", status: "要約完了" },
    { title: "1on1ミーティング", duration: "45:00", status: "文字起こし完了" },
    { title: "プロジェクト計画", duration: "60:00", status: "保存済み" },
    { title: "アイデアブレスト", duration: "20:00", status: "要約中" },
  ];

  return (
    <View style={[cardStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[cardStyles.title, { color: colors.foreground }]}>カードグリッド レスポンシブ問題</Text>

      <ScrollView style={cardStyles.scrollView}>
        <View style={cardStyles.grid}>
          {cards.map((card, i) => (
            <View
              key={i}
              style={[
                cardStyles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[cardStyles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                {card.title}
              </Text>
              <View style={cardStyles.cardMeta}>
                <Text style={[cardStyles.cardDuration, { color: colors.muted }]}>
                  {card.duration}
                </Text>
                <View style={[cardStyles.statusBadge, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[cardStyles.statusText, { color: colors.primary }]}>
                    {card.status}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[cardStyles.indicator, { backgroundColor: colors.warning + "20" }]}>
        <Text style={[cardStyles.indicatorText, { color: colors.warning }]}>
          ⚠️ iPad (768px) でカラム数が2になるが、カード幅の計算で余白が不均一
        </Text>
      </View>
    </View>
  );
}

// Mock Waveform (problem area)
function WaveformDemo() {
  const colors = useColors();
  const barCount = 50; // Fixed count - problem

  return (
    <View style={[waveformStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[waveformStyles.title, { color: colors.foreground }]}>波形表示 固定バー数問題</Text>

      <View style={[waveformStyles.waveform, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={waveformStyles.waveformBars}>
          {Array.from({ length: barCount }).map((_, i) => (
            <View
              key={i}
              style={[
                waveformStyles.waveformBar,
                {
                  backgroundColor: i < 20 ? colors.primary : colors.muted,
                  height: 20 + Math.random() * 40,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={[waveformStyles.indicator, { backgroundColor: colors.warning + "20" }]}>
        <Text style={[waveformStyles.indicatorText, { color: colors.warning }]}>
          ⚠️ 50本のバーが固定。375px画面では3pxバー + 隙間で187px必要だが、パディング込みで収まらない
        </Text>
      </View>
    </View>
  );
}

// Mock Search + Smart Folders (problem area)
function SearchSmartFoldersDemo() {
  const colors = useColors();
  const smartFolders = [
    { name: "未処理", count: 3 },
    { name: "今週", count: 8 },
    { name: "重要タスク", count: 2 },
    { name: "ポジティブ", count: 5 },
  ];

  return (
    <View style={[searchStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[searchStyles.title, { color: colors.foreground }]}>検索 + スマートフォルダー問題</Text>

      {/* Smart Folders */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={searchStyles.smartFoldersScroll}
      >
        <View style={searchStyles.smartFolders}>
          {smartFolders.map((folder, i) => (
            <TouchableOpacity
              key={folder.name}
              style={[
                searchStyles.smartFolder,
                {
                  backgroundColor: i === 0 ? colors.primary + "20" : colors.surface,
                  borderColor: i === 0 ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[searchStyles.smartFolderText, { color: i === 0 ? colors.primary : colors.muted }]}>
                {folder.name}
              </Text>
              <View style={[searchStyles.badge, { backgroundColor: i === 0 ? colors.primary : colors.muted + "30" }]}>
                <Text style={[searchStyles.badgeText, { color: i === 0 ? "#FFFFFF" : colors.muted }]}>
                  {folder.count}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Search */}
      <View style={[searchStyles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
        <TextInput
          style={[searchStyles.searchInput, { color: colors.foreground }]}
          placeholder="タイトル、タグ、内容を検索..."
          placeholderTextColor={colors.muted}
        />
      </View>

      <View style={[searchStyles.indicator, { backgroundColor: colors.warning + "20" }]}>
        <Text style={[searchStyles.indicatorText, { color: colors.warning }]}>
          ⚠️ スマートフォルダーがスクロール可能であることが視覚的に不明確
        </Text>
      </View>
    </View>
  );
}

// Main viewport test component
interface ViewportTestProps {
  viewport: keyof typeof VIEWPORTS;
  component: "filters" | "tabs" | "cards" | "waveform" | "search";
}

function ViewportTest({ viewport, component }: ViewportTestProps) {
  const vp = VIEWPORTS[viewport];

  const renderComponent = () => {
    switch (component) {
      case "filters":
        return <FilterRowDemo />;
      case "tabs":
        return <TabBarDemo />;
      case "cards":
        return <CardGridDemo />;
      case "waveform":
        return <WaveformDemo />;
      case "search":
        return <SearchSmartFoldersDemo />;
    }
  };

  return (
    <ViewportContainer width={vp.width} height={Math.min(vp.height, 600)} name={vp.name}>
      {renderComponent()}
    </ViewportContainer>
  );
}

const styles = StyleSheet.create({
  viewportWrapper: {
    margin: 16,
  },
  viewportLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  viewportFrame: {
    borderWidth: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
});

const filterStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "nowrap", // Problem: no wrap causes overflow
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "500",
  },
  indicator: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  indicatorText: {
    fontSize: 12,
  },
});

const tabStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12, // Problem: too small
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  tapAreaRow: {
    flexDirection: "row",
    marginTop: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 8,
  },
  tapAreaItem: {
    flex: 1,
    alignItems: "center",
  },
  tapAreaBox: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tapAreaText: {
    fontSize: 10,
    fontWeight: "600",
  },
  indicator: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  indicatorText: {
    fontSize: 12,
  },
});

const cardStyles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "48%", // Problem: fixed percentage doesn't account for gap
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardDuration: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  indicator: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  indicatorText: {
    fontSize: 12,
  },
});

const waveformStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  waveform: {
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    justifyContent: "center",
  },
  waveformBars: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: "100%",
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
  indicator: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  indicatorText: {
    fontSize: 12,
  },
});

const searchStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  smartFoldersScroll: {
    marginBottom: 12,
  },
  smartFolders: {
    flexDirection: "row",
    gap: 8,
  },
  smartFolder: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  smartFolderText: {
    fontSize: 13,
    fontWeight: "500",
  },
  badge: {
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  indicator: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  indicatorText: {
    fontSize: 12,
  },
});

const meta: Meta<typeof ViewportTest> = {
  title: "Viewport/ResponsiveIssues",
  component: ViewportTest,
  argTypes: {
    viewport: {
      control: "select",
      options: Object.keys(VIEWPORTS),
    },
    component: {
      control: "select",
      options: ["filters", "tabs", "cards", "waveform", "search"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof ViewportTest>;

// iPhone SE - Most constrained viewport
export const FiltersiPhoneSE: Story = {
  args: { viewport: "iPhoneSE", component: "filters" },
};

export const TabsiPhoneSE: Story = {
  args: { viewport: "iPhoneSE", component: "tabs" },
};

export const WaveformiPhoneSE: Story = {
  args: { viewport: "iPhoneSE", component: "waveform" },
};

export const SearchiPhoneSE: Story = {
  args: { viewport: "iPhoneSE", component: "search" },
};

// iPad Mini - Breakpoint transition
export const FiltersiPadMini: Story = {
  args: { viewport: "iPadMini", component: "filters" },
};

export const CardsiPadMini: Story = {
  args: { viewport: "iPadMini", component: "cards" },
};

// iPad Pro - Regular layout
export const CardsiPadPro: Story = {
  args: { viewport: "iPadPro", component: "cards" },
};

// Desktop Wide - Maximum width
export const CardsDesktopWide: Story = {
  args: { viewport: "desktopWide", component: "cards" },
};

export const FiltersDesktopWide: Story = {
  args: { viewport: "desktopWide", component: "filters" },
};
