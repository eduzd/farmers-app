# Farmers app – fix & responsive pass (progress log)

Started 2026-10-20. Small steps, logged as they land.

## Done
- [x] `window.__nav` (navigation ref) exposed on web so Playwright can open every screen directly.
- [x] scripts/audit.py: opens all ~127 screens at any viewport sizes, reports crashes, console/page errors,
      failed /api calls, horizontal overflow, clipped text and overlapping text. scripts/probe.py prints element rects.
- [x] Baseline audit at 390x844 (before): only crashes were from test params; no overflow found.
- [x] Per-screen error boundary (ScreenErrorBoundary via Stack `screenLayout`): one broken screen shows
      "Go back / Try again" instead of killing the whole app.
- [x] Web responsive frame (src/lib/webFrame.ts): on tablets/desktop the app is a centred column (max 640px),
      Dimensions/useWindowDimensions clamped so card grids sized from screen width don't stretch or overflow.
- [x] Alert.alert was a silent no-op on web (122 calls in 48 screens: validation, confirms, "saved").
      WebAlertHost replaces it with an in-app dialog supporting any buttons.
- [x] Server: /api/ai-status; ai-chat & analyze-disease return `offline` + `notice` when GOOGLE_API_KEY missing;
      AI screen shows a notice banner; disease screen uses getApiUrl (was relative to old Replit domain env).
- [x] Server: bKash callback URL now uses PUBLIC_URL or the request host (was REPLIT_DEV_DOMAIN/localhost);
      added /payment-success, /payment-failed, /payment-cancelled pages; bKash sandbox create-payment verified working.
- [x] Server: GET /api/calc-records without userId no longer returns every user's records; unknown /api routes return JSON 404.

- [x] Returning users no longer get sent back to onboarding on every login (login now marks onboarding done, keeps role/username).
- [x] Saved Bangla/English choice is restored on app start (loadLanguage was never called).
- [x] RN Modals constrained to the app column on wide screens (CSS in webFrame.ts).
- [x] Full audit 360x640 / 430x932 / 768x1024 / 1280x800: no crashes, no page errors, no horizontal overflow,
      no clipped text, nothing hidden at the bottom of lists. Only floating + buttons (FABs) sit over list rows mid-scroll (by design).
- [x] scripts/flows.py: signup -> onboarding -> logout -> login, Bepari calc, AI (notice + reply), weather, web alert, Bangla persist: 10/10 pass.

- [x] Dead buttons fixed: product Share (Web Share / copy link), product Call seller (tel: or offer to message),
      company review menu (report), invoice PDF (print / Save as PDF via expo-print; share PDF on phones).
- [x] Admin: ADMIN_EMAIL in .env makes that account super admin; adminAuth no longer shadows the super-admin
      /users route; new Content moderation tab (GET/DELETE /api/admin/posts). Flows: all 8 admin tabs open.
- [x] Chat: Enter sends on web (Shift+Enter = new line) in chat, AI and comments; sample chat now reads in the right order, prices in ৳.
- [x] Real person-to-person messages: server/dmRoutes.ts (/api/dm/threads, /api/dm/:userId/messages, table auto-created,
      live push over /ws/chat), Chat screen uses it for real accounts (polls every 4s), Chats list shows real threads above samples.
- [x] Market -> product -> Buy -> Checkout -> Place order works (flows2.py).

- [x] Final audit after all changes at 360x640, 390x844, 430x932, 768x1024 (and 1280x800 earlier): no crashes,
      no page errors, no failed API calls, no overflow, clipping, or content hidden at the bottom.
- [x] Final flows: flows.py 10/10, flows2.py 12/12, live chat between two accounts verified both ways.
- [x] Before/after screenshots: /home/sprite/farmers-desktop-before-after.png, /home/sprite/farmers-phone-after.png.

## Pass 3 (2026-10-20)
- [x] Chats list and RFQ: floating buttons replaced by inline header buttons (New message pencil next to the filter chips,
      + New request next to the RFQ tabs), so nothing sits over list text any more. Audit at 360x640/1280x800: 0 flagged.
- [x] scripts/audit.py logs in as admin@farmers.app and audits all 8 AdminDashboard tabs at every size.
- [x] Market: removed the duplicate floating cart button (header cart with badge stays) - it covered product cards.
- [x] Server catalog (server/catalogRoutes.ts, table catalog_items, seeded from the old samples in server/catalogSeed.ts):
      GET/POST/PUT/DELETE /api/catalog/{experts|events|listings}, POST /api/catalog/events/:id/register.
      Owner or super admin can edit/delete.
- [x] Experts screen loads from the server; "Add expert" form; pencil to edit/delete (owner/admin).
- [x] Events screen loads from the server; "Add event" form; Register is saved on the server (spotsLeft goes down).
- [x] Market: "Sell" button opens a listing form; listings come from the server and show first; long-press own listing to edit/delete.
- [x] Checkout also records the order on the server (POST /api/shop-orders); currency now ৳.
- [x] Admin Analytics: real 14-day bar charts (new users, posts, orders, products) from GET /api/admin/analytics.
      Admin Reports: real app report (totals, order value, users by role, recent orders).
- [x] Language: live toggle fixed app-wide - with the React Compiler on, t() was memoised and screens didn't change
      until reload. useI18n now gives a new t per language. New tr()/useTr() (src/lib/tr.ts + src/lib/trDict.ts,
      ~210 phrases) wraps hard-coded text on cart, orders, order detail, product, chat, checkout, notifications,
      user profile, RFQ, weather, feed calculator and all offline calculator/ledger screens. Calculator screens now
      follow the app language (were fixed to Bangla); calculator settings language buttons also switch the app.
      scripts/i18n_wrap.py does the wrapping for more screens.
- [x] scripts/flows3.py: experts/events/sell/admin analytics/language toggle flows (9/9 pass).
- [x] Polls, Expert Q&A, Farm Diary, Price Alerts: floating + buttons moved into the header (useHeaderAddButton),
      the audit flagged them covering list text.
- [x] Price Alerts: the + button did nothing - now opens a "new alert" form; the bell on a popular product pre-fills it;
      alerts are saved on the device.
- [x] Nearby Farmers: Message opened a "coming soon" alert - now opens an SMS to the farmer's number.
- [x] Full audit (127 screens + 8 admin tabs, 5 sizes): only the 4 FAB screens were flagged; after the fix a re-audit of
      the changed screens at all 5 sizes shows 0 flagged. flows.py 10/10, flows2.py 10/10 (updated to accept the
      English "Buy" and checkout placeholders), tsc clean.
- Note: flows3 registers the admin for one seeded event per run (registrations stay on the event).
- Not checked: the audit runs in English only; Bangla text is longer and wasn't audited for clipping.

## Not done / known limits
- About 100 screens have hard-coded Bangla or English text, so the language switch only changes screens built on i18n.
- Admin Reports and Analytics charts are still placeholders (no reporting feature exists to feed them).
- Voice/video calls need a TURN server to work across networks; not tested.
- Sample data stays in places with no server source (sample chats, some market listings, experts, events).

## Still blocked (needs keys)
- AI help: GOOGLE_API_KEY in .env (UI shows notice, answers fall back to tips)
- bKash live: BKASH_USERNAME/PASSWORD/APP_KEY/APP_SECRET + BKASH_SANDBOX=false (sandbox works now)

## Pass 4 (2026-10-20, "same design, all functionality + more features")
- [x] server/featureRoutes.ts (tables auto-created): notifications, favorites, item reviews + seller rating, follows,
      order tracking (status + history, seller_ids resolved from listing owners, buyer/seller views, allowed transitions),
      wallet from real orders/sales, image uploads (/api/uploads -> /uploads/*), community lists polls/questions/rfqs/diary
      (seeded from old samples; vote, upvote, answers, RFQ bids, private diary with reminders -> notifications),
      server price alerts with /check. New order / status change / review / follow / answer / quote / DM / reminder /
      price alert all create in-app notifications. scripts/api_features.py: 43/43 pass.
- [x] Client: src/lib/api.ts, favoritesStore, community.ts, share.ts. Notifications screen = server (15s poll, tap opens order/chat/RFQ/Q&A/diary/alerts).
      Orders: "My orders | Selling" tabs, seller status buttons, status history, buyer cancel (pending only), checkout sends id+address.
      Wishlist = favorites store (server/guest device), add-to-cart works, bell creates server price alert.
      Product detail: heart = favorites, ratings & reviews card + write review, follow seller, chat goes to real owner.
      Polls, Expert Q&A (upvote, answers, share), RFQ (bids, close/reopen, details, my requests) = server.
- [x] Farm diary = server (private, categories, reminders -> notifications, tap to delete). Wallet = real orders/sales; add/withdraw/send explain bKash keys needed. Followers/Following = server.
- [x] Market: sort/filter chips (newest, price up/down, top rated, saved). Sell form: Upload photo (expo-image-picker -> /api/uploads).
- [x] Price alerts = server for logged-in users; opening the screen checks today's prices and fires notifications.

## Pass 5 (2026-10-20, "more Market features + richer checkout")
- [x] server/checkoutRoutes.ts: GET /api/coupons, GET /api/checkout/options, POST /api/checkout/quote (server prices for
      listings, stock check, delivery fee home ৳60 Dhaka / ৳120 elsewhere, free over ৳2000, express ৳150 Dhaka only, pickup free,
      coupons KRISHI10 / NEW50 / FARMER100 / FREESHIP), saved addresses GET/POST/PUT default/DELETE /api/me/addresses.
      POST /api/shop-orders with `checkout` -> server totals, 409 when over stock, takes stock off listings, saves checkout jsonb.
- [x] Market client: Vegetables/Fruits/Grains/Livestock categories, Filters panel (price range, division, in stock), Nearby sort (my division first), result count + Clear all, Recently viewed strip, stock badges (Out of stock / Only N left), sell form stock + minimum order + unit hint. Product detail: related products, quantity starts at min order and stops at stock, out-of-stock disables buy, real stock/sold specs. tsc clean, web export rebuilt.
- [x] Checkout client: saved addresses from the server (+ picker), new address with division chips, district, upazila,
      village/road, "save this address"; delivery method cards (home / express Dhaka-only / pickup) with fees and a free-delivery hint;
      delivery day (next 3 days) + time slot; promo code box with tap-to-apply coupon chips and error text; Cash on Delivery, bKash
      shown as needing merchant keys; order notes; summary (items, subtotal, delivery, discount, total) from /api/checkout/quote;
      confirmation with order id, delivery slot, Track order / Continue shopping. Order detail shows delivery method, slot, notes and
      the price breakdown. Cart shows ৳ and "delivery fee at checkout" (was a $5 flat fee).
- [x] Fixes found while testing: Market and Product detail crashed on Sell-form listings without rating/seller (now defaulted);
      flows2 updated for the new checkout; flows4 rfq step now closes the "Bid sent" dialog.
- [x] Checks: tsc clean; audit.py Market/Cart/Checkout/ProductDetail/Orders/OrderDetail at 5 sizes 0 flagged; flows2 + flows4 16/16 +
      api_features pass; scripts/shots5.py places a real order through the UI (KRISHI10, COD) with no page errors; stock went down.
- Leftovers: admin account has a saved address and a few test orders from shots5; test listing deleted.

## Push notifications, code side (2026-10-21)
- [x] server/push.ts: push_tokens table; POST/DELETE/GET /api/me/push-tokens (sign-in required, user from token only,
      userId for someone else -> 403, delete only own -> 404, Expo token format check, max 10 per user, masked list).
      sendPush() via Expo push API (EXPO_ACCESS_TOKEN optional, PUSH_DISABLED=1, EXPO_PUSH_URL for tests), drops DeviceNotRegistered.
- [x] notify() in featureRoutes.ts also sends a push, so new order (seller), order status (buyer), admin announcements, DMs etc. reach phones.
- [x] Removed the old open endpoints: POST /api/push-tokens, GET /api/push-tokens/:userId, POST /api/send-notification (no auth!).
- [x] Client: notificationService registers channel, asks permission, gets Expo token (projectId from extra.eas.projectId or easConfig;
      quietly skips when missing), syncPushTokenAfterSignIn after every sign-in and app start, removes token on logout. Guests skip.
- [x] scripts/push_tokens_test.py (fake Expo server on 5599): 26/26.
- [ ] Needs user: Expo account + `eas init` projectId, Android app com.farmers.app in Firebase (google-services.json), FCM V1 key uploaded to Expo.

## Expo link (2026-10-21)
- [x] Expo account username is dinaparp (login dirapir3@gmail.com). Created project @dinaparp/farmers, ID 506448c5-81c8-45ae-b73a-2f85302df243.
- [x] app.json: expo.owner=dinaparp, extra.eas.projectId set.

## Bottom bar / keyboard / nav bar colour (APK v1.0.0-bottombar1)
- New hook src/hooks/useKeyboardAwareBottomPadding.ts: bottom padding = nav-bar inset + extra when keyboard closed, extra only when open (optional follow = translate with keyboard). Uses keyboard-controller values (not Reanimated useAnimatedKeyboard).
- Chat composer was paddingBottom insets-8, so it sat 8dp inside the 48dp 3-button bar. Fixed via hook; same for PostDetail comments, AI assistant, Community new-post toolbar, KeyboardComposerLayout, BottomActionBar. ProductDetail footer (qty input) follows the keyboard.
- ModalBottomInset grows to keyboard height (Android modals use ADJUST_NOTHING), avoidKeyboard={false} where a KAV already wraps (Settings edit modal).
- FarmDiary, Inventory, SellerApp product modals wrapped in keyboard-controller KAV; Welfare and Fish Summit forms switched to keyboard-controller KAV padding.
- Cart footer and calculator StickyActionBar get +8dp above the nav bar.
- app.json androidNavigationBar.enforceContrast=false (no grey scrim) + expo-navigation-bar; App.tsx sets button style by in-app theme.

## Pass "UI polish + Connect" (2026-10-22) -- one APK with everything
Scope: duplicate headers / clipped tabs, composer separator/background (chat + post detail), profile badge vs Verified overlap,
online dots bottom-right (real presence), home share = detail share, post actions (owner Edit/Delete; others Report/Save/Mute/Block/Request Quote),
photo jitter while typing, feed thumb cropped (cover 4:3) / detail whole / fullscreen viewer / upload full or crop (choice),
saved posts -> Profile Saved section (server), unread badges (bell + Messages tab), Connect tab next to Home (professional roles only, not farmers).
- [x] server: posts PATCH/DELETE, relations (mute/block), save + /me/saved-posts, report (+admin reports), presence beat/query, /api/me/notifications/unread-count, DM block check
- [x] PostActionsSheet, share button, ProfileScreen saved posts from server
- [x] PhotoViewer.tsx (PhotoViewer + PostPhoto thumb/full), CommunityScreen pickImage asks Full photo / Crop
- [x] PostDetail ListHeaderComponent={renderHeader()} (header remounted every render -> photo jitter)
- [x] liveStatus.ts (unread counts + presence + heartbeat), CountBadge.tsx, Messages tab badge, bell badge
- [ ] refreshUnreadCounts after mark-read (Notifications, Chat), on push received
- [ ] UserAvatar userId -> online dot bottom-right; pass userId in feed/chat list/chat header/post detail/profile
- [ ] Connect tab + screen + server /api/connect/professionals
- [x] 2026-10-22 round: fixed the two tsc errors (presence sweep `.unref` typed via `any` in server/communityRoutes.ts;
      `isSaved?: boolean` added to the PostDetail `Post` param type in RootStackNavigator.tsx). `npx tsc --noEmit` clean.
- [x] Committed all saved UI work on ui-headers (ab49992), then merged main (calls2 fix 4be0d40: VoiceCallContext opens /ws/chat).
      Merge had no conflicts; tsc clean again after the merge.
- [x] (live a4bd5b9 on Render, health checked) USER DECISION 2026-10-22: no APK for now. Deliver the WEB version (Render https://farmers-2ybg.onrender.com) for the user
      to check first; they will confirm before any APK build.
- [x] Web: `npm run web:export` (dist is committed, served by server on Render), smoke test, merge ui-headers -> main, push origin main, verify Render /api/health shows the new commit.
- [ ] Then: Connect tab + screen + server /api/connect/professionals; unread refresh after mark-read; UserAvatar online dot; narrow-width Bangla/English audit.
- [ ] NEW REQUEST 2026-10-22: SEPARATE ADMIN APP (own app, same look/UI design as the main Farmers app, different functionality).
      Two apps: (1) Farmers main app for everybody, (2) Farmers Admin app that controls the whole platform. Must include:
      users (view/search, roles, verify, suspend/ban, delete), products + product listings (approve/reject/hide/edit/delete),
      shops = different companies selling different products (approve companies/stores, suspend, per-company products),
      orders (approve/reject, status, refunds/cancel), payment system setup (bKash etc. keys/config, payment records),
      community posts/reports moderation, notifications/announcements, Connect (the "Connect" name/tab must be in it), app settings.
      Starting point: existing AdminDashboardScreen + src/components/admin/* (orders/stores/listings/delivery tiles, 8 tabs)
      and server/adminRoutes.ts. Plan: separate Expo entry/app (e.g. apps/admin or second app.json) sharing src/ components
      and the same server; web first, user checks before any APK.
- [ ] LAST (after user confirms everything is done): full source handoff zip + HANDOFF.md for another AI agent (what the app is,
      how to run server/web/APK, env keys needed, branches, what is done/pending). Not before.
