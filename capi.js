// Envía el evento "Lead" tanto al Pixel del navegador como al Conversions API (server-side)
// vía el Worker de Cloudflare, usando el mismo event_id para que Meta los deduplique.
// CAPI_ENDPOINT se completa al desplegar el Worker (ver cloudflare-worker/worker.js).
var CAPI_ENDPOINT = "https://camote-capi-relay.victorhugo9719.workers.dev";

function getCookie(name) {
  var match = document.cookie.match("(?:^|; )" + name + "=([^;]*)");
  return match ? decodeURIComponent(match[1]) : null;
}

function trackLead() {
  var eventId = "lead_" + Date.now() + "_" + Math.random().toString(36).slice(2);

  if (window.fbq) {
    fbq("track", "Lead", {}, { eventID: eventId });
  }

  if (!CAPI_ENDPOINT) return;

  try {
    fetch(CAPI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_name: "Lead",
        event_id: eventId,
        event_source_url: location.href,
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
      }),
    }).catch(function () {});
  } catch (e) {}
}
