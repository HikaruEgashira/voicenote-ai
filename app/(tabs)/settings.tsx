import { useState, useEffect } from "react";
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "@/packages/components/screen-container";
import { IconSymbol } from "@/packages/components/ui/icon-symbol";
import { useRecordings } from "@/packages/lib/recordings-context";
import { useColors } from "@/packages/hooks/use-colors";

type SummaryTemplate = "general" | "meeting" | "interview" | "lecture";
type Language = "ja" | "en" | "auto";
type TranscriptionProvider = "elevenlabs" | "gemini";

interface SettingsState {
  language: Language;
  summaryTemplate: SummaryTemplate;
  autoTranscribe: boolean;
  autoSummarize: boolean;
  transcriptionProvider: TranscriptionProvider;
  realtimeTranscription: {
    enabled: boolean;
    language: string;
    enableSpeakerDiarization: boolean;
  };
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "auto", label: "自動検出" },
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
];

const TRANSCRIPTION_PROVIDERS: { value: TranscriptionProvider; label: string; description: string }[] = [
  { value: "gemini", label: "Gemini", description: "Googleのマルチモーダルモデル" },
  { value: "elevenlabs", label: "ElevenLabs", description: "高精度な話者分離機能" },
];

const TEMPLATES: { value: SummaryTemplate; label: string; description: string }[] = [
  { value: "general", label: "一般", description: "汎用的な要約形式" },
  { value: "meeting", label: "会議", description: "議題・決定事項・アクションアイテム" },
  { value: "interview", label: "インタビュー", description: "主要トピック・重要発言・結論" },
  { value: "lecture", label: "講義", description: "主要概念・学習ポイント" },
];

const SETTINGS_KEY = "app-settings";

export default function SettingsScreen() {
  const colors = useColors();
  const { state: recordingsState } = useRecordings();

  const [settings, setSettings] = useState<SettingsState>({
    language: "auto",
    summaryTemplate: "general",
    autoTranscribe: false,
    autoSummarize: false,
    transcriptionProvider: "elevenlabs",
    realtimeTranscription: {
      enabled: false,
      language: "ja",
      enableSpeakerDiarization: true,
    },
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await AsyncStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const savedSettings = JSON.parse(saved);
          // Merge with default settings to handle missing fields
          setSettings((prev) => ({
            ...prev,
            ...savedSettings,
            realtimeTranscription: {
              ...prev.realtimeTranscription,
              ...(savedSettings.realtimeTranscription || {}),
            },
          }));
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  // Save settings whenever they change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error("Failed to save settings:", error);
      }
    };
    saveSettings();
  }, [settings]);

  const handleLanguageChange = (language: Language) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSettings((prev) => ({ ...prev, language }));
  };

  const handleTemplateChange = (template: SummaryTemplate) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSettings((prev) => ({ ...prev, summaryTemplate: template }));
  };

  const handleProviderChange = (provider: TranscriptionProvider) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSettings((prev) => ({ ...prev, transcriptionProvider: provider }));
  };

  const handleToggle = (key: "autoTranscribe" | "autoSummarize") => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClearData = () => {
    Alert.alert(
      "データを削除",
      "すべての録音データを削除しますか？この操作は取り消せません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert("完了", "すべてのデータが削除されました。アプリを再起動してください。");
            } catch {
              Alert.alert("エラー", "データの削除に失敗しました");
            }
          },
        },
      ]
    );
  };

  const totalDuration = recordingsState.recordings.reduce((sum, r) => sum + r.duration, 0);
  const transcribedCount = recordingsState.recordings.filter((r) => r.transcript).length;
  const summarizedCount = recordingsState.recordings.filter((r) => r.summary).length;

  return (
    <ScreenContainer>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>設定</Text>
        </View>

        {/* Statistics */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>統計</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {recordingsState.recordings.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>録音数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {Math.floor(totalDuration / 60)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>合計時間(分)</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.success }]}>{transcribedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>文字起こし済</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.secondary }]}>{summarizedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>要約済</Text>
            </View>
          </View>
        </View>

        {/* Language */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>言語設定</Text>
          <View style={styles.optionGroup}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.value}
                onPress={() => handleLanguageChange(lang.value)}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor:
                      settings.language === lang.value ? colors.primary : colors.background,
                    borderColor:
                      settings.language === lang.value ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color:
                        settings.language === lang.value ? "#FFFFFF" : colors.foreground,
                    },
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Transcription Provider - Hidden: ElevenLabs is now default
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>文字起こしプロバイダ</Text>
          {TRANSCRIPTION_PROVIDERS.map((provider) => (
            <TouchableOpacity
              key={provider.value}
              onPress={() => handleProviderChange(provider.value)}
              style={[
                styles.templateItem,
                {
                  backgroundColor:
                    settings.transcriptionProvider === provider.value
                      ? colors.primary + "15"
                      : "transparent",
                  borderColor:
                    settings.transcriptionProvider === provider.value ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={styles.templateContent}>
                <Text
                  style={[
                    styles.templateLabel,
                    {
                      color:
                        settings.transcriptionProvider === provider.value
                          ? colors.primary
                          : colors.foreground,
                    },
                  ]}
                >
                  {provider.label}
                </Text>
                <Text style={[styles.templateDescription, { color: colors.muted }]}>
                  {provider.description}
                </Text>
              </View>
              {settings.transcriptionProvider === provider.value && (
                <IconSymbol name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        */}

        {/* Summary Template */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>要約テンプレート</Text>
          {TEMPLATES.map((template) => (
            <TouchableOpacity
              key={template.value}
              onPress={() => handleTemplateChange(template.value)}
              style={[
                styles.templateItem,
                {
                  backgroundColor:
                    settings.summaryTemplate === template.value
                      ? colors.primary + "15"
                      : "transparent",
                  borderColor:
                    settings.summaryTemplate === template.value ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={styles.templateContent}>
                <Text
                  style={[
                    styles.templateLabel,
                    {
                      color:
                        settings.summaryTemplate === template.value
                          ? colors.primary
                          : colors.foreground,
                    },
                  ]}
                >
                  {template.label}
                </Text>
                <Text style={[styles.templateDescription, { color: colors.muted }]}>
                  {template.description}
                </Text>
              </View>
              {settings.summaryTemplate === template.value && (
                <IconSymbol name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Auto Processing */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>自動処理</Text>
          <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
                自動文字起こし
              </Text>
              <Text style={[styles.toggleDescription, { color: colors.muted }]}>
                録音完了後に自動で文字起こしを開始
              </Text>
            </View>
            <Switch
              value={settings.autoTranscribe}
              onValueChange={() => handleToggle("autoTranscribe")}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: colors.foreground }]}>自動要約</Text>
              <Text style={[styles.toggleDescription, { color: colors.muted }]}>
                文字起こし完了後に自動で要約を生成
              </Text>
            </View>
            <Switch
              value={settings.autoSummarize}
              onValueChange={() => handleToggle("autoSummarize")}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Realtime Transcription */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            リアルタイム文字起こし
          </Text>
          <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
                リアルタイムモード
              </Text>
              <Text style={[styles.toggleDescription, { color: colors.muted }]}>
                録音中にリアルタイムで文字起こし結果を表示（150ms遅延）
              </Text>
            </View>
            <Switch
              value={settings.realtimeTranscription.enabled}
              onValueChange={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setSettings((prev) => ({
                  ...prev,
                  realtimeTranscription: {
                    ...prev.realtimeTranscription,
                    enabled: !prev.realtimeTranscription.enabled,
                  },
                }));
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          {settings.realtimeTranscription.enabled && (
            <>
              <View style={styles.toggleRow}>
                <View style={styles.toggleContent}>
                  <Text style={[styles.toggleLabel, { color: colors.foreground }]}>話者分離</Text>
                  <Text style={[styles.toggleDescription, { color: colors.muted }]}>
                    複数の話者を自動識別してラベル付け
                  </Text>
                </View>
                <Switch
                  value={settings.realtimeTranscription.enableSpeakerDiarization}
                  onValueChange={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setSettings((prev) => ({
                      ...prev,
                      realtimeTranscription: {
                        ...prev.realtimeTranscription,
                        enableSpeakerDiarization:
                          !prev.realtimeTranscription.enableSpeakerDiarization,
                      },
                    }));
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={[styles.noteBox, { backgroundColor: colors.warning + "15" }]}>
                <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.warning} />
                <Text style={[styles.noteText, { color: colors.warning }]}>
                  リアルタイムモードはネットワーク使用量とバッテリー消費が増加します
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Data Management */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>データ管理</Text>
          <TouchableOpacity
            onPress={handleClearData}
            style={[styles.dangerButton, { borderColor: colors.error }]}
          >
            <IconSymbol name="trash.fill" size={20} color={colors.error} />
            <Text style={[styles.dangerButtonText, { color: colors.error }]}>
              すべてのデータを削除
            </Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>アプリ情報</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>バージョン</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>ビルド</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>2024.01</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.muted }]}>
            Pleno Transcribe
          </Text>
          <Text style={[styles.footerSubtext, { color: colors.muted }]}>
            音声録音・文字起こし・AI要約アプリ
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  statItem: {
    width: "50%",
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  optionGroup: {
    flexDirection: "row",
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  templateItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  templateContent: {
    flex: 1,
  },
  templateLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  templateDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  toggleDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "500",
  },
  footerSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
});
