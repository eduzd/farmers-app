// Live call check against the deployed server: two throwaway accounts, the ICE server
// list (is a TURN relay there?), and the full call set-up over the live socket:
// ring -> accept -> offer/answer/candidates relayed -> hang up.
// With WITH_MEDIA=1 it also opens a real WebRTC connection between the two (werift),
// forcing the TURN relay, and sends audio packets through it.
//   FB_ADMIN_TOKEN=... node tests/check-live-call.mjs
// (WITH_MEDIA needs the werift package: npm i --no-save werift)
import WebSocket from "ws";

const BASE = process.env.LIVE_URL || "https://farmers-2ybg.onrender.com";
const WS_URL = BASE.replace("https://", "wss://").replace("http://", "ws://") + "/ws/chat";
const FB_PROJECT = "farms-31bf9";
const FB_KEY = "AIzaSyDRAUJu7szUfeoPXMq_i-4fQTFOL6S3f0E";
const FB_ADMIN = process.env.FB_ADMIN_TOKEN;
const fbUids = [];
let passed = 0, failed = 0;
const ok = (cond, label) => { cond ? passed++ : failed++; console.log((cond ? "PASS" : "FAIL") + "  " + label); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gpost(url, body, bearer) {
  const headers = { "Content-Type": "application/json" };
  if (bearer) headers.Authorization = "Bearer " + bearer;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function signUp(tag) {
  const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const email = "callcheck-" + tag + "-" + stamp + "@check.test";
  const password = "Check-pass-" + stamp;
  const made = await gpost("https://identitytoolkit.googleapis.com/v1/projects/" + FB_PROJECT + "/accounts", { email, password, emailVerified: true, displayName: "Call check " + tag }, FB_ADMIN);
  if (!made.json?.localId) throw new Error("Firebase user create failed: " + made.status + " " + JSON.stringify(made.json));
  fbUids.push(made.json.localId);
  const si = await gpost("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FB_KEY, { email, password, returnSecureToken: true });
  const r = await gpost(BASE + "/api/auth/firebase", { idToken: si.json.idToken, name: "Call check " + tag });
  if (!r.json?.token) throw new Error("app sign-in failed: " + r.status + " " + JSON.stringify(r.json));
  return { token: r.json.token, id: String(r.json.user.id), name: tag };
}
async function socket(user) {
  const ws = new WebSocket(WS_URL);
  const inbox = [];
  ws.on("message", (d) => { try { inbox.push(JSON.parse(String(d))); } catch {} });
  await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });
  ws.send(JSON.stringify({ type: "auth", token: user.token }));
  const s = {
    ws, inbox,
    send: (m) => ws.send(JSON.stringify(m)),
    async wait(pred, ms = 10000) {
      const end = Date.now() + ms;
      while (Date.now() < end) { const i = inbox.findIndex(pred); if (i >= 0) return inbox.splice(i, 1)[0]; await sleep(50); }
      return null;
    },
  };
  ok(!!(await s.wait((m) => m.type === "auth_success")), user.name + " socket signed in");
  return s;
}

try {
  const a = await signUp("alice");
  const b = await signUp("bob");
  const ice = await (await fetch(BASE + "/api/calls/ice-servers", { headers: { Authorization: "Bearer " + a.token } })).json();
  const urls = (ice.iceServers || []).flatMap((s) => [].concat(s.urls || s.url || []));
  console.log("ICE servers:", urls.join(", "), "turn:", ice.turn);
  ok(urls.some((u) => /^turns?:/.test(u)), "live server hands out a TURN relay");

  const A = await socket(a);
  const B = await socket(b);
  A.send({ type: "call_initiate", calleeId: b.id, clientRef: "r1" });
  const ringing = await A.wait((m) => m.type === "call_ringing");
  ok(!!ringing && ringing.calleeOnline, "caller hears ringing, callee online");
  const inc = await B.wait((m) => m.type === "incoming_call");
  ok(!!inc && inc.callId === ringing?.callId, "callee gets the incoming call");
  B.send({ type: "call_ack", callId: inc.callId });
  B.send({ type: "call_accept", callId: inc.callId });
  ok(!!(await A.wait((m) => m.type === "call_accepted")), "caller told the call was answered");
  const callId = inc.callId;

  if (process.env.WITH_MEDIA) {
    const { RTCPeerConnection, MediaStreamTrack, RtpPacket, RtpHeader } = await import("werift");
    const relayOnly = { iceServers: ice.iceServers.filter((s) => [].concat(s.urls).some((u) => /^turn:/.test(u))).map((s) => ({ urls: [].concat(s.urls).filter((u) => /^turn:.*transport=udp|^turn:[^?]*$/.test(u))[0], username: s.username, credential: s.credential })), iceTransportPolicy: "relay" };
    console.log("relay config:", JSON.stringify(relayOnly.iceServers.map((s) => s.urls)));
    const pa = new RTCPeerConnection(relayOnly);
    const pb = new RTCPeerConnection(relayOnly);
    const track = new MediaStreamTrack({ kind: "audio" });
    pa.addTransceiver(track, { direction: "sendrecv" });
    let got = 0, relayType = "";
    pb.onTrack.subscribe((t) => t.onReceiveRtp.subscribe(() => got++));
    pa.onIceCandidate.subscribe((c) => { if (c) { if (/typ relay/.test(c.candidate)) relayType = "relay"; A.send({ type: "webrtc_ice_candidate", callId, targetUserId: b.id, candidate: c.toJSON() }); } });
    pb.onIceCandidate.subscribe((c) => { if (c) B.send({ type: "webrtc_ice_candidate", callId, targetUserId: a.id, candidate: c.toJSON() }); });
    const offer = await pa.createOffer();
    await pa.setLocalDescription(offer);
    A.send({ type: "webrtc_offer", callId, targetUserId: b.id, offer: { type: "offer", sdp: pa.localDescription.sdp } });
    const o = await B.wait((m) => m.type === "webrtc_offer");
    ok(!!o, "offer relayed to callee");
    await pb.setRemoteDescription(o.offer);
    const ans = await pb.createAnswer();
    await pb.setLocalDescription(ans);
    B.send({ type: "webrtc_answer", callId, targetUserId: a.id, answer: { type: "answer", sdp: pb.localDescription.sdp } });
    const an = await A.wait((m) => m.type === "webrtc_answer");
    ok(!!an, "answer relayed to caller");
    await pa.setRemoteDescription(an.answer);
    const pump = setInterval(async () => {
      for (const [S, pc] of [[A, pa], [B, pb]]) {
        let m; while ((m = S.inbox.findIndex((x) => x.type === "webrtc_ice_candidate")) >= 0) { const c = S.inbox.splice(m, 1)[0]; try { await pc.addIceCandidate(c.candidate); } catch {} }
      }
    }, 50);
    const end = Date.now() + 20000;
    while (Date.now() < end && pa.connectionState !== "connected") await sleep(200);
    ok(pa.connectionState === "connected", "WebRTC connected through the TURN relay only (" + pa.connectionState + ")");
    let seq = 0;
    for (let i = 0; i < 50 && pa.connectionState === "connected"; i++) {
      track.writeRtp(new RtpPacket(new RtpHeader({ payloadType: 111, sequenceNumber: seq++, timestamp: i * 960, ssrc: 1234, marker: false }), Buffer.alloc(60, 1)));
      await sleep(20);
    }
    await sleep(1000);
    ok(got > 10, "audio packets arrived through the relay (" + got + " of 50)");
    clearInterval(pump);
    await pa.close(); await pb.close();
  }

  A.send({ type: "call_end", callId });
  ok(!!(await B.wait((m) => m.type === "call_ended")), "hang-up reaches the other side");
  A.ws.close(); B.ws.close();
} catch (e) {
  failed++;
  console.log("FAIL  " + (e?.stack || e));
} finally {
  if (fbUids.length) {
    const r = await gpost("https://identitytoolkit.googleapis.com/v1/projects/" + FB_PROJECT + "/accounts:batchDelete", { localIds: fbUids, force: true }, FB_ADMIN);
    console.log("Firebase test users deleted:", r.status === 200 ? fbUids.length : "failed " + r.status);
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
