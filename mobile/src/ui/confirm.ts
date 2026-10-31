import { Alert } from "react-native";

/** Pide confirmar algo que no se deshace (el confirm() de la web). */
export function confirmAction(title: string, message: string, action: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: "Cancelar", style: "cancel" },
    { text: action, style: "destructive", onPress: onConfirm },
  ]);
}
