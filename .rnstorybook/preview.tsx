import React from "react";
import type { Preview } from "@storybook/react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/packages/lib/theme-provider";
import { SettingsProvider } from "@/packages/lib/settings-context";
import "@/global.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider>
        <SafeAreaProvider>
          <SettingsProvider>
            <View style={{ flex: 1 }}>
              <Story />
            </View>
          </SettingsProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
