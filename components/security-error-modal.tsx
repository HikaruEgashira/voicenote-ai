import { Modal, View, Text, TouchableOpacity } from "react-native";

interface Props {
  visible: boolean;
  message: string;
  onDismiss: () => void;
}

export function SecurityErrorModal({ visible, message, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white rounded-xl p-6 mx-4 max-w-sm">
          <Text className="text-lg font-bold text-center mb-2">アクセス制限</Text>
          <Text className="text-gray-600 text-center mb-4">{message}</Text>
          <TouchableOpacity
            onPress={onDismiss}
            className="bg-blue-500 py-3 rounded-lg active:bg-blue-600"
          >
            <Text className="text-white text-center font-medium">閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
