import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

export default function DiseaseDetectorScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const handleTakePhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow camera access to take photos for disease detection."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
      setAnalysisResult(null);
    }
  };

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow photo library access to upload images for disease detection."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
      setAnalysisResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      Alert.alert("No Image", "Please take or upload a photo first.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const response = await fetch(
        new URL("/api/analyze-disease", getApiUrl()).toString(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUri: selectedImage,
            imageBase64: imageBase64,
            description: description.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const data = await response.json();
      setAnalysisResult(
        data.offline && data.notice ? `Note: ${data.notice}\n\n${data.analysis}` : data.analysis
      );
    } catch (error) {
      setAnalysisResult(
        "Couldn't analyse this photo: the AI server can't be reached right now. " +
          "Check your internet connection and try again in a minute."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedImage(null);
    setImageBase64(null);
    setDescription("");
    setAnalysisResult(null);
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="search" size={24} color={theme.primary} />
          </View>
          <View style={styles.cardHeaderText}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              Disease Detector
            </ThemedText>
            <ThemedText style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
              AI-powered analysis for crops, fish, and livestock
            </ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          1. Upload or Take Photo
        </ThemedText>

        {selectedImage ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.selectedImage}
              contentFit="cover"
            />
            <Pressable
              style={[styles.removeImageButton, { backgroundColor: theme.error }]}
              onPress={handleReset}
            >
              <Feather name="x" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.imageOptions}>
            <Pressable
              style={[styles.imageOptionButton, { backgroundColor: theme.primary }]}
              onPress={handleTakePhoto}
            >
              <Feather name="camera" size={24} color="#FFFFFF" />
              <ThemedText style={styles.imageOptionText}>Take Photo</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.imageOptionButton, { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.cardBorder }]}
              onPress={handlePickImage}
            >
              <Feather name="image" size={24} color={theme.text} />
              <ThemedText style={[styles.imageOptionText, { color: theme.text }]}>
                Upload Photo
              </ThemedText>
            </Pressable>
          </View>
        )}

        <ThemedText style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xl }]}>
          2. Describe the Problem (Optional)
        </ThemedText>

        <TextInput
          style={[
            styles.descriptionInput,
            {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
              borderColor: theme.cardBorder,
            },
          ]}
          placeholder="E.g., Yellow spots on leaves, fish not eating, etc."
          placeholderTextColor={theme.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Pressable
          style={[
            styles.analyzeButton,
            { backgroundColor: theme.primary },
            (!selectedImage || isAnalyzing) && styles.buttonDisabled,
          ]}
          onPress={handleAnalyze}
          disabled={!selectedImage || isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name="cpu" size={20} color="#FFFFFF" />
              <ThemedText style={styles.analyzeButtonText}>Analyze with AI</ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {analysisResult ? (
        <View style={[styles.resultCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.resultHeader}>
            <Feather name="file-text" size={20} color={theme.primary} />
            <ThemedText style={[styles.resultTitle, { color: theme.text }]}>
              Analysis Result
            </ThemedText>
          </View>
          <ThemedText style={[styles.resultText, { color: theme.text }]}>
            {analysisResult}
          </ThemedText>
        </View>
      ) : null}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    borderWidth: 1,
    ...Shadows.medium,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: Spacing.md,
  },
  imageContainer: {
    position: "relative",
  },
  selectedImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  removeImageButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  imageOptions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  imageOptionButton: {
    flex: 1,
    height: 100,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  imageOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  descriptionInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  analyzeButton: {
    flexDirection: "row",
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  analyzeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  resultCard: {
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    borderWidth: 1,
    marginTop: Spacing.lg,
    ...Shadows.medium,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  resultText: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans_400Regular",
  },
});
