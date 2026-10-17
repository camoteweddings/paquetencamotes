// Lógica compartida del contrato de Navidad (cliente y administrador).
window.Contrato = (function () {
  // URL del Worker "camote-contratos" (se obtiene al publicarlo con wrangler).
  var API = "https://camote-contratos.victorhugo9719.workers.dev";
  var STUDIO = "Camote Weddings";
  var LOGO_URL = "https://res.cloudinary.com/rauzqcoj/image/upload/f_auto,q_auto,w_400/LOGO_CAMOTE-06";
  var FIRMA_ESTUDIO = "/contrato-navidad/firma-victor.png";

  var PAQUETES = [
    { nombre: "Mini Sesión", precio: 250, incluye: "30 minutos de sesión + 8 fotos digitales editadas + galería en línea" },
    { nombre: "Sesión Extendida", precio: 500, incluye: "45 minutos de sesión + 15 fotos digitales editadas + 15 fotos impresas 10x15 + galería en línea" }
  ];

  var CLAUSULAS = [
    ["1. Objeto", "Camote Weddings (el «Estudio») prestará al cliente el servicio de sesión fotográfica de Navidad en estudio, según el paquete, fecha y hora indicados en este contrato."],
    ["2. Contenido del paquete", "El paquete contratado incluye lo descrito en el resumen anterior. Cualquier extra (impresiones adicionales, ampliaciones en MDF) se cotiza y acuerda por separado."],
    ["3. Precio y forma de pago", "El valor del paquete es el indicado. La fecha se aparta con el 70% del valor del paquete; el 30% restante se paga el día de la sesión."],
    ["4. Entrega", "El Estudio entregará las fotos digitales editadas mediante galería en línea y las fotos impresas (si el paquete las incluye) en una fecha coordinada a tiempo para la Navidad, según la fecha de la sesión."],
    ["5. Puntualidad", "La sesión se realiza en el horario reservado. El retraso del cliente reduce el tiempo de sesión sin extender el horario ni modificar el precio."],
    ["6. Reprogramación", "El cliente puede solicitar el cambio de fecha con anticipación, sujeto a disponibilidad de cupos del Estudio."],
    ["7. Uso de imágenes", "Las fotografías son obra del Estudio, que cede al cliente su uso personal. El cliente autoriza al Estudio a usar las imágenes con fines de portafolio y promoción, salvo que lo indique expresamente por escrito."],
    ["8. Aceptación", "Ambas partes aceptan este contrato con la firma del cliente. El presente documento se genera en formato digital y tiene validez como constancia de aceptación."]
  ];

  function bs(n) { return "Bs." + (Math.round(n * 100) / 100).toString().replace(/\.0+$/, ""); }
  function fmtFecha(v) { if (!v) return ""; var d = v.split("-"); return d[2] + "/" + d[1] + "/" + d[0]; }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function api(path, opt) {
    opt = opt || {};
    var h = { "Content-Type": "application/json" };
    if (opt.key) h.Authorization = "Bearer " + opt.key;
    return fetch(API + path, { method: opt.method || "GET", headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || "error"); e.status = r.status; throw e; } return d; }); });
  }
  function configurado() { return API.indexOf("REEMPLAZAR") === -1; }

  function cargarImg(src, cors, blanco) {
    return new Promise(function (res) {
      var im = new Image(); if (cors) im.crossOrigin = "anonymous";
      im.onload = function () {
        try {
          var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
          var x = c.getContext("2d"); x.drawImage(im, 0, 0);
          if (blanco) {
            var d = x.getImageData(0, 0, c.width, c.height), a = d.data;
            for (var i = 0; i < a.length; i += 4) { a[i] = 255; a[i + 1] = 255; a[i + 2] = 255; }
            x.putImageData(d, 0, 0);
          }
          res({ data: c.toDataURL("image/png"), w: c.width, h: c.height });
        } catch (e) { res(null); }
      };
      im.onerror = function () { res(null); };
      im.src = src;
    });
  }

  // Genera y descarga el PDF original (solo se usa en el panel del administrador).
  function generarPDF(c) {
    return Promise.all([
      cargarImg(FIRMA_ESTUDIO + "?v=" + Date.now(), false, false),
      cargarImg(LOGO_URL, true, true),
      cargarImg(c.firma, false, false)
    ]).then(function (r) {
      var firmaEst = r[0], logo = r[1], firmaCli = r[2];
      var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ unit: "mm", format: "a4" });
      var W = 210, M = 20, CW = W - 2 * M, y = 0;
      var anticipo = c.precio * 0.7, resto = c.precio * 0.3;
      var f = new Date(c.firmadoEn || Date.now());
      var fechaFirma = f.toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" });

      function need(h) { if (y + h > 280) { doc.addPage(); y = 22; } }
      function para(txt, size, style, gap) {
        doc.setFont("helvetica", style || "normal"); doc.setFontSize(size || 10.5);
        doc.splitTextToSize(txt, CW).forEach(function (l) { need(6); doc.text(l, M, y); y += (size || 10.5) * 0.46; });
        y += gap == null ? 2.5 : gap;
      }

      doc.setFillColor(27, 18, 12); doc.rect(0, 0, W, 26, "F");
      doc.setTextColor(250, 248, 243); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
      if (logo) { var lh = 14; doc.addImage(logo.data, "PNG", M, 6, lh * (logo.w / logo.h), lh); } else doc.text(STUDIO, M, 16);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("camoteweddings.com", W - M, 16, { align: "right" });
      doc.setTextColor(27, 18, 12);
      y = 40;
      doc.setFont("helvetica", "bold"); doc.setFontSize(15);
      doc.text("CONTRATO DE SESIÓN FOTOGRÁFICA DE NAVIDAD", M, y); y += 10;
      para("Entre " + STUDIO + " (el «Estudio») y el cliente identificado a continuación, se acuerda lo siguiente:", 10.5, "normal", 4);

      [["Cliente", c.nombre], ["CI", c.ci], ["Teléfono", c.tel], ["Correo", c.email],
       ["Paquete", c.paquete + " — " + bs(c.precio)], ["Incluye", c.incluye],
       ["Fecha y hora", fmtFecha(c.fecha) + " a las " + c.hora],
       ["Reserva (70%)", bs(anticipo)], ["Día de la sesión (30%)", bs(resto)]
      ].forEach(function (r) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
        var lines = doc.splitTextToSize(r[1], CW - 52);
        need(lines.length * 5 + 3);
        doc.text(r[0] + ":", M, y);
        doc.setFont("helvetica", "normal"); doc.text(lines, M + 52, y);
        y += lines.length * 5 + 1.5;
      });
      y += 4; doc.setDrawColor(201, 162, 75); doc.line(M, y, W - M, y); y += 8;

      CLAUSULAS.forEach(function (cl) { need(18); para(cl[0], 11, "bold", 1); para(cl[1], 10.5, "normal", 4); });

      need(70); y += 6;
      function put(img, x) {
        if (!img) return;
        var w = 70, h = w * (img.h / img.w);
        if (h > 32) { h = 32; w = h * (img.w / img.h); }
        doc.addImage(img.data, "PNG", x, y, w, h);
      }
      put(firmaCli, M); put(firmaEst, W - M - 75);
      var ly = y + 34;
      doc.setDrawColor(27, 18, 12); doc.line(M, ly, M + 75, ly); doc.line(W - M - 75, ly, W - M, ly);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(c.nombre, M, ly + 5); doc.text("Victor Villarroel", W - M - 75, ly + 5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("Cliente — CI " + c.ci, M, ly + 10);
      doc.text("Representante — " + STUDIO, W - M - 75, ly + 10);
      doc.setFontSize(8.5); doc.setTextColor(107, 112, 104);
      doc.text("Firmado digitalmente el " + fechaFirma + " a las " + f.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }) + (c.ip ? " · IP " + c.ip : ""), M, ly + 20);

      var slug = c.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      doc.save("contrato-navidad-" + (slug || "cliente") + ".pdf");
    });
  }

  return { PAQUETES: PAQUETES, CLAUSULAS: CLAUSULAS, bs: bs, fmtFecha: fmtFecha, esc: esc, api: api, configurado: configurado, generarPDF: generarPDF, STUDIO: STUDIO };
})();
