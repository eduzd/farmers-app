import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useAuthStore } from "@/lib/authStore";
import { UserAddress } from "@/lib/storage";

import { tr, useTr } from "@/lib/tr";
const DISTRICTS = [
  "ঢাকা", "চট্টগ্রাম", "রাজশাহী", "খুলনা", "বরিশাল", 
  "সিলেট", "রংপুর", "ময়মনসিংহ", "কুমিল্লা", "গাজীপুর",
  "নারায়ণগঞ্জ", "টাঙ্গাইল", "কিশোরগঞ্জ", "জামালপুর", "শেরপুর",
  "নেত্রকোনা", "ব্রাহ্মণবাড়িয়া", "চাঁদপুর", "লক্ষ্মীপুর", "নোয়াখালী",
  "ফেনী", "কক্সবাজার", "রাঙ্গামাটি", "খাগড়াছড়ি", "বান্দরবান",
  "বগুড়া", "পাবনা", "নাটোর", "সিরাজগঞ্জ", "চাঁপাইনবাবগঞ্জ",
  "নওগাঁ", "জয়পুরহাট", "যশোর", "সাতক্ষীরা", "মেহেরপুর",
  "নড়াইল", "মাগুরা", "কুষ্টিয়া", "চুয়াডাঙ্গা", "ঝিনাইদহ",
  "পিরোজপুর", "ঝালকাঠি", "পটুয়াখালী", "ভোলা", "বরগুনা",
  "মৌলভীবাজার", "হবিগঞ্জ", "সুনামগঞ্জ", "দিনাজপুর", "ঠাকুরগাঁও",
  "পঞ্চগড়", "নীলফামারী", "লালমনিরহাট", "কুড়িগ্রাম", "গাইবান্ধা"
];

export default function AddressManagementScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { user, updateProfile } = useAuthStore();
  
  const [addresses, setAddresses] = useState<UserAddress[]>(user?.addresses || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  
  const [formData, setFormData] = useState({
    label: "বাড়ি",
    fullName: user?.name || "",
    phone: user?.phone || "",
    address: "",
    area: "",
    city: "",
    district: "ঢাকা",
    postalCode: "",
  });

  useEffect(() => {
    navigation.setOptions({
      headerTitle: "ঠিকানা ম্যানেজমেন্ট",
      headerLeft: () => (
        <Pressable onPress={() => navigation.goBack()} style={{ marginLeft: 8 }}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
      ),
    });
  }, [navigation, theme]);

  const resetForm = () => {
    setFormData({
      label: "বাড়ি",
      fullName: user?.name || "",
      phone: user?.phone || "",
      address: "",
      area: "",
      city: "",
      district: "ঢাকা",
      postalCode: "",
    });
    setEditingAddress(null);
  };

  const handleSaveAddress = async () => {
    if (!formData.fullName || !formData.phone || !formData.address || !formData.area) {
      Alert.alert(tr("ত্রুটি"), tr("সব প্রয়োজনীয় তথ্য পূরণ করুন"));
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const newAddress: UserAddress = {
      id: editingAddress?.id || Date.now().toString(),
      label: formData.label,
      fullName: formData.fullName,
      phone: formData.phone,
      address: formData.address,
      area: formData.area,
      city: formData.city || formData.district,
      district: formData.district,
      postalCode: formData.postalCode,
      isDefault: addresses.length === 0,
    };

    let updatedAddresses: UserAddress[];
    if (editingAddress) {
      updatedAddresses = addresses.map(a => 
        a.id === editingAddress.id ? newAddress : a
      );
    } else {
      updatedAddresses = [...addresses, newAddress];
    }

    setAddresses(updatedAddresses);
    await updateProfile({ addresses: updatedAddresses });
    
    setShowAddModal(false);
    resetForm();
  };

  const handleEditAddress = (address: UserAddress) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      address: address.address,
      area: address.area,
      city: address.city,
      district: address.district,
      postalCode: address.postalCode || "",
    });
    setShowAddModal(true);
  };

  const handleDeleteAddress = (addressId: string) => {
    Alert.alert(
      "ঠিকানা মুছুন",
      "আপনি কি এই ঠিকানা মুছতে চান?",
      [
        { text: "না", style: "cancel" },
        {
          text: "হ্যাঁ, মুছুন",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const updatedAddresses = addresses.filter(a => a.id !== addressId);
            if (updatedAddresses.length > 0 && !updatedAddresses.some(a => a.isDefault)) {
              updatedAddresses[0].isDefault = true;
            }
            setAddresses(updatedAddresses);
            await updateProfile({ addresses: updatedAddresses });
          },
        },
      ]
    );
  };

  const handleSetDefault = async (addressId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updatedAddresses = addresses.map(a => ({
      ...a,
      isDefault: a.id === addressId,
    }));
    setAddresses(updatedAddresses);
    await updateProfile({ addresses: updatedAddresses });
  };

  const labelOptions = ["বাড়ি", "অফিস", "অন্যান্য"];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {addresses.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="map-pin" size={40} color={theme.primary} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              {tr("কোনো ঠিকানা নেই")}
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {tr("চেকআউটে দ্রুত অর্ডার করতে আপনার ডেলিভারি ঠিকানা যোগ করুন")}
            </ThemedText>
          </View>
        ) : (
          addresses.map((address) => (
            <View
              key={address.id}
              style={[
                styles.addressCard,
                { 
                  backgroundColor: theme.card, 
                  borderColor: address.isDefault ? theme.primary : theme.cardBorder 
                },
              ]}
            >
              <View style={styles.addressCardHeader}>
                <View style={styles.addressLabelRow}>
                  <View style={[styles.labelBadge, { backgroundColor: theme.primary + "15" }]}>
                    <Feather 
                      name={address.label === "অফিস" ? "briefcase" : address.label === "বাড়ি" ? "home" : "map-pin"} 
                      size={14} 
                      color={theme.primary} 
                    />
                    <ThemedText style={[styles.labelText, { color: theme.primary }]}>
                      {address.label}
                    </ThemedText>
                  </View>
                  {address.isDefault ? (
                    <View style={[styles.defaultBadge, { backgroundColor: "#16A34A" }]}>
                      <ThemedText style={styles.defaultText}>{tr("ডিফল্ট")}</ThemedText>
                    </View>
                  ) : null}
                </View>
                <View style={styles.addressActions}>
                  <Pressable 
                    style={styles.actionButton} 
                    onPress={() => handleEditAddress(address)}
                  >
                    <Feather name="edit-2" size={18} color={theme.primary} />
                  </Pressable>
                  <Pressable 
                    style={styles.actionButton} 
                    onPress={() => handleDeleteAddress(address.id)}
                  >
                    <Feather name="trash-2" size={18} color="#DC2626" />
                  </Pressable>
                </View>
              </View>
              
              <ThemedText style={[styles.addressName, { color: theme.text }]}>
                {address.fullName}
              </ThemedText>
              <ThemedText style={[styles.addressPhone, { color: theme.textSecondary }]}>
                {address.phone}
              </ThemedText>
              <ThemedText style={[styles.addressFull, { color: theme.textSecondary }]}>
                {address.address}, {address.area}, {address.city}, {address.district}
                {address.postalCode ? ` - ${address.postalCode}` : ""}
              </ThemedText>

              {!address.isDefault ? (
                <Pressable
                  style={[styles.setDefaultButton, { borderColor: theme.primary }]}
                  onPress={() => handleSetDefault(address.id)}
                >
                  <ThemedText style={[styles.setDefaultText, { color: theme.primary }]}>
                    {tr("ডিফল্ট হিসেবে সেট করুন")}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            resetForm();
            setShowAddModal(true);
          }}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <ThemedText style={styles.addButtonText}>{tr("নতুন ঠিকানা যোগ করুন")}</ThemedText>
        </Pressable>
      </View>

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.cardBorder }, Platform.OS === "android" && { paddingTop: insets.top + Spacing.md }]}>
              <Pressable onPress={() => setShowAddModal(false)}>
                <ThemedText style={[styles.cancelButton, { color: theme.textSecondary }]}>
                  {tr("বাতিল")}
                </ThemedText>
              </Pressable>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                {editingAddress ? "ঠিকানা সম্পাদনা" : "নতুন ঠিকানা"}
              </ThemedText>
              <Pressable onPress={handleSaveAddress}>
                <ThemedText style={[styles.saveButton, { color: theme.primary }]}>
                  {tr("সংরক্ষণ")}
                </ThemedText>
              </Pressable>
            </View>

            <KeyboardAwareScrollViewCompat 
              style={styles.modalScroll}
              contentContainerStyle={[styles.modalContent, { paddingBottom: insets.bottom + 40 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bottomOffset={100}
            >
            <View style={styles.labelSection}>
              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                {tr("ঠিকানার ধরন")}
              </ThemedText>
              <View style={styles.labelOptions}>
                {labelOptions.map((label) => (
                  <Pressable
                    key={label}
                    style={[
                      styles.labelOption,
                      { 
                        backgroundColor: formData.label === label ? theme.primary : theme.card,
                        borderColor: formData.label === label ? theme.primary : theme.cardBorder,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, label })}
                  >
                    <Feather 
                      name={label === "অফিস" ? "briefcase" : label === "বাড়ি" ? "home" : "map-pin"} 
                      size={16} 
                      color={formData.label === label ? "#FFFFFF" : theme.text} 
                    />
                    <ThemedText style={[
                      styles.labelOptionText,
                      { color: formData.label === label ? "#FFFFFF" : theme.text }
                    ]}>
                      {label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                {tr("পুরো নাম *")}
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text }]}
                placeholder={tr("আপনার নাম লিখুন")}
                placeholderTextColor={theme.textSecondary}
                value={formData.fullName}
                onChangeText={(text) => setFormData({ ...formData, fullName: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                {tr("মোবাইল নম্বর *")}
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text }]}
                placeholder={tr("01XXXXXXXXX")}
                placeholderTextColor={theme.textSecondary}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                {tr("বিস্তারিত ঠিকানা *")}
              </ThemedText>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text }]}
                placeholder={tr("বাড়ি নং, রোড নং, ব্লক...")}
                placeholderTextColor={theme.textSecondary}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                {tr("এলাকা *")}
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text }]}
                placeholder={tr("এলাকার নাম")}
                placeholderTextColor={theme.textSecondary}
                value={formData.area}
                onChangeText={(text) => setFormData({ ...formData, area: text })}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                  {tr("শহর")}
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text }]}
                  placeholder={tr("শহরের নাম")}
                  placeholderTextColor={theme.textSecondary}
                  value={formData.city}
                  onChangeText={(text) => setFormData({ ...formData, city: text })}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
                <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                  {tr("পোস্ট কোড")}
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text }]}
                  placeholder={tr("১২০০")}
                  placeholderTextColor={theme.textSecondary}
                  value={formData.postalCode}
                  onChangeText={(text) => setFormData({ ...formData, postalCode: text })}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                {tr("জেলা *")}
              </ThemedText>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.districtScroll}
              >
                {DISTRICTS.slice(0, 15).map((district) => (
                  <Pressable
                    key={district}
                    style={[
                      styles.districtChip,
                      { 
                        backgroundColor: formData.district === district ? theme.primary : theme.card,
                        borderColor: formData.district === district ? theme.primary : theme.cardBorder,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, district })}
                  >
                    <ThemedText style={[
                      styles.districtChipText,
                      { color: formData.district === district ? "#FFFFFF" : theme.text }
                    ]}>
                      {district}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            </KeyboardAwareScrollViewCompat>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing["2xl"],
    borderRadius: 16,
    marginTop: Spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  addressCard: {
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  addressCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  addressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  labelBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  labelText: {
    fontSize: 12,
    fontWeight: "600",
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  defaultText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  addressActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    padding: 8,
  },
  addressName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  addressPhone: {
    fontSize: 14,
    marginBottom: 8,
  },
  addressFull: {
    fontSize: 14,
    lineHeight: 22,
  },
  setDefaultButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  setDefaultText: {
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  cancelButton: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  saveButton: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: Spacing.lg,
  },
  labelSection: {
    marginBottom: Spacing.xl,
  },
  labelOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  labelOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  labelOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
  },
  districtScroll: {
    marginTop: Spacing.sm,
  },
  districtChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  districtChipText: {
    fontSize: 14,
  },
});
