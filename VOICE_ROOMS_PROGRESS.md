# Voice rooms round (worktree /home/sprite/farmers-voiceroom, branch from f4f3e78)
Done: server/voiceRooms.ts (HTTP + vr_* socket, roles host/moderator/speaker/audience, stage 8 default (max 20), room 60,
chat, reactions, signalling), VoiceCallContext sendRoom/subscribeRoom, src/lib/voiceRoomApi.ts, roomAudio(.web), voiceRoom/mesh.ts, useVoiceRoom.ts,
tests/check-voice-rooms.mjs.
Todo: screens VoiceRoomsScreen (list: live + upcoming), VoiceRoomCreateScreen (setup page), VoiceRoomScreen (interior: stage grid 8 + More sheet,
audience, hands, chat box, reactions, mute/hand/leave), admin "who can host" UI, typecheck, tests, web build, deploy, commit/push. No APK unless asked.
Do NOT change numbers/limits.
