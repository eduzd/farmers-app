# Farmers Admin app round (task 56450041, branch admin-app, worktree /home/sprite/farmers-admin)

Isolated from the Connect task (fd8d0f50, works in /home/sprite/farmers-ui on ui-headers). Merge later.
User 2026-10-22: no keyboard shortcuts needed in Shop.

## Plan
1. [x] server/adminAppRoutes.ts: categories (public GET /api/market/categories + admin CRUD/reorder/reassign),
       admin shop (overview, products CRUD/search, product detail w/ orders, store create/detail/edit),
       order detail, support chat (user /api/support/*, admin /api/admin/manage/support/*). All admin = requireAdmin.
2. [x] (57/57 pass) tests/check-admin-app.mjs (non-admin denied, categories propagate, shop/products/orders, help->admin->reply, user isolation)
3. [x] src/admin/*: AdminAppScreen (bottom nav: Home, Shop, Orders, Support, More) + detail views; variant admin route uses it
4. [x] main app: Market chips + Sell form (chips) + Seller Hub + product page categories from server
       (src/lib/marketCategories.ts, offline fallback); Help button in home header (round, unread dot, guest prompt)
       -> popup -> SupportChat screen (real chat with admins).
4b.[x] User 2026-10-22: Connect page: intro title removed, AdCarousel (src/components/AdCarousel.tsx; advertise/vet/fish
       cards, auto-slide 4s) + floating Help button (HelpFab in HelpButton.tsx) -> SupportChat.
       Ads are fixed cards for now; NEXT: admin-managed ads (server table + admin More > Ads) for Connect + home carousel.
4c.[x] Merged origin/main b213ae9 (Connect/UI round) into admin-app; only dist/ conflicted (rebuilt).
4d.[x] tests/check-admin-web.py (local throwaway server; QUICK=1 for en/360 admin only). Results 2026-10-22:
       pre-merge full run: admin tabs Home/Shop(products,shops,categories)/Orders/Support/More at 320/360/390 en+bn:
       no sideways overflow, no cut labels; page error 'duplicate column name: owner_user_id' on every admin page.
       post-merge QUICK run: category add/rename/hide reaches Market + Seller Hub (en+bn); Help popup->chat;
       admin replies in Support; user sees unread dot + reply; Connect 320/360/390 en+bn: carousel auto-moves one
       card, no cut text, FAB above tab bar and opens chat, no overflow, no page errors (owner_user_id error gone).
       NOT re-run post-merge: admin tabs at 320/390 and in Bangla.
5. [x] pushed to main + live on Render (e4cb152, 2026-10-22)
6. [ ] Admin APK (applicationId com.farmers.admin, EXPO_PUBLIC_APP_VARIANT=admin), release on GitHub, download check

## Round: shared chat icon + Connect online dots, then merge to main + Render (task started 2026-10-22 08:11)
User (call): Connect specialist cards keep avatar+name, add green online dot; Message button = icon only (no text);
the icon must be the "nav chat icon" (custom ChatIcon in src/components/icons/ChatIcon.tsx, used by the Chats tab)
everywhere a chat/message/comment icon appears (posts, comments, Connect, etc.). One shared component.
Plan:
 a. [x] ChatIcon gets style prop; src/components/icons/AppIcon.tsx = drop-in Feather that renders ChatIcon for
        message-circle/message-square. Codemod: literal Feather message-* -> ChatIcon; dynamic <Feather name={..}> -> AppIcon.
 b. [x] Connect card: icon-only round chat button, "Active now" when online (avatar dot via UserAvatar userId).
 c. [x] tsc (0 errors), check-admin-app 57/57, check-chat-icon-web en+bn 320/360/390 all pass; + checks; commit on admin-app
 d. [x] main fast-forwarded to admin-app e4cb152 (has calls fix 4be0d40), pushed; Render /api/health version e4cb152; live guest check en+bn 320/390: Connect carousel + Help FAB + Sylin Har card with icon-only ChatIcon button, home shows ChatIcons, no page errors. Online dot needs sign-in (not checked live).
 e. [x] narrow-width (local, tests/check-chat-icon-web.py) check Connect + posts en/bn

## Round: admin web live for review (task 2026-10-22 08:48), branch admin-login-fix -> main 9c016ac
- Bug found live: real sign-in at /admin showed "Admins only" for admin@farmers.app (AdminAppScreen read user.isSuperAdmin,
  which sign-in never saves; the flag lives on the auth store). Fixed: read store isSuperAdmin. tests/check-admin-login-web.py
  (local: admin UI login -> admin app, also after reload; normal user -> Admins only; normal token 403 on /api/admin/manage/* + legacy).
- Live 9c016ac: UI sign-in at https://farmers-2ybg.onrender.com/admin -> admin app. All 5 tabs en+bn 320/360/390: no page errors,
  no API errors, no sideways page scroll. More items all open (Users, moderation, notify, delivery; classic Control Tower for
  posts/reports, content, analytics, settings, logs). Order detail opens. No-token /api/admin/manage/* = 401.
- Not done: no global search bar across admin (per-tab search only); carousel ads not admin-managed; admin APK not built (user: wait).

## 2026-10-22: hisendrag@gmail.com made admin on live DB
- Existing account (id d8befc8d..., created 2026-10-21) set is_super_admin=true via PUT /api/admin/manage/users/:id (signed in as admin@farmers.app). No other fields changed. Verified: GET user shows isSuperAdmin true; admins filter lists hisendrag@gmail.com + admin@farmers.app. requireAdmin reads the flag from DB on every request; /api/auth/me refreshes it on app load.

## Round: admin redesign + moderation + official page (task started 2026-10-22 10:01, branch admin-redesign in /home/sprite/farmers-adminfix, from main 7de207a)
 a. [x] server: restrictions (users.restrictions jsonb, banned_until, deleted_at) enforced in platformGuard (code RESTRICTED: message/post/comment/sell/buy)
 b. [x] server/moderationRoutes.ts: moderation GET/PUT restrictions, ban(days)/unban, remove-content, DELETE user (confirm username/email; anonymise shell if FKs), official page (/api/official/*, admin /official), carousel ads (/api/ads + admin CRUD), admin /search
 c. [x] admin support photo reply POST /support/threads/:id/photo
 d. [x] profile share button = post share (Feather upload, 44 round)
 e. [ ] tests for b (extend tests/check-admin-app.mjs or new tests/check-moderation.mjs)
 f. [ ] admin UI redesign (theme fonts, tab bar like main app, CustomSwitch + radio rows like Checkout), user moderation sheet, Official composer, Ads manager, global search, product form (unit radio, options)
 g. [ ] main app: Farmers Official pinned in Chats + OfficialChatScreen, ads from /api/ads in Connect, RESTRICTED messages shown
 h. [ ] web export, commit, push main, Render check

## Round: redesign round 1 (look + chat), task 2026-10-21 22:48 PDT, branch admin-redesign
 - [x] AdminAppScreen frame finished (header w/ app icon + ADMIN CONSOLE, search + support icons, 5-tab bar w/ badges, route stack); tsc 0 errors (fixed isDark)
 - [x] fade+rise transition on tab/screen change; press "pop" (scale 0.96) on buttons, 0.92 on tab icons
 - [x] Support thread = main app SupportConversation (same header, bubbles, composer, plus -> Camera/Gallery, mic); admin photo + voice replies (/support/threads/:id/photo|voice)
 - [x] check-admin-app 57/57, check-moderation 58/58; web export rebuilt (0ee897c)
 Later rounds: user moderation sheet UI (ban/remove/delete/restrict messaging/posting - server done), Farmers Official in users' Chats,
 admin-editable carousel ads UI + Connect reading /api/ads, global search polish, "water product add" (ASK USER what it means),
 profile share button = post share (done server/UI d. above, verify live), admin APK (wait for user OK).
 - [x] Pushed main 0826906; Render /api/health version 0826906; live serves new bundle index-3b5f8b40. tests/check-admin-live.py (read-only):
       UI sign-in as admin@farmers.app at /admin -> admin app; all 5 tabs at 320/360/390, no page errors, 0px sideways overflow, Orders badge 4.
       Live Bangla toggle not exercised (localStorage key didn't switch it); Bangla checked locally only. Live support thread not opened (would mark read).
 - check-admin-web.py updated for full-screen chat (support-input/support-send/support-back); local en+bn 320/360/390 all clean; admin reply reached Ann.
 - This commit (tests + notes) pushed to branch admin-redesign only, not main, to avoid another Render deploy.

## Round: product sell-as details, hold-to-reply, dark mode, Home icon (2026-10-22)
- [x] Product form: How is it sold (weight kg/g/maund, packs bag/box/packet/sack/crate/bottle with amount kg/g/litre/ml/pieces,
      piece, dozen, litre/ml), price per unit, stock, min/max order, live "Buyers will see" preview, organic, grade, variety,
      origin, harvest date, shelf life, storage. Server validates (productFields SELL_AS, pack size required, min<=max).
- [x] Support chat (shared SupportChatScreen, both sides): hold a message -> Reply / Copy / Try again menu (main chat styles),
      reply bar above composer, quote saved server-side (reply_to_* columns, only same-thread messages).
- [x] Dark mode: moon/sun on admin Home header + Appearance card in More (Light/Dark/Auto), uses main themeStore (persisted).
- [x] Home tab uses main app HomeIcon.
- [x] tests: check-admin-app 70/70, check-moderation 63/63, tests/check-admin-dark-web.py (light/dark en/bn 360, dark 320).
