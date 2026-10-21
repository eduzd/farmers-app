import React, { useEffect, useRef, useState, ReactNode } from "react";
import {
  FlatList,
  Keyboard,
  StyleSheet,
  TextInput,
  View,
  ListRenderItem,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated from "react-native-reanimated";
import { useKeyboardAwareBottomPadding } from "@/hooks/useKeyboardAwareBottomPadding";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface KeyboardComposerLayoutProps<T> {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor?: (item: T, index: number) => string;
  inputValue: string;
  onChangeInput: (text: string) => void;
  onSend?: () => void;
  placeholder?: string;
  inverted?: boolean;
  ListEmptyComponent?: ReactNode;
  leftButton?: ReactNode;
  rightButton?: ReactNode;
  headerComponent?: ReactNode;
}

export default function KeyboardComposerLayout<T>({
  data,
  renderItem,
  keyExtractor,
  inputValue,
  onChangeInput,
  onSend,
  placeholder = "Type...",
  inverted = false,
  ListEmptyComponent,
  leftButton,
  rightButton,
  headerComponent,
}: KeyboardComposerLayoutProps<T>) {
  const { theme } = useTheme();
  const composerPadding = useKeyboardAwareBottomPadding(Spacing.sm);
  const listRef = useRef<FlatList>(null);

  const [composerHeight, setComposerHeight] = useState(44);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      requestAnimationFrame(() => {
        if (inverted) {
          listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
        } else {
          listRef.current?.scrollToEnd?.({ animated: true });
        }
      });
    });
    return () => show.remove();
  }, [inverted]);

  const bottomPad = composerHeight + 60;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
      {headerComponent}
      <FlatList
        ref={listRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor || ((item: any, index) => item?.id?.toString?.() ?? String(index))}
        style={styles.flex}
        contentContainerStyle={[
          { paddingTop: 8, paddingBottom: bottomPad },
          data.length === 0 && styles.emptyList,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        inverted={inverted && data.length > 0}
        ListEmptyComponent={ListEmptyComponent as React.ReactElement}
        showsVerticalScrollIndicator={false}
      />

      <Animated.View style={[styles.composerWrap, { backgroundColor: theme.white, borderTopColor: theme.inputBorder }, composerPadding]}>
        <View style={styles.composerRow}>
          {leftButton}
          <View style={[styles.composer, { backgroundColor: theme.backgroundRoot, borderColor: theme.inputBorder }]}>
            <TextInput
              value={inputValue}
              onChangeText={onChangeInput}
              placeholder={placeholder}
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[styles.input, { height: composerHeight, color: theme.text }]}
              onContentSizeChange={(e) => {
                const h = e.nativeEvent.contentSize.height;
                const MIN = 44;
                const MAX = 140;
                const next = Math.max(MIN, Math.min(MAX, Math.ceil(h)));
                if (next !== composerHeight) setComposerHeight(next);
              }}
            />
          </View>
          {rightButton}
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  emptyList: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  composerWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  composer: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  input: {
    fontSize: 16,
    padding: 0,
    textAlignVertical: "top",
  },
});
