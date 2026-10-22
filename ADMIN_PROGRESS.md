# Farmers Admin app round (task 56450041, branch admin-app, worktree /home/sprite/farmers-admin)

Isolated from the Connect task (fd8d0f50, works in /home/sprite/farmers-ui on ui-headers). Merge later.
User 2026-10-22: no keyboard shortcuts needed in Shop.

## Plan
1. [x] server/adminAppRoutes.ts: categories (public GET /api/market/categories + admin CRUD/reorder/reassign),
       admin shop (overview, products CRUD/search, product detail w/ orders, store create/detail/edit),
       order detail, support chat (user /api/support/*, admin /api/admin/manage/support/*). All admin = requireAdmin.
2. [x] (57/57 pass) tests/check-admin-app.mjs (non-admin denied, categories propagate, shop/products/orders, help->admin->reply, user isolation)
3. [ ] src/admin/*: AdminAppScreen (bottom nav: Home, Shop, Orders, Support, More) + detail views; variant admin route uses it
4. [ ] main app: Market + Sell + Seller Hub categories from server; Help button (home header) popup; SupportScreen = real chat
5. [ ] tsc, web export, web smoke at /admin, push main, Render live check
6. [ ] Admin APK (applicationId com.farmers.admin, EXPO_PUBLIC_APP_VARIANT=admin), release on GitHub, download check
