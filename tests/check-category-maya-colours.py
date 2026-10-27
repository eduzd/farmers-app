"""Marketplace category colours move to the Maya palette, without touching colours an admin picked.

1. A fresh database gets the Maya defaults (Vegetables = Maya green #00BB77, Medicine = Maya red).
2. An existing database (categories still on their old default colours, no 'shop_categories_maya'
   flag) moves to Maya on the next start: Vegetables #16A34A -> #00BB77. A colour an admin picked by
   hand (Fruits #123456) stays. It runs once: a later hand-picked #16A34A is kept.
Throwaway local server and database only.

    python3 tests/check-category-maya-colours.py
"""
import os, subprocess, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from webharness import H, ROOT

h = H("cat-maya")
h.start()
admin = h.signup("boss", "Admin Rahim")
h.make_admin(admin)
h.login(admin)


def cats():
    st, d = h.api("GET", "/api/admin/manage/categories", None, admin["token"])
    assert st == 200, (st, d)
    lst = d if isinstance(d, list) else d.get("categories", d.get("items", []))
    return {c["slug"]: c for c in lst}


c = cats()
h.ok(c["vegetables"]["color"].upper() == "#00BB77", "fresh database: Vegetables uses Maya green", c["vegetables"]["color"])
h.ok(c["medicine"]["color"].upper() == "#DA2F2F", "fresh database: Medicine uses Maya red", c["medicine"]["color"])
st, pub = h.api("GET", "/api/market/categories")
h.ok(st == 200 and not any(str(x.get("color", "")).upper() in ("#16A34A", "#15803D") for x in (pub if isinstance(pub, list) else pub.get("categories", []))),
     "public market categories have no old Farmers greens", st)

# Make it look like the live database before this change: old default colours, and no Maya flag.
h.stop()
script = r"""
const { PGlite } = require('@electric-sql/pglite');
(async () => {
  const db = new PGlite(process.argv[1]);
  await db.query("UPDATE shop_categories SET color = '#16A34A' WHERE slug = 'vegetables'");
  await db.query("UPDATE shop_categories SET color = '#DC2626' WHERE slug = 'medicine'");
  await db.query("UPDATE shop_categories SET color = '#123456' WHERE slug = 'fruits'");
  await db.query("DELETE FROM app_settings WHERE key = 'shop_categories_maya'");
  await db.close();
})().catch(e => { console.error(e); process.exit(1); });
"""
r = subprocess.run(["node", "-e", script, os.path.join(h.data_dir, "pglite")], cwd=ROOT, capture_output=True, text=True)
h.ok(r.returncode == 0, "rewound the throwaway database to the old colours", r.stderr[-300:])
h.start()
c = cats()
h.ok(c["vegetables"]["color"].upper() == "#00BB77", "existing database: old default Vegetables green moves to Maya green", c["vegetables"]["color"])
h.ok(c["medicine"]["color"].upper() == "#DA2F2F", "existing database: old default Medicine red moves to Maya red", c["medicine"]["color"])
h.ok(c["fruits"]["color"].upper() == "#123456", "existing database: a hand-picked colour is kept", c["fruits"]["color"])

# Runs once: an admin who later picks the old green on purpose keeps it after a restart.
st, d = h.api("PUT", f"/api/admin/manage/categories/{c['vegetables']['id']}", {"color": "#16A34A"}, admin["token"])
h.ok(st == 200, "admin can still pick any colour", (st, d))
h.stop()
h.start()
c = cats()
h.ok(c["vegetables"]["color"].upper() == "#16A34A", "the move runs only once (a later hand-picked colour stays)", c["vegetables"]["color"])
h.done()
