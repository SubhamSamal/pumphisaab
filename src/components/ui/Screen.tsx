import { useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, useWindowDimensions, View } from "react-native";

/** Web at or above this width gets the left rail and wider padding. */
export const WIDE_MIN = 1024;

export function useIsWide() {
  return useWindowDimensions().width >= WIDE_MIN;
}

/**
 * Scrolling body of a screen. Entry content stays 480 px wide: centred on phones and tablets,
 * left column on wide web (the spare width is for summaries later).
 * With a sticky bar, the bar sits outside the scroll so the last field is never covered.
 *
 * Keyboard: Android draws edge to edge, so the window no longer shrinks when the keyboard opens.
 * The body makes room for the keyboard, then scrolls the box being typed in into view, so the
 * number is always visible while typing (owner found this on Opening dip, 27 Sep).
 */
export function ScreenBody({ children, sticky }: { children: ReactNode; sticky?: ReactNode }) {
  const wide = useIsWide();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Android: add room under the content for the keyboard, then scroll the box being typed in up
  // until it sits just above the keyboard. (iPhone uses KeyboardAvoidingView below, which works there.)
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => {
        const input = TextInput.State.currentlyFocusedInput();
        input?.measureInWindow((_x, y, _w, h) => {
          const overlap = y + h + 24 - keyboardTop;
          if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
        });
      }, 50);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName={wide ? "p-24" : "p-16"}
        contentContainerStyle={keyboardHeight ? { paddingBottom: keyboardHeight } : undefined}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
      >
        <View className={`w-full max-w-content gap-16 ${wide ? "" : "self-center"}`}>{children}</View>
      </ScrollView>
      {sticky ? (
        <View className={wide ? "items-start px-8" : ""}>
          <View className={`w-full ${wide ? "max-w-[496px]" : ""}`}>{sticky}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
