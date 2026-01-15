// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";
import reactNativePlugin from "eslint-plugin-react-native";

export default defineConfig([
  expoConfig,
  {
    plugins: {
      "react-native": reactNativePlugin,
    },
    rules: {
      // StyleSheet定義で未使用スタイルを検出
      "react-native/no-unused-styles": "error",
    },
  },
  {
    ignores: ["dist/*"],
  },
]);
