import React, { useEffect, useState } from "react";
import { Modal, View, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@/components/icons/Feather";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { uploadImage, mediaUrl } from "@/lib/api";
import { tr } from "@/lib/tr";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ModalBottomInset } from "@/components/ModalBottomInset";

export interface FormField {
  key: string;
  label: string;
  numeric?: boolean;
  multiline?: boolean;
  /** shows an "Upload photo" button that uploads to the server and fills the URL */
  image?: boolean;
  required?: boolean;
  placeholder?: string;
  /** shows tappable chips instead of a text box (e.g. marketplace categories from the server) */
  choices?: { value: string; label: string }[];
}

interface Props {
  visible: boolean;
  title: string;
  fields: FormField[];
  initial?: Record<string, any> | null;
  submitLabel: string;
  onClose: () => void;
  /** Return an error message to show, or nothing on success. */
  onSubmit: (values: Record<string, any>) => Promise<string | void>;
  onDelete?: () => void;
  deleteLabel?: string;
}

/** Small create / edit form used for server-backed experts, events and listings. */
export function CatalogFormModal({ visible, title, fields, initial, submitLabel, onClose, onSubmit, onDelete, deleteLabel }: Props) {
  const { theme } = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const pickImage = async (key: string) => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      const dataUrl = a.uri.startsWith("data:") ? a.uri : `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`;
      setUploading(key);
      setError(null);
      const url = await uploadImage(dataUrl);
      setValues((v) => ({ ...v, [key]: mediaUrl(url) }));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setUploading(null);
    }
  };

  useEffect(() => {
    if (visible) {
      const v: Record<string, string> = {};
      for (const f of fields) v[f.key] = initial?.[f.key] != null ? String(initial[f.key]) : "";
      setValues(v);
      setError(null);
    }
  }, [visible]);

  const submit = async () => {
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        setError(`${f.label} *`);
        return;
      }
    }
    const out: Record<string, any> = {};
    for (const f of fields) {
      const raw = (values[f.key] ?? "").trim();
      if (f.numeric) {
        if (raw !== "") out[f.key] = Number(raw.replace(/[^0-9.]/g, "")) || 0;
      } else out[f.key] = raw;
    }
    setBusy(true);
    setError(null);
    try {
      const err = await onSubmit(out);
      if (err) setError(err);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.header}>
            <ThemedText type="h4" style={{ flex: 1 }}>
              {title}
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: Spacing.md, paddingBottom: Spacing.lg }} keyboardShouldPersistTaps="handled">
            {fields.map((f) => (
              <View key={f.key} style={{ gap: 4 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {f.label}
                  {f.required ? " *" : ""}
                </ThemedText>
                {f.choices && f.choices.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} testID={`choices-${f.key}`}>
                    {f.choices.map((c) => {
                      const on = String(values[f.key] ?? "") === c.value;
                      return (
                        <Pressable
                          key={c.value}
                          testID={`choice-${f.key}-${c.value}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          onPress={() => setValues((v) => ({ ...v, [f.key]: c.value }))}
                          style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: on ? theme.primary : theme.border, backgroundColor: on ? theme.primary : theme.backgroundSecondary }}
                        >
                          <ThemedText style={{ fontSize: 13.5, color: on ? "#fff" : theme.text, fontWeight: on ? "700" : "500" }}>{c.label}</ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                <TextInput
                  value={values[f.key] ?? ""}
                  onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={theme.textTertiary || theme.textSecondary}
                  keyboardType={f.numeric ? "numeric" : "default"}
                  multiline={f.multiline}
                  accessibilityLabel={f.label}
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
                    f.multiline && { minHeight: 80, textAlignVertical: "top" },
                  ]}
                />
                )}
                {f.image ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
                    <Pressable
                      onPress={() => pickImage(f.key)}
                      accessibilityRole="button"
                      style={[styles.button, { flex: 1, borderWidth: 1, borderColor: theme.primary, paddingVertical: Spacing.sm }]}
                    >
                      {uploading === f.key ? (
                        <ActivityIndicator color={theme.primary} />
                      ) : (
                        <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>
                          <Feather name="upload" size={14} color={theme.primary} /> {tr("Upload photo")}
                        </ThemedText>
                      )}
                    </Pressable>
                    {values[f.key] ? <Image source={{ uri: values[f.key] }} style={{ width: 48, height: 48, borderRadius: BorderRadius.sm }} /> : null}
                  </View>
                ) : null}
              </View>
            ))}
            {error ? <ThemedText style={{ color: theme.error || "#DA2F2F" }}>{error}</ThemedText> : null}
            <Pressable
              onPress={submit}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: theme.primary, opacity: busy ? 0.7 : 1 }]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>{submitLabel}</ThemedText>}
            </Pressable>
            {onDelete ? (
              <Pressable onPress={onDelete} accessibilityRole="button" style={[styles.button, { borderWidth: 1, borderColor: theme.error || "#DA2F2F" }]}>
                <ThemedText style={{ color: theme.error || "#DA2F2F", fontWeight: "600" }}>{deleteLabel || "Delete"}</ThemedText>
              </Pressable>
            ) : null}
          </ScrollView>
          <ModalBottomInset />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md, gap: Spacing.md },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 15 },
  button: { height: 48, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
});
