import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp, SlideInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ModalBottomInset } from "@/components/ModalBottomInset";

import { AppIcon } from "@/components/icons/AppIcon";
const { width } = Dimensions.get("window");

interface HealthRecord {
  id: string;
  date: string;
  type: "vaccination" | "treatment" | "checkup" | "weight";
  description: string;
  notes?: string;
  cost?: number;
  veterinarian?: string;
}

interface Animal {
  id: string;
  name: string;
  type: "cow" | "goat" | "sheep" | "chicken" | "duck" | "fish" | "buffalo";
  typeBn: string;
  breed?: string;
  age: string;
  gender: "male" | "female";
  weight?: number;
  purchaseDate: string;
  purchasePrice?: number;
  status: "healthy" | "sick" | "pregnant" | "sold";
  lastVaccination?: string;
  nextVaccination?: string;
  healthRecords: HealthRecord[];
  notes?: string;
}

const ANIMAL_TYPES = [
  { id: "cow", name: "Cow", nameBn: "গরু", icon: "heart", color: "#795548" },
  { id: "goat", name: "Goat", nameBn: "ছাগল", icon: "heart", color: "#8D6E63" },
  { id: "sheep", name: "Sheep", nameBn: "ভেড়া", icon: "heart", color: "#A1887F" },
  { id: "chicken", name: "Chicken", nameBn: "মুরগি", icon: "heart", color: "#EA8A0C" },
  { id: "duck", name: "Duck", nameBn: "হাঁস", icon: "heart", color: "#2563EB" },
  { id: "fish", name: "Fish", nameBn: "মাছ", icon: "heart", color: "#0D9488" },
  { id: "buffalo", name: "Buffalo", nameBn: "মহিষ", icon: "heart", color: "#475569" },
];

const INITIAL_ANIMALS: Animal[] = [];

const STATUS_CONFIG = {
  healthy: { label: "সুস্থ", color: "#2FA36B" },
  sick: { label: "অসুস্থ", color: "#DC2626" },
  pregnant: { label: "গর্ভবতী", color: "#7C3AED" },
  sold: { label: "বিক্রি", color: "#475569" },
};

export default function LivestockTrackerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [animals, setAnimals] = useState<Animal[]>(INITIAL_ANIMALS);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [newAnimal, setNewAnimal] = useState<Partial<Animal>>({ type: "cow", typeBn: "গরু", gender: "male", status: "healthy" });
  const [newHealthRecord, setNewHealthRecord] = useState<Partial<HealthRecord>>({ type: "vaccination" });

  const totalAnimals = animals.length;
  const totalValue = animals.reduce((sum, a) => sum + (a.purchasePrice || 0), 0);
  const upcomingVaccinations = animals.filter((a) => a.nextVaccination && new Date(a.nextVaccination) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length;
  const sickAnimals = animals.filter((a) => a.status === "sick").length;

  const filteredAnimals = filterType ? animals.filter((a) => a.type === filterType) : animals;

  const handleAddAnimal = useCallback(() => {
    if (!newAnimal.name) return;

    const animal: Animal = {
      id: Date.now().toString(),
      name: newAnimal.name || "",
      type: (newAnimal.type as Animal["type"]) || "cow",
      typeBn: newAnimal.typeBn || "গরু",
      breed: newAnimal.breed,
      age: newAnimal.age || "১ বছর",
      gender: (newAnimal.gender as Animal["gender"]) || "male",
      weight: newAnimal.weight,
      purchaseDate: new Date().toISOString().split("T")[0],
      purchasePrice: newAnimal.purchasePrice,
      status: (newAnimal.status as Animal["status"]) || "healthy",
      healthRecords: [],
    };

    setAnimals((prev) => [...prev, animal]);
    setNewAnimal({ type: "cow", typeBn: "গরু", gender: "male", status: "healthy" });
    setShowAddModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [newAnimal]);

  const handleAddHealthRecord = useCallback(() => {
    if (!selectedAnimal || !newHealthRecord.description) return;

    const record: HealthRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      type: (newHealthRecord.type as HealthRecord["type"]) || "checkup",
      description: newHealthRecord.description || "",
      notes: newHealthRecord.notes,
      cost: newHealthRecord.cost,
      veterinarian: newHealthRecord.veterinarian,
    };

    setAnimals((prev) =>
      prev.map((a) =>
        a.id === selectedAnimal.id
          ? { ...a, healthRecords: [record, ...a.healthRecords] }
          : a
      )
    );
    setSelectedAnimal((prev) =>
      prev ? { ...prev, healthRecords: [record, ...prev.healthRecords] } : null
    );
    setNewHealthRecord({ type: "vaccination" });
    setShowHealthModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [selectedAnimal, newHealthRecord]);

  const handleDeleteAnimal = useCallback((animalId: string) => {
    Alert.alert("মুছে ফেলুন", "আপনি কি নিশ্চিত যে এই পশুটি মুছে ফেলতে চান?", [
      { text: "বাতিল", style: "cancel" },
      {
        text: "মুছুন",
        style: "destructive",
        onPress: () => {
          setAnimals((prev) => prev.filter((a) => a.id !== animalId));
          if (selectedAnimal?.id === animalId) {
            setSelectedAnimal(null);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }, [selectedAnimal]);

  const renderAnimalCard = (animal: Animal, index: number) => {
    const typeConfig = ANIMAL_TYPES.find((t) => t.id === animal.type);
    const statusConfig = STATUS_CONFIG[animal.status];

    return (
      <Animated.View key={animal.id} entering={SlideInRight.delay(index * 60)}>
        <Pressable
          style={[styles.animalCard, { backgroundColor: theme.card }]}
          onPress={() => {
            setSelectedAnimal(animal);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          onLongPress={() => handleDeleteAnimal(animal.id)}
        >
          <View style={[styles.animalIcon, { backgroundColor: typeConfig?.color + "20" }]}>
            <Feather name="heart" size={24} color={typeConfig?.color} />
          </View>
          <View style={styles.animalInfo}>
            <View style={styles.animalHeader}>
              <ThemedText style={styles.animalName}>{animal.name}</ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + "20" }]}>
                <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.animalType, { color: theme.textSecondary }]}>
              {animal.typeBn} {animal.breed ? `- ${animal.breed}` : ""} | {animal.age}
            </ThemedText>
            <View style={styles.animalMeta}>
              {animal.weight ? (
                <View style={styles.metaItem}>
                  <Feather name="activity" size={12} color={theme.textSecondary} />
                  <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                    {animal.weight} কেজি
                  </ThemedText>
                </View>
              ) : null}
              {animal.nextVaccination ? (
                <View style={styles.metaItem}>
                  <Feather name="calendar" size={12} color={theme.textSecondary} />
                  <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                    পরবর্তী টিকা: {animal.nextVaccination}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>
      </Animated.View>
    );
  };

  const renderHealthRecord = (record: HealthRecord, index: number) => {
    const typeConfig = {
      vaccination: { icon: "shield" as const, color: "#2FA36B", label: "টিকা" },
      treatment: { icon: "activity" as const, color: "#DC2626", label: "চিকিৎসা" },
      checkup: { icon: "eye" as const, color: "#2563EB", label: "পরীক্ষা" },
      weight: { icon: "trending-up" as const, color: "#EA8A0C", label: "ওজন" },
    }[record.type];

    return (
      <View key={record.id} style={[styles.recordCard, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={[styles.recordIcon, { backgroundColor: typeConfig.color + "20" }]}>
          <AppIcon name={typeConfig.icon} size={16} color={typeConfig.color} />
        </View>
        <View style={styles.recordInfo}>
          <View style={styles.recordHeader}>
            <ThemedText style={styles.recordTitle}>{record.description}</ThemedText>
            <View style={[styles.recordTypeBadge, { backgroundColor: typeConfig.color + "15" }]}>
              <ThemedText style={[styles.recordTypeText, { color: typeConfig.color }]}>
                {typeConfig.label}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.recordDate, { color: theme.textSecondary }]}>
            {record.date}
          </ThemedText>
          {record.notes ? (
            <ThemedText style={[styles.recordNotes, { color: theme.textSecondary }]}>
              {record.notes}
            </ThemedText>
          ) : null}
          <View style={styles.recordFooter}>
            {record.cost ? (
              <ThemedText style={[styles.recordCost, { color: theme.primary }]}>
                খরচ: {record.cost.toLocaleString("bn-BD")} টাকা
              </ThemedText>
            ) : null}
            {record.veterinarian ? (
              <ThemedText style={[styles.recordVet, { color: theme.textSecondary }]}>
                {record.veterinarian}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <LinearGradient
            colors={["#795548", "#5D4037"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIcon}>
                <Feather name="heart" size={28} color="#FFF" />
              </View>
              <ThemedText style={styles.summaryTitle}>পশু সারাংশ</ThemedText>
            </View>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>{totalAnimals.toLocaleString("bn-BD")}</ThemedText>
                <ThemedText style={styles.statLabel}>মোট পশু</ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>{totalValue.toLocaleString("bn-BD")}</ThemedText>
                <ThemedText style={styles.statLabel}>মোট মূল্য (টাকা)</ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
              <View style={styles.statItem}>
                <ThemedText style={[styles.statValue, upcomingVaccinations > 0 && { color: "#FFEB3B" }]}>
                  {upcomingVaccinations.toLocaleString("bn-BD")}
                </ThemedText>
                <ThemedText style={styles.statLabel}>টিকা আসছে</ThemedText>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {sickAnimals > 0 && (
          <Animated.View entering={FadeInUp.delay(100)}>
            <View style={[styles.alertCard, { backgroundColor: "#FFEBEE" }]}>
              <Feather name="alert-circle" size={20} color="#DC2626" />
              <View style={styles.alertContent}>
                <ThemedText style={[styles.alertTitle, { color: "#C62828" }]}>স্বাস্থ্য সতর্কতা</ThemedText>
                <ThemedText style={[styles.alertText, { color: "#C62828" }]}>
                  {sickAnimals} টি পশু অসুস্থ
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        )}

        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable
              style={[
                styles.filterChip,
                { backgroundColor: filterType === null ? theme.primary : theme.card },
              ]}
              onPress={() => setFilterType(null)}
            >
              <ThemedText
                style={[
                  styles.filterText,
                  { color: filterType === null ? "#FFF" : theme.text },
                ]}
              >
                সব
              </ThemedText>
            </Pressable>
            {ANIMAL_TYPES.map((type) => (
              <Pressable
                key={type.id}
                style={[
                  styles.filterChip,
                  { backgroundColor: filterType === type.id ? type.color : theme.card },
                ]}
                onPress={() => setFilterType(filterType === type.id ? null : type.id)}
              >
                <ThemedText
                  style={[
                    styles.filterText,
                    { color: filterType === type.id ? "#FFF" : theme.text },
                  ]}
                >
                  {type.nameBn}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.animalsSection}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              পশু তালিকা ({filteredAnimals.length})
            </ThemedText>
            <Pressable
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowAddModal(true)}
            >
              <Feather name="plus" size={16} color="#FFF" />
              <ThemedText style={styles.addButtonText}>নতুন যোগ</ThemedText>
            </Pressable>
          </View>

          {filteredAnimals.map((animal, index) => renderAnimalCard(animal, index))}

          {filteredAnimals.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
              <Feather name="inbox" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                কোনো পশু পাওয়া যায়নি
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={selectedAnimal !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <ThemedText style={styles.modalTitle}>{selectedAnimal?.name}</ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_CONFIG[selectedAnimal?.status || "healthy"].color + "20" }]}>
                  <ThemedText style={[styles.statusText, { color: STATUS_CONFIG[selectedAnimal?.status || "healthy"].color }]}>
                    {STATUS_CONFIG[selectedAnimal?.status || "healthy"].label}
                  </ThemedText>
                </View>
              </View>
              <Pressable onPress={() => setSelectedAnimal(null)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedAnimal && (
                <>
                  <View style={[styles.detailsGrid, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={styles.detailItem}>
                      <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>প্রজাতি</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedAnimal.typeBn}</ThemedText>
                    </View>
                    <View style={styles.detailItem}>
                      <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>জাত</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedAnimal.breed || "-"}</ThemedText>
                    </View>
                    <View style={styles.detailItem}>
                      <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>বয়স</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedAnimal.age}</ThemedText>
                    </View>
                    <View style={styles.detailItem}>
                      <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>ওজন</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedAnimal.weight ? `${selectedAnimal.weight} কেজি` : "-"}</ThemedText>
                    </View>
                    <View style={styles.detailItem}>
                      <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>ক্রয় মূল্য</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedAnimal.purchasePrice?.toLocaleString("bn-BD") || "-"} টাকা</ThemedText>
                    </View>
                    <View style={styles.detailItem}>
                      <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>পরবর্তী টিকা</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedAnimal.nextVaccination || "-"}</ThemedText>
                    </View>
                  </View>

                  <View style={styles.healthSection}>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionTitle}>স্বাস্থ্য রেকর্ড</ThemedText>
                      <Pressable
                        style={[styles.addButton, { backgroundColor: theme.primary }]}
                        onPress={() => setShowHealthModal(true)}
                      >
                        <Feather name="plus" size={16} color="#FFF" />
                        <ThemedText style={styles.addButtonText}>যোগ করুন</ThemedText>
                      </Pressable>
                    </View>

                    {selectedAnimal.healthRecords.length > 0 ? (
                      selectedAnimal.healthRecords.map((record, index) => renderHealthRecord(record, index))
                    ) : (
                      <View style={[styles.emptyRecords, { backgroundColor: theme.backgroundSecondary }]}>
                        <Feather name="file-text" size={32} color={theme.textSecondary} />
                        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                          কোনো স্বাস্থ্য রেকর্ড নেই
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>নতুন পশু যোগ করুন</ThemedText>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>নাম</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="পশুর নাম"
                  placeholderTextColor={theme.textSecondary}
                  value={newAnimal.name}
                  onChangeText={(text) => setNewAnimal((prev) => ({ ...prev, name: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>প্রজাতি</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {ANIMAL_TYPES.map((type) => (
                    <Pressable
                      key={type.id}
                      style={[
                        styles.typeChip,
                        { backgroundColor: newAnimal.type === type.id ? type.color : theme.backgroundSecondary },
                      ]}
                      onPress={() => setNewAnimal((prev) => ({ ...prev, type: type.id as Animal["type"], typeBn: type.nameBn }))}
                    >
                      <ThemedText
                        style={[
                          styles.typeChipText,
                          { color: newAnimal.type === type.id ? "#FFF" : theme.text },
                        ]}
                      >
                        {type.nameBn}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <ThemedText style={styles.inputLabel}>জাত</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="যেমন: দেশি"
                    placeholderTextColor={theme.textSecondary}
                    value={newAnimal.breed}
                    onChangeText={(text) => setNewAnimal((prev) => ({ ...prev, breed: text }))}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
                  <ThemedText style={styles.inputLabel}>বয়স</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="যেমন: ২ বছর"
                    placeholderTextColor={theme.textSecondary}
                    value={newAnimal.age}
                    onChangeText={(text) => setNewAnimal((prev) => ({ ...prev, age: text }))}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <ThemedText style={styles.inputLabel}>ওজন (কেজি)</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    value={newAnimal.weight?.toString()}
                    onChangeText={(text) => setNewAnimal((prev) => ({ ...prev, weight: parseInt(text) || 0 }))}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
                  <ThemedText style={styles.inputLabel}>ক্রয় মূল্য (টাকা)</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    value={newAnimal.purchasePrice?.toString()}
                    onChangeText={(text) => setNewAnimal((prev) => ({ ...prev, purchasePrice: parseInt(text) || 0 }))}
                  />
                </View>
              </View>
            </ScrollView>

            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleAddAnimal}
            >
              <Feather name="check" size={20} color="#FFF" />
              <ThemedText style={styles.saveButtonText}>সংরক্ষণ করুন</ThemedText>
            </Pressable>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>

      <Modal visible={showHealthModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>স্বাস্থ্য রেকর্ড যোগ</ThemedText>
              <Pressable onPress={() => setShowHealthModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>রেকর্ডের ধরন</ThemedText>
                <View style={styles.typeOptions}>
                  {[
                    { id: "vaccination", label: "টিকা" },
                    { id: "treatment", label: "চিকিৎসা" },
                    { id: "checkup", label: "পরীক্ষা" },
                    { id: "weight", label: "ওজন" },
                  ].map((type) => (
                    <Pressable
                      key={type.id}
                      style={[
                        styles.typeOption,
                        { backgroundColor: newHealthRecord.type === type.id ? theme.primary : theme.backgroundSecondary },
                      ]}
                      onPress={() => setNewHealthRecord((prev) => ({ ...prev, type: type.id as HealthRecord["type"] }))}
                    >
                      <ThemedText
                        style={[
                          styles.typeOptionText,
                          { color: newHealthRecord.type === type.id ? "#FFF" : theme.text },
                        ]}
                      >
                        {type.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>বিবরণ</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="যেমন: FMD টিকা"
                  placeholderTextColor={theme.textSecondary}
                  value={newHealthRecord.description}
                  onChangeText={(text) => setNewHealthRecord((prev) => ({ ...prev, description: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>নোট (ঐচ্ছিক)</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="অতিরিক্ত তথ্য"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={3}
                  value={newHealthRecord.notes}
                  onChangeText={(text) => setNewHealthRecord((prev) => ({ ...prev, notes: text }))}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <ThemedText style={styles.inputLabel}>খরচ (টাকা)</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    value={newHealthRecord.cost?.toString()}
                    onChangeText={(text) => setNewHealthRecord((prev) => ({ ...prev, cost: parseInt(text) || 0 }))}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
                  <ThemedText style={styles.inputLabel}>পশু চিকিৎসক</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="নাম"
                    placeholderTextColor={theme.textSecondary}
                    value={newHealthRecord.veterinarian}
                    onChangeText={(text) => setNewHealthRecord((prev) => ({ ...prev, veterinarian: text }))}
                  />
                </View>
              </View>
            </ScrollView>

            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleAddHealthRecord}
            >
              <Feather name="check" size={20} color="#FFF" />
              <ThemedText style={styles.saveButtonText}>সংরক্ষণ করুন</ThemedText>
            </Pressable>
            <ModalBottomInset />
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  summaryCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: Spacing.sm,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFF",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  alertContent: {
    marginLeft: Spacing.md,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  alertText: {
    fontSize: 12,
    marginTop: 2,
  },
  filterSection: {
    marginBottom: Spacing.lg,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    flexShrink: 0,
    minWidth: 84,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "500",
  },
  animalsSection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  addButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  animalCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  animalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  animalInfo: {
    flex: 1,
  },
  animalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  animalName: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  animalType: {
    fontSize: 13,
    marginBottom: 4,
  },
  animalMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  metaText: {
    fontSize: 11,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  emptyText: {
    fontSize: 14,
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: Spacing.sm,
  },
  modalBody: {
    padding: Spacing.lg,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  detailItem: {
    width: "50%",
    paddingVertical: Spacing.sm,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  healthSection: {
    marginBottom: Spacing.lg,
  },
  recordCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  recordIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  recordInfo: {
    flex: 1,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  recordTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  recordTypeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  recordDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  recordNotes: {
    fontSize: 12,
    marginBottom: 4,
  },
  recordFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  recordCost: {
    fontSize: 12,
    fontWeight: "600",
  },
  recordVet: {
    fontSize: 12,
  },
  emptyRecords: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: "row",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  typeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  typeOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },
});
