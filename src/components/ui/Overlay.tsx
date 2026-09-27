import { useEffect, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { shadow } from "@/theme/theme";
import { Icon } from "./Icon";
import { useAndroidKeyboard } from "./Screen";
import { Text } from "./Text";

/**
 * Bottom sheet over a scrim: 16 px top radius, handle, shadow. Tap outside to close.
 * It rises above the keyboard, so a field inside it is never hidden while typing.
 */
export function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<View>(null);
  const [lift, setLift] = useState(0);

  // Android: whether or not the window shrank for the keyboard, measure where the sheet ends up
  // and lift it by exactly the part the keyboard still covers (see KeyboardSafeScroll).
  useAndroidKeyboard(
    (keyboardTop) =>
      setTimeout(
        () => sheetRef.current?.measureInWindow((_x, y, _w, h) => setLift((cur) => Math.max(0, cur + y + h - keyboardTop))),
        50,
      ),
    () => setLift(0),
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView className="flex-1 justify-end" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable
          className="absolute inset-0 bg-text-primary/50"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          ref={sheetRef}
          className="w-full max-w-content gap-16 self-center rounded-t-lg bg-bg px-16 pt-12"
          style={{ paddingBottom: Math.max(24, insets.bottom), marginBottom: lift, boxShadow: shadow.sheet[scheme] }}
        >
          <View className="h-4 w-40 self-center rounded-full bg-border-strong" />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Short confirmation above the sticky bar. Success hides itself after 4 s; errors stay until dismissed.
 * Render it inside the screen, positioned by the parent.
 */
export function Toast({ message, tone = "success", onDismiss }: { message: string; tone?: "success" | "error"; onDismiss?: () => void }) {
  const { scheme } = useTheme();
  useEffect(() => {
    if (tone !== "success" || !onDismiss) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [tone, onDismiss]);
  const error = tone === "error";
  return (
    <View
      className={`flex-row items-center gap-12 rounded-md px-16 py-12 ${error ? "bg-danger" : "bg-text-primary"}`}
      style={{ boxShadow: shadow.sheet[scheme] }}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon name={error ? "error" : "check"} color={error ? "on-danger" : "success-on-inverse"} />
      <Text variant="body" tone={error ? "onDanger" : "inverse"} className="flex-1">
        {message}
      </Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Icon name="close" color={error ? "on-danger" : "bg"} />
        </Pressable>
      ) : null}
    </View>
  );
}
