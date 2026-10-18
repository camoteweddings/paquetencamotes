// Texto del contrato. Se usa tanto en la pantalla como en el PDF.
// Basado en el "Contrato Privado" modelo de Camote Weddings / VICTORFRAME.
(function () {
  function monto(n, m) {
    var x = Number(n) || 0;
    var s = x.toLocaleString("es-BO", { maximumFractionDigits: 2 });
    return m + " " + s;
  }
  function fechaLarga(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    var meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return parseInt(p[2], 10) + " de " + meses[parseInt(p[1], 10) - 1] + " de " + p[0];
  }
  function hora12(h) {
    if (!h) return "";
    var p = h.split(":"), n = parseInt(p[0], 10);
    return (n % 12 || 12) + ":" + p[1] + " " + (n < 12 ? "a.m." : "p.m.");
  }

  // d = datos del contrato; firmaFecha = texto con la fecha de la firma
  function clausulas(d, firmaFecha) {
    var m = d.moneda;
    var out = [];
    out.push({
      t: "PRIMERA.- PARTES INTERVINIENTES",
      p: "Forman parte del presente documento: 1. El Equipo VICTORFRAME representado por el Señor Victor Hugo Villarroel Paredes con C.I. 6206639, mayor de edad, vecino de esta ciudad y hábil por derecho, con domicilio en Condominio Los Mangales casa 26, quien para el presente documento se denominará el prestador de los servicios. 2. " +
        d.cliente + " con C.I. " + d.ci + ", mayor de edad, vecino de esta ciudad y hábil por derecho, con teléfono " + d.tel +
        ". Para efectos del presente se denomina la persona contratante del Equipo VICTORFRAME."
    });
    out.push({
      t: "SEGUNDA.- OBJETO",
      p: "Se contratan los servicios del Equipo VICTORFRAME de acuerdo al siguiente detalle. SERVICIO DE: Fotografía - " + d.paquete +
        ". EVENTO: " + d.evento + ". FECHA: " + fechaLarga(d.fecha) + ". HORA: " + hora12(d.hora) + " LUGAR: " + d.lugar + "."
    });
    out.push({
      t: "TERCERA.- ENTREGA Y PAGO",
      p: "Se le entregarán todas las fotografías tomadas el día del evento sin editar en formato JPG; el fotógrafo no entrega los archivos crudos o en formato RAW ya que no representan el trabajo final del fotógrafo. El contratante elegirá las fotografías que sean de su agrado, según la cantidad que incluya el paquete contratado, para que le sean entregadas editadas en formato digital. El contratante se compromete a cancelar la suma de " +
        monto(d.total, m) + " por el total del servicio, de la siguiente manera: un anticipo de " + monto(d.anticipo, m) +
        " al momento de la firma del contrato y el saldo de " + monto(d.saldo, m) +
        " hasta la fecha del evento. Los pagos en bolivianos se realizan con depósito a la cuenta en Bs del Bisa 5944954017, a nombre de Victor Hugo Villarroel Paredes."
    });
    out.push({
      t: "CUARTA.- TRANSPORTE",
      p: "En caso que el evento sea fuera del área urbana de Santa Cruz, está a cargo del contratante proveer el transporte que se requiera para el desenvolvimiento del equipo y personal técnico, tanto de ida como de vuelta."
    });
    out.push({
      t: "QUINTA.- USO DE IMÁGENES",
      p: "El contratante otorga su consentimiento al Equipo VICTORFRAME para el uso de las imágenes obtenidas por medio del presente contrato, en alguna publicación, anuncio impreso, componente de correo directo, medios electrónicos (por ejemplo: video, CD-ROM, Internet/WWW), o cualquier otra forma de publicación o promoción interna o externa."
    });
    out.push({
      t: "SEXTA.- SUSPENSIÓN DEL EVENTO",
      p: "En caso de suspensión del evento por parte del contratante, éste se compromete de forma obligatoria a cubrir el 100% del contrato firmado, es decir que deberá cancelar el monto acordado por la totalidad del contrato a favor del Equipo VICTORFRAME, a reclamo posterior, como compensación de los daños y perjuicios ocasionados. En caso de que se presente un inconveniente con el Equipo VICTORFRAME se designará personal para continuar con la cobertura de su evento."
    });
    out.push({
      t: "SÉPTIMA.- PLAZO DE ENTREGA",
      p: "La entrega de trabajos es hasta de 1 semana o menos después de elegidas las fotos y se puede extender hasta 5 semanas por motivos de fuerza mayor. En caso de incumplimiento por parte del Equipo o empresa, existirá una penalización de un 1% sobre el monto total por cada semana de demora, previa negociación con los clientes."
    });
    out.push({
      t: "OCTAVA.- RESGUARDO DE ARCHIVOS",
      p: "Los archivos solo serán guardados por la empresa hasta 1 mes después de la entrega de los archivos; pasado ese tiempo VICTORFRAME no se responsabiliza por la pérdida completa o parcial de los archivos."
    });
    if (d.notas) {
      out.push({ t: "NOTAS ADICIONALES", p: d.notas });
    }
    out.push({
      t: "NOVENA.- CONFORMIDAD",
      p: "Expresando nuestra conformidad con el tenor íntegro del presente documento, lo suscribimos al pie en la ciudad de Santa Cruz de la Sierra el " + firmaFecha + "."
    });
    return out;
  }

  window.CW_CONTRATO = {
    titulo: "Contrato Privado de Prestación de Servicios",
    preambulo: "Conste por el presente contrato privado de prestación de servicios, que con el solo reconocimiento de firmas y rúbricas ante autoridad competente sufrirá los efectos de ley entre partes y eficacia de documento público, conforme el Art. 519 y el Art. 1297 del Código Civil, que se suscribe de acuerdo con el tenor de las siguientes cláusulas.",
    clausulas: clausulas,
    monto: monto,
    fechaLarga: fechaLarga,
    hora12: hora12
  };
})();
