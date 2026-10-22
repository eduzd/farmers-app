// Phone-side fallback for opening notifications (src/lib/notificationTarget.ts), used for pushes
// without a server notification (calls) and when the server can't be reached.
//   npx tsx tests/check-notification-local-target.ts
import { localTarget, isAllowedTarget, cleanId, chatParams, profileUser } from "../src/lib/notificationTarget";

let failed = 0, passed = 0;
const ok = (c: any, label: string, extra?: any) => {
  if (c) passed++; else failed++;
  console.log(`${c ? "PASS" : "FAIL"}  ${label}${!c && extra !== undefined ? "  -> " + JSON.stringify(extra) : ""}`);
};
const t = (p: any) => localTarget(p);

ok(t({ type: "comment", data: { postId: "p1", commentId: "42" } })?.params?.commentId === "42", "comment -> post at comment");
ok(t({ type: "comment", data: { postId: "p1" } })?.params?.toComments === true, "old comment -> post comments");
ok(t({ type: "like", data: { postId: "p1" } })?.screen === "PostDetail", "like -> post");
ok(t({ type: "order", data: { orderId: "ord-1", role: "buyer" } })?.params?.orderId === "ord-1", "order -> order");
ok(t({ type: "order", data: { orderId: "ord 1; drop" } }) === null || t({ type: "order", data: { orderId: "ord 1; drop" } })?.screen !== "OrderDetail", "unsafe order id not opened");
ok(t({ type: "message", title: "Message from Bob", data: { userId: "u2" } })?.params?.userName === "Bob", "message -> chat with sender name");
ok(t({ type: "missed_call", body: "Bob called you", data: { type: "missed_call", callerId: "u2" } })?.screen === "Chat", "missed call -> that chat");
ok(t({ data: { type: "incoming_call", callId: "c" } }) === null, "incoming call -> nothing (call screen handles it)");
ok(t({ type: "follow", data: { userId: "u2", userName: "Bob" } })?.screen === "UserProfile", "follow -> profile");
ok(t({ type: "warning", title: "Warning", body: "x" })?.screen === "Notice", "warning -> full message");
ok(t({ type: "official", data: { screen: "OfficialChat", account: "safety" } })?.params?.account === "safety", "official -> account chat");
ok(t({ type: "support", data: { screen: "Support" } })?.screen === "SupportChat", "support -> Support chat");
ok(t({ type: "support", data: { screen: "AdminSupport", supportThreadId: "u9" } })?.params?.openThread === "u9", "admin support -> that thread");
ok(t({ type: "mystery", title: "Hi", data: { screen: "Settings" } })?.screen === "Notice", "unknown -> message only, ignores its screen");
ok(!isAllowedTarget({ screen: "Settings" }) && !isAllowedTarget({ screen: "javascript:alert(1)" }) && isAllowedTarget({ screen: "OrderDetail" }), "only listed screens allowed");
ok(cleanId("../x") === "" && cleanId("n-123_ab") === "n-123_ab", "ids cleaned");
ok(chatParams({ userId: "u2", userName: "Bob Ali" }).userInitials === "BA", "chat params");
ok(profileUser({ id: "u2", name: "Bob", role: "weird" }).role === "farmer", "profile user shape");
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
