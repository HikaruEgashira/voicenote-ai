import React from "react";
import type { Preview } from "@storybook/react";
import { View, ScrollView, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/packages/lib/theme-provider";
import { SettingsProvider } from "@/packages/lib/settings-context";
import "@/global.css";

// Mobile-first: iPhone SE viewport as default
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 667;

const preview: Preview = {
  decorators: [
    (Story, context) => {
      // Skip mobile container for viewport test stories (they handle their own sizing)
      const isViewportTest = context.title?.startsWith("Viewport/");

      return (
        <ThemeProvider>
          <SafeAreaProvider>
            <SettingsProvider>
              {Platform.OS === "web" && !isViewportTest ? (
                <View style={{ flex: 1, alignItems: "center", backgroundColor: "#1a1a1a", padding: 20 }}>
                  <View
                    style={{
                      width: MOBILE_WIDTH,
                      height: MOBILE_HEIGHT,
                      backgroundColor: "#f5f5f5",
                      borderRadius: 20,
                      overflow: "hidden",
                      borderWidth: 8,
                      borderColor: "#333",
                    }}
                  >
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
                      <Story />
                    </ScrollView>
                  </View>
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <Story />
                </View>
              )}
            </SettingsProvider>
          </SafeAreaProvider>
        </ThemeProvider>
      );
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    // Mobile-first: panel on right side
    layout: "fullscreen",
    panelPosition: "right",
  },
};

export default preview;
