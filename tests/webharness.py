"""Shared helpers for web checks: a throwaway local server with its own database, serving ./dist.

    from webharness import H
    h = H("market")            # picks a port, temp data dir, shots dir
    h.start(); admin = h.signup("boss", "Admin Rahim"); h.make_admin(admin)  # restarts the server
    ... async with async_playwright() as p: pg = await h.page(b, admin, "en", 360, path="/admin")
    h.done()                   # stops the server, prints the summary, exits 1 on any failure
"""
import asyncio, json, os, random, signal, subprocess, sys, tempfile, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def T(tid):
    return f'[data-testid="{tid}"]'


class H:
    def __init__(self, name):
        self.name = name
        self.port = 6500 + random.randint(0, 400)
        self.base = f"http://127.0.0.1:{self.port}"
        self.shots = sys.argv[1] if len(sys.argv) > 1 else f"/home/sprite/farmers-shots/{name}"
        os.makedirs(self.shots, exist_ok=True)
        self.data_dir = tempfile.mkdtemp(prefix=f"{name}-web-")
        self.env = dict(os.environ, PORT=str(self.port), NODE_ENV="development", DATA_DIR=self.data_dir, DATABASE_URL="",
                        FIREBASE_PROJECT_ID="", PUSH_DISABLED="1", ADMIN_EMAIL="", JWT_SECRET=f"{name}-web-secret-0123456789abcdef0123456789")
        self.srv = None
        self.fails = []
        self.passes = 0
        self.errors = []

    def start(self):
        self.srv = subprocess.Popen(["npx", "tsx", "server/index.ts"], cwd=ROOT, env=self.env,
                                    stdout=open(f"/tmp/{self.name}-web-server.log", "a"), stderr=subprocess.STDOUT, start_new_session=True)
        for _ in range(180):
            try:
                urllib.request.urlopen(self.base + "/api/health", timeout=2)
                return
            except Exception:
                time.sleep(1)
        raise RuntimeError("server did not start")

    def stop(self):
        try:
            os.killpg(self.srv.pid, signal.SIGTERM)
        except Exception:
            pass
        time.sleep(2)

    def api(self, method, path, body=None, tok=None):
        req = urllib.request.Request(self.base + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {tok}"} if tok else {})})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read() or b"null")
            except Exception:
                return e.code, None

    def signup(self, tag, name):
        s = str(int(time.time() * 1000))[-7:] + str(random.randint(10, 99))
        email = f"{tag}{s}@check.test"
        st, j = self.api("POST", "/api/auth/signup", {"email": email, "password": "Check-pass-123", "name": name, "username": f"{tag}_{s}"})
        assert j and j.get("token"), (st, j)
        return {"token": j["token"], "user": j["user"], "id": str(j["user"]["id"]), "email": email}

    def login(self, acc):
        st, j = self.api("POST", "/api/auth/login", {"email": acc["email"], "password": "Check-pass-123"})
        acc["token"], acc["user"] = j["token"], j["user"]

    def make_admin(self, *accs):
        """Marks accounts as super admins (stops and restarts the server)."""
        self.stop()
        ids = json.dumps([a["id"] for a in accs])
        subprocess.run(["node", "-e", """
const { PGlite } = require('@electric-sql/pglite');
(async () => { const pg = new PGlite(process.argv[1]); for (const id of JSON.parse(process.argv[2])) await pg.query('UPDATE users SET is_super_admin = true WHERE id = $1', [id]); await pg.close(); })();
""", os.path.join(self.data_dir, "pglite"), ids], check=True, cwd=ROOT)
        self.start()
        for a in accs:
            self.login(a)

    def ok(self, cond, label, extra=""):
        print(("PASS  " if cond else "FAIL  ") + label + ("" if cond or not extra else f"  -> {str(extra)[:300]}"), flush=True)
        if cond:
            self.passes += 1
        else:
            self.fails.append(label)

    @staticmethod
    def init_script(acc, lang):
        u = dict(acc["user"]); u["language"] = lang
        return ("localStorage.setItem('auth_token', %s); localStorage.setItem('user', %s); localStorage.setItem('onboarding_complete','true'); localStorage.setItem('language', %s);"
                % (json.dumps(acc["token"]), json.dumps(json.dumps(u)), json.dumps(lang)))

    async def page(self, b, acc, lang, w, path="/", h=800):
        ctx = await b.new_context(viewport={"width": w, "height": h})
        if acc:
            await ctx.add_init_script(self.init_script(acc, lang))
        pg = await ctx.new_page()
        tag = f"{acc['user'].get('name') if acc else 'guest'}-{lang}-{w}"
        pg.on("pageerror", lambda e: self.errors.append(f"{tag}: {str(e)[:200]}"))
        pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(self.base + path, wait_until="load", timeout=180000)
        await pg.wait_for_timeout(3000)
        return ctx, pg

    @staticmethod
    async def wait_for(pg, tid, ms=15000):
        try:
            await pg.locator(T(tid)).first.wait_for(state="visible", timeout=ms)
            return True
        except Exception:
            return False

    @staticmethod
    async def text(pg, tid):
        loc = pg.locator(T(tid))
        return (await loc.first.inner_text()).strip() if await loc.count() else None

    @staticmethod
    async def no_overflow(pg):
        return await pg.evaluate("()=>document.documentElement.scrollWidth<=window.innerWidth+1")

    def done(self):
        self.stop()
        self.ok(not self.errors, "no page errors", self.errors[:5])
        print(f"\n{self.passes} passed, {len(self.fails)} failed", flush=True)
        sys.exit(1 if self.fails else 0)
