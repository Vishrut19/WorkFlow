import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import "../global.css";


export default function RootLayout() {

  return (
    <SafeAreaView className="bg-black flex-1">
      <Text className="text-red-500 text-2xl">Hello World</Text>
    </SafeAreaView>
  );
}
