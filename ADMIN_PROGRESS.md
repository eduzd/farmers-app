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
5. [ ] push main (after the farmers-ui deploy task is finished), Render deploy + live check
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
 d. [ ] fast-forward main to admin-app, push, Render deploy, live check of commit
 e. [x] narrow-width (local, tests/check-chat-icon-web.py) check Connect + posts en/bn
