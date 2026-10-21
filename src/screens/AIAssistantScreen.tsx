import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "আসসালামু আলাইকুম! আমি আপনার AI কৃষি সহায়ক। আমি আপনাকে সাহায্য করতে পারি:\n\n" +
    "• ফসল চাষ ও পরিচর্যা\n" +
    "• রোগ-বালাই শনাক্তকরণ\n" +
    "• আবহাওয়া ভিত্তিক পরামর্শ\n" +
    "• মাছ চাষ ও মৎস্য চাষ\n" +
    "• গবাদি পশু পালন\n" +
    "• বাজার দর ও প্রবণতা\n\n" +
    "প্রশ্ন টাইপ করুন অথবা ফোন আইকনে ট্যাপ করে সরাসরি কথা বলুন!",
  timestamp: new Date(),
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AIAssistantScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Ask the server once whether a real AI key is configured, so the user
  // knows up front that answers are general tips until GOOGLE_API_KEY is set.
  useEffect(() => {
    fetch(new URL("/api/ai-status", getApiUrl()).toString())
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.aiConfigured === false) {
          setAiNotice("AI is not connected yet, so answers are general farming tips. AI এখনও চালু হয়নি, তাই সাধারণ পরামর্শ দেখানো হচ্ছে।");
        }
      })
      .catch(() => setAiNotice("Can't reach the server. Answers are offline farming tips. সার্ভারে সংযোগ নেই।"));
  }, []);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          onPress={() => navigation.navigate("VoiceCall")}
          pressColor={theme.primary + "20"}
        >
          <View style={styles.callIconContainer}>
            <Feather name="phone" size={20} color={theme.primary} />
            <ThemedText style={[styles.callIconText, { color: theme.primary }]}>কল</ThemedText>
          </View>
        </HeaderButton>
      ),
    });
  }, [navigation, theme]);

  useEffect(() => {
    return () => {
      if (Platform.OS !== "web") {
        try {
          Speech.stop();
        } catch (e) {}
      }
    };
  }, []);

  const handleSend = async () => {
    const messageContent = inputText.trim();
    if (!messageContent || isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await fetch(
        new URL("/api/ai-chat", getApiUrl()).toString(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userMessage.content,
            context: "farming",
          }),
        }
      );

      let assistantContent: string;

      if (!response.ok) {
        assistantContent = generateFallbackResponse(userMessage.content);
      } else {
        const data = await response.json();
        assistantContent = data.response || generateFallbackResponse(userMessage.content);
        if (data.offline && data.notice) setAiNotice(data.notice);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const fallbackResponse = generateFallbackResponse(userMessage.content);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: fallbackResponse,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const speakMessage = async (message: Message) => {
    if (Platform.OS === "web") {
      Alert.alert("সতর্কতা", "ভয়েস ফিচার মোবাইল অ্যাপে কাজ করে। Expo Go ব্যবহার করুন।");
      return;
    }

    if (isSpeaking && speakingMessageId === message.id) {
      try {
        Speech.stop();
      } catch (e) {}
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      return;
    }

    try {
      Speech.stop();
    } catch (e) {}
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setIsSpeaking(true);
    setSpeakingMessageId(message.id);

    try {
      Speech.speak(message.content, {
        language: "bn-BD",
        pitch: 1.0,
        rate: 0.9,
        onDone: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
        onError: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
        onStopped: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
      });
    } catch (error) {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  };

  const generateFallbackResponse = (question: string): string => {
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes("ধান") || lowerQuestion.includes("rice") || lowerQuestion.includes("paddy")) {
      return "ধান চাষের জন্য কিছু গুরুত্বপূর্ণ পরামর্শ:\n\n১. পানি ব্যবস্থাপনা: গাছ বড় হওয়ার সময় ৫-৭ সেমি পানি রাখুন\n২. সার প্রয়োগ: নাইট্রোজেন সার ভাগ করে দিন - রোপণ, টিলারিং এবং শীষ বের হওয়ার সময়\n৩. পোকা দমন: কাণ্ড মাজরা ও পাতা মোড়ানো পোকার জন্য নিয়মিত পর্যবেক্ষণ করুন\n৪. ফসল কাটা: ৮০-৮৫% দানা সোনালী হলে কাটুন\n\nআরো বিস্তারিত জানতে চাইলে জিজ্ঞাসা করুন!";
    }

    if (lowerQuestion.includes("মাছ") || lowerQuestion.includes("fish") || lowerQuestion.includes("aquaculture")) {
      return "সফল মাছ চাষের জন্য:\n\n১. পানির গুণমান: pH ৬.৫-৮.৫, দ্রবীভূত অক্সিজেন ৫mg/L এর উপরে রাখুন\n২. খাদ্য দেওয়া: দিনে ২-৩ বার, শরীরের ওজনের ২-৩%\n৩. মজুদ ঘনত্ব: বেশি মজুদ করবেন না - সাধারণত প্রতি বর্গমিটারে ১-২ মাছ\n৪. স্বাস্থ্য: অস্বাভাবিক সাঁতার, খাদ্য গ্রহণ না করা লক্ষণ দেখুন\n\nকোন জাতের মাছ চাষ করছেন?";
    }

    if (lowerQuestion.includes("রোগ") || lowerQuestion.includes("পোকা") || lowerQuestion.includes("pest") || lowerQuestion.includes("disease")) {
      return "রোগ-বালাই ব্যবস্থাপনার জন্য:\n\n১. প্রতিরোধ: সম্ভব হলে রোগ প্রতিরোধী জাত ব্যবহার করুন\n২. পর্যবেক্ষণ: নিয়মিত মাঠ পরিদর্শন করুন\n৩. সমন্বিত ব্যবস্থাপনা: জৈবিক, কৃষিতাত্ত্বিক ও রাসায়নিক পদ্ধতি একসাথে ব্যবহার করুন\n৪. সময়মত পদক্ষেপ: আগে পদক্ষেপ নিলে কম খরচে বেশি ফল পাবেন\n\nকি ধরনের লক্ষণ দেখছেন বিস্তারিত বলুন?";
    }

    return "আপনার কৃষি বিষয়ক প্রশ্নের জন্য ধন্যবাদ। কিছু সাধারণ পরামর্শ:\n\n১. সঠিক সার প্রয়োগ ও ফসল পর্যায় মেনে চলুন\n২. নিয়মিত ফসল/গবাদি পশু পর্যবেক্ষণ করুন\n৩. চাষাবাদের রেকর্ড রাখুন\n৪. স্থানীয় কৃষি সম্প্রসারণ অফিসে যোগাযোগ করুন\n\nআরো বিস্তারিত জানাতে পারলে নির্দিষ্ট পরামর্শ দিতে পারব!";
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const isCurrentlySpeaking = isSpeaking && speakingMessageId === item.id;
    
    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser
              ? [styles.userBubble, { backgroundColor: theme.primary }]
              : [styles.assistantBubble, { backgroundColor: theme.card, borderColor: theme.cardBorder }],
          ]}
        >
          <ThemedText
            style={[
              styles.messageText,
              { color: isUser ? "#FFFFFF" : theme.text },
            ]}
          >
            {item.content}
          </ThemedText>
          
          {!isUser && Platform.OS !== "web" && (
            <Pressable
              style={[
                styles.speakButton,
                { backgroundColor: isCurrentlySpeaking ? theme.primary : theme.backgroundSecondary },
              ]}
              onPress={() => speakMessage(item)}
            >
              <Feather 
                name={isCurrentlySpeaking ? "volume-x" : "volume-2"} 
                size={16} 
                color={isCurrentlySpeaking ? "#FFFFFF" : theme.primary} 
              />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="message-circle" size={48} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyStateText, { color: theme.textSecondary }]}>
        কৃষি বিষয়ে যেকোনো প্রশ্ন করুন!
      </ThemedText>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
    >
      {aiNotice ? (
        <View style={[styles.noticeBar, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
          <Feather name="info" size={16} color={theme.text} style={{ marginTop: 2 }} />
          <ThemedText style={[styles.noticeText, { color: theme.text }]}>{aiNotice}</ThemedText>
        </View>
      ) : null}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[
          styles.messagesList,
          {
            paddingTop: Spacing.md,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        onContentSizeChange={() => {
          if (messages.length > 1) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
      />

      {isLoading ? (
        <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            চিন্তা করছি...
          </ThemedText>
        </View>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.backgroundRoot,
            borderTopColor: theme.divider,
            paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.md,
          },
        ]}
      >
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
              borderColor: theme.cardBorder,
            },
          ]}
          placeholder="আপনার প্রশ্ন লিখুন..."
          placeholderTextColor={theme.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
          textAlignVertical="center"
          onKeyPress={(e: any) => {
                  // web: Enter sends, Shift+Enter adds a new line
                  if (Platform.OS === "web" && e?.nativeEvent?.key === "Enter" && !e?.nativeEvent?.shiftKey) {
                    e.preventDefault?.();
                    handleSend();
                  }
                }}
              />
        <Pressable
          style={[
            styles.sendButton,
            { backgroundColor: theme.primary },
            !inputText.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
        >
          <Feather name="send" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  noticeBar: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  container: {
    flex: 1,
  },
  callIconContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  callIconText: {
    fontSize: 14,
    fontWeight: "600",
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  messageContainer: {
    marginVertical: Spacing.xs,
  },
  userMessageContainer: {
    alignItems: "flex-end",
  },
  assistantMessageContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  userBubble: {
    borderBottomRightRadius: Spacing.xs,
  },
  assistantBubble: {
    borderBottomLeftRadius: Spacing.xs,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  speakButton: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: Spacing.md,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  loadingText: {
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
