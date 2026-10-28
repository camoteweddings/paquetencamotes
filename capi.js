// Envía eventos de conversión tanto al Pixel del navegador como al Conversions API (server-side)
// vía el Worker de Cloudflare, usando el mismo event_id para que Meta los deduplique.
// CAPI_ENDPOINT se completa al desplegar el Worker (ver cloudflare-worker/worker.js).
//
// Mapa de eventos del embudo (cada evento significa lo que dice su nombre):
//   ViewContent      -> alguien vio la página (automático, una vez por página y sesión)
//   Contact          -> clic en WhatsApp (una vez por persona cada 30 días)
//   InitiateCheckout -> eligió un paquete y abrió el calendario (una vez por paquete y sesión)
//   Schedule         -> reserva completada en Cal.com (bookingSuccessful, una por reserva)
//   Purchase         -> SOLO cuando el cliente confirma su pago (botón "Ya pagué" en /early-christmas/gracias/)
//   Lead             -> disponible (trackLead) pero sin botones asignados
var CAPI_ENDPOINT = "https://camote-capi-relay.victorhugo9719.workers.dev";

function getCookie(name) {
  var match = document.cookie.match("(?:^|; )" + name + "=([^;]*)");
  return match ? decodeURIComponent(match[1]) : null;
}

function newEventId(prefix) {
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

// Envía un evento por Pixel + servidor con el mismo event_id.
function sendEvent(name, eventId, custom) {
  if (window.fbq) {
    fbq("track", name, custom || {}, { eventID: eventId });
  }

  if (!CAPI_ENDPOINT) return;

  try {
    fetch(CAPI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_name: name,
        event_id: eventId,
        event_source_url: location.href,
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
        custom_data: custom || undefined,
      }),
    }).catch(function () {});
  } catch (e) {}
}

// Un evento por cliente cada 30 días: se recuerda en localStorage y en memoria,
// así varios clics no generan eventos repetidos en Meta. Devuelve true si ya se había enviado.
var ONCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
var onceInMemory = {};

function alreadySentOnce(key) {
  if (onceInMemory[key]) return true;
  onceInMemory[key] = true;
  try {
    var t = parseInt(localStorage.getItem(key), 10);
    if (t && Date.now() - t < ONCE_TTL_MS) return true;
    localStorage.setItem(key, String(Date.now()));
  } catch (e) {}
  return false;
}

// Un evento por sesión del navegador para la clave dada. Devuelve true si ya se había enviado.
function alreadySentInSession(key) {
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, "1");
  } catch (e) {}
  return false;
}

// Clic en el botón de WhatsApp: evento estándar "Contact".
function trackContact() {
  if (alreadySentOnce("camote_contact_sent")) return;
  sendEvent("Contact", newEventId("contact"));
}

// Lead calificado (p. ej. confirmó datos o agendó y es un prospecto real). Sin botones asignados por ahora.
function trackLead() {
  if (alreadySentOnce("camote_lead_sent")) return;
  sendEvent("Lead", newEventId("lead"));
}

// Vio la página: "ViewContent", una vez por página y sesión.
function trackViewContent() {
  if (alreadySentInSession("camote_vc_" + location.pathname)) return;
  sendEvent("ViewContent", newEventId("viewcontent"), { content_name: document.title });
}

// Eligió un paquete y abrió el calendario de reserva: "InitiateCheckout" (compra iniciada, NO venta).
function trackInitiateCheckout(value, currency, name) {
  if (alreadySentInSession("camote_ic_" + (name || ""))) return;
  sendEvent("InitiateCheckout", newEventId("initiatecheckout"), {
    value: value,
    currency: currency || "BOB",
    content_name: name || "",
  });
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

  sendEvent("Schedule", eventId);
}

// Venta: llamar SOLO cuando el cliente confirma que el pago ya está hecho (botón "Ya pagué" de la thank-you page).
// Un Purchase por reserva: orderId (uid de la reserva) evita duplicados y comparte event_id con el servidor.
function trackPurchase(value, currency, name, orderId) {
  var key = "camote_purchase_" + (orderId || "any");
  if (alreadySentOnce(key)) return;
  sendEvent("Purchase", "purchase_" + (orderId || Date.now() + "_" + Math.random().toString(36).slice(2)), {
    value: value,
    currency: currency || "BOB",
    content_name: name || "",
  });
}

// Registra la visita automáticamente en cada página que cargue este script.
if (!window.CAMOTE_NO_VC) trackViewContent();
