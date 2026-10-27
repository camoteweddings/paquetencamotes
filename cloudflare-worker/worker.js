// Cloudflare Worker: reenvía eventos de conversión a la Meta Conversions API (server-side).
// Se usa junto con capi.js (en la raíz del sitio), que llama a este Worker desde el navegador
// además de disparar el Pixel normal — así el mismo evento llega por dos caminos y Meta los
// deduplica automáticamente usando el mismo event_id.
//
// También recibe el webhook de Cal.com (POST /cal-webhook): cuando alguien agenda (BOOKING_CREATED)
// agrega sus datos, con hash SHA-256, a una audiencia personalizada de Meta ("Personas que agendaron")
// para poder crear audiencias similares.
//
// Variables de entorno necesarias (configurar en el dashboard de Cloudflare, no en este archivo):
//   PIXEL_ID            -> "1608878456861993" (el dataset/pixel de Camote Weddings)
//   META_ACCESS_TOKEN    -> token de acceso generado en Meta Events Manager (SECRETO, no lo pegues aquí)
//   ALLOWED_ORIGIN       -> "https://camoteweddings.com" (para restringir quién puede llamar al Worker)
//   TEST_EVENT_CODE      -> (opcional) código de prueba de Meta Events Manager, solo mientras se prueba
// Solo para el webhook de Cal:
//   CAL_WEBHOOK_SECRET   -> secreto que también se pega en Cal (SECRETO)
//   META_AD_ACCOUNT_ID   -> id de la cuenta publicitaria, con o sin el prefijo "act_" (no secreto)
//   META_AUDIENCE_NAME   -> (opcional) nombre de la audiencia, por defecto "Personas que agendaron"
//   META_AUDIENCE_ID     -> (opcional) id de una audiencia ya creada, para no buscarla por nombre
// El token del webhook necesita permisos ads_management y business_management.

const GRAPH = "https://graph.facebook.com/v21.0";

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(text) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

// Verifica la firma que manda Cal (x-cal-signature-256 = HMAC-SHA256 hex del cuerpo crudo).
async function validSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const got = signature.trim().toLowerCase();
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

// Normaliza y aplica hash como pide Meta: correo en minúsculas sin espacios; teléfono solo con dígitos.
// Meta solo acepta combinaciones de columnas definidas (EMAIL_SHA256, PHONE_SHA256, ...), no nombre suelto.
async function hashedRow(attendee, responses) {
  const email = String(attendee.email || responses?.email?.value || "").trim().toLowerCase();
  const phoneRaw =
    attendee.phoneNumber ||
    responses?.attendeePhoneNumber?.value ||
    responses?.phone?.value ||
    "";
  const phone = String(phoneRaw).replace(/\D/g, "");
  const h = (v) => (v ? sha256(v) : Promise.resolve(""));
  return Promise.all([h(email), h(phone)]);
}

async function graph(path, env, params, method = "POST") {
  const body = new URLSearchParams({ access_token: env.META_ACCESS_TOKEN, ...params });
  const res = await fetch(`${GRAPH}/${path}`, { method, body: method === "GET" ? undefined : body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Meta ${res.status}: ${JSON.stringify(json.error || json)}`);
  return json;
}

// Devuelve el id de la audiencia: el configurado, la que ya existe con ese nombre, o una nueva.
async function audienceId(env) {
  if (env.META_AUDIENCE_ID) return env.META_AUDIENCE_ID;
  const name = env.META_AUDIENCE_NAME || "Personas que agendaron";
  const account = "act_" + String(env.META_AD_ACCOUNT_ID).replace(/^act_/, "");

  const list = await fetch(
    `${GRAPH}/${account}/customaudiences?fields=id,name&limit=200&access_token=${encodeURIComponent(env.META_ACCESS_TOKEN)}`
  );
  const listJson = await list.json().catch(() => ({}));
  if (!list.ok) throw new Error(`Meta ${list.status}: ${JSON.stringify(listJson.error || listJson)}`);
  const found = (listJson.data || []).find((a) => a.name === name);
  if (found) return found.id;

  const created = await graph(`${account}/customaudiences`, env, {
    name,
    subtype: "CUSTOM",
    description: "Personas que agendaron una reunión o sesión en Cal.com",
    customer_file_source: "USER_PROVIDED_ONLY",
  });
  return created.id;
}

async function handleCalWebhook(request, env) {
  if (!env.CAL_WEBHOOK_SECRET || !env.META_AD_ACCOUNT_ID || !env.META_ACCESS_TOKEN) {
    return new Response("Webhook not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-cal-signature-256");
  if (!(await validSignature(rawBody, signature, env.CAL_WEBHOOK_SECRET))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  // La prueba de ping de Cal y cualquier otro disparador se aceptan sin hacer nada.
  if (event.triggerEvent !== "BOOKING_CREATED") {
    return new Response(JSON.stringify({ ok: true, ignored: event.triggerEvent || null }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = event.payload || {};
  const attendees = (payload.attendees || []).filter((a) => a && (a.email || a.name));
  if (!attendees.length) {
    return new Response(JSON.stringify({ ok: true, added: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  try {
    const rows = await Promise.all(attendees.map((a) => hashedRow(a, payload.responses)));
    const id = await audienceId(env);
    const result = await graph(`${id}/users`, env, {
      payload: JSON.stringify({ schema: ["EMAIL_SHA256", "PHONE_SHA256"], data: rows }),
    });
    return new Response(JSON.stringify({ ok: true, added: rows.length, audience_id: id, meta: result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cal-webhook: fallo al subir la audiencia a Meta:", String(e.message || e));
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Solo se reenvían campos conocidos de custom_data (value, currency, content_name).
function safeCustomData(cd) {
  if (!cd || typeof cd !== "object") return null;
  const out = {};
  if (typeof cd.value === "number" && isFinite(cd.value)) out.value = cd.value;
  if (typeof cd.currency === "string" && /^[A-Z]{3}$/.test(cd.currency)) out.currency = cd.currency;
  if (typeof cd.content_name === "string") out.content_name = cd.content_name.slice(0, 100);
  return Object.keys(out).length ? out : null;
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/cal-webhook") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
      return handleCalWebhook(request, env);
    }

    const allowedOrigin = env.ALLOWED_ORIGIN || "https://camoteweddings.com";

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
    }

    const {
      event_name,
      event_id,
      event_source_url,
      fbp,
      fbc,
      custom_data,
    } = payload || {};

    if (!event_name || !event_id) {
      return new Response("Missing event_name or event_id", { status: 400, headers: corsHeaders });
    }

    const clientIp = request.headers.get("CF-Connecting-IP") || "";
    const userAgent = request.headers.get("User-Agent") || "";

    const eventData = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id,
      event_source_url: event_source_url || "",
      action_source: "website",
      ...(safeCustomData(custom_data) ? { custom_data: safeCustomData(custom_data) } : {}),
      user_data: {
        client_ip_address: clientIp,
        client_user_agent: userAgent,
        ...(fbp ? { fbp } : {}),
        ...(fbc ? { fbc } : {}),
      },
    };

    const body = {
      data: [eventData],
      ...(env.TEST_EVENT_CODE ? { test_event_code: env.TEST_EVENT_CODE } : {}),
    };

    const metaUrl = `https://graph.facebook.com/v21.0/${env.PIXEL_ID}/events?access_token=${env.META_ACCESS_TOKEN}`;

    const metaResponse = await fetch(metaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const metaResult = await metaResponse.json();

    return new Response(JSON.stringify(metaResult), {
      status: metaResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
