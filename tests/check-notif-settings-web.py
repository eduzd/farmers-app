"""Web check (throwaway local server, needs ./dist): Settings > Notifications section with the
Notifications and Vibration switches, English + Bangla, 320/360/390 wide.

  python3 tests/check-notif-settings-web.py [shots_dir]

- The section shows NOTIFICATIONS / বিজ্ঞপ্তি with "Notifications" and "Vibration" switches, both on by default.
- Switches are real switches for screen readers (role=switch, aria-checked).
- Turning Vibration off keeps Notifications on, shows the "still come with sound" hint, and is
  saved on the phone (localStorage farmers:notificationPrefs) and still off after a reload.
- Turning Notifications off greys out Vibration (disabled) and shows the "off on this phone" hint.
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

PORT = 6500 + random.randint(0, 90)
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/home/sprite/farmers-shots/notif-settings"
os.makedirs(SHOTS, exist_ok=True)
data_dir = tempfile.mkdtemp(prefix="notif-web-")
env = dict(os.environ, PORT=str(PORT), NODE_ENV="development", DATA_DIR=data_dir, DATABASE_URL="", FIREBASE_PROJECT_ID="",
           PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET="notif-web-secret-0123456789abcdef0123456789ab")
srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], env=env, stdout=open("/tmp/notif-web-server.log", "a"),
                       stderr=subprocess.STDOUT, start_new_session=True)
for _ in range(120):
    try:
        urllib.request.urlopen(BASE + "/api/market/categories", timeout=2); break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("server did not start")


def api(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"null")


s = str(int(time.time() * 1000))[-7:]
ann = api("POST", "/api/auth/signup", {"email": f"ann{s}@check.test", "password": "Check-pass-123", "name": "Ann", "username": f"ann_{s}"})


def init_script(lang):
    u = dict(ann["user"]); u["language"] = lang
    return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
            % (json.dumps(ann["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))


TEXT = {
    "en": {"section": "NOTIFICATIONS", "notif": "Notifications", "vib": "Vibration", "hint": "still come with sound", "off": "off on this phone"},
    "bn": {"section": "বিজ্ঞপ্তি", "notif": "বিজ্ঞপ্তি", "vib": "ভাইব্রেশন", "hint": "শব্দসহ আসবে", "off": "বিজ্ঞপ্তি বন্ধ আছে"},
}
results = {}
fails = []


def check(key, cond, label):
    results.setdefault(key, {})[label] = bool(cond)
    if not cond:
        fails.append(f"{key}: {label}")


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ("en", "bn"):
            for w in (320, 360, 390):
                key = f"{lang}-{w}"
                T = TEXT[lang]
                ctx = await b.new_context(viewport={"width": w, "height": 800}, device_scale_factor=2)
                pg = await ctx.new_page()
                errors = []
                pg.on("pageerror", lambda e: errors.append(str(e)))
                await pg.add_init_script(init_script(lang))

                async def open_settings():
                    await pg.goto(BASE, wait_until="networkidle")
                    await pg.wait_for_function("()=>window.__nav && window.__nav.isReady()", timeout=30000)
                    await pg.evaluate("()=>window.__nav.navigate('Settings')")
                    sec = pg.locator('[data-testid="settings-notifications"]')
                    await sec.wait_for(timeout=15000)
                    await sec.scroll_into_view_if_needed()
                    await pg.wait_for_timeout(600)
                    return sec

                sec = await open_settings()
                txt = await sec.inner_text()
                check(key, T["section"] in txt and T["vib"] in txt and T["notif"] in txt, "section + both labels")
                notif = pg.locator('[data-testid="switch-notifications"]')
                vib = pg.locator('[data-testid="switch-vibration"]')
                check(key, await notif.get_attribute("role") == "switch" and await vib.get_attribute("role") == "switch", "role=switch")
                check(key, await notif.get_attribute("aria-label") == T["notif"] and await vib.get_attribute("aria-label") == T["vib"], "accessible names")
                check(key, await notif.get_attribute("aria-checked") == "true" and await vib.get_attribute("aria-checked") == "true", "both on by default")
                box = await sec.bounding_box()
                vb = await vib.bounding_box()
                check(key, vb and box and vb["x"] + vb["width"] <= w and vb["x"] + vb["width"] <= box["x"] + box["width"] + 1, "switch fits on screen")
                await pg.screenshot(path=f"{SHOTS}/default-{key}.png")

                # Vibration off: notifications stay on, hint, saved.
                await vib.click()
                await pg.wait_for_timeout(500)
                check(key, await vib.get_attribute("aria-checked") == "false", "vibration turns off")
                check(key, await notif.get_attribute("aria-checked") == "true", "notifications stay on")
                check(key, T["hint"] in await pg.locator('[data-testid="notifications-hint"]').inner_text(), "sound hint")
                stored = json.loads(await pg.evaluate("()=>localStorage.getItem('farmers:notificationPrefs')") or "null")
                check(key, stored == {"enabled": True, "vibrate": False}, "saved on the phone")
                await pg.screenshot(path=f"{SHOTS}/vibration-off-{key}.png")

                # Reload: still off.
                sec = await open_settings()
                check(key, await vib.get_attribute("aria-checked") == "false" and await notif.get_attribute("aria-checked") == "true", "still off after reload")

                # Notifications off: vibration disabled + hint.
                await notif.click()
                await pg.wait_for_timeout(500)
                check(key, await notif.get_attribute("aria-checked") == "false", "notifications turn off")
                check(key, await vib.get_attribute("aria-disabled") == "true", "vibration disabled while notifications off")
                check(key, T["off"] in await pg.locator('[data-testid="notifications-hint"]').inner_text(), "off hint")
                await vib.click(force=True)
                await pg.wait_for_timeout(300)
                check(key, await vib.get_attribute("aria-checked") == "false", "disabled vibration switch ignores taps")
                await pg.screenshot(path=f"{SHOTS}/notifications-off-{key}.png")

                # Both back on.
                await notif.click(); await pg.wait_for_timeout(300)
                await vib.click(); await pg.wait_for_timeout(500)
                stored = json.loads(await pg.evaluate("()=>localStorage.getItem('farmers:notificationPrefs')") or "null")
                check(key, stored == {"enabled": True, "vibrate": True}, "both back on and saved")
                check(key, not errors, "no page errors")
                if errors:
                    print(key, errors[:3])
                await ctx.close()
        await b.close()


try:
    asyncio.run(main())
finally:
    try:
        os.killpg(srv.pid, signal.SIGTERM)
    except Exception:
        pass

for k, v in results.items():
    print(k, "PASS" if all(v.values()) else "FAIL", sum(v.values()), "/", len(v))
print("FAILURES:", fails if fails else "none")
sys.exit(1 if fails else 0)
