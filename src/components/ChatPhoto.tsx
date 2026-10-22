import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { photoDisplayUri } from "@/lib/dmApi";
import { tr } from "@/lib/tr";
import { BorderRadius } from "@/constants/theme";

const MAX_W = 230;
const MAX_H = 300;
const MIN_SIDE = 120;

/**
 * A photo in a chat bubble. My own photo shows straight from the phone; a photo from the
 * other person is downloaded with the sign-in token (only the two people in the chat can
 * get it). The whole photo is shown at its own shape (no cropping); tap opens it full screen.
 */
export function ChatPhoto({
  localUri,
  mediaId,
  width,
  height,
  onOpen,
  onLongPress,
}: {
  localUri?: string;
  mediaId?: string | null;
  width?: number;
  height?: number;
  onOpen: (uri: string) => void;
  onLongPress?: () => void;
}) {
  const { theme } = useTheme();
  const [uri, setUri] = useState<string | null>(localUri || null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (localUri) {
      setUri(localUri);
      return;
    }
    if (!mediaId) return;
    let alive = true;
    setFailed(false);
    photoDisplayUri(mediaId)
      .then((u) => alive && setUri(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [localUri, mediaId, attempt]);

  // Keep the photo's own shape inside the bubble limits.
  let w = MAX_W;
  let h = Math.round(MAX_W * 0.75);
  if (width && height) {
    const scale = Math.min(MAX_W / width, MAX_H / height, 1);
    w = Math.max(MIN_SIDE, Math.round(width * scale));
    h = Math.max(MIN_SIDE, Math.round(height * scale));
  }

  return (
    <Pressable
      onPress={() => (uri ? onOpen(uri) : failed ? setAttempt((a) => a + 1) : undefined)}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityRole="imagebutton"
      accessibilityLabel={tr("Photo")}
      testID="chat-photo"
      style={[styles.box, { width: w, height: h, backgroundColor: theme.backgroundSecondary }]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
      ) : failed ? (
        <View style={styles.center}>
          <Feather name="refresh-cw" size={20} color={theme.textSecondary} />
          <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>{tr("Couldn't load photo · Tap to retry")}</ThemedText>
        </View>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    gap: 6,
  },
  hint: {
    fontSize: 12,
    textAlign: "center",
  },
});

export default ChatPhoto;
