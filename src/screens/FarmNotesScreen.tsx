import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2;

const STORAGE_KEY = "@farm_notes";

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
}

const NOTE_COLORS = [
  { id: "yellow", color: "#FFF9C4", name: "হলুদ" },
  { id: "green", color: "#C8E6C9", name: "সবুজ" },
  { id: "blue", color: "#BBDEFB", name: "নীল" },
  { id: "pink", color: "#F8BBD9", name: "গোলাপী" },
  { id: "purple", color: "#E1BEE7", name: "বেগুনি" },
  { id: "orange", color: "#FFE0B2", name: "কমলা" },
  { id: "teal", color: "#B2DFDB", name: "টিল" },
  { id: "red", color: "#FFCDD2", name: "লাল" },
];

export default function FarmNotesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  const [notes, setNotes] = useState<Note[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0].color);
  const [searchQuery, setSearchQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [])
  );

  const loadNotes = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setNotes(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  };

  const saveNotes = async (updatedNotes: Note[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNotes));
      setNotes(updatedNotes);
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  };

  const handleAddNote = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingNote(null);
    setNoteTitle("");
    setNoteContent("");
    setSelectedColor(NOTE_COLORS[0].color);
    setIsModalVisible(true);
  };

  const handleEditNote = (note: Note) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setSelectedColor(note.color);
    setIsModalVisible(true);
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim() && !noteContent.trim()) {
      setIsModalVisible(false);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const now = new Date().toISOString();

    if (editingNote) {
      const updatedNotes = notes.map((n) =>
        n.id === editingNote.id
          ? {
              ...n,
              title: noteTitle.trim(),
              content: noteContent.trim(),
              color: selectedColor,
              updatedAt: now,
            }
          : n
      );
      await saveNotes(updatedNotes);
    } else {
      const newNote: Note = {
        id: Date.now().toString(),
        title: noteTitle.trim(),
        content: noteContent.trim(),
        color: selectedColor,
        createdAt: now,
        updatedAt: now,
        isPinned: false,
      };
      await saveNotes([newNote, ...notes]);
    }

    setIsModalVisible(false);
  };

  const handleDeleteNote = (noteId: string) => {
    Alert.alert(
      "নোট মুছুন",
      "আপনি কি এই নোটটি মুছে ফেলতে চান?",
      [
        { text: "বাতিল", style: "cancel" },
        {
          text: "মুছুন",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const updatedNotes = notes.filter((n) => n.id !== noteId);
            await saveNotes(updatedNotes);
          },
        },
      ]
    );
  };

  const handleTogglePin = async (noteId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updatedNotes = notes.map((n) =>
      n.id === noteId ? { ...n, isPinned: !n.isPinned } : n
    );
    const sortedNotes = updatedNotes.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    await saveNotes(sortedNotes);
  };

  const filteredNotes = notes.filter((note) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "এইমাত্র";
    if (diffMins < 60) return `${diffMins} মিনিট আগে`;
    if (diffHours < 24) return `${diffHours} ঘণ্টা আগে`;
    if (diffDays < 7) return `${diffDays} দিন আগে`;
    
    return date.toLocaleDateString("bn-BD", {
      day: "numeric",
      month: "short",
    });
  };

  const renderNote = ({ item }: { item: Note }) => (
    <Pressable
      style={[styles.noteCard, { backgroundColor: item.color }]}
      onPress={() => handleEditNote(item)}
      onLongPress={() => handleDeleteNote(item.id)}
    >
      {item.isPinned ? (
        <View style={styles.pinBadge}>
          <Feather name="bookmark" size={14} color="#666" />
        </View>
      ) : null}
      
      {item.title ? (
        <ThemedText style={styles.noteTitle} numberOfLines={2}>
          {item.title}
        </ThemedText>
      ) : null}
      
      <ThemedText style={styles.noteContent} numberOfLines={6}>
        {item.content}
      </ThemedText>
      
      <View style={styles.noteFooter}>
        <ThemedText style={styles.noteDate}>
          {formatDate(item.updatedAt)}
        </ThemedText>
        <Pressable
          style={styles.pinButton}
          onPress={() => handleTogglePin(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather
            name={item.isPinned ? "bookmark" : "bookmark"}
            size={16}
            color={item.isPinned ? "#FF6B6B" : "#999"}
          />
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="নোট খুঁজুন..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {filteredNotes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="edit-3" size={64} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
            কোনো নোট নেই
          </ThemedText>
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            নতুন নোট যোগ করতে নিচের বাটনে ক্লিক করুন
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.noteRow}
          contentContainerStyle={[
            styles.notesContainer,
            { paddingBottom: insets.bottom + 80 },
          ]}
          renderItem={renderNote}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={handleAddNote}
      >
        <Feather name="plus" size={28} color="#FFFFFF" />
      </Pressable>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAwareScrollViewCompat 
          style={{ flex: 1, backgroundColor: selectedColor }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.modalContainer, { backgroundColor: selectedColor }]}>
            <View style={[styles.modalHeader, Platform.OS === "android" && { paddingTop: insets.top + Spacing.md }]}>
              <Pressable
                style={styles.modalButton}
                onPress={() => setIsModalVisible(false)}
              >
                <Feather name="x" size={24} color="#333" />
              </Pressable>
              <ThemedText style={styles.modalTitle}>
                {editingNote ? "নোট সম্পাদনা" : "নতুন নোট"}
              </ThemedText>
              <Pressable style={styles.modalButton} onPress={handleSaveNote}>
                <Feather name="check" size={24} color="#333" />
              </Pressable>
            </View>

            <View style={styles.colorPicker}>
            {NOTE_COLORS.map((c) => (
              <Pressable
                key={c.id}
                style={[
                  styles.colorOption,
                  { backgroundColor: c.color },
                  selectedColor === c.color && styles.colorOptionSelected,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedColor(c.color);
                }}
              >
                {selectedColor === c.color ? (
                  <Feather name="check" size={16} color="#333" />
                ) : null}
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.titleInput}
            placeholder="শিরোনাম"
            placeholderTextColor="#999"
            value={noteTitle}
            onChangeText={setNoteTitle}
            maxLength={100}
          />

          <TextInput
            style={styles.contentInput}
            placeholder="আপনার নোট লিখুন..."
            placeholderTextColor="#999"
            value={noteContent}
            onChangeText={setNoteContent}
            multiline
            textAlignVertical="top"
          />
          </View>
        </KeyboardAwareScrollViewCompat>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Spacing.xs,
  },
  notesContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  noteRow: {
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  noteCard: {
    width: CARD_WIDTH,
    minHeight: 120,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    ...Shadows.small,
  },
  pinBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: Spacing.xs,
  },
  noteContent: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    flex: 1,
  },
  noteFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  noteDate: {
    fontSize: 11,
    color: "#888",
  },
  pinButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    bottom: 100,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.large,
  },
  modalContainer: {
    flex: 1,
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  modalButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  colorPicker: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorOptionSelected: {
    borderColor: "#333",
  },
  titleInput: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingHorizontal: Spacing.lg,
    lineHeight: 24,
  },
});
