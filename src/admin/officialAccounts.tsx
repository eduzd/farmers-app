import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Page, Card, SectionTitle, Pill, Btn, Field, Empty, Loading, ErrorBox, ToggleRow, Text, useAdminNav, useL, useLoader, confirmAsk, st } from "./ui";

/* =============================================================================================
 * Official accounts: Farmers Official plus any others (Safety, Market news...). Each one is its own
 * verified chat in people's Chats; Official message lets the admin pick which one a message comes from.
 * ============================================================================================= */

const ICONS = ["check-circle", "shield", "alert-triangle", "bell", "trending-up", "shopping-bag", "heart", "sun", "droplet", "info", "award", "truck"] as const;
const COLORS = ["#2E96EF", "#00BB77", "#DA2F2F", "#B25E09", "#3D38D0", "#1F86DB", "#B25E09", "#FF4BB7"];

type Acc = { id: string; nameEn: string; nameBn: string; aboutEn: string; aboutBn: string; icon: string; color: string; isDefault: boolean; active: boolean; messages: number };

function Badge({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <Feather name={(icon in Feather.glyphMap ? icon : "check-circle") as any} size={Math.round(size * 0.46)} color="#fff" />
    </View>
  );
}

function AccountForm({ acc, onDone }: { acc?: Acc | null; onDone: () => void }) {
  const { theme } = useTheme();
  const L = useL();
  const [nameEn, setNameEn] = useState(acc?.nameEn || "");
  const [nameBn, setNameBn] = useState(acc?.nameBn || "");
  const [aboutEn, setAboutEn] = useState(acc?.aboutEn || "");
  const [aboutBn, setAboutBn] = useState(acc?.aboutBn || "");
  const [icon, setIcon] = useState(acc?.icon || "shield");
  const [color, setColor] = useState(acc?.color || "#DA2F2F");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const b = { nameEn: nameEn.trim(), nameBn: nameBn.trim(), aboutEn: aboutEn.trim(), aboutBn: aboutBn.trim(), icon, color };
      if (acc) await apiPut(`/api/admin/manage/official-accounts/${acc.id}`, b);
      else await apiPost("/api/admin/manage/official-accounts", b);
      onDone();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
    setBusy(false);
  };
  return (
    <Card testID="official-account-form">
      <View style={[st.row, { marginBottom: 12 }]}>
        <Badge icon={icon} color={color} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16 }} numberOfLines={1}>{L(nameEn || nameBn || "New account", nameBn || nameEn || "নতুন অ্যাকাউন্ট")}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12.5 }}>{L("How it looks in people's Chats", "মানুষের চ্যাটে যেমন দেখাবে")}</Text>
        </View>
      </View>
      <Field label={L("Name (English)", "নাম (ইংরেজি)")} value={nameEn} onChange={setNameEn} testID="oa-name-en" maxLength={60} placeholder="Farmers Safety" />
      <Field label={L("Name (Bangla)", "নাম (বাংলা)")} value={nameBn} onChange={setNameBn} testID="oa-name-bn" maxLength={60} placeholder="ফার্মার্স সেফটি" />
      <Field label={L("About (English, optional)", "পরিচিতি (ইংরেজি, ঐচ্ছিক)")} value={aboutEn} onChange={setAboutEn} testID="oa-about-en" maxLength={200} placeholder={L("Weather and disease alerts", "Weather and disease alerts")} />
      <Field label={L("About (Bangla, optional)", "পরিচিতি (বাংলা, ঐচ্ছিক)")} value={aboutBn} onChange={setAboutBn} testID="oa-about-bn" maxLength={200} placeholder="আবহাওয়া ও রোগের সতর্কতা" />
      <Text style={{ color: theme.textSecondary, fontWeight: "700", fontSize: 13, marginBottom: 8 }}>{L("Icon", "আইকন")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {ICONS.map((i) => (
          <Pressable key={i} testID={`oa-icon-${i}`} onPress={() => setIcon(i)} accessibilityRole="button" accessibilityState={{ selected: icon === i }}
            style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: icon === i ? color + "22" : theme.backgroundSecondary, borderWidth: icon === i ? 2 : 0, borderColor: color }}>
            <Feather name={i} size={18} color={icon === i ? color : theme.textSecondary} />
          </Pressable>
        ))}
      </View>
      <Text style={{ color: theme.textSecondary, fontWeight: "700", fontSize: 13, marginBottom: 8 }}>{L("Colour", "রঙ")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        {COLORS.map((c) => (
          <Pressable key={c} testID={`oa-color-${c.slice(1)}`} onPress={() => setColor(c)} accessibilityRole="button" accessibilityState={{ selected: color === c }}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, alignItems: "center", justifyContent: "center", borderWidth: color === c ? 3 : 0, borderColor: theme.text }}>
            {color === c ? <Feather name="check" size={16} color="#fff" /> : null}
          </Pressable>
        ))}
      </View>
      {err ? <Text testID="oa-error" style={{ color: "#DA2F2F", fontWeight: "700", marginBottom: 10 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Btn testID="oa-cancel" kind="ghost" label={L("Cancel", "বাতিল")} onPress={onDone} style={{ flex: 1 }} />
        <Btn testID="oa-save" icon="check" label={acc ? L("Save", "সেভ করুন") : L("Create account", "অ্যাকাউন্ট তৈরি")} busy={busy} disabled={!nameEn.trim() && !nameBn.trim()} onPress={save} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

export function OfficialAccountsScreen({ create }: { create?: boolean }) {
  const { theme } = useTheme();
  const L = useL();
  const nav = useAdminNav();
  const list = useLoader<Acc[]>(() => apiGet("/api/admin/manage/official-accounts"), []);
  const [editing, setEditing] = useState<Acc | "new" | null>(create ? "new" : null);
  const done = () => {
    setEditing(null);
    list.load();
  };
  return (
    <Page testID="admin-official-accounts" onRefresh={list.load}>
      <Card>
        <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16 }}>{L("Official accounts", "অফিসিয়াল অ্যাকাউন্ট")}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
          {L("Each account is its own verified chat in people's Chats. When you send an official message, you pick which one it comes from.", "প্রতিটি অ্যাকাউন্ট মানুষের চ্যাটে আলাদা ভেরিফায়েড চ্যাট। অফিসিয়াল মেসেজ পাঠানোর সময় কোন অ্যাকাউন্ট থেকে যাবে তা বেছে নিন।")}
        </Text>
        {editing === null ? (
          <View style={{ marginTop: 12 }}>
            <Btn testID="oa-new" icon="plus" label={L("New official account", "নতুন অফিসিয়াল অ্যাকাউন্ট")} onPress={() => setEditing("new")} />
          </View>
        ) : null}
      </Card>
      {editing !== null ? <AccountForm key={editing === "new" ? "new" : editing.id} acc={editing === "new" ? null : editing} onDone={done} /> : null}
      <SectionTitle title={L("Accounts", "অ্যাকাউন্ট")} />
      {list.loading && !list.data ? <Loading rows={2} /> : null}
      {list.error ? <ErrorBox text={list.error} onRetry={list.load} /> : null}
      {list.data && !list.data.length ? <Card><Empty icon="check-circle" text={L("No accounts", "কোনো অ্যাকাউন্ট নেই")} /></Card> : null}
      {(list.data || []).map((a) => (
        <Card key={a.id} testID={`oa-${a.id}`}>
          <View style={[st.row, { alignItems: "flex-start" }]}>
            <Badge icon={a.icon} color={a.color} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={{ color: theme.text, fontWeight: "800", fontSize: 15, flexShrink: 1 }} numberOfLines={1}>{L(a.nameEn, a.nameBn)}</Text>
                <Feather name="check-circle" size={14} color="#1D9BF0" />
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>{L(a.nameBn, a.nameEn)}</Text>
              {L(a.aboutEn, a.aboutBn) ? <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4 }} numberOfLines={2}>{L(a.aboutEn, a.aboutBn)}</Text> : null}
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {a.isDefault ? <Pill icon="star" label={L("Default", "ডিফল্ট")} color="#B25E09" /> : null}
                <Pill icon={a.active ? "eye" : "eye-off"} label={a.active ? L("On", "চালু") : L("Off", "বন্ধ")} color={a.active ? "#00BB77" : "#7A8CA3"} />
                <Pill icon="message-circle" label={L(`${a.messages} sent`, `${a.messages}টি পাঠানো`)} color="#2E96EF" />
              </View>
            </View>
          </View>
          {!a.isDefault ? (
            <ToggleRow testID={`oa-active-${a.id}`} icon="power" label={L("Turned on", "চালু")} sub={L("Off hides it from people's Chats and from Send from", "বন্ধ করলে মানুষের চ্যাট ও পাঠানোর তালিকা থেকে লুকাবে")} value={a.active}
              onChange={async (v) => { try { await apiPut(`/api/admin/manage/official-accounts/${a.id}`, { active: v }); list.load(); } catch {} }} />
          ) : null}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Btn small kind="soft" icon="send" testID={`oa-send-${a.id}`} label={L("Send message", "মেসেজ পাঠান")} disabled={!a.active} onPress={() => nav.push({ name: "official", from: a.id })} />
            <Btn small kind="ghost" icon="edit-2" testID={`oa-edit-${a.id}`} label={L("Edit", "এডিট")} onPress={() => setEditing(a)} />
            {!a.isDefault ? (
              <Btn small kind="dangerSoft" icon="trash-2" testID={`oa-delete-${a.id}`} label={L("Delete", "মুছুন")} onPress={async () => {
                if (!(await confirmAsk(L(`Delete ${a.nameEn}?`, `${a.nameBn} মুছবেন?`), L("Its chat and all its messages disappear from people's Chats. To keep them, turn it off instead.", "এর চ্যাট ও সব মেসেজ মানুষের চ্যাট থেকে মুছে যাবে। রাখতে চাইলে বন্ধ করুন।"), L("Delete", "মুছুন"), L("Cancel", "বাতিল")))) return;
                try { await apiDelete(`/api/admin/manage/official-accounts/${a.id}`); list.load(); } catch {}
              }} />
            ) : null}
          </View>
        </Card>
      ))}
    </Page>
  );
}
