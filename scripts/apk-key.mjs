import crypto from 'crypto';
import fs from 'fs';
const seed = process.env.FARMERS_SIGNING_SEED;
if (!seed) throw new Error('FARMERS_SIGNING_SEED missing');
let ctr = 0;
function rnd(n) { let out = Buffer.alloc(0); while (out.length < n) { out = Buffer.concat([out, crypto.createHash('sha256').update(seed + ':' + (ctr++)).digest()]); } return out.subarray(0, n); }
function big(buf) { return BigInt('0x' + buf.toString('hex')); }
function modpow(b, e, m) { let r = 1n; b = b % m; while (e > 0n) { if (e & 1n) r = r * b % m; e = e >> 1n; b = b * b % m; } return r; }
const small = [3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n];
function isPrime(n) { for (const p of small) { if (n % p === 0n) return n === p; } let d = n - 1n; let s = 0; while ((d & 1n) === 0n) { d = d >> 1n; s++; } for (let i = 0; i < 40; i++) { const a = 2n + big(rnd(128)) % (n - 4n); let x = modpow(a, d, n); if (x === 1n || x === n - 1n) continue; let ok = false; for (let j = 1; j < s; j++) { x = x * x % n; if (x === n - 1n) { ok = true; break; } } if (!ok) return false; } return true; }
function prime() { while (true) { const b = rnd(128); b[0] = b[0] | 0xC0; b[127] = b[127] | 1; const p = big(b); if (p % 65537n !== 1n && isPrime(p)) return p; } }
function inv(a, m) { let r0 = a % m; let r1 = m; let s0 = 1n; let s1 = 0n; while (r1 !== 0n) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; } return ((s0 % m) + m) % m; }
function b64(x) { let h = x.toString(16); if (h.length % 2) h = '0' + h; return Buffer.from(h, 'hex').toString('base64url'); }
const e = 65537n;
let p = prime();
let q = prime();
if (p < q) { const t = p; p = q; q = t; }
const n = p * q;
const d = inv(e, (p - 1n) * (q - 1n));
const key = crypto.createPrivateKey({ key: { kty: 'RSA', n: b64(n), e: b64(e), d: b64(d), p: b64(p), q: b64(q), dp: b64(d % (p - 1n)), dq: b64(d % (q - 1n)), qi: b64(inv(q, p)) }, format: 'jwk' });
fs.writeFileSync('key.pem', key.export({ type: 'pkcs8', format: 'pem' }));
fs.writeFileSync('key.pk8', key.export({ type: 'pkcs8', format: 'der' }));
console.log('Signing key ready');
