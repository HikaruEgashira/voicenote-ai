import { view } from "./storybook.requires";
import { Platform } from "react-native";

// Web用のストレージラッパー
const webStorage = {
  getItem: async (key: string) => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: async (key: string, value: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
  },
};

// Native用のAsyncStorage
const getNativeStorage = () => {
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  return {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  };
};

const storage = Platform.OS === "web" ? webStorage : getNativeStorage();

const StorybookUIRoot = view.getStorybookUI({
  storage,
});

export default StorybookUIRoot;
