import { useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, useWindowDimensions, View } from "react-native";

/** Web at or above this width gets the left rail and wider padding. */
export const WIDE_MIN = 1024;

export function useIsWide() {
  return useWindowDimensions().width >= WIDE_MIN;
}

/**
 * Keyboard-safe scrolling (use this or ScreenBody for EVERY screen with a typing box).
 *
 * Android draws edge to edge, so the window no longer shrinks when the keyboard opens and a box
 * near the bottom hides behind it (owner found this on Opening dip and Sign in, 27 Sep). Here, on
 * Android, the content gets room under it equal to the keyboard, and the box being typed in is
 * scrolled to just above the keyboard, with room for a short message under it (an error that
 * appears while typing is scrolled into view too). `revealToEnd` scrolls to the very end instead,
 * for short forms whose main button sits below the last box (Sign in). iPhone uses
 * KeyboardAvoidingView.
 */
export function KeyboardSafeScroll({
  children,
  contentContainerClassName,
  revealToEnd,
}: {
  children: ReactNode;
  contentContainerClassName?: string;
  revealToEnd?: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Room kept under the box being typed in: enough for a two-line message below it.
  const ROOM_BELOW = 72;
  const reveal = () => {
    const top = keyboardTop.current;
    if (top === null) return;
    if (revealToEnd) {
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }
    TextInput.State.currentlyFocusedInput()?.measureInWindow((_x, y, _w, h) => {
      const overlap = y + h + ROOM_BELOW - top;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  };

  useAndroidKeyboard(
    (top, height) => {
      keyboardTop.current = top;
      setKeyboardHeight(height);
      setTimeout(reveal, 50);
    },
    () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    },
  );

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName={contentContainerClassName}
        contentContainerStyle={keyboardHeight ? { paddingBottom: keyboardHeight } : undefined}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        // A message that appears under the box while typing makes the content taller: reveal again.
        onContentSizeChange={() => {
          if (keyboardTop.current !== null) setTimeout(reveal, 50);
        }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Android only: tells you when the keyboard opens (its top edge on screen and its height) and closes. */
export function useAndroidKeyboard(onShow: (keyboardTop: number, height: number) => void, onHide: () => void) {
  const handlers = useRef({ onShow, onHide });
  useEffect(() => {
    handlers.current = { onShow, onHide };
  });
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => handlers.current.onShow(e.endCoordinates.screenY, e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => handlers.current.onHide());
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
}

/**
 * Scrolling body of a screen. Entry content stays 480 px wide: centred on phones and tablets,
 * left column on wide web (the spare width is for summaries later).
 * With a sticky bar, the bar sits outside the scroll so the last field is never covered.
 * Keyboard-safe (see KeyboardSafeScroll).
 */
export function ScreenBody({ children, sticky }: { children: ReactNode; sticky?: ReactNode }) {
  const wide = useIsWide();
  return (
    <View className="flex-1 bg-bg">
      <KeyboardSafeScroll contentContainerClassName={wide ? "p-24" : "p-16"}>
        <View className={`w-full max-w-content gap-16 ${wide ? "" : "self-center"}`}>{children}</View>
      </KeyboardSafeScroll>
      {sticky ? (
        <View className={wide ? "items-start px-8" : ""}>
          <View className={`w-full ${wide ? "max-w-[496px]" : ""}`}>{sticky}</View>
        </View>
      ) : null}
    </View>
  );
}
