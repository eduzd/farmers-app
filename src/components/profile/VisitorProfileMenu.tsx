import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, TextInput, Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/icons/AppIcon";
import { ProfileSheet, SheetRow } from "@/components/profile/ProfileSheet";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/lib/authStore";
import { apiGet } from "@/lib/api";
import { setUserRelation } from "@/lib/feedApi";
import { reportUser } from "@/lib/profileApi";
import { shareText } from "@/lib/share";
import { Spacing, FontFamily } from "@/constants/theme";

const REASONS: { key: string; en: string; bn: string }[] = [
  { key: "spam", en: "Spam", bn: "স্প্যাম" },
  { key: "scam", en: "Scam or fraud", bn: "প্রতারণা বা জালিয়াতি" },
  { key: "impersonation", en: "Pretending to be someone else", bn: "অন্য কারও ভান করছে" },
  { key: "harassment", en: "Harassment or bullying", bn: "হয়রানি বা উত্ত্যক্ত করা" },
  { key: "hate", en: "Hate speech", bn: "ঘৃণামূলক কথা" },
  { key: "nudity", en: "Nudity or sexual content", bn: "অশ্লীল কন্টেন্ট" },
  { key: "violence", en: "Violence or threats", bn: "সহিংসতা বা হুমকি" },
  { key: "other", en: "Something else", bn: "অন্য কিছু" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  user: { id: string; name: string; username?: string };
  bn: boolean;
  /** Called after a block so the page can go back. */
  onBlocked?: () => void;
}

/**
 * The three-dot menu on someone else's profile: share, mute, block and report.
 * Mute and block are the same real settings the post menu uses; report goes to the admin queue.
 */
export function VisitorProfileMenu({ visible, onClose, user, bn, onBlocked }: Props) {
  const { theme } = useTheme();
  const L = (en: string, b: string) => (bn ? b : en);
  const [muted, setMuted] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"" | "mute" | "block" | "report">("");
  const [step, setStep] = useState<"menu" | "report">("menu");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!visible) return;
    setStep("menu");
    setReason("");
    setDetails("");
    const token = useAuthStore.getState().getToken();
    if (!token) return;
    let alive = true;
    apiGet<{ muted?: string[]; blocked?: string[] }>("/api/relations")
      .then((r) => {
        if (!alive) return;
        setMuted((r?.muted || []).includes(user.id));
        setBlocked((r?.blocked || []).includes(user.id));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible, user.id]);

  const needToken = () => {
    const token = useAuthStore.getState().getToken();
    if (!token) {
      Alert.alert(L("Sign in first", "আগে সাইন ইন করুন"), L("You need an account to do this.", "এটা করতে অ্যাকাউন্ট লাগবে।"));
      return null;
    }
    return token;
  };

  const notify = (title: string, msg?: string) => {
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      (globalThis as any).alert?.(msg ? `${title}\n${msg}` : title);
    } else Alert.alert(title, msg);
  };

  const share = () => {
    onClose();
    shareText(
      user.name,
      bn
        ? `কৃষক বন্ধু অ্যাপে ${user.name}${user.username ? ` (@${user.username})` : ""}-কে খুঁজুন`
        : `Find ${user.name}${user.username ? ` (@${user.username})` : ""} on Farmers`,
    );
  };

  const toggle = async (kind: "mute" | "block") => {
    const token = needToken();
    if (!token) return;
    const now = kind === "mute" ? !!muted : !!blocked;
    setBusy(kind);
    try {
      await setUserRelation(token, kind, user.id, !now);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (kind === "mute") setMuted(!now);
      else setBlocked(!now);
      onClose();
      if (kind === "mute") {
        notify(now ? L("Unmuted", "মিউট তুলে দেওয়া হয়েছে") : L("Muted", "মিউট করা হয়েছে"), now ? undefined : L(`You won't see ${user.name}'s posts in your feed.`, `আপনি ফিডে ${user.name}-এর পোস্ট দেখবেন না।`));
      } else {
        notify(now ? L("Unblocked", "আনব্লক করা হয়েছে") : L("Blocked", "ব্লক করা হয়েছে"), now ? undefined : L(`You won't see each other's posts.`, `আপনারা একে অপরের পোস্ট দেখবেন না।`));
        if (!now) onBlocked?.();
      }
    } catch (e: any) {
      notify(L("Couldn't do that", "করা যায়নি"), e?.message || L("Please try again.", "আবার চেষ্টা করুন।"));
    } finally {
      setBusy("");
    }
  };

  const confirmBlock = () => {
    if (blocked) return toggle("block");
    const title = L(`Block ${user.name}?`, `${user.name}-কে ব্লক করবেন?`);
    const msg = L("Their posts disappear from your feed and yours from theirs. You can unblock any time.", "তাদের পোস্ট আপনার ফিডে আর আপনার পোস্ট তাদের ফিডে দেখা যাবে না। যেকোনো সময় আনব্লক করা যাবে।");
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if ((globalThis as any).confirm?.(`${title}\n${msg}`)) toggle("block");
      return;
    }
    Alert.alert(title, msg, [
      { text: L("Cancel", "বাতিল"), style: "cancel" },
      { text: L("Block", "ব্লক"), style: "destructive", onPress: () => toggle("block") },
    ]);
  };

  const sendReport = async () => {
    if (!reason) return;
    if (!needToken()) return;
    setBusy("report");
    try {
      await reportUser(user.id, reason, details.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
      notify(L("Report sent", "রিপোর্ট পাঠানো হয়েছে"), L("Thanks. Our team will review this profile.", "ধন্যবাদ। আমাদের টিম এই প্রোফাইলটি দেখবে।"));
    } catch (e: any) {
      notify(L("Couldn't send the report", "রিপোর্ট পাঠানো যায়নি"), e?.message || L("Please try again.", "আবার চেষ্টা করুন।"));
    } finally {
      setBusy("");
    }
  };

  return (
    <ProfileSheet
      visible={visible}
      onClose={onClose}
      title={step === "menu" ? user.name : L("Report profile", "প্রোফাইল রিপোর্ট")}
      testID="visitor-profile-menu"
    >
      {step === "menu" ? (
        <>
          <SheetRow icon="share-2" label={L("Share profile", "প্রোফাইল শেয়ার")} onPress={share} testID="visitor-menu-share" />
          <SheetRow
            icon={muted ? "volume-2" : "volume-x"}
            label={muted ? L("Unmute", "মিউট তুলুন") : L("Mute", "মিউট করুন")}
            sub={muted ? L("See their posts in your feed again", "আবার ফিডে তাদের পোস্ট দেখুন") : L("Hide their posts from your feed", "ফিড থেকে তাদের পোস্ট লুকান")}
            busy={busy === "mute"}
            onPress={() => toggle("mute")}
            testID="visitor-menu-mute"
          />
          <SheetRow
            icon="slash"
            label={blocked ? L("Unblock", "আনব্লক করুন") : L("Block", "ব্লক করুন")}
            sub={blocked ? undefined : L("You won't see each other's posts", "আপনারা একে অপরের পোস্ট দেখবেন না")}
            danger={!blocked}
            busy={busy === "block"}
            onPress={confirmBlock}
            testID="visitor-menu-block"
          />
          <SheetRow
            icon="flag"
            label={L("Report profile", "প্রোফাইল রিপোর্ট করুন")}
            sub={L("Tell our team what's wrong", "কী সমস্যা আমাদের টিমকে জানান")}
            danger
            onPress={() => {
              if (!needToken()) return;
              setStep("report");
            }}
            testID="visitor-menu-report"
          />
        </>
      ) : (
        <View style={styles.report} testID="visitor-report-form">
          <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
            {L(`Why are you reporting ${user.name}?`, `কেন ${user.name}-কে রিপোর্ট করছেন?`)}
          </ThemedText>
          {REASONS.map((r) => {
            const on = reason === r.key;
            return (
              <Pressable
                key={r.key}
                testID={`visitor-report-reason-${r.key}`}
                onPress={() => setReason(r.key)}
                style={[styles.reason, { borderColor: on ? theme.link : theme.cardBorder, backgroundColor: on ? theme.backgroundSecondary : theme.card }]}
              >
                <View style={[styles.radio, { borderColor: on ? theme.link : theme.border }]}>{on ? <View style={[styles.radioDot, { backgroundColor: theme.link }]} /> : null}</View>
                <ThemedText style={[styles.reasonText, { color: theme.text }]}>{bn ? r.bn : r.en}</ThemedText>
              </Pressable>
            );
          })}
          <TextInput
            testID="visitor-report-details"
            value={details}
            onChangeText={setDetails}
            placeholder={L("Anything else? (optional)", "আর কিছু? (ঐচ্ছিক)")}
            placeholderTextColor={theme.textTertiary}
            multiline
            maxLength={500}
            style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.card }]}
          />
          <View style={styles.reportButtons}>
            <Pressable onPress={() => setStep("menu")} style={[styles.btn, { borderColor: theme.text, backgroundColor: theme.card }]} testID="visitor-report-back">
              <ThemedText style={[styles.btnText, { color: theme.text }]}>{L("Back", "ফিরে যান")}</ThemedText>
            </Pressable>
            <Pressable
              onPress={sendReport}
              disabled={!reason || busy === "report"}
              style={[styles.btn, { borderColor: theme.text, backgroundColor: theme.text, opacity: !reason || busy === "report" ? 0.45 : 1 }]}
              testID="visitor-report-send"
            >
              <AppIcon name="flag" size={16} color={theme.backgroundRoot} />
              <ThemedText style={[styles.btnText, { color: theme.backgroundRoot }]}>{busy === "report" ? L("Sending…", "পাঠানো হচ্ছে…") : L("Send report", "রিপোর্ট পাঠান")}</ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </ProfileSheet>
  );
}

const styles = StyleSheet.create({
  report: { paddingHorizontal: Spacing.sm, gap: Spacing.sm },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.xs },
  reason: { flexDirection: "row", alignItems: "center", gap: Spacing.md, borderWidth: 1, borderRadius: 12, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { fontSize: 15, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 72, padding: Spacing.md, fontSize: 15, textAlignVertical: "top" },
  reportButtons: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
  btn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm },
  btnText: { fontSize: 15, fontFamily: FontFamily.semibold },
});

export default VisitorProfileMenu;
