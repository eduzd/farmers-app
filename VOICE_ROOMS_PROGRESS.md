# Voice rooms round (worktree /home/sprite/farmers-voiceroom, branch from f4f3e78)
Done: server/voiceRooms.ts (HTTP + vr_* socket, roles host/moderator/speaker/audience, stage 8 default (max 20), room 60,
chat, reactions, signalling), VoiceCallContext sendRoom/subscribeRoom, src/lib/voiceRoomApi.ts, roomAudio(.web), voiceRoom/mesh.ts, useVoiceRoom.ts,
tests/check-voice-rooms.mjs.
Todo: screens VoiceRoomsScreen (list: live + upcoming), VoiceRoomCreateScreen (setup page), VoiceRoomScreen (interior: stage grid 8 + More sheet,
audience, hands, chat box, reactions, mute/hand/leave), admin "who can host" UI, typecheck, tests, web build, deploy, commit/push. No APK unless asked.
Do NOT change numbers/limits.


## Round 3 (Oct 23, 6:40 AM) — finished, merged, deployed
- Merged origin/main (community feed polls) — communityRoutes now does attachVoiceRooms(withPolls(...)).
- Connect tab: src/components/VoiceRoomConnectCard.tsx (live/upcoming count; "Start a room" only when /api/voice-rooms/permission says canCreate).
- Feed + post detail: src/components/VoiceRoomPostCard.tsx (LIVE/UPCOMING/ENDED, Join re-checks the room first; host can Start a scheduled room; a deleted room falls back to the ended state from the post text). FeedPost.voiceRoom added in feedApi.postFromRow.
- New room page: share-to-feed is now a tick box, unticked by default; private rooms can't be shared.
- Admin: src/admin/voicerooms.tsx (More > Voice rooms): rule experts / only people I pick / everyone, add/remove picked people, end live rooms.
- Tests: tests/check-voice-rooms.mjs 73/73, tests/check-post-polls.mjs 30/30, tests/check-voice-rooms-web.py 29/29 x3 (en-320, en-390, bn-360). tsc clean.
- Not done: real two-phone voice test; no TURN relay (callRelay none); no APK.
