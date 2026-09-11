// Cloudflare Worker: reenvía eventos de conversión a la Meta Conversions API (server-side).
// Se usa junto con capi.js (en la raíz del sitio), que llama a este Worker desde el navegador
// además de disparar el Pixel normal — así el mismo evento llega por dos caminos y Meta los
// deduplica automáticamente usando el mismo event_id.
//
// Variables de entorno necesarias (configurar en el dashboard de Cloudflare, no en este archivo):
//   PIXEL_ID            -> "1608878456861993" (el dataset/pixel de Camote Weddings)
//   META_ACCESS_TOKEN    -> token de acceso generado en Meta Events Manager (SECRETO, no lo pegues aquí)
//   ALLOWED_ORIGIN       -> "https://camoteweddings.com" (para restringir quién puede llamar al Worker)
//   TEST_EVENT_CODE      -> (opcional) código de prueba de Meta Events Manager, solo mientras se prueba

export default {
  async fetch(request, env) {
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
