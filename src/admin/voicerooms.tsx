import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { Feather } from "@/components/icons/Feather";
import { useTheme } from "@/hooks/useTheme";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import {
  useL, useLoader, useDebounced, Page, Card, SectionTitle, Btn, Loading, ErrorBox, Text, RadioGroup, SearchBox, Avatar, Empty, Pill,
  fmtDate, confirmAsk, st,
} from "./ui";

/**
 * Admin > More > Voice rooms. Who may start voice rooms in the Connect tab (admins always can):
 * experts only, only the people picked here, or everyone. People picked here can start rooms under any rule.
 * The server enforces it (server/voiceRooms.ts canHost; GET/PUT /api/admin/manage/voice-rooms).
 * Also lists live rooms so an admin can end one.
 */
type Who = "experts" | "selected" | "everyone";
type Host = { id: string; name: string; username: string; email: string; avatar: string | null; profileRole: string | null; addedAt: string | null };
type View_ = { who: Who; hosts: Host[]; liveRooms: any[]; stageLimit: number; stageMax: number };

const A = "/api/admin/manage/voice-rooms";

export function VoiceRoomSettings() {
  const { theme } = useTheme();
  const L = useL();
  const v = useLoader<View_>(() => apiGet(A), []);
  const [data, setData] = useState<View_ | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const found = useLoader<any[]>(
    () => (dq.trim().length >= 2 ? apiGet(`/api/admin/manage/users?q=${encodeURIComponent(dq.trim())}`) : Promise.resolve([])),
    [dq],
  );
  useEffect(() => {
    if (v.data) setData(v.data);
  }, [v.data]);

  const run = async (key: string, fn: () => Promise<View_>, done?: string) => {
    setBusy(key); setErr(null); setMsg(null);
    try {
      const next = await fn();
      if (next && (next as any).who) setData(next);
      if (done) setMsg(done);
    } catch (e: any) {
      setErr(e?.message || L("Couldn't save. Try again.", "সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।"));
    } finally {
      setBusy(null);
    }
  };

  if (v.loading && !data) return <Page><Loading /></Page>;
  if (v.error && !data) return <Page><ErrorBox text={v.error} onRetry={v.load} /></Page>;
  if (!data) return <Page><Loading /></Page>;

  const hostIds = new Set(data.hosts.map((h) => h.id));
  const results = (found.data || []).filter((u: any) => u && u.id).slice(0, 8);

  return (
    <Page testID="admin-voice-rooms" onRefresh={v.load} refreshing={v.loading}>
      {err ? <ErrorBox text={err} /> : null}
      {msg ? (
        <View style={[st.row, { gap: 8, marginBottom: 10 }]} testID="vr-admin-msg">
          <Feather name="check-circle" size={16} color={theme.primary} />
          <Text style={{ color: theme.primary, fontWeight: "700" }}>{msg}</Text>
        </View>
      ) : null}

      <SectionTitle title={L("Who can start voice rooms", "কারা ভয়েস রুম শুরু করতে পারবেন")} />
      <Card>
        <Text style={{ color: theme.textSecondary, fontSize: 12.5, marginBottom: 10 }}>
          {L(
            "Everyone can listen and join. This decides who sees the voice room button (the mic next to the filter) in the Connect tab. Admins can always start rooms, and the people you pick below can start them under any rule.",
            "সবাই শুনতে ও যোগ দিতে পারেন। এখানে ঠিক হয় কারা Connect ট্যাবে ফিল্টারের পাশে ভয়েস রুম বাটন (মাইক) দেখবেন। অ্যাডমিনরা সবসময় পারেন, আর নিচে বাছাই করা মানুষরা যেকোনো নিয়মে পারেন।",
          )}
        </Text>
        <RadioGroup<Who>
          testID="vr-who"
          value={data.who}
          onChange={(w) => {
            if (w === data.who || busy) return;
            run("who", () => apiPut(A, { who: w }), L("Saved", "সংরক্ষিত"));
          }}
          options={[
            { value: "experts", icon: "award", label: L("Experts", "বিশেষজ্ঞ"), sub: L("Expert accounts, plus the people you pick", "বিশেষজ্ঞ অ্যাকাউন্ট, আর আপনার বাছাই করা মানুষ") },
            { value: "selected", icon: "user-check", label: L("Only people I pick", "শুধু আমার বাছাই করা মানুষ"), sub: L("Nobody else can start a room", "আর কেউ রুম শুরু করতে পারবেন না") },
            { value: "everyone", icon: "users", label: L("Everyone", "সবাই"), sub: L("Any account that isn't banned", "ব্যান না হওয়া যেকোনো অ্যাকাউন্ট") },
          ]}
        />
        {busy === "who" ? <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 6 }}>{L("Saving…", "সংরক্ষণ হচ্ছে…")}</Text> : null}
      </Card>

      <SectionTitle title={L(`People who can start rooms (${data.hosts.length})`, `যাঁরা রুম শুরু করতে পারেন (${data.hosts.length.toLocaleString("bn-BD")})`)} />
      <Card>
        <SearchBox
          testID="vr-host-search"
          value={q}
          onChange={setQ}
          placeholder={L("Search a name, email or phone to add", "যোগ করতে নাম, ইমেইল বা ফোন খুঁজুন")}
        />
        {dq.trim().length >= 2 ? (
          <View style={{ marginTop: 8, gap: 6 }}>
            {found.loading ? <Loading rows={1} /> : null}
            {!found.loading && !results.length ? (
              <Text style={{ color: theme.textSecondary, fontSize: 12.5 }}>{L("No accounts match.", "কোনো অ্যাকাউন্ট মেলেনি।")}</Text>
            ) : null}
            {results.map((u: any) => {
              const added = hostIds.has(u.id);
              return (
                <View key={u.id} style={[st.row, { gap: 10, paddingVertical: 4 }]} testID={`vr-found-${u.id}`}>
                  <Avatar name={u.name || u.email} uri={u.avatar} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{u.name || u.username || u.email || L("Farmer", "কৃষক")}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>{u.email || u.phone || u.username || ""}</Text>
                  </View>
                  {added ? (
                    <Pill label={L("Added", "যোগ করা আছে")} color={theme.primary} icon="check" />
                  ) : (
                    <Btn
                      small
                      kind="soft"
                      icon="plus"
                      label={L("Add", "যোগ")}
                      busy={busy === `add-${u.id}`}
                      testID={`vr-add-${u.id}`}
                      onPress={() => run(`add-${u.id}`, () => apiPut(`${A}/hosts/${encodeURIComponent(u.id)}`, {}), L("Added. They can start voice rooms now.", "যোগ করা হয়েছে। উনি এখন ভয়েস রুম শুরু করতে পারবেন।"))}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ) : null}
        <View style={{ marginTop: 12, gap: 6 }}>
          {!data.hosts.length ? (
            <Text style={{ color: theme.textSecondary, fontSize: 12.5 }}>
              {L("No one picked yet. Search above to add people.", "এখনো কাউকে বাছাই করা হয়নি। উপরে খুঁজে যোগ করুন।")}
            </Text>
          ) : null}
          {data.hosts.map((h) => (
            <View key={h.id} style={[st.row, { gap: 10, paddingVertical: 4 }]} testID={`vr-host-${h.id}`}>
              <Avatar name={h.name} uri={h.avatar} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{h.name}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {[h.email || h.username, h.addedAt ? L(`added ${fmtDate(h.addedAt, false)}`, `যোগ ${fmtDate(h.addedAt, false)}`) : ""].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Pressable
                testID={`vr-remove-${h.id}`}
                accessibilityRole="button"
                accessibilityLabel={L(`Remove ${h.name}`, `${h.name} কে সরান`)}
                hitSlop={8}
                disabled={!!busy}
                onPress={async () => {
                  const ok = await confirmAsk(
                    L("Remove this person?", "এই মানুষটিকে সরাবেন?"),
                    L("They won't be able to start new voice rooms unless the rule above allows them. Rooms already live keep going.", "উপরের নিয়ম অনুমতি না দিলে উনি নতুন ভয়েস রুম শুরু করতে পারবেন না। চলমান রুম চলতে থাকবে।"),
                    L("Remove", "সরান"),
                    L("Cancel", "বাতিল"),
                  );
                  if (ok) run(`rm-${h.id}`, () => apiDelete(`${A}/hosts/${encodeURIComponent(h.id)}`), L("Removed", "সরানো হয়েছে"));
                }}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: theme.error + "14" }}
              >
                <Feather name="x" size={16} color={theme.error} />
              </Pressable>
            </View>
          ))}
        </View>
      </Card>

      <SectionTitle title={L(`Live now (${data.liveRooms.length})`, `এখন লাইভ (${data.liveRooms.length.toLocaleString("bn-BD")})`)} />
      {!data.liveRooms.length ? (
        <Empty icon="mic" text={L("No voice rooms are live right now.", "এখন কোনো ভয়েস রুম লাইভ নেই।")} />
      ) : (
        data.liveRooms.map((r: any) => (
          <Card key={r.id} testID={`vr-live-${r.id}`}>
            <View style={[st.row, { gap: 10 }]}>
              <Avatar name={r.hostName} uri={r.hostAvatar} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: theme.text, fontWeight: "800" }} numberOfLines={1}>{r.title}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {L(`Host: ${r.hostName} · ${r.speakers} on stage · ${r.listeners} listening`, `হোস্ট: ${r.hostName} · মঞ্চে ${r.speakers} · শ্রোতা ${r.listeners}`)}
                </Text>
              </View>
              <Btn
                small
                kind="ghost"
                icon="power"
                label={L("End", "শেষ")}
                busy={busy === `end-${r.id}`}
                testID={`vr-end-${r.id}`}
                onPress={async () => {
                  const ok = await confirmAsk(
                    L("End this room?", "এই রুমটি শেষ করবেন?"),
                    L("Everyone in it is taken out and its feed card shows it has ended.", "সবাইকে রুম থেকে বের করে দেওয়া হবে, আর ফিডের কার্ডে শেষ দেখাবে।"),
                    L("End room", "রুম শেষ করুন"),
                    L("Cancel", "বাতিল"),
                  );
                  if (ok) run(`end-${r.id}`, () => apiPost(`${A}/${encodeURIComponent(r.id)}/end`, {}), L("Room ended", "রুম শেষ হয়েছে"));
                }}
              />
            </View>
          </Card>
        ))
      )}
    </Page>
  );
}
