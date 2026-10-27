import React, { useEffect, useState } from "react";
import { Modal, View, Pressable, StyleSheet, FlatList, useWindowDimensions, StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@/components/icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/lib/i18n";

/** Full-screen photo view: the whole photo, never cropped, on black. Swipe between photos
 *  when there are several. Close with the X or the phone's back button. */
export function PhotoViewer({ images, index = 0, visible, onClose }: { images: string[]; index?: number; visible: boolean; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bn = useI18n((s) => s.language) === "bn";
  const [page, setPage] = useState(index);
  useEffect(() => {
    if (visible) setPage(index);
  }, [visible, index]);
  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.root} testID="photo-viewer">
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={Math.min(index, Math.max(images.length - 1, 0))}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(u, i) => `${i}-${u.slice(-24)}`}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width, height, justifyContent: "center" }}>
              <Image source={{ uri: item }} style={{ width, height: height - insets.top - insets.bottom }} contentFit="contain" transition={150} />
            </View>
          )}
        />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={bn ? "বন্ধ করুন" : "Close"}
          testID="photo-viewer-close"
          hitSlop={10}
          style={[styles.close, { top: insets.top + 8 }]}
        >
          <Feather name="x" size={24} color="#fff" />
        </Pressable>
        {images.length > 1 ? (
          <View style={[styles.counter, { top: insets.top + 16 }]}>
            <ThemedText style={styles.counterText}>{`${page + 1} / ${images.length}`}</ThemedText>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** A post photo. Tapping it opens the full-screen viewer (whole photo), and the tap doesn't open the post.
 *  - mode "thumb" (feed): a fixed 4:3 preview, filled and visually cropped. The upload itself is untouched.
 *  - mode "full" (post page): the complete photo at its own shape, nothing cut off. */
export function PostPhoto({ uri, style, radius = 0, mode = "full" }: { uri: string; style?: StyleProp<ViewStyle>; radius?: number; mode?: "thumb" | "full" }) {
  const { theme } = useTheme();
  const bn = useI18n((s) => s.language) === "bn";
  const [ratio, setRatio] = useState(4 / 3);
  const [open, setOpen] = useState(false);
  const thumb = mode === "thumb";
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={bn ? "ছবি বড় করে দেখুন" : "View photo"}
        testID="post-photo"
        style={[{ width: "100%", aspectRatio: thumb ? 4 / 3 : ratio, borderRadius: radius, overflow: "hidden", backgroundColor: theme.backgroundSecondary }, style]}
      >
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={thumb ? "cover" : "contain"}
          transition={200}
          onLoad={
            thumb
              ? undefined
              : (e: any) => {
                  const w = e?.source?.width, h = e?.source?.height;
                  // Very tall photos are capped at 1:2 and shown whole inside that box (contain).
                  if (w > 0 && h > 0) setRatio(Math.max(0.5, w / h));
                }
          }
        />
      </Pressable>
      <PhotoViewer images={[uri]} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  close: { position: "absolute", left: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  counter: { position: "absolute", alignSelf: "center", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.55)" },
  counterText: { color: "#fff", fontSize: 14, lineHeight: 20 },
});

export default PhotoViewer;
