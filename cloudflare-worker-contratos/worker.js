// Cloudflare Worker: contratos de Navidad de Camote Weddings.
// - El admin (con ADMIN_KEY) crea contratos y recibe un enlace con id aleatorio.
// - El cliente abre el enlace, ve la vista previa y firma (una sola vez).
// - Solo el admin puede leer el contrato completo con la firma (para generar el PDF).
// Datos en KV (binding CONTRATOS). Variables: ALLOWED_ORIGIN, secreto ADMIN_KEY.

const MAX_FIRMA = 400000; // caracteres del data URL de la firma
const ID_RE = /^[A-Za-z0-9_-]{32}$/;

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "https://camoteweddings.com",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
function json(env, data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { ...cors(env), "Content-Type": "application/json" } });
}
function randomId() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  let s = ""; b.forEach(x => s += String.fromCharCode(x));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_"); // 32 caracteres
}
function safeEq(a, b) {
  const enc = new TextEncoder(), x = enc.encode(a), y = enc.encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}
function isAdmin(request, env) {
  const h = request.headers.get("Authorization") || "";
  return !!env.ADMIN_KEY && h.startsWith("Bearer ") && safeEq(h.slice(7), env.ADMIN_KEY);
}
const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    try {
      // ---------- Cliente ----------
      // GET /c/:id  -> datos para la vista previa (sin firma)
      if (parts[0] === "c" && parts.length === 2 && request.method === "GET") {
        if (!ID_RE.test(parts[1])) return json(env, { error: "not_found" }, 404);
        const c = await env.CONTRATOS.get("c:" + parts[1], "json");
        if (!c) return json(env, { error: "not_found" }, 404);
        const { firma, ip, ua, ...pub } = c;
        return json(env, { ...pub, firmado: !!firma });
      }
      // POST /c/:id/sign  -> firma única
      if (parts[0] === "c" && parts[2] === "sign" && request.method === "POST") {
        if (!ID_RE.test(parts[1])) return json(env, { error: "not_found" }, 404);
        const key = "c:" + parts[1];
        const c = await env.CONTRATOS.get(key, "json");
        if (!c) return json(env, { error: "not_found" }, 404);
        if (c.firma) return json(env, { error: "already_signed" }, 409);
        const body = await request.json().catch(() => null);
        const firma = body && body.firma;
        if (typeof firma !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(firma) || firma.length > MAX_FIRMA)
          return json(env, { error: "bad_signature" }, 400);
        c.firma = firma;
        c.firmadoEn = new Date().toISOString();
        c.ip = request.headers.get("CF-Connecting-IP") || "";
        c.ua = (request.headers.get("User-Agent") || "").slice(0, 200);
        await env.CONTRATOS.put(key, JSON.stringify(c), { metadata: { nombre: c.nombre, paquete: c.paquete, fecha: c.fecha, creado: c.creado, firmado: true } });
        return json(env, { ok: true });
      }

      // ---------- Admin ----------
      if (parts[0] === "admin") {
        if (!isAdmin(request, env)) return json(env, { error: "unauthorized" }, 401);

        // POST /admin/create
        if (parts[1] === "create" && request.method === "POST") {
          const b = await request.json().catch(() => null) || {};
          const c = {
            nombre: str(b.nombre, 120), ci: str(b.ci, 30), tel: str(b.tel, 30), email: str(b.email, 120),
            paquete: str(b.paquete, 60), incluye: str(b.incluye, 300), precio: Number(b.precio),
            fecha: str(b.fecha, 10), hora: str(b.hora, 5),
          };
          if (!c.nombre || !c.ci || !c.tel || !c.email || !c.paquete || !c.incluye || !c.fecha || !c.hora || !(c.precio > 0))
            return json(env, { error: "missing_fields" }, 400);
          c.id = randomId(); c.creado = new Date().toISOString(); c.firma = null;
          await env.CONTRATOS.put("c:" + c.id, JSON.stringify(c), { metadata: { nombre: c.nombre, paquete: c.paquete, fecha: c.fecha, creado: c.creado, firmado: false } });
          return json(env, { id: c.id });
        }
        // GET /admin/list
        if (parts[1] === "list" && request.method === "GET") {
          const out = []; let cursor;
          do {
            const r = await env.CONTRATOS.list({ prefix: "c:", cursor });
            r.keys.forEach(k => out.push({ id: k.name.slice(2), ...(k.metadata || {}) }));
            cursor = r.list_complete ? null : r.cursor;
          } while (cursor);
          out.sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
          return json(env, out);
        }
        // GET|DELETE /admin/c/:id
        if (parts[1] === "c" && parts.length === 3 && ID_RE.test(parts[2])) {
          const key = "c:" + parts[2];
          if (request.method === "GET") {
            const c = await env.CONTRATOS.get(key, "json");
            return c ? json(env, c) : json(env, { error: "not_found" }, 404);
          }
          if (request.method === "DELETE") { await env.CONTRATOS.delete(key); return json(env, { ok: true }); }
        }
      }
      return json(env, { error: "not_found" }, 404);
    } catch (e) {
      return json(env, { error: "server_error" }, 500);
    }
  },
};
