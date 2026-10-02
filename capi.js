// Envía el evento "Lead" tanto al Pixel del navegador como al Conversions API (server-side)
// vía el Worker de Cloudflare, usando el mismo event_id para que Meta los deduplique.
// CAPI_ENDPOINT se completa al desplegar el Worker (ver cloudflare-worker/worker.js).
var CAPI_ENDPOINT = "https://camote-capi-relay.victorhugo9719.workers.dev";

function getCookie(name) {
  var match = document.cookie.match("(?:^|; )" + name + "=([^;]*)");
  return match ? decodeURIComponent(match[1]) : null;
}

// Un solo Lead por cliente: se recuerda en localStorage (30 días) y en memoria,
// así varios clics en "Reservar" no generan eventos repetidos en Meta.
var LEAD_TTL_MS = 30 * 24 * 60 * 60 * 1000;
var leadSent = false;

function leadAlreadySent() {
  if (leadSent) return true;
  try {
    var t = parseInt(localStorage.getItem("camote_lead_sent"), 10);
    if (t && Date.now() - t < LEAD_TTL_MS) return true;
  } catch (e) {}
  return false;
}

function markLeadSent() {
  leadSent = true;
  try { localStorage.setItem("camote_lead_sent", String(Date.now())); } catch (e) {}
}

function trackLead() {
  if (leadAlreadySent()) return;
  markLeadSent();

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

// Reserva completada (Cal.com bookingSuccessful): evento estándar "Schedule", uno por reserva.
// Se deduplica Pixel + servidor con el mismo event_id (uid de la reserva si existe).
function trackSchedule(uid) {
  var eventId = "schedule_" + (uid || Date.now() + "_" + Math.random().toString(36).slice(2));
  try {
    var done = (sessionStorage.getItem("camote_schedule_ids") || "").split(",");
    if (done.indexOf(eventId) !== -1) return;
    sessionStorage.setItem("camote_schedule_ids", done.concat(eventId).join(","));
  } catch (e) {}

  if (window.fbq) {
    fbq("track", "Schedule", {}, { eventID: eventId });
  }

  if (!CAPI_ENDPOINT) return;

  try {
    fetch(CAPI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_name: "Schedule",
        event_id: eventId,
        event_source_url: location.href,
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
      }),
    }).catch(function () {});
  } catch (e) {}
}
