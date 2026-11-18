import type { Article } from './blogData'

// ─────────────────────────────────────────────────────────────────
// Spanish (es) translations of blog content — Approach A: parallel map.
// Only translated slugs appear here; ArticleDetail falls back to the
// English ARTICLES map for anything not yet translated.
// Structure mirrors blogData.ts exactly (same slugs, same block order,
// same internal-link targets and CTA pages — only the text is translated).
// ─────────────────────────────────────────────────────────────────

export const ARTICLES_ES: Record<string, Article> = {
  "can-americans-buy": {
    "catKey": "Buying",
    "catLabel": "Guía del Comprador",
    "read": "14 min",
    "reads": "—",
    "date": "29 de junio de 2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "¿Pueden los estadounidenses comprar propiedades en la República Dominicana? (Guía 2026)",
    "lede": "Los estadounidenses generalmente pueden comprar inmuebles dominicanos sin ser residentes. Usa esta guía para organizar la revisión del título, un presupuesto escrito de cierre y las preguntas que debes resolver antes de comprometer fondos.",
    "metaTitle": "¿Pueden los estadounidenses comprar propiedades en la República Dominicana? (2026)",
    "metaDescription": "Los estadounidenses generalmente pueden comprar sin residencia. Organiza revisión independiente del título, documentos, cotizaciones de cierre y preguntas migratorias.",
    "keywords": [
      "pueden los estadounidenses comprar propiedad en república dominicana",
      "extranjeros comprando propiedad república dominicana",
      "comprar bienes raíces república dominicana",
      "propiedad república dominicana para extranjeros"
    ],
    "facts": [
      [
        "Propiedad",
        "Confirma título y uso permitido"
      ],
      [
        "Residencia",
        "Trámite migratorio separado"
      ],
      [
        "3%",
        "Tasa general de transferencia"
      ],
      [
        "Documentos",
        "Solicita la lista del trámite"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "La nacionalidad estadounidense generalmente no impide comprar un inmueble dominicano. El principio de trato nacional a la inversión extranjera no elimina las restricciones de título, zona costera o dominio público, medioambiente y uso del suelo de cada parcela. Un abogado independiente debe confirmar la estructura de adquisición y los derechos que realmente pueden transferirse."
      ],
      [
        "p",
        "Empieza por separar el precio anunciado, los derechos inscritos y el uso previsto. Un anuncio o una presentación comercial no demuestra titularidad, posibilidad de construcción, permiso de alquiler ni estado del edificio. Esta guía ofrece una secuencia para pedir pruebas antes de firmar o pagar."
      ],
      [
        "h",
        "¿De verdad tienen los estadounidenses los mismos derechos de propiedad?"
      ],
      [
        "p",
        "La Ley 16-95 establece el trato nacional para la inversión extranjera, sujeto a sus excepciones y a otras leyes aplicables. Pide al abogado que examine el título concreto, los derechos inscritos, el acceso, la zonificación y las restricciones costeras; la igualdad de trato no es permiso para comprar o construir en cualquier lugar."
      ],
      [
        "p",
        "Antes de enviar o repatriar dinero, consulta a los bancos de origen y destino qué identificación, pruebas del origen de fondos y documentos cambiarios o tributarios exigen. Solicita por escrito tasas de cambio y comisiones. El derecho a remesar fondos no elimina los controles bancarios ni los impuestos del caso."
      ],
      [
        "tip",
        "Compara la adquisición personal y mediante una sociedad con asesores legales y tributarios, según tus planes, sucesión y obligaciones de declaración. No constituyas una sociedad solo porque una presentación comercial diga que es obligatoria, ni supongas que la titularidad personal siempre será la opción más económica."
      ],
      [
        "h",
        "¿Necesitas residencia o visa para comprar?"
      ],
      [
        "p",
        "Comprar un inmueble y obtener autorización para vivir en el país son asuntos separados. La compra no prorroga una estancia de visitante ni otorga residencia. Si vas a mudarte, confirma los requisitos de visa y residencia aplicables antes de fijar una fecha."
      ],
      [
        "p",
        "La residencia y los incentivos fiscales requieren verificaciones independientes de elegibilidad y aprobación. Comprar no genera una exención general de los ingresos extranjeros. Consulta los requisitos oficiales para tu situación; [[contacta a nuestro equipo|contact]] sobre la búsqueda del inmueble y contrata asesores independientes para decisiones legales o tributarias."
      ],
      [
        "h",
        "El proceso de compra paso a paso"
      ],
      [
        "p",
        "La compra puede organizarse en las seis etapas siguientes. El plazo real depende del título, la mensura, el financiamiento, las autorizaciones y la inscripción. Solicita a los asesores responsables hitos, documentos y actualizaciones específicos de la operación antes de acordar una fecha de terminación."
      ],
      [
        "ol",
        [
          "Define tu objetivo y haz una lista corta. Decide si se trata de una vivienda de estilo de vida, una inversión de alquiler pura, o ambas — eso cambia qué región y tipo de propiedad encajan. Empieza a filtrar con nuestra [[búsqueda de propiedades|search]].",
          "Haz una oferta. Un abogado independiente debe revisar la reserva, quién custodiará el depósito, las condiciones de devolución y el vencimiento antes de firmar o pagar.",
          "Debida diligencia. Obtén información registral actualizada, verifica al vendedor y su facultad para firmar y revisa mensura, impuestos, permisos y restricciones aplicables.",
          "Promesa de venta. Documenta precio, condiciones, fechas, custodia del depósito, hitos de desembolso, consecuencias del incumplimiento y responsable de cada gasto. El porcentaje del depósito y su devolución deben acordarse, no presumirse.",
          "Reúne el saldo. Si usarás crédito, obtén condiciones escritas; de lo contrario, confirma transferencia, moneda, origen de fondos y condiciones de pago con el abogado.",
          "Cierre y transferencia. El Contrato de Venta final se firma ante un Notario, se paga el impuesto de transferencia y se inscribe el título en el Registro para que la propiedad quede a tu nombre."
        ]
      ],
      [
        "h",
        "¿Qué documentos necesitan los estadounidenses?"
      ],
      [
        "p",
        "Solicita al abogado y al registro la lista vigente para comprador, vendedor y estructura de titularidad. Entre los temas que conviene preparar figuran:"
      ],
      [
        "ul",
        [
          "Identificación vigente; a las personas extranjeras puede solicitárseles el pasaporte.",
          "Documentos matrimoniales, societarios, sucesorales o de representación que correspondan.",
          "Registro o identificación tributaria aplicable a la operación concreta.",
          "Pruebas bancarias del origen de fondos y traducciones, apostillas o legalizaciones necesarias."
        ]
      ],
      [
        "p",
        "Los requisitos varían según las partes y la operación. Resuelve los documentos de identidad o representación faltantes antes de aceptar una fecha de cierre incondicional."
      ],
      [
        "h",
        "¿Cuánto cuesta comprar?"
      ],
      [
        "p",
        "Prepara un presupuesto de cierre por partidas con la base imponible aplicable y cotizaciones profesionales escritas. Una regla porcentual no sustituye el cálculo tributario, los servicios, los gastos de inscripción ni una exención aprobada."
      ],
      [
        "table",
        {
          "headers": [
            "Gasto",
            "Cómo presupuestar",
            "Prueba"
          ],
          "rows": [
            [
              "Impuesto de transferencia",
              "Tasa general del 3%, salvo beneficio aprobado",
              "Cálculo de DGII y autorización de exención"
            ],
            [
              "Servicios jurídicos",
              "Cotización escrita",
              "Alcance, impuestos, gastos y condiciones de pago"
            ],
            [
              "Notaría e inscripción",
              "Estimación desglosada",
              "Tasas y servicios aplicables"
            ],
            [
              "IPI anual",
              "Cálculo recurrente separado",
              "Patrimonio gravado conjunto y exenciones aplicables"
            ]
          ]
        }
      ],
      [
        "p",
        "La [[guía de costos de cierre|article|closing-costs-dr]] muestra un cálculo ilustrativo, no una cotización para tu compra. Confirma todo beneficio de CONFOTUR para la unidad, la adquisición y el período aprobado restante antes de incluirlo en el presupuesto."
      ],
      [
        "cta",
        {
          "label": "Calcula tus costos totales en la calculadora de ROI",
          "page": "calculator"
        }
      ],
      [
        "h",
        "¿Pueden los estadounidenses obtener una hipoteca en la RD?"
      ],
      [
        "p",
        "Compara ofertas de crédito escritas en vez de suponer una tasa o proporción financiada para no residentes. Revisa elegibilidad, inicial, moneda, ajustes de tasa, comisiones, seguros, pago anticipado y tasación. Usar una vivienda en el extranjero como garantía también crea obligaciones en esa jurisdicción."
      ],
      [
        "tip",
        "Si necesitas financiamiento, refleja en el contrato la aprobación del banco y un calendario realista de fondos. Evalúa pagos y variaciones cambiarias antes de asumir una obligación incondicional."
      ],
      [
        "h",
        "¿Es seguro? Los riesgos reales (y cómo evitarlos)"
      ],
      [
        "p",
        "Una compra implica riesgos legales, físicos, financieros y de seguridad personal. Ninguna etiqueta del país, certificado ni anuncio los elimina todos. La debida diligencia independiente debe atender al inmueble y la operación concretos, incluidos estos asuntos:"
      ],
      [
        "ul",
        [
          "Revisa independencia, habilitación profesional, conflictos y alcance escrito del asesor.",
          "Acuerda custodia, desembolsos, devoluciones y controversias del depósito; no presupongas un servicio de custodia.",
          "Verifica título, permisos, obligaciones de entrega e historial del promotor en terreno o preventa.",
          "Compara la mensura inscrita con el terreno y el acceso legal."
        ]
      ],
      [
        "p",
        "Pregunta quién revisó cada documento, cuándo y qué quedó fuera del examen. La aprobación de un anuncio no es una opinión jurídica, inspección técnica ni garantía de inversión. Puedes [[ver propiedades|search]] y [[hablar con nuestro equipo|contact]] mientras organizas la verificación independiente."
      ],
      [
        "h",
        "Errores que conviene prevenir"
      ],
      [
        "ol",
        [
          "Suponer que el cierre funciona como en EE. UU. Confirma directamente las responsabilidades, la custodia de fondos y los seguros disponibles; no des por automático ningún servicio.",
          "Presupuestar de menos. Obtén cálculos tributarios y cotizaciones desglosadas en vez de depender solo de un porcentaje general de cierre.",
          "Confundir residencia con propiedad y sobrecargar una estructura corporativa que no necesitan.",
          "Comprar puramente por la emoción de las vacaciones. La villa que parece mágica en febrero igual tiene que tener sentido como activo durante todo el año."
        ]
      ],
      [
        "h",
        "En resumen"
      ],
      [
        "p",
        "Para un comprador estadounidense, la decisión debe basarse en derechos transferibles documentados, un presupuesto viable y un contrato claro. Verifica el inmueble de forma independiente, resuelve financiamiento y custodia antes de pagar y trata la planificación migratoria y fiscal por separado."
      ],
      [
        "cta",
        {
          "label": "Ver propiedades",
          "page": "search"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Puede un ciudadano estadounidense ser dueño pleno de una propiedad en la RD?",
        "a": "Los estadounidenses generalmente pueden adquirir inmuebles dominicanos, sujetos a la ley y a los derechos de la parcela concreta. Un abogado independiente debe verificar título, estructura de titularidad, acceso y restricciones de uso."
      },
      {
        "q": "¿Necesito ser residente para comprar una propiedad en la RD?",
        "a": "La propiedad y la autorización migratoria son independientes. Comprar no otorga residencia ni prorroga una estancia de visitante; confirma el estatus necesario para el tiempo que pretendes permanecer."
      },
      {
        "q": "¿Cuánto cuestan los costos de cierre para un comprador extranjero?",
        "a": "Usa el cálculo de transferencia de DGII, cotizaciones jurídicas, notariales y registrales desglosadas y cualquier beneficio aprobado para el caso. Un ejemplo ayuda a presupuestar, pero no acredita lo que debes pagar."
      },
      {
        "q": "¿Pueden los estadounidenses obtener una hipoteca en la República Dominicana?",
        "a": "Consulta a los bancos su elegibilidad vigente para no residentes y sus condiciones escritas. Compara moneda, inicial, tasación, cambios de tasa, comisiones, seguros y pago anticipado; la aprobación no está garantizada."
      },
      {
        "q": "¿Es seguro comprar propiedad en la RD?",
        "a": "Ningún proceso elimina todos los riesgos. Las revisiones jurídicas, de mensura y físicas independientes, la custodia y condiciones de desembolso claras y un plan de fondos documentado ayudan a evaluar el caso antes de comprometerte."
      }
    ]
  },
  "closing-costs-dr": {
    "catKey": "Buying",
    "catLabel": "Costos e Impuestos",
    "read": "11 min",
    "reads": "—",
    "date": "29 de junio de 2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "Costos de cierre en la República Dominicana, explicados a fondo (2026)",
    "lede": "Prepara un presupuesto escrito con impuesto de transferencia, servicios jurídicos, notaría e inscripción, un ejemplo claramente hipotético y gastos recurrentes separados.",
    "metaTitle": "Costos de cierre en República Dominicana (2026) — Desglose completo",
    "metaDescription": "Un desglose completo de los costos de cierre al comprar propiedad en la República Dominicana: el impuesto de transferencia del 3%, honorarios del abogado, notaría, impuesto IPI y un ejemplo práctico.",
    "keywords": [
      "costos de cierre república dominicana",
      "impuesto de transferencia república dominicana",
      "costo de comprar propiedad república dominicana",
      "impuesto ipi república dominicana"
    ],
    "facts": [
      [
        "3%",
        "Tasa general de transferencia"
      ],
      [
        "Cotiza",
        "Servicios jurídicos"
      ],
      [
        "Desglosa",
        "Notaría y registro"
      ],
      [
        "Separa",
        "Gastos anuales de propiedad"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "El precio anunciado es solo una parte del presupuesto. Obtén la liquidación tributaria aplicable, cotizaciones profesionales y los hitos de pago antes de comprometerte. Esta guía separa gastos de adquisición y de propiedad recurrente y muestra cálculos sin presentarlos como un tarifario del mercado."
      ],
      [
        "h",
        "El impuesto de transferencia del 3% (Impuesto de Transferencia)"
      ],
      [
        "p",
        "DGII publica una tasa general del 3% para la transferencia inmobiliaria. Solicita el cálculo de tu operación, incluida la base imponible y cualquier beneficio autorizado. No multipliques sin más el precio anunciado si no es el valor aceptado para el impuesto."
      ],
      [
        "p",
        "El contrato debe distribuir el impuesto y los demás gastos entre las partes. Confirma con el abogado los plazos legales de pago e inscripción; una fecha de cierre negociada no sustituye un vencimiento oficial."
      ],
      [
        "h",
        "Honorarios jurídicos: compara alcance y cotizaciones"
      ],
      [
        "p",
        "Solicita una cotización jurídica escrita que defina trabajo, exclusiones, impuestos y desembolsos. No presupongas que incluye custodia, seguros, inspecciones técnicas o todos los trámites registrales. Pregunta quién realizará y documentará estas tareas:"
      ],
      [
        "ul",
        [
          "Realizar una búsqueda de título completa en el Registro Inmobiliario para confirmar la propiedad limpia y sin gravámenes.",
          "Verificar los límites, que los impuestos estén al día y que no haya cargas.",
          "Redactar o revisar la Promesa de Venta y el Contrato de Venta final.",
          "Acordar la custodia y el desembolso de fondos, coordinar el cierre y confirmar quién presenta y da seguimiento a la inscripción."
        ]
      ],
      [
        "tip",
        "Compara habilitación, independencia, alcance, comunicación y cotización escrita. Pregunta qué revisiones de título, mensura, contrato e inscripción se incluyen y cuáles requieren otro especialista. Una tarifa baja por sí sola no demuestra calidad ni revisión completa."
      ],
      [
        "h",
        "Costos de notaría y registro"
      ],
      [
        "p",
        "Consulta a la notaría y al registro los servicios y tasas aplicables al acto y al inmueble. Separa impuestos, cargos oficiales y honorarios, incluidas traducciones, poderes y documentos específicos del caso."
      ],
      [
        "h",
        "Costos anuales que debes prever"
      ],
      [
        "p",
        "Los costos de cierre son únicos, pero dos costos recurrentes importan para tu presupuesto:"
      ],
      [
        "ul",
        [
          "IPI: obtén la liquidación del patrimonio inmobiliario gravado conjunto del propietario y las exenciones aplicables. El precio anunciado de una vivienda no determina por sí solo el IPI anual; consulta la guía tributaria sobre la base vigente para personas físicas.",
          "Cuotas de HOA / condominio: si compras en una comunidad cerrada o un edificio de condominios, las cuotas mensuales de mantenimiento financian seguridad, jardinería, piscinas y amenidades. Varían mucho — confirma la cifra exacta antes de comprometerte, sobre todo para un análisis de inversión de alquiler."
        ]
      ],
      [
        "h",
        "CONFOTUR: confirma el beneficio aplicable"
      ],
      [
        "p",
        "Una adquisición que cumpla los requisitos en un proyecto turístico aprobado puede recibir beneficios fiscales específicos. Obtén la clasificación definitiva y la autorización tributaria del caso; no presupuestes una exención solo porque un folleto diga CONFOTUR."
      ],
      [
        "p",
        "Comprueba que los documentos cubran la unidad, el adquiriente, la operación y el período aplicable. No presupongas beneficios en una reventa ni que una compra posterior reinicie el plazo del proyecto. Conserva la revisión profesional con los documentos del cierre."
      ],
      [
        "h",
        "Un ejemplo práctico"
      ],
      [
        "p",
        "Solo para ilustrar, se supone una compra y base imponible de US$250,000, honorarios cotizados equivalentes al 1.25% y gastos notariales/registrales supuestos del 0.5%. Son datos elegidos para el cálculo, no promedios actuales ni una cotización:"
      ],
      [
        "table",
        {
          "headers": [
            "Partida",
            "Tasa supuesta",
            "Importe ilustrativo (USD)"
          ],
          "rows": [
            [
              "Precio de compra",
              "—",
              "$250,000"
            ],
            [
              "Impuesto de transferencia",
              "3%",
              "$7,500"
            ],
            [
              "Cotización jurídica supuesta",
              "1.25%",
              "$3,125"
            ],
            [
              "Notaría/registro supuestos",
              "0.5%",
              "$1,250"
            ],
            [
              "Total de gastos únicos supuestos",
              "4.75%",
              "$11,875"
            ],
            [
              "Efectivo de adquisición ilustrativo",
              "—",
              "$261,875"
            ]
          ]
        }
      ],
      [
        "p",
        "Si se aprobara una exención de transferencia para el caso, elimina solo esa partida aplicable del ejemplo. No elimines gastos jurídicos, registrales, financieros o anuales sin pruebas separadas de que estén cubiertos."
      ],
      [
        "cta",
        {
          "label": "Modela tus números exactos en la calculadora de ROI",
          "page": "calculator"
        }
      ],
      [
        "h",
        "¿Quién paga qué?"
      ],
      [
        "p",
        "Registra en el contrato la distribución acordada. Pide al abogado que identifique las obligaciones legales de cada parte y los honorarios negociables; una costumbre no sustituye las condiciones firmadas."
      ],
      [
        "h",
        "En resumen"
      ],
      [
        "p",
        "Reúne cálculo tributario, cotizaciones desglosadas, plan de fondos y beneficios escritos antes de comparar precios totales. Separa IPI recurrente, comunidad, seguros, reparaciones y financiamiento para no ocultar gastos de propiedad dentro del presupuesto de compra."
      ],
      [
        "cta",
        {
          "label": "Ve cómo encaja en el proceso completo de compra",
          "page": "article",
          "slug": "can-americans-buy"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Cuáles son los costos de cierre totales al comprar propiedad en la República Dominicana?",
        "a": "No hay un total único para todas las compras. Usa la base tributaria real y cotizaciones escritas; el 4.75% de esta guía es un ejemplo hipotético, no un promedio actual del mercado."
      },
      {
        "q": "¿Quién paga el impuesto de transferencia en la RD?",
        "a": "La tasa general de transferencia es del 3%. Confirma la base tasada, beneficios, plazo legal y distribución entre las partes para la operación concreta."
      },
      {
        "q": "¿Qué es el impuesto IPI?",
        "a": "El IPI es recurrente y distinto del impuesto de transferencia. Su cálculo general para personas físicas usa el patrimonio inmobiliario gravado conjunto y las exenciones aplicables, no una nueva exención por vivienda."
      },
      {
        "q": "¿Se pueden reducir los costos de cierre?",
        "a": "Incluye únicamente beneficios aprobados para la adquisición concreta. Compara cotizaciones desglosadas sin eliminar la debida diligencia ni suponer que una reventa hereda la exención de otro adquiriente."
      }
    ]
  },
  "punta-cana-airbnb-roi": {
    "catKey": "Investing",
    "catLabel": "Inteligencia de Inversión",
    "read": "13 min",
    "reads": "—",
    "date": "29 de junio de 2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "Inversión de alquiler en Punta Cana: modelo práctico de ROI (2026)",
    "lede": "Construye un modelo de alquiler por inmueble con ingresos documentados, noches disponibles y gastos desglosados. Separa resultados medidos y supuestos y evalúa qué pasa si bajan las reservas.",
    "metaTitle": "ROI de alquiler en Punta Cana: costos, flujo y escenarios",
    "metaDescription": "Cómo modelar un alquiler en Punta Cana: verificar ocupación y tarifa, separar ingresos y flujo neto, presupuestar gastos y comparar escenarios adversos.",
    "keywords": [
      "inversión airbnb punta cana",
      "roi bienes raíces república dominicana",
      "rendimiento de alquiler punta cana",
      "mejor inversión airbnb república dominicana"
    ],
    "facts": [
      [
        "Pruebas",
        "Registros fechados del inmueble"
      ],
      [
        "Ingresos",
        "Noches ocupadas × tarifa"
      ],
      [
        "Gastos",
        "Presupuesto operativo desglosado"
      ],
      [
        "Escenarios",
        "Evalúa menos reservas"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "Un anuncio atractivo es un punto de partida, no prueba de rendimiento. Basa la decisión en el uso de alquiler permitido, reservas documentadas, estado operativo y costo total de adquisición. Esta guía no afirma un rendimiento promedio del mercado."
      ],
      [
        "h",
        "¿Cuánto genera realmente un alquiler en Punta Cana?"
      ],
      [
        "p",
        "Solicita registros mensuales de noches disponibles, ocupadas, tarifas cobradas, devoluciones, comisiones y estancias del propietario. Un bloqueo del calendario no siempre es una reserva ni una tarifa anunciada es ingreso cobrado. Si no hay registros, identifica el modelo como proyección y documenta cada supuesto."
      ],
      [
        "p",
        "Calcula por separado ingresos brutos, resultado operativo, financiamiento e impuestos. Indica si el rendimiento usa precio de compra, costo total o efectivo invertido: cada denominador produce una medida distinta. No llames ingresos conciliados a un total manual de reservas."
      ],
      [
        "tip",
        "Pide los documentos que respaldan cualquier ocupación o rentabilidad prometida. Compara inmuebles equivalentes y años completos, separa el uso del propietario y prueba menor ocupación y mayores gastos antes de decidir."
      ],
      [
        "h",
        "Evalúa el valor del acceso a la playa"
      ],
      [
        "p",
        "Mide la ruta peatonal real, el acceso público y los servicios. Compara reservas fechadas de unidades equivalentes antes de asignar una prima a la primera línea o cercanía a la playa. Presupuesta también seguros, mantenimiento y restricciones: estar cerca del mar no garantiza ocupación."
      ],
      [
        "h",
        "Dónde comprar para un buen desempeño de alquiler"
      ],
      [
        "p",
        "Compara comunidades con la misma lista de pruebas, en vez de ordenarlas por una rentabilidad no respaldada:"
      ],
      [
        "ul",
        [
          "Cap Cana: revisa la unidad, cuotas, reglas de alquiler, acceso a servicios y cotización operativa.",
          "Bávaro: verifica ubicación precisa, acceso de huéspedes, competencia y resultados documentados.",
          "Uvero Alto: comprueba transporte, servicios, obras y el uso de alquiler permitido."
        ]
      ],
      [
        "p",
        "Usa el mismo modelo en otras zonas, incluidas Las Terrenas y Cabarete, sin presumir precios ni demanda mayores o menores. Empieza en la [[búsqueda de propiedades|search]] y reúne pruebas de las unidades seleccionadas."
      ],
      [
        "h",
        "La ventaja fiscal de CONFOTUR para inversores"
      ],
      [
        "p",
        "Modela beneficios de CONFOTUR solo tras recibir documentos y autorización tributaria aplicables a unidad y operación. Conserva un escenario con impuestos ordinarios junto al de beneficio confirmado; consulta la [[guía de cierre y CONFOTUR|article|closing-costs-dr]]. Un beneficio no demuestra demanda ni rentabilidad neta."
      ],
      [
        "h",
        "Los costos que no aparecen en el folleto"
      ],
      [
        "p",
        "Los ingresos brutos por alquiler no son lo que te quedas. Un análisis realista de Punta Cana tiene que restar:"
      ],
      [
        "ul",
        [
          "Administración: solicita honorarios escritos con servicios incluidos, mínimos, impuestos y cargos separados.",
          "Cuotas de HOA / comunidad: las comunidades cerradas de resort cobran cuotas mensuales por seguridad y amenidades — confirma el número exacto, ya que varía mucho e impacta directamente el rendimiento neto.",
          "Amueblado y puesta a punto: un paquete de amueblado listo para alquilar es un costo inicial real que afecta tanto tu tarifa por noche como tu retorno del primer año.",
          "Servicios, internet, mantenimiento de piscina y jardín, y una reserva para vacancia/mantenimiento.",
          "Comisiones de plataformas y pagos, devoluciones y variación estacional; anualiza el modelo sin extender una semana de alta demanda a todos los meses."
        ]
      ],
      [
        "h",
        "Un modelo de escenarios transparente"
      ],
      [
        "p",
        "La tabla ofrece reglas de cálculo, no referencias de mercado. Introduce pruebas del inmueble y documenta los supuestos modificados del escenario adverso:"
      ],
      [
        "table",
        {
          "headers": [
            "Dato o medida",
            "Caso base documentado",
            "Prueba adversa"
          ],
          "rows": [
            [
              "Ocupación",
              "Noches ocupadas ÷ noches realmente disponibles",
              "Menos reservas o más cierres"
            ],
            [
              "Tarifa diaria media",
              "Ingreso de alquiler cobrado ÷ noches ocupadas",
              "Menor tarifa cobrada y más devoluciones"
            ],
            [
              "Administración",
              "Honorarios escritos y cargos separados",
              "Mayor costo o menos servicios incluidos"
            ],
            [
              "Rendimiento neto",
              "Declara gastos y denominador",
              "Recalcula tras vacancia y reserva de reparaciones"
            ],
            [
              "Apreciación",
              "Sepárala del ingreso operativo",
              "No dependas de ella para pagar gastos"
            ]
          ]
        }
      ],
      [
        "p",
        "Compara escenarios con el mismo período y moneda. Muestra los datos faltantes en vez de inventar ocupación o gastos. La calculadora de ROI ayuda a explorar supuestos elegidos; el resultado sigue siendo un modelo, no prueba de que el inmueble haya generado esos importes."
      ],
      [
        "cta",
        {
          "label": "Calcula tus propios números en la calculadora de ROI",
          "page": "calculator"
        }
      ],
      [
        "h",
        "Errores que cometen los inversores en Punta Cana"
      ],
      [
        "ol",
        [
          "Tratar una rentabilidad cotizada como resultado verificado sin registros.",
          "Excluir administración, comisiones o facturas pagadas por el propietario.",
          "Suponer que la cercanía a la playa garantiza tarifas u ocupación mayores.",
          "Presupuestar beneficios fiscales sin revisar aprobación y plazo concretos.",
          "Usar ingresos de una semana de alta demanda para pronosticar todo el año."
        ]
      ],
      [
        "h",
        "¿Es un Airbnb en Punta Cana una buena inversión en 2026?"
      ],
      [
        "p",
        "Un inmueble puede encajar si su uso documentado, costo de adquisición y flujo adverso realista se ajustan a tu presupuesto y tolerancia al riesgo. Resuelve los registros faltantes y obtén asesoría legal y tributaria independiente antes de depender del modelo."
      ],
      [
        "cta",
        {
          "label": "Explora propiedades de inversión",
          "page": "search"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Qué ROI puedo esperar de un Airbnb en Punta Cana?",
        "a": "Aquí no se proporciona un ROI promedio de mercado verificado. Calcula el inmueble concreto con ingresos, gastos, financiamiento e impuestos documentados e indica período y base de capital."
      },
      {
        "q": "¿Cuál es la ocupación y la tarifa por noche promedio en Punta Cana?",
        "a": "Solicita reservas y cobros fechados del inmueble. Distingue noches ocupadas y bloqueadas, y tarifas cobradas y anunciadas. Sin esos registros, usa supuestos identificados, no un supuesto promedio actual."
      },
      {
        "q": "¿Cuánto cuesta la gestión de propiedades?",
        "a": "Obtén una cotización escrita con alcance, impuestos, mínimos y servicios facturados aparte. Compara el costo anual total, no solo el porcentaje anunciado."
      },
      {
        "q": "¿Ayuda CONFOTUR a los inversores de alquiler a corto plazo?",
        "a": "Una adquisición concreta puede recibir beneficios específicos mediante las aprobaciones correspondientes. Confirma unidad, operación y plazo restante; la etiqueta del proyecto no demuestra exención de renta ni mayor demanda."
      }
    ]
  },
  "can-canadians-buy": {
    "catKey": "Buying",
    "catLabel": "Guía del Comprador",
    "read": "12 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "¿Pueden los canadienses comprar propiedades en la República Dominicana? (Guía 2026)",
    "lede": "Un comprador canadiense debe planificar dos revisiones conectadas: la operación inmobiliaria dominicana y las obligaciones fiscales y de declaración canadienses. Estos son los documentos y preguntas que conviene organizar antes de comprometer fondos.",
    "metaTitle": "¿Pueden los canadienses comprar propiedades en la República Dominicana? (Guía 2026)",
    "metaDescription": "Los canadienses generalmente pueden adquirir inmuebles dominicanos. Revisa título, restricciones, cierre y obligaciones tributarias y de bienes extranjeros de residentes de Canadá.",
    "keywords": [
      "pueden los canadienses comprar propiedad en república dominicana",
      "canadiense comprando bienes raíces república dominicana",
      "propiedad república dominicana impuestos canadienses",
      "propiedad república dominicana canadienses que pasan el invierno"
    ],
    "facts": [
      [
        "Compra",
        "Verifica derechos transferibles"
      ],
      [
        "Residencia",
        "Separada de la propiedad"
      ],
      [
        "1977",
        "Entrada en vigor del convenio"
      ],
      [
        "CRA",
        "Revisa declaraciones del residente"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "Los canadienses generalmente pueden adquirir inmuebles dominicanos dentro del marco de trato nacional. Confirma con un abogado independiente el título, la estructura y las restricciones; la nacionalidad por sí sola no determina qué puede construirse, alquilarse o transferirse."
      ],
      [
        "p",
        "La revisión del inmueble y la revisión fiscal canadiense responden preguntas distintas. Confirma tu residencia fiscal en Canadá en vez de suponer que la ciudadanía determina por sí sola las obligaciones, y explica al contador el uso personal y de alquiler previsto."
      ],
      [
        "h",
        "Los mismos derechos que todos los demás"
      ],
      [
        "p",
        "La Ley 16-95 dispone el trato nacional sujeto a excepciones y leyes especiales. Confirma las restricciones de la parcela, el derecho adquirido y los requisitos bancarios y tributarios para mover fondos; no interpretes ese marco como propiedad sin restricciones o repatriación libre de impuestos en todos los casos."
      ],
      [
        "h",
        "¿Necesitan los canadienses residencia o visa para comprar?"
      ],
      [
        "p",
        "La propiedad no otorga autorización migratoria ni prorroga la estancia de un visitante. Planifica por separado el tiempo que vivirás en el país y usa la [[guía de compra paso a paso|article|can-americans-buy]] para organizar las preguntas de la operación."
      ],
      [
        "h",
        "Cuánto cuesta del lado dominicano"
      ],
      [
        "p",
        "Obtén un cálculo escrito del impuesto de transferencia, cotizaciones jurídicas, notariales y registrales y un presupuesto anual separado. No dependas de un porcentaje total sin respaldo. Consulta el [[ejemplo de cierre|article|closing-costs-dr]] y la [[guía de IPI|article|property-taxes-ipi]] para los cálculos independientes."
      ],
      [
        "tip",
        "La etiqueta CONFOTUR no demuestra que tu adquisición esté exenta. Solicita la resolución definitiva y la autorización tributaria de la unidad y operación concretas. Revisa el período restante y las reglas de reventa: una compra posterior no inicia automáticamente otros 15 años."
      ],
      [
        "h",
        "Declaraciones canadienses: importan la residencia y el uso"
      ],
      [
        "p",
        "Los residentes fiscales canadienses generalmente declaran sus ingresos mundiales. Consulta a un contador cómo el uso real afecta la declaración de ingresos, los bienes extranjeros y un posible crédito:"
      ],
      [
        "ul",
        [
          "Ingresos de alquiler: declara la renta extranjera según las reglas canadienses aplicables. El formulario T776 se usa para alquileres inmobiliarios; los servicios adicionales pueden influir en su tratamiento como actividad empresarial.",
          "Declaración de bienes en el extranjero (T1135): los contribuyentes residentes de Canadá generalmente deben declarar cuando el costo total de sus bienes extranjeros especificados supera CAD $100,000 en algún momento del año. Los bienes destinados principalmente al uso personal pueden quedar excluidos, incluidos algunos alquileres limitados que solo recuperan gastos. El uso mixto depende de los hechos; declarar los ingresos es una obligación distinta.",
          "Crédito fiscal por impuestos pagados en el extranjero (T2209): los residentes de Canadá pueden tener derecho a un crédito por impuestos dominicanos sobre la renta admisibles respecto de ingresos declarados en Canadá, sujeto a los límites canadienses y a sus circunstancias. El convenio fiscal Canadá–RD se firmó el 6 de agosto de 1976 y entró en vigor el 23 de septiembre de 1977; no garantiza que todo impuesto pagado sea íntegramente acreditable."
        ]
      ],
      [
        "tip",
        "Organiza la revisión tributaria internacional antes de comprometerte. Facilita residencia fiscal, uso personal y de alquiler, costo y fondos; confirma por escrito declaraciones y créditos aplicables."
      ],
      [
        "h",
        "Financiamiento: efectivo o hipoteca"
      ],
      [
        "p",
        "Obtén ofertas de crédito escritas y compáralas con el efectivo disponible. Revisa elegibilidad, moneda, tasas, comisiones, pagos y consecuencias de usar un inmueble canadiense como garantía. Esta guía no afirma tasas actuales, probabilidades de aprobación ni porcentajes financiados típicos."
      ],
      [
        "h",
        "Errores que cometen los compradores canadienses"
      ],
      [
        "ol",
        [
          "Ignorar el lado canadiense. La compra en la RD puede estar en regla y aun así generar una obligación de presentar T1135/T776 en tu país — planifícala antes de comprar.",
          "Suponer que el uso personal y el alquiler tributan igual. El uso mixto personal y de alquiler debe evaluarse según los hechos; no deduzcas el resultado del T1135 solo de un anuncio en Airbnb.",
          "Omitir la revisión jurídica independiente o suponer que un seguro o servicio de custodia es automático. Acuerda quién verificará título, manejará fondos y confirmará inscripción.",
          "Presupuestar beneficios de CONFOTUR sin los documentos y la autorización de la operación concreta."
        ]
      ],
      [
        "h",
        "En resumen para los canadienses"
      ],
      [
        "p",
        "Reúne las pruebas del inmueble, el presupuesto dominicano y el plan de declaraciones canadienses antes de decidir. Revisa uso mixto y supuestos cambiarios con asesores y no permitas que una rentabilidad o ventaja anunciada sustituya sus documentos."
      ],
      [
        "cta",
        {
          "label": "Ver propiedades",
          "page": "search"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Puede un canadiense ser dueño pleno de una propiedad en la República Dominicana?",
        "a": "Los canadienses generalmente pueden adquirir inmuebles dominicanos. Aun así, deben verificarse de forma independiente título, estructura y restricciones de parcela o uso."
      },
      {
        "q": "¿Pagan los canadienses un impuesto para compradores extranjeros en la RD?",
        "a": "Pide al abogado el cálculo aplicable al adquiriente y la operación, en vez de suponer que la nacionalidad determina el total. Confirma el impuesto ordinario y cualquier exención aprobada para el caso."
      },
      {
        "q": "¿Tengo que declarar mi propiedad en la RD ante la CRA?",
        "a": "Declarar los ingresos por alquiler y los bienes extranjeros son obligaciones distintas. El T1135 generalmente corresponde cuando el costo total de los bienes extranjeros especificados de un contribuyente residente de Canadá supera CAD $100,000 en algún momento del año, salvo que aplique una exclusión. Los bienes destinados principalmente al uso personal pueden quedar excluidos; los alquileres de uso mixto requieren evaluar los hechos. Un contador especializado debe confirmar tus obligaciones de ingresos y T1135."
      },
      {
        "q": "¿Me cobrarán impuestos dos veces sobre los ingresos por alquiler?",
        "a": "El convenio fiscal entre Canadá y la República Dominicana, firmado en 1976 y vigente desde el 23 de septiembre de 1977, establece reglas para tratar la doble imposición. Los residentes de Canadá pueden tener derecho a un crédito mediante el formulario T2209, pero la elegibilidad y el monto dependen de los ingresos, los impuestos admisibles pagados y los límites canadienses. Confirma el tratamiento con un contador especializado."
      },
      {
        "q": "¿Es la RD una buena opción para los canadienses que pasan el invierno fuera de su país?",
        "a": "Compara duración de estancia, estatus migratorio, atención médica y seguros, presupuesto estacional y reglas de alquiler. La idoneidad depende de esos requisitos; los incentivos anunciados no la demuestran."
      }
    ]
  },
  "property-taxes-ipi": {
    "catKey": "Legal",
    "catLabel": "Legal e Impuestos",
    "read": "11 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "Impuestos sobre la propiedad e IPI en la República Dominicana, explicados a fondo (2026)",
    "lede": "Entiende la base general del IPI para personas físicas en 2026, la exención anual, fechas de pago y un cálculo en pesos. Separa el impuesto de transferencia y cualquier beneficio aprobado para el caso.",
    "metaTitle": "Impuesto sobre la propiedad (IPI) en la República Dominicana — Guía 2026",
    "metaDescription": "Una guía clara de 2026 sobre los impuestos sobre la propiedad en la República Dominicana: el IPI anual del 1%, el umbral de exención de RD$10.7M, fechas de pago, exenciones CONFOTUR y un ejemplo práctico.",
    "keywords": [
      "impuesto sobre la propiedad república dominicana",
      "impuesto IPI república dominicana",
      "exención impuesto sobre la propiedad república dominicana 2026",
      "cuánto es el impuesto sobre la propiedad en república dominicana"
    ],
    "facts": [
      [
        "1%",
        "Tasa anual del IPI"
      ],
      [
        "RD$10,695,494",
        "Exención individual de 2026"
      ],
      [
        "11 mar / 11 sep",
        "Dos fechas de pago"
      ],
      [
        "Hasta 15 años",
        "Plazo CONFOTUR por verificar"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "El IPI anual (Impuesto al Patrimonio Inmobiliario) generalmente aplica a las personas físicas un 1% sobre el valor conjunto tasado por la DGII de sus inmuebles sujetos al impuesto que supera una exención anual. La exención se aplica al conjunto de bienes del propietario, no por separado a cada vivienda. Los fideicomisos y los inmuebles de empresas siguen reglas distintas. Aquí se explica el cálculo para personas físicas en 2026."
      ],
      [
        "h",
        "Cómo funciona el IPI"
      ],
      [
        "p",
        "Para las personas físicas, el IPI se calcula al 1% sobre la parte del valor conjunto tasado por la DGII de sus inmuebles sujetos al impuesto que supera la exención anual. Solo tributa el excedente. La DGII ajusta el umbral anualmente; no es una exención separada para cada propiedad."
      ],
      [
        "p",
        "Para 2026, la DGII publica una exención de RD$10,695,494 para las personas físicas. Si el valor conjunto de los inmuebles del propietario sujetos al impuesto no supera ese monto, no corresponde IPI sobre esos bienes. Que una sola vivienda esté por debajo del umbral no demuestra por sí mismo que el propietario no deba IPI. El monto legal está en pesos dominicanos; confirma el año y la tasación aplicables con la DGII."
      ],
      [
        "tip",
        "Obtén la tasación de DGII y la lista completa de inmuebles gravados del propietario. No supongas que la tasación es inferior al precio anunciado ni que una propiedad de menor precio demuestra que no se deba IPI."
      ],
      [
        "h",
        "Un ejemplo práctico"
      ],
      [
        "p",
        "Este ejemplo utiliza todo el patrimonio inmobiliario sujeto al impuesto del propietario, a valores tasados por la DGII, la exención de 2026 de RD$10,695,494 y ninguna exención adicional. Todos los montos están en pesos dominicanos; no son tasaciones de precios de compra ni liquidaciones tributarias individuales:"
      ],
      [
        "table",
        {
          "headers": [
            "Valor conjunto gravado tasado por la DGII (DOP)",
            "Excedente de RD$10,695,494 (DOP)",
            "IPI anual al 1% (DOP)"
          ],
          "rows": [
            [
              "RD$9,000,000",
              "RD$0",
              "RD$0"
            ],
            [
              "RD$15,000,000",
              "RD$4,304,506",
              "RD$43,045.06"
            ],
            [
              "RD$25,000,000",
              "RD$14,304,506",
              "RD$143,045.06"
            ],
            [
              "RD$45,000,000",
              "RD$34,304,506",
              "RD$343,045.06"
            ]
          ]
        }
      ],
      [
        "p",
        "Son ejemplos aritméticos para los bienes conjuntos indicados. El IPI real depende de las tasaciones de la DGII, de todo el patrimonio inmobiliario sujeto al impuesto del propietario y de las exenciones aplicables. No apliques la exención por separado a cada vivienda ni la conviertas en un umbral fijo en dólares estadounidenses."
      ],
      [
        "h",
        "Cuándo y cómo pagas"
      ],
      [
        "p",
        "El IPI se paga anualmente, normalmente dividido en dos cuotas iguales con vencimiento a más tardar el 11 de marzo y el 11 de septiembre. Puedes pagar en la DGII o en línea, y el atraso genera recargos e intereses — así que conviene poner un recordatorio en el calendario o encargarlo a un administrador de propiedades. El impuesto se calcula por cada propietario individual sobre el total de sus bienes inmuebles sujetos al impuesto, no estrictamente por propiedad."
      ],
      [
        "h",
        "El impuesto único de transferencia (distinto del IPI)"
      ],
      [
        "p",
        "No confundas el IPI anual con el impuesto único de transferencia del 3% que se paga al comprar para registrar el título a tu nombre. Son distintos. Cubrimos el desglose completo de la compra — impuesto de transferencia, abogado y notaría — en nuestra [[guía de costos de cierre|article|closing-costs-dr]]."
      ],
      [
        "h",
        "Revisa los beneficios de CONFOTUR autorizados para el caso"
      ],
      [
        "p",
        "Las adquisiciones elegibles en un proyecto turístico aprobado pueden recibir beneficios específicos. Obtén los documentos y la autorización tributaria, incluida la unidad, la operación y el período restante. No supongas que una reventa conserva los beneficios de la primera adquisición ni que inicia otros 15 años."
      ],
      [
        "h",
        "Otros impuestos que deben conocer los propietarios"
      ],
      [
        "ul",
        [
          "Renta de alquiler: pregunta al contador qué declaraciones dominicanas y retenciones corresponden al propietario y a la actividad. Los residentes canadienses deben revisar además sus obligaciones allí; consulta la [[guía para compradores canadienses|article|can-canadians-buy]].",
          "Venta futura: conserva documentos de adquisición y mejoras y solicita el tratamiento tributario y los ajustes permitidos; no supongas que todo gasto es deducible.",
          "Estructura de titularidad: personas físicas, sociedades y fideicomisos pueden seguir reglas distintas. Compara las consecuencias completas antes de cambiarla."
        ]
      ],
      [
        "h",
        "En resumen"
      ],
      [
        "p",
        "Para las personas físicas en 2026, el cálculo general del IPI es el 1% del valor conjunto tasado por la DGII de los inmuebles sujetos al impuesto que supera RD$10,695,494, sujeto a las exenciones aplicables. El impuesto de transferencia es un costo de compra distinto. Anota las fechas del IPI de marzo y septiembre y verifica cualquier aprobación CONFOTUR, los impuestos cubiertos y el plazo restante de la unidad antes de presupuestar."
      ],
      [
        "cta",
        {
          "label": "Estima tus impuestos y rendimientos en la calculadora de ROI",
          "page": "calculator"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Cuánto es el impuesto sobre la propiedad en la República Dominicana?",
        "a": "Para las personas físicas en 2026, la tasa general del IPI es del 1% sobre el valor conjunto tasado por la DGII de sus inmuebles sujetos al impuesto que supera RD$10,695,494, sujeto a las exenciones aplicables. El umbral se aplica al conjunto de los bienes del propietario, no una vez por vivienda. Los fideicomisos y los inmuebles de empresas tienen reglas distintas."
      },
      {
        "q": "¿Cuándo vence el IPI?",
        "a": "El IPI se paga anualmente, normalmente en dos cuotas iguales con vencimiento a más tardar el 11 de marzo y el 11 de septiembre. Los pagos atrasados generan recargos e intereses."
      },
      {
        "q": "¿Es el impuesto de transferencia lo mismo que el IPI?",
        "a": "No. El impuesto de transferencia del 3% es un costo único al comprar para registrar el título. El IPI es el impuesto recurrente anual del 1% sobre la propiedad. Son cargos distintos."
      },
      {
        "q": "¿Puedo evitar el impuesto sobre la propiedad en la RD?",
        "a": "El valor conjunto de los inmuebles sujetos al impuesto de una persona física por debajo de la exención anual puede dar lugar a que no deba IPI, y pueden aplicar otras exenciones legales. Los beneficios relacionados con CONFOTUR requieren verificar el proyecto, la unidad, la operación y el plazo aprobado restante. No supongas una exención separada por vivienda ni un nuevo plazo automático de 15 años."
      },
      {
        "q": "¿Es diferente el impuesto sobre la propiedad para inmuebles a nombre de una empresa?",
        "a": "Las sociedades y los fideicomisos pueden seguir una base diferente del cálculo de IPI para personas físicas mostrado aquí. Un asesor debe comparar regímenes y exenciones de la estructura concreta."
      }
    ]
  },
  "las-terrenas": {
    "catKey": "Moving",
    "catLabel": "Guía de Zonas",
    "read": "12 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "Vivir en Las Terrenas: guía para expatriados (2026)",
    "lede": "Explora Las Terrenas mediante las preguntas prácticas de una mudanza: recorridos diarios, acceso a playa, servicios, presupuesto personal y pruebas de una compra.",
    "metaTitle": "Vivir en Las Terrenas, República Dominicana — Guía para expatriados 2026",
    "metaDescription": "Guía completa de 2026 para vivir en Las Terrenas: comunidad de expatriados, costo de vida, playas, acceso, atención médica y mercado inmobiliario para compradores e inversores.",
    "keywords": [
      "vivir en las terrenas",
      "expatriados las terrenas república dominicana",
      "bienes raíces las terrenas",
      "mudarse a las terrenas samaná"
    ],
    "facts": [
      [
        "Samaná",
        "Compara ubicaciones exactas"
      ],
      [
        "Acceso",
        "Prueba recorridos diarios"
      ],
      [
        "Presupuesto",
        "Reúne cotizaciones actuales"
      ],
      [
        "Inmueble",
        "Verifica cada anuncio"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "Las Terrenas está en la península de Samaná y se asocia con playas como Las Ballenas, Bonita y Cosón. Visitar permite distinguir el centro, las zonas de playa y las ubicaciones interiores; las necesidades de residencia difieren de las de vacaciones."
      ],
      [
        "h",
        "Para quién es Las Terrenas"
      ],
      [
        "p",
        "Escribe lo que necesitas cada semana: conexión de trabajo, compras, escuela, farmacia, atención médica, transporte y actividades. Pruébalo desde la dirección que consideras, sin depender de una cifra general de extranjeros ni de una etiqueta de barrio."
      ],
      [
        "tip",
        "Compara por separado estilo de vida y rendimiento. Un lugar agradable para visitar puede tener restricciones de alquiler, gastos altos o demanda que no encaje en tu modelo. Ni la reputación del pueblo ni los resultados de otra zona establecen el rendimiento de tu inmueble."
      ],
      [
        "h",
        "Las playas"
      ],
      [
        "p",
        "Visita las playas concretas y la ruta de acceso legal desde cada vivienda seleccionada. Condiciones, ruido, estacionamiento y actividades varían con el lugar y el tiempo; una fotografía no demuestra baño seguro ni acceso irrestricto."
      ],
      [
        "ul",
        [
          "Las Ballenas: revisa tramo concreto, recorrido, acceso y entorno cotidiano.",
          "Playa Bonita: compara la ruta real desde la vivienda, servicios y condiciones durante la visita.",
          "Cosón: verifica acceso, transporte, suministros e implicaciones de mantenimiento del terreno concreto."
        ]
      ],
      [
        "h",
        "Cómo llegar e infraestructura"
      ],
      [
        "p",
        "Compara itinerarios actuales y traslados cotizados para El Catey (AZS) y otros aeropuertos adecuados. Prueba recorridos en el horario real de viaje. Antes de trabajar a distancia o mudarte, verifica la conexión, energía de respaldo, agua, seguros y atención médica que necesitas."
      ],
      [
        "h",
        "Costo de vida"
      ],
      [
        "p",
        "Construye el presupuesto mensual con cotizaciones fechadas, no con un supuesto promedio del pueblo. Separa mudanza e imprevistos de los gastos recurrentes:"
      ],
      [
        "table",
        {
          "headers": [
            "Perfil o gasto",
            "Cotizaciones necesarias",
            "Comprobación"
          ],
          "rows": [
            [
              "Trabajo remoto",
              "Alquiler, internet, energía de respaldo, espacio",
              "Prueba conexión e interrupciones del inmueble"
            ],
            [
              "Pareja o jubilados",
              "Vivienda, transporte, seguros, atención médica",
              "Comprueba cobertura y acceso para tus necesidades"
            ],
            [
              "Familia",
              "Escuela, transporte, vivienda, suministros",
              "Confirma admisión, cuotas y recorridos"
            ],
            [
              "Vivienda alquilada",
              "Contrato, depósito, facturas incluidas y renovación",
              "Revisa duración, temporada y moneda"
            ]
          ]
        }
      ],
      [
        "p",
        "Compara inclusiones y duración equivalentes. Añade transporte y facturas recurrentes antes de decidir que una opción interior o de playa es más económica."
      ],
      [
        "h",
        "El mercado inmobiliario"
      ],
      [
        "p",
        "Compara pruebas actuales: precio anunciado y fecha, superficie y título, estado físico, gastos de comunidad y restricciones de uso. Los anuncios no son precios de venta verificados. Todo beneficio de CONFOTUR debe acreditarse para unidad y adquisición, no inferirse del mercadeo del proyecto."
      ],
      [
        "p",
        "Para invertir en alquiler, pide reservas y gastos fechados y separa uso personal y demanda pagada. El [[modelo de ROI de alquiler|article|punta-cana-airbnb-roi]] organiza el cálculo; usa pruebas del inmueble en Las Terrenas en vez de copiar supuestos de otro mercado."
      ],
      [
        "cta",
        {
          "label": "Explora propiedades en Las Terrenas",
          "page": "search"
        }
      ],
      [
        "h",
        "Las desventajas, con honestidad"
      ],
      [
        "ol",
        [
          "Prueba servicios y transporte necesarios sin suponer que un pueblo tiene todas las comodidades de una ciudad.",
          "Visita en distintos momentos y pide registros anuales de suministros y alquiler; no extrapoles todas las temporadas de un viaje.",
          "Compara gastos totales antes de asignar una prima a la cercanía a la playa.",
          "Organiza revisión independiente de título, mensura, estado físico y contrato antes de comprometerte."
        ]
      ],
      [
        "h",
        "¿Es Las Terrenas para ti?"
      ],
      [
        "p",
        "Elige entre direcciones que cubran tus necesidades, no según una clasificación de los “mejores” pueblos para extranjeros. Compara Las Terrenas con otras opciones usando igual presupuesto y lista de servicios e inmuebles, y alquila primero si aún dudas del estilo de vida."
      ],
      [
        "cta",
        {
          "label": "Habla con nuestro equipo",
          "page": "contact"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Es Las Terrenas un buen lugar para vivir como expatriado?",
        "a": "Depende de tus necesidades y de la ubicación concreta. Prueba transporte, conexión, atención médica, escuelas y comunidad durante una visita; esta guía no ofrece una población extranjera verificada ni una clasificación de calidad."
      },
      {
        "q": "¿Cómo se llega a Las Terrenas?",
        "a": "Compara vuelos actuales a aeropuertos adecuados, incluido El Catey, y cotiza el traslado a tu dirección. Verifica horarios y recorridos para tus fechas."
      },
      {
        "q": "¿Cuánto cuestan las propiedades en Las Terrenas?",
        "a": "Usa anuncios fechados y pruebas de valoración independiente de inmuebles comparables. Distingue precio anunciado y venta realizada, superficie, estado y gastos recurrentes; aquí no se da un rango inicial sin respaldo."
      },
      {
        "q": "¿Es Las Terrenas una buena opción para invertir en alquileres?",
        "a": "Evalúa uso permitido, ingresos documentados y gastos del inmueble. Separa valor personal y rendimiento de alquiler, sin suponer que ubicación o incentivo garantizan rentabilidad."
      },
      {
        "q": "¿Cuál es el costo de vida en Las Terrenas?",
        "a": "Prepara un presupuesto con alquiler, suministros, transporte, comida, seguros y escuela o atención médica cotizados y fechados. Indica moneda, plazo y temporada; aquí no se afirma un presupuesto promedio verificado."
      }
    ]
  },
  "best-places-to-retire": {
    "catKey": "Lifestyle",
    "catLabel": "Jubilación",
    "read": "13 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "Jubilarse en la República Dominicana: lugares y requisitos (2026)",
    "lede": "Compara posibles lugares de retiro según tus necesidades de atención médica, transporte, vivienda y presupuesto. Revisa los requisitos publicados para pensionados y rentistas por separado de la decisión inmobiliaria.",
    "metaTitle": "Jubilarse en República Dominicana: lugares y requisitos (2026)",
    "metaDescription": "Compara destinos según tus necesidades de vivienda y servicios. Revisa requisitos de pensionado y rentista y el alcance condicionado de la Ley 171-07.",
    "keywords": [
      "mejores lugares para jubilarse en república dominicana",
      "jubilarse en república dominicana",
      "visa pensionado república dominicana",
      "costo de jubilarse en república dominicana"
    ],
    "facts": [
      [
        "US$1,500/mes",
        "Pensión mínima publicada"
      ],
      [
        "DGM",
        "Se requiere evaluación"
      ],
      [
        "Condicionados",
        "Beneficios de Ley 171-07"
      ],
      [
        "Presupuesto propio",
        "Reúne cotizaciones actuales"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "Jubilarse en la República Dominicana combina un clima cálido con lugares muy distintos para vivir. Los pensionados y rentistas elegibles pueden solicitar residencia mediante una vía basada en sus ingresos, y la Ley 171-07 prevé beneficios fiscales condicionados para la pensión o renta declarada que califique. Antes de mudarte, comprueba la elegibilidad, los requisitos de renovación y el alcance de cada beneficio."
      ],
      [
        "p",
        "Los lugares siguientes son opciones para investigar, no una clasificación ni una promesa de facilidad migratoria. Relaciona vivienda y servicios con tus necesidades y verifica elegibilidad, plazos y gastos por el procedimiento oficial vigente."
      ],
      [
        "h",
        "¿Por qué jubilarse en la República Dominicana?"
      ],
      [
        "ul",
        [
          "Presupuesto: cotiza vivienda, comida, suministros, transporte, seguros e imprevistos propios; no uses un promedio sin respaldo para “la mayoría de las parejas”.",
          "Viajes: compara vuelos actuales, requisitos de entrada y traslado real hasta la vivienda.",
          "Beneficios fiscales: los pensionados o rentistas elegibles y aprobados pueden recibir beneficios específicos de Ley 171-07; menaje y vehículos tienen condiciones separadas y el beneficio vehicular es parcial.",
          "Atención médica: confirma especialidades, emergencias, medicamentos, aceptación del seguro y gastos propios antes de elegir ubicación."
        ]
      ],
      [
        "h",
        "Las visas de Pensionado y Rentista"
      ],
      [
        "p",
        "DGM publica servicios de residencia separados para pensionados y rentistas elegibles de fuente extranjera. La renta mínima es solo una parte: revisa visa, pruebas, dependientes, documentos, tasas y renovaciones antes de comprometerte con una mudanza."
      ],
      [
        "ul",
        [
          "Vía de residencia para Pensionado: la DGM exige al menos US$1,500 mensuales de pensión de fuente extranjera de un gobierno, organismo oficial o empresa privada, más US$250 por cada dependiente directo incluido. Un salario laboral no cumple el requisito de ingreso por pensión.",
          "Vía de residencia para Rentista: el mínimo publicado es de US$2,000 mensuales de renta estable admisible del exterior, con documentos que respalden su origen e historial. La Ley 171-07 también exige US$250 por cada dependiente incluido. Un salario no sustituye la renta que debe calificar."
        ]
      ],
      [
        "p",
        "Usa las listas vigentes del consulado y DGM para tu vía, incluidas pruebas de ingresos, identidad, antecedentes y documentos médicos, y apostilla, legalización o traducción judicial cuando correspondan. Solicita información oficial del plazo de tu expediente; aquí no se promete fecha de residencia ni ciudadanía. La naturalización es otro trámite con requisitos propios."
      ],
      [
        "tip",
        "Ser propietario no otorga residencia. Evita comprometer una compra o mudanza no reembolsable basándote en un resultado migratorio no confirmado. [[Contacta a nuestro equipo|contact]] sobre inmuebles y busca asesoría migratoria independiente para tu estatus."
      ],
      [
        "h",
        "Compara posibles lugares para el retiro"
      ],
      [
        "p",
        "Usa los mismos requisitos en cada lugar. La tabla propone preguntas de investigación; no certifica calidad, asequibilidad ni idoneidad de un inmueble:"
      ],
      [
        "table",
        {
          "headers": [
            "Lugar",
            "Preguntas cotidianas",
            "Revisiones del inmueble"
          ],
          "rows": [
            [
              "Las Terrenas",
              "¿Llegas desde esa dirección a los servicios necesarios?",
              "Acceso, suministros, mantenimiento y reglas de alquiler"
            ],
            [
              "Sosúa y Cabarete",
              "¿Transporte, actividades y ruido encajan en tu rutina?",
              "Acceso legal, estado y presupuesto operativo"
            ],
            [
              "Puerto Plata",
              "¿Qué barrios cubren transporte y servicios?",
              "Título, estado y cuotas recurrentes"
            ],
            [
              "Punta Cana",
              "¿Qué servicios y reglas reales de la comunidad te convienen?",
              "Cuotas, acceso y restricciones de uso"
            ],
            [
              "Santo Domingo",
              "¿Funcionan los recorridos y el entorno urbano?",
              "Estado del edificio, comunidad y estacionamiento"
            ],
            [
              "Jarabacoa",
              "¿La ubicación permite viajes y atención médica necesarios?",
              "Acceso, drenaje, suministros y mantenimiento"
            ]
          ]
        }
      ],
      [
        "h3",
        "Las Terrenas"
      ],
      [
        "p",
        "Compara centro, playas y direcciones interiores mediante una visita. Prueba compras, conexión y atención médica sin suponer que todas las propiedades tienen los mismos servicios; consulta la [[guía de Las Terrenas|article|las-terrenas]]."
      ],
      [
        "h3",
        "Sosúa, Cabarete y Puerto Plata"
      ],
      [
        "p",
        "Visita inmuebles del corredor norte y compara el presupuesto mensual completo. Prueba transporte, actividades, ruido y los servicios médicos que necesitas. La fama de una zona como económica no es una cotización vigente ni prueba de idoneidad médica."
      ],
      [
        "h3",
        "Punta Cana"
      ],
      [
        "p",
        "Compara comunidades concretas con sus reglas, acceso a servicios y cuotas. Confirma recorridos y necesidades médicas y de seguro de tu hogar; consulta la [[guía de Punta Cana|article|living-punta-cana]]."
      ],
      [
        "h",
        "Cuánto cuesta realmente la jubilación"
      ],
      [
        "p",
        "Prepara un presupuesto familiar con cotizaciones fechadas de vivienda, comida, suministros, transporte, seguros y atención médica. Añade visa, residencia, mudanza, cambios de moneda y reserva. La renta mínima migratoria no demuestra que esa suma cubra tu costo de vida."
      ],
      [
        "h",
        "Pasos sensatos antes de jubilarte aquí"
      ],
      [
        "ol",
        [
          "Visita tanto en temporada alta como en temporada baja antes de comprometerte: las localidades se sienten muy distintas en julio y en febrero.",
          "Alquila antes de comprar. Pasa unos meses en la localidad que hayas seleccionado para confirmar que te conviene antes de adquirir una propiedad.",
          "Confirma proveedores médicos, cobertura y acceso de emergencia antes de comprometerte; no dependas de una afirmación general sobre calidad nacional.",
          "Habla con un asesor fiscal transfronterizo para gestionar correctamente tu pensión y los posibles ingresos de alquiler en ambos países."
        ]
      ],
      [
        "h",
        "En resumen"
      ],
      [
        "p",
        "Un plan sólido conecta lugar, inmueble, presupuesto, atención médica y procedimiento migratorio oficial. Visita y considera alquilar primero, documenta las preguntas pendientes y no sustituyas ese trabajo por un incentivo o presupuesto bajo anunciado."
      ],
      [
        "cta",
        {
          "label": "Explora viviendas en lugares ideales para jubilarte",
          "page": "search"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Cuál es el mejor lugar para jubilarse en la República Dominicana?",
        "a": "No hay una ubicación universalmente mejor. Compara direcciones según atención médica, transporte, accesibilidad, vida social y presupuesto mediante visitas y cotizaciones actuales, no una clasificación sin respaldo."
      },
      {
        "q": "¿Cuánto dinero necesito para jubilarme en la RD?",
        "a": "Separa la renta exigida por tu vía migratoria del presupuesto real. Obtén cotizaciones de vivienda, seguros, atención médica, comida, suministros y transporte, con reservas y gastos migratorios."
      },
      {
        "q": "¿Cuáles son los requisitos de la visa de Pensionado?",
        "a": "La DGM publica un mínimo de US$1,500 mensuales de pensión de fuente extranjera de un gobierno, organismo oficial o empresa privada, más US$250 por cada dependiente directo incluido. La vía de Rentista utiliza un mínimo de US$2,000 mensuales de renta admisible y documentación adicional. Los ingresos por sí solos no demuestran elegibilidad: confirma los requisitos vigentes completos del consulado y de la DGM."
      },
      {
        "q": "¿Necesito residencia para comprar una vivienda de jubilación en la RD?",
        "a": "Comprar y obtener autorización migratoria son asuntos separados. La compra no otorga residencia; confirma el estatus de tu estancia antes de mudarte o comprometer fondos bajo esa suposición."
      },
      {
        "q": "¿Existen beneficios fiscales para los jubilados?",
        "a": "La Ley 171-07 prevé beneficios condicionados para pensionados y rentistas aprobados, incluidas la exención de la pensión o renta declarada que califique y de importaciones admisibles de enseres domésticos. El beneficio para importar vehículos es parcial y sigue reglas aduaneras separadas. No es una exención de todos los ingresos extranjeros ni de toda importación; verifica cada beneficio y su aprobación con la autoridad correspondiente."
      }
    ]
  },
  "dr-real-estate-safe": {
    "catKey": "Buying",
    "catLabel": "Seguridad y Confianza",
    "read": "12 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "¿Es seguro el mercado inmobiliario de la República Dominicana? Estafas que evitar (2026)",
    "lede": "Evalúa por separado riesgos legales, físicos, financieros y de seguridad personal. Esta guía organiza documentos, controles de pago y revisiones independientes antes de comprometerte con un inmueble.",
    "metaTitle": "¿Es seguro el mercado inmobiliario de la República Dominicana? Estafas y cómo evitarlas",
    "metaDescription": "Guía práctica de debida diligencia en RD: derechos inscritos, facultades del vendedor, mensura, contrato, controles de pago y estado del edificio.",
    "keywords": [
      "es seguro comprar propiedades en república dominicana",
      "estafas inmobiliarias república dominicana",
      "fraude inmobiliario república dominicana",
      "comprar propiedad república dominicana con seguridad"
    ],
    "facts": [
      [
        "Título",
        "Obtén pruebas registrales actuales"
      ],
      [
        "Vendedor",
        "Verifica identidad y facultades"
      ],
      [
        "Fondos",
        "Acuerda custodia y desembolso"
      ],
      [
        "Alcance",
        "Revisión jurídica y física independiente"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "Ninguna operación inmobiliaria carece de riesgo. El trato nacional a inversionistas extranjeros no garantiza título sin incidencias, edificio seguro, vendedor confiable ni inversión adecuada. Evalúa la operación concreta antes de decidir qué riesgos aceptas."
      ],
      [
        "p",
        "Usa la lista siguiente para investigar señales de alerta, registrar asuntos pendientes y acordar condiciones de pago. Es una guía organizativa, no una opinión jurídica ni certificación del inmueble anunciado."
      ],
      [
        "h",
        "Revisa por separado riesgos jurídicos y físicos"
      ],
      [
        "p",
        "Contrata asesoría independiente con alcance escrito y verifica situación profesional y conflictos. Acuerda quién examina registro, facultades del vendedor, impuestos, contratos y custodia, y organiza inspecciones técnicas separadas. No presupongas que un seguro o custodio sea automático ni afirmes que esos servicios no existen."
      ],
      [
        "tip",
        "Verifica identidad, situación profesional y facultades de asesores e intermediarios según los requisitos vigentes. Pregunta qué verificó realmente la plataforma o el agente, cuándo y con qué límites; una insignia o cargo no sustituye las pruebas independientes."
      ],
      [
        "h",
        "Patrones de alerta que conviene investigar"
      ],
      [
        "p",
        "Estos patrones requieren preguntas y revisión independiente. Son ejemplos de riesgos, no una clasificación estadística de fraudes dominicanos:"
      ],
      [
        "ul",
        [
          "Trampas con depósitos de reserva: te presionan para pagar un depósito que «aparte» una unidad antes de que alguien haya verificado que existe, está libre de cargas y pertenece realmente al vendedor. Una vez que sale el dinero, también desaparece tu capacidad de negociación.",
          "Representación falsa del título o de la propiedad: quien vende no es el verdadero propietario registrado o no puede transferir legalmente un título limpio. Aquí aparecen los certificados de título falsificados o desactualizados.",
          "Cargas ocultas: gravámenes, una hipoteca existente, impuestos sobre la propiedad impagados o disputas de límites que solo salen a la luz después de que hayas pagado.",
          "Problemas de límites y mensura: comprar un terreno o solar sin deslinde registrado y descubrir después que es más pequeño o está ubicado en un lugar distinto del anunciado."
        ]
      ],
      [
        "p",
        "Completa las revisiones apropiadas antes de desembolsar fondos y documenta condiciones pendientes. Verificar puede reducir riesgos concretos, pero no elimina todos los riesgos financieros, constructivos o de seguridad personal."
      ],
      [
        "h",
        "Cómo protegerte: lo que no es negociable"
      ],
      [
        "ol",
        [
          "Contrata asesoría dominicana independiente, verifica situación profesional y conflictos y acuerda un alcance escrito.",
          "Obtén pruebas registrales actuales, incluida la Certificación del Estado Jurídico del Inmueble. Describe derechos, cargas y gravámenes inscritos; verifica aparte identidad, representación, consentimientos y facultades necesarias para vender.",
          "Un profesional competente debe comparar datos catastrales y mensura con el terreno, el acceso legal y las incidencias de linderos.",
          "Acuerda una custodia documentada: responsable, regulación aplicable, instrucciones de desembolso, devolución y manejo de controversias. Verifica por otra vía los datos de pago.",
          "Vincula depósitos y cierre con asuntos pendientes de título, mensura, financiamiento e inspección; no supongas que el depósito es reembolsable sin condiciones que lo establezcan.",
          "Si compras sobre plano, verifica el título del desarrollador, los permisos y su historial de entregas antes de pagar cualquier importe."
        ]
      ],
      [
        "h",
        "Señales de alerta para retirarte"
      ],
      [
        "ul",
        [
          "Presión para pagar un depósito rápidamente «antes de que otra persona se lo lleve».",
          "Un vendedor o agente que se opone a que lleves a tu propio abogado.",
          "Documentos de título entregados solo como copias o que no pueden confirmarse en el registro.",
          "Un precio muy por debajo del mercado con una explicación vaga: lo que parece demasiado bueno para ser verdad suele serlo.",
          "Condiciones poco claras de custodia, desembolso o devolución, o resistencia a documentar el acuerdo en un idioma que entiendas."
        ]
      ],
      [
        "h",
        "Preguntas antes de depender de un anuncio"
      ],
      [
        "p",
        "Solicita título, mensura, permisos, gastos e informes de estado disponibles e identifica qué requiere confirmación independiente. Aprobar un anuncio no equivale a opinión jurídica de título ni inspección técnica. Usa la [[guía de compra|article|can-americans-buy]] y la [[guía de cierre|article|closing-costs-dr]] para organizar lo pendiente."
      ],
      [
        "h",
        "En resumen"
      ],
      [
        "p",
        "Procede cuando entiendas pruebas, asuntos pendientes, exposición económica y remedios contractuales. La revisión jurídica y técnica independiente y los pagos controlados apoyan una decisión informada; no garantizan seguridad ni rendimiento."
      ],
      [
        "cta",
        {
          "label": "Ver propiedades",
          "page": "search"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Es seguro comprar una propiedad en la República Dominicana como extranjero?",
        "a": "Evalúa inmueble y operación concretos. La protección a la inversión extranjera no elimina riesgos de título, construcción, finanzas o seguridad personal; obtén pruebas independientes y acuerda pagos antes de comprometerte."
      },
      {
        "q": "¿Cuáles son las estafas inmobiliarias más comunes en la RD?",
        "a": "Investiga, por ejemplo, depósitos bajo presión, facultades del vendedor poco claras, documentos desactualizados o inconsistentes, cargas y diferencias de mensura. No se afirma una clasificación estadística ni que sean los únicos riesgos."
      },
      {
        "q": "¿Cómo verifico el título de una propiedad en la RD?",
        "a": "Pide al abogado pruebas registrales actuales y revisión de derechos y cargas. Verifica por separado identidad, representación y facultades del vendedor, y compara datos catastrales mediante revisión competente del terreno y la mensura."
      },
      {
        "q": "¿Debo utilizar un servicio de custodia (escrow)?",
        "a": "Consulta con el abogado la custodia y el desembolso adecuados. Verifica proveedor, cuenta, condiciones escritas, devolución y controversias; la palabra escrow no garantiza por sí sola protección."
      },
      {
        "q": "¿Están regulados los agentes inmobiliarios en la República Dominicana?",
        "a": "Verifica requisitos vigentes e identidad, facultades y situación profesional reales del intermediario. No dependas de una afirmación general sin respaldo de que todos carecen de regulación o están verificados automáticamente."
      }
    ]
  },
  "living-punta-cana": {
    "catKey": "Moving",
    "catLabel": "Guía de Zonas",
    "read": "13 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "Vivir en Punta Cana: guía completa para expatriados (2026)",
    "lede": "Compara comunidades de Bávaro–Punta Cana con recorridos reales, servicios, reglas de asociación y un presupuesto por inmueble. Separa la experiencia vacacional de las necesidades de vivir o invertir allí.",
    "metaTitle": "Vivir en Punta Cana, República Dominicana — Guía para expatriados 2026",
    "metaDescription": "Compara direcciones, servicios, transporte, gastos del hogar y documentos de inmuebles en Punta Cana con una lista práctica de reubicación e inversión.",
    "keywords": [
      "vivir en punta cana",
      "guía expatriados punta cana",
      "mejores zonas punta cana",
      "mudarse a punta cana república dominicana"
    ],
    "facts": [
      [
        "PUJ",
        "Consulta vuelos actuales"
      ],
      [
        "Comunidad",
        "Lee reglas y cuotas reales"
      ],
      [
        "Presupuesto",
        "Usa cotizaciones fechadas"
      ],
      [
        "Alquileres",
        "Verifica uso permitido"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "El área de Bávaro–Punta Cana contiene distintas comunidades residenciales y turísticas. Compara direcciones, acceso legal, reglas y servicios necesarios. No supongas que un anuncio en una zona turística incluye todos los servicios, traslados o atención médica de su material promocional."
      ],
      [
        "h",
        "Para quién es Punta Cana"
      ],
      [
        "p",
        "Empieza por el objetivo: residencia anual, uso estacional o inversión. Para vivienda, prueba recorridos y servicios; para invertir, revisa uso permitido, demanda documentada y gastos. Ni la comodidad ni un acceso controlado establecen rendimiento o seguridad personal."
      ],
      [
        "h",
        "Comunidades para comparar"
      ],
      [
        "p",
        "Usa los nombres siguientes como áreas de búsqueda y después verifica la dirección concreta y lo que incluyen sus cuotas:"
      ],
      [
        "ul",
        [
          "Cap Cana: confirma cuotas, derechos de acceso, restricciones de alquiler y cargos de servicios.",
          "Puntacana Village: prueba rutas desde la dirección al trabajo, escuela, compras y aeropuerto.",
          "Cocotal: revisa reglas, mantenimiento y acceso a golf u otros servicios del caso.",
          "Los Corales y El Cortecito: inspecciona acceso a playa, estacionamiento, ruido y permisos de alquiler.",
          "White Sands y Arena Gorda: confirma desarrollo concreto, acceso y obligaciones de servicio.",
          "Uvero Alto: prueba transporte, suministros, servicios y efectos de obras cercanas."
        ]
      ],
      [
        "h",
        "Costo de vida"
      ],
      [
        "p",
        "Recoge cotizaciones fechadas y compara iguales inclusiones y contratos. Usa un plan personal en vez de un supuesto presupuesto cómodo para toda la zona:"
      ],
      [
        "table",
        {
          "headers": [
            "Hogar o gasto",
            "Datos para cotizar",
            "Qué confirmar"
          ],
          "rows": [
            [
              "Residente solo",
              "Alquiler, suministros, internet, comida y transporte",
              "Facturas incluidas y moneda"
            ],
            [
              "Residente con servicios",
              "Cuotas, estacionamiento y recreación",
              "Derechos de acceso y cargos extra"
            ],
            [
              "Pareja o jubilados",
              "Vivienda, transporte, seguros y atención médica",
              "Cobertura, acceso e imprevistos"
            ],
            [
              "Contrato de alquiler",
              "Plazo, depósito, renovación y mantenimiento",
              "Temporada, servicios incluidos y restricciones"
            ]
          ]
        }
      ],
      [
        "p",
        "Compara el total mensual, los desplazamientos y la reserva antes de elegir comunidad. Un alquiler mayor puede incluir gastos que otra oferta excluye; compara cada partida."
      ],
      [
        "h",
        "Transporte, atención médica y servicios"
      ],
      [
        "p",
        "Consulta servicios actuales en el Aeropuerto Internacional de Punta Cana (PUJ) y cotiza el traslado a tu dirección. Confirma especialidades médicas, aceptación del seguro, escuelas, internet y suministros de respaldo con sus proveedores. Prueba los recorridos con tu horario real."
      ],
      [
        "h",
        "Seguridad"
      ],
      [
        "p",
        "Evalúa seguridad personal en la dirección y recorridos, acceso de emergencia, iluminación y servicios realmente contratados por la comunidad. La entrada controlada es un elemento de evaluación, no garantía contra delitos, accidentes u otros riesgos."
      ],
      [
        "h",
        "Bienes raíces e inversión"
      ],
      [
        "p",
        "Solicita documentos, gastos y registros de alquiler actuales antes de comparar inversiones. Todo beneficio fiscal exige la aprobación aplicable. Usa la [[guía de ROI|article|punta-cana-airbnb-roi]] para modelar escenarios y la [[guía de cierre|article|closing-costs-dr]] para presupuestar; ninguna garantiza un rendimiento de mercado."
      ],
      [
        "cta",
        {
          "label": "Explora propiedades en Punta Cana",
          "page": "search"
        }
      ],
      [
        "h",
        "Las desventajas, con honestidad"
      ],
      [
        "ol",
        [
          "Visita inmueble y comunidad concretos en vez de elegir solo por fotografías.",
          "Prueba cómo te desplazarás: la zona no demuestra recorridos peatonales ni transporte utilizable.",
          "Lee cuotas recurrentes y derechos reales de acceso antes de comparar precios.",
          "Compara distintas fechas y registros anuales para uso estacional o alquiler."
        ]
      ],
      [
        "h",
        "¿Es Punta Cana para ti?"
      ],
      [
        "p",
        "Elige una ubicación que cubra prioridades documentadas con un costo total sostenible. Compara direcciones de la zona con opciones en [[Las Terrenas|article|las-terrenas]] mediante la misma lista de pruebas, no una clasificación sin respaldo."
      ],
      [
        "cta",
        {
          "label": "Habla con nuestro equipo",
          "page": "contact"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Es Punta Cana un buen lugar para vivir como expatriado?",
        "a": "Depende de la vivienda, tus necesidades y los servicios y reglas reales de la comunidad. Prueba transporte, atención médica, escuelas, conexión y costo total durante una visita."
      },
      {
        "q": "¿Cuáles son las mejores zonas de Punta Cana para expatriados?",
        "a": "Compara comunidades y direcciones en Cap Cana, Puntacana Village, Cocotal, Los Corales, El Cortecito, White Sands, Arena Gorda y Uvero Alto. Es una lista de búsqueda, no una clasificación de seguridad o rentabilidad."
      },
      {
        "q": "¿Cuánto cuesta vivir en Punta Cana?",
        "a": "Usa cotizaciones de alquiler, suministros, transporte, comida, seguros y servicios elegidos, con una reserva. Compara iguales plazos e inclusiones; aquí no se afirma un presupuesto promedio actual."
      },
      {
        "q": "¿Es seguro Punta Cana?",
        "a": "Evalúa dirección, recorridos, acceso de emergencia y medidas de seguridad reales. El nombre de una comunidad o una entrada controlada no garantiza seguridad."
      },
      {
        "q": "¿Es Punta Cana una buena opción para invertir en bienes raíces?",
        "a": "Evalúa uso permitido, ingresos documentados, estado y gastos del inmueble. Usa escenarios base y adverso y verifica todo beneficio aprobado; aquí no se promete demanda ni superioridad del mercado."
      }
    ]
  },
  "confotur-explained": {
    "catKey": "Legal",
    "catLabel": "Incentivo Fiscal",
    "read": "11 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "CONFOTUR explicado: incentivos fiscales por proyecto en la RD (2026)",
    "lede": "Entiende qué acredita la clasificación de un proyecto y qué no. Revisa unidad, adquisición, autorización tributaria y período aprobado restante antes de incluir beneficios en el presupuesto.",
    "metaTitle": "Ley CONFOTUR explicada (2026) — Beneficios y verificación del proyecto",
    "metaDescription": "Cómo el régimen CONFOTUR puede afectar los impuestos de transferencia y sobre la propiedad en la RD, por qué debe verificarse cada unidad, cómo funciona el plazo restante y qué comprobar antes de comprar.",
    "keywords": [
      "confotur",
      "ley confotur república dominicana",
      "exención fiscal confotur",
      "propiedad libre de impuestos república dominicana"
    ],
    "facts": [
      [
        "Ley 158-01",
        "Régimen de incentivos turísticos"
      ],
      [
        "Unidad específica",
        "Verifica la exención de transferencia"
      ],
      [
        "Plazo del proyecto",
        "Verifica el período restante"
      ],
      [
        "Aprobación",
        "Confirmación documental"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "CONFOTUR administra un marco de incentivos turísticos, pero una etiqueta comercial no es una autorización tributaria. Usa resolución y documentos de la operación para establecer si la adquisición recibe un beneficio concreto. El marco no promete propiedad libre de todos los impuestos."
      ],
      [
        "h",
        "¿Qué es CONFOTUR?"
      ],
      [
        "p",
        "CONFOTUR administra el régimen de incentivos turísticos de la Ley 158-01 y sus modificaciones. Los proyectos aprobados pueden recibir beneficios tributarios determinados, y algunos pueden aplicar a adquisiciones de unidades que cumplan los requisitos. La clasificación del proyecto no sustituye verificar al comprador, la operación, la unidad, la autorización tributaria necesaria y el plazo aplicable."
      ],
      [
        "h",
        "Qué exime CONFOTUR para un comprador"
      ],
      [
        "ul",
        [
          "Impuesto de transferencia: las adquisiciones que cumplan los requisitos pueden obtener una exención del impuesto normal del 3% mediante la autorización aplicable. Verifica la operación específica con el Ministerio de Hacienda y la DGII; no basta una etiqueta CONFOTUR en un folleto.",
          "IPI anual: el inmueble elegible en un proyecto aprobado puede recibir una exención durante el período autorizado aplicable. El artículo 7, modificado por la Ley 195-13, fija un período de exención del proyecto de 15 años desde la terminación de la construcción y el equipamiento; una compra posterior no inicia automáticamente otros 15 años.",
          "Impuesto sobre los ingresos por alquiler: no supongas que una exención de transferencia o IPI de la unidad también exime los ingresos por alquiler del propietario. Solicita una determinación separada de cualquier beneficio de ISR y sus condiciones para el contribuyente, la actividad y el inmueble."
        ]
      ],
      [
        "p",
        "Si se autoriza un beneficio, incluye solo el impuesto y período cubiertos. Conserva una comparación sin beneficios no confirmados para que una solicitud tardía o rechazada no deje la compra dependiendo de un ahorro supuesto."
      ],
      [
        "h",
        "¿Cuánto te ahorra realmente?"
      ],
      [
        "p",
        "Solo como ejemplo aritmético, se supone que el único inmueble gravado de una persona física y la base de transferencia aceptada valen RD$15,000,000, sin otra exención. La columna de beneficios supone autorizaciones escritas de esa misma unidad y adquisición; n representa los períodos de IPI restantes confirmados, no una nueva concesión de 15 años:"
      ],
      [
        "table",
        {
          "headers": [
            "Costo o plazo (DOP)",
            "Cálculo estándar hipotético",
            "Solo si se autoriza expresamente"
          ],
          "rows": [
            [
              "Transferencia sobre la base supuesta al 3%",
              "RD$450,000",
              "Exención sujeta a aprobación de la operación"
            ],
            [
              "IPI anual sobre la base conjunta de 2026",
              "RD$43,045.06",
              "Exención solo por los períodos restantes aprobados"
            ],
            [
              "Períodos de IPI aprobados restantes",
              "No aplica",
              "Verifica n para la unidad específica"
            ],
            [
              "Reducción hipotética si aplican ambos beneficios",
              "—",
              "RD$450,000 + RD$43,045.06 × n"
            ]
          ]
        }
      ],
      [
        "p",
        "Es un ejemplo aritmético en pesos dominicanos, no una previsión ni una liquidación tributaria. Mantiene constantes el umbral de 2026 y las tasaciones supuestas solo para explicar la fórmula; los umbrales futuros, la titularidad, las tasaciones y los períodos aprobados pueden cambiar. Consulta la [[guía de costos de cierre|article|closing-costs-dr]] y la [[explicación del IPI|article|property-taxes-ipi]] para distinguir los impuestos y la base conjunta del propietario."
      ],
      [
        "h",
        "¿Quién califica?"
      ],
      [
        "ul",
        [
          "Revisa requisitos del solicitante y la adquisición sin inferir elegibilidad solo de nacionalidad o residencia.",
          "Obtén la clasificación definitiva y confirma cobertura de unidad y actividad aprobada.",
          "Confirma el tratamiento de la operación, especialmente reventa o terreno/construcción; estar en una zona turística o prometer obras no basta."
        ]
      ],
      [
        "tip",
        "Formula ambas preguntas: ¿tiene el proyecto la clasificación aplicable y cumple esta adquisición del comprador los requisitos del beneficio? Verifica la respuesta documental de forma independiente antes de comprometer fondos o retirar impuestos del presupuesto."
      ],
      [
        "h",
        "Cómo verificar que un proyecto realmente cuenta con CONFOTUR"
      ],
      [
        "ol",
        [
          "Solicita al desarrollador la resolución oficial de aprobación de CONFOTUR (con su número y fecha).",
          "Encarga a tu abogado independiente que confirme que la aprobación es auténtica, está vigente y cubre la unidad específica que vas a comprar.",
          "Verifica impuestos, autorizaciones y período restante concretos; la renta de alquiler debe evaluarse aparte de beneficios de transferencia o IPI.",
          "Haz que la exención quede reflejada por escrito en tu Promesa de Venta, para que forme parte del acuerdo que realmente firmas."
        ]
      ],
      [
        "h",
        "Las salvedades"
      ],
      [
        "p",
        "Los beneficios CONFOTUR no son automáticos ni eximen de todo impuesto. Verifica la clasificación del proyecto, la unidad y la operación específicas, las autorizaciones tributarias necesarias y el plazo restante. El período legal del proyecto se cuenta desde la terminación de la construcción y el equipamiento según el artículo 7 modificado, no simplemente desde el cierre del comprador. El ISR de los alquileres requiere un análisis propio."
      ],
      [
        "h",
        "En resumen"
      ],
      [
        "p",
        "Verifica la adquisición antes de asignar ahorros. Conserva resolución, aprobación tributaria, identificación de unidad y plazo con los documentos de cierre. La [[guía de ROI|article|punta-cana-airbnb-roi]] compara escenarios elegidos; un beneficio no demuestra rendimiento de alquiler."
      ],
      [
        "cta",
        {
          "label": "Estima tu ahorro en la calculadora de ROI",
          "page": "calculator"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Qué es la ley CONFOTUR?",
        "a": "CONFOTUR administra el régimen de incentivos turísticos de la Ley 158-01 y sus modificaciones. Determinadas operaciones de proyectos y unidades pueden calificar para beneficios de transferencia o IPI mediante las aprobaciones aplicables. Verifica los impuestos cubiertos y el plazo restante; un comprador posterior no recibe automáticamente una nueva exención de 15 años."
      },
      {
        "q": "¿Cuánto me puede ahorrar CONFOTUR?",
        "a": "Calcula cada impuesto sobre su base imponible real y aplica solo los beneficios y períodos restantes confirmados para la unidad. En el ejemplo hipotético de RD$15,000,000, la transferencia supuesta es de RD$450,000 y el IPI de 2026 sobre el patrimonio conjunto del propietario es de RD$43,045.06 por un año. No son una cotización, previsión ni prueba de que una compra específica esté exenta."
      },
      {
        "q": "¿Califican los extranjeros para CONFOTUR?",
        "a": "La nacionalidad por sí sola no establece aprobación. Confirma solicitante, proyecto, unidad y adquisición y obtén autorización tributaria; no supongas que la residencia determina por sí sola elegibilidad."
      },
      {
        "q": "¿Califica la compra de un terreno para CONFOTUR?",
        "a": "La ubicación turística o un paquete comercial de terreno y construcción no demuestra por sí solo beneficios. Revisa resolución y adquisición concretas, actividad aprobada, unidad y autorización necesaria."
      },
      {
        "q": "¿Cómo confirmo que un proyecto tiene CONFOTUR?",
        "a": "Pide al desarrollador la resolución oficial de aprobación de CONFOTUR y encarga a tu abogado independiente que verifique que es auténtica, está vigente y cubre tu unidad específica — después, haz que conste por escrito en tu Promesa de Venta."
      }
    ]
  },
  "dr-vs-miami": {
    "catKey": "Investing",
    "catLabel": "Inteligencia de Inversión",
    "read": "12 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "República Dominicana frente a Miami: argumentos para el inversor en 2026",
    "lede": "Compara inmuebles concretos de dos jurisdicciones con igual base de precio, período de alquiler, definición de gastos y preguntas de riesgo. Separa reglas tributarias, cálculos hipotéticos y promedios de mercado sin respaldo.",
    "metaTitle": "Bienes raíces en República Dominicana frente a Miami — Comparación para inversores 2026",
    "metaDescription": "Comparación por inmueble entre RD y Miami: costos comparables, pruebas de alquiler, impuestos, financiamiento, exposición cambiaria y escenarios adversos.",
    "keywords": [
      "bienes raíces república dominicana frente a miami",
      "inversión inmobiliaria república dominicana",
      "invertir república dominicana o miami",
      "inversión inmobiliaria caribe 2026"
    ],
    "facts": [
      [
        "Compara",
        "Inmuebles equivalentes"
      ],
      [
        "Ingresos",
        "Usa pruebas fechadas"
      ],
      [
        "Impuestos",
        "Evalúa ambas jurisdicciones"
      ],
      [
        "Riesgo",
        "Prueba flujo adverso"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "La comparación internacional debe empezar con inmuebles y objetivos concretos, no con una clasificación nacional de precios o rentabilidad. Iguala tipo, estado, titularidad, ubicación y uso de alquiler permitido; después compara costos totales y un mismo período."
      ],
      [
        "h",
        "Costo inicial: compara toda la adquisición"
      ],
      [
        "p",
        "Usa comparables fechados y distingue anuncios de operaciones realizadas. Convierte de forma consistente metros y pies cuadrados e identifica superficie interior, construida, bruta o de terreno. Añade cierre, reparaciones, mobiliario, financiamiento y cambio antes de decidir qué inversión tiene menor costo."
      ],
      [
        "h",
        "Una ficha de comparación equivalente"
      ],
      [
        "table",
        {
          "headers": [
            "Factor",
            "Pruebas del inmueble dominicano",
            "Pruebas del inmueble en Miami"
          ],
          "rows": [
            [
              "Costo de adquisición",
              "Precio, cierre, puesta en marcha y reparaciones",
              "Precio, cierre, puesta en marcha y reparaciones"
            ],
            [
              "Superficie y estado",
              "Superficie legal, mensura e inspección",
              "Definición de superficie equivalente e inspección"
            ],
            [
              "Ingreso bruto de alquiler",
              "Estancias pagadas y devoluciones del período",
              "Estancias pagadas y devoluciones del mismo período"
            ],
            [
              "Flujo neto",
              "Gastos, financiamiento e impuestos desglosados",
              "Iguales categorías y denominador"
            ],
            [
              "Impuesto inmobiliario",
              "Liquidación y exenciones del titular y estructura",
              "Tasación, gravámenes y exenciones de la parcela"
            ],
            [
              "Incentivos y restricciones",
              "Aprobaciones escritas de unidad y operación",
              "Reglas y aprobaciones locales documentadas"
            ]
          ]
        }
      ],
      [
        "p",
        "Deja visibles los datos desconocidos. No mejoras una comparación incompleta introduciendo un promedio regional sin respaldo. Identifica cada cifra como operación realizada, cotización, proyección o dato ilustrativo."
      ],
      [
        "h",
        "Rendimientos e impuestos: conserva una base coherente"
      ],
      [
        "p",
        "Usa iguales categorías de gastos, período y denominador. Solo como aritmética, una tasa anual supuesta del 2.45% sobre US$485,000 da US$11,882.50; ninguno de esos supuestos es una cotización tributaria actual de Miami. Obtén el cálculo de la parcela. En el modelo dominicano, obtén la liquidación del titular y estructura y verifica toda aprobación de [[CONFOTUR|article|confotur-explained]], sin suponer exención en toda compra."
      ],
      [
        "h",
        "Preguntas para un inmueble en Miami"
      ],
      [
        "p",
        "Evalúa edificio, parcela y operación concretos con los asesores locales correspondientes:"
      ],
      [
        "ul",
        [
          "Pruebas de salida: compara ventas realizadas, plazo comercial y gastos sin presumir liquidez.",
          "Revisión jurídica y del edificio: confirma título, custodia, reglas de alquiler, asociación y estado técnico.",
          "Financiamiento: obtén por escrito elegibilidad, tasa, seguros y pagos según tu perfil.",
          "Moneda e impuestos: compara moneda de fondos, residencia, declaraciones y obligaciones internacionales."
        ]
      ],
      [
        "h",
        "Preguntas para un inmueble dominicano"
      ],
      [
        "ul",
        [
          "Confirma título, mensura, acceso legal, uso permitido y facultades del vendedor.",
          "Obtén registros y cotizaciones; no sustituyas datos por una rentabilidad regional anunciada.",
          "Verifica liquidación, beneficio aprobado del caso y plazo restante.",
          "Prueba financiamiento, cambio de moneda, mantenimiento y salida sin apreciación supuesta."
        ]
      ],
      [
        "h",
        "Las ventajas y desventajas reales"
      ],
      [
        "p",
        "Cada inmueble tiene riesgos propios de liquidez, derecho, construcción, operación y moneda. Compáralos expresamente en vez de llamar a un país inherentemente más seguro o rentable. Usa la [[guía de debida diligencia|article|dr-real-estate-safe]] para organizar las preguntas dominicanas."
      ],
      [
        "h",
        "¿Cuál deberías elegir?"
      ],
      [
        "p",
        "Elige según las pruebas de los activos que realmente puedes comprar y administrar. Compara flujo base y adverso, fondos necesarios y salida con asesores. Si faltan datos clave, resolverlos aporta más que declarar ganador a uno de los mercados."
      ],
      [
        "cta",
        {
          "label": "Modela una inversión en la RD en la calculadora de ROI",
          "page": "calculator"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Es la República Dominicana una mejor inversión que Miami?",
        "a": "Aquí no se establece un ganador universal. Compara inmuebles concretos con supuestos coherentes de adquisición, ingresos, gastos, impuestos, financiamiento y salida adecuados a tus objetivos."
      },
      {
        "q": "¿Cómo se comparan los rendimientos de alquiler?",
        "a": "Usa registros fechados y el mismo período y definición de rendimiento neto. Separa ingresos brutos, resultado operativo, financiamiento, impuestos y apreciación; aquí no se ofrece un promedio regional actual."
      },
      {
        "q": "¿Cuánto más baratas son las propiedades en la RD que en Miami?",
        "a": "No se establece un descuento nacional. Compara activos equivalentes con ventas fechadas, igual definición de superficie y gastos totales. Los anuncios solos no prueban un descuento."
      },
      {
        "q": "¿Y los impuestos sobre la propiedad?",
        "a": "Obtén una liquidación real de cada inmueble y estructura. El ejemplo 2.45% × US$485,000 = US$11,882.50 es aritmética con supuestos, no tasa verificada ni cotización de Miami. Confirma aparte la base dominicana y los beneficios aprobados."
      },
      {
        "q": "¿Cuál es la contrapartida de invertir en la RD?",
        "a": "Identifica riesgos jurídicos, físicos, operativos, cambiarios y de salida del inmueble. No presupongas servicios de título o custodia, permisos de alquiler, financiamiento ni apreciación; investiga pruebas y protecciones contractuales."
      }
    ]
  },
  "living-cabarete-sosua": {
    "catKey": "Moving",
    "catLabel": "Guía de Zonas",
    "read": "12 min",
    "reads": "—",
    "date": "2026",
    "author": "iLoveDRRealty Team",
    "role": "Guías de bienes raíces",
    "initials": "DR",
    "title": "Vivir en Cabarete y Sosúa: guía para expatriados de la costa norte (2026)",
    "lede": "Compara Cabarete y Sosúa mediante preguntas de vida e inmuebles: acceso a playa, deportes acuáticos, transporte, servicios, gastos reales y pruebas antes de alquilar o comprar.",
    "metaTitle": "Vivir en Cabarete y Sosúa — Guía para expatriados de la costa norte de la RD (2026)",
    "metaDescription": "Guía de 2026 para vivir en Cabarete y Sosúa, en la costa norte de la RD: comunidad de expatriados, costo de vida, kitesurf, acceso y mercado inmobiliario y de inversión.",
    "keywords": [
      "vivir en cabarete",
      "vivir en sosúa",
      "expatriados cabarete sosúa",
      "bienes raíces costa norte república dominicana"
    ],
    "facts": [
      [
        "Cabarete",
        "Interés en deportes acuáticos"
      ],
      [
        "Sosúa",
        "Ubicaciones de bahía y pueblo"
      ],
      [
        "Transporte",
        "Prueba el recorrido real"
      ],
      [
        "Presupuesto",
        "Compara cotizaciones actuales"
      ]
    ],
    "img": "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1200&q=80&auto=format&fit=crop",
    "body": [
      [
        "p",
        "Cabarete y Sosúa son destinos de la costa norte, en Puerto Plata, con distintos entornos de playa y pueblo. Compara direcciones en vez de afirmaciones de mejor precio nacional. Deben orientar la elección tu rutina, acceso y pruebas del inmueble."
      ],
      [
        "h",
        "Cabarete: conoce el entorno de deportes acuáticos"
      ],
      [
        "p",
        "Cabarete se asocia con surf, windsurf y kitesurf. Si te interesan, consulta instructores apropiados, revisa condiciones actuales y visita acceso e instalaciones para guardar equipo. La reputación no garantiza condiciones seguras o adecuadas todos los días; confirma eventos con su organizador."
      ],
      [
        "h",
        "Sosúa: compara ubicaciones del pueblo y la bahía"
      ],
      [
        "p",
        "Compara rutas desde la dirección en Sosúa a compras, playa y servicios necesarios. Inspecciona ruido, estacionamiento, accesibilidad, agua y energía. Describir la zona como familiar, establecida o económica no sustituye comprobar tus requisitos."
      ],
      [
        "tip",
        "Alójate cerca de las direcciones consideradas y prueba recorridos en tus horarios. Compara costo y viabilidad del transporte entre actividades y vivienda, sin depender de un trayecto fijo de diez minutos."
      ],
      [
        "h",
        "Cómo llegar e infraestructura"
      ],
      [
        "p",
        "Compara itinerarios actuales por Gregorio Luperón (POP), Santiago (STI) u otro aeropuerto adecuado y cotiza el traslado a la dirección. Confirma internet, suministros de respaldo, escuelas y requisitos médicos y de seguro con sus proveedores."
      ],
      [
        "h",
        "Costo de vida"
      ],
      [
        "p",
        "Reúne cotizaciones actuales de tu hogar y compara contratos equivalentes. Separa gastos recurrentes, depósitos, mudanza y reserva:"
      ],
      [
        "table",
        {
          "headers": [
            "Perfil o gasto",
            "Prueba del presupuesto",
            "Qué probar"
          ],
          "rows": [
            [
              "Persona sola o trabajo remoto",
              "Alquiler, internet, respaldo, comida y transporte",
              "Conexión y recorridos diarios reales"
            ],
            [
              "Pareja o jubilados",
              "Vivienda, transporte, seguros y atención médica",
              "Cobertura y servicios necesarios"
            ],
            [
              "Condominio alquilado",
              "Contrato, depósito, cuotas y facturas incluidas",
              "Plazo, temporada, moneda y restricciones"
            ]
          ]
        }
      ],
      [
        "h",
        "El mercado inmobiliario"
      ],
      [
        "p",
        "Compara precios anunciados con comparables fechados, superficie legal, estado y gastos totales. El nombre de una comunidad no establece seguridad, acceso ni valor de inversión. Verifica unidad y autorización antes de incluir beneficios; consulta la [[guía de CONFOTUR|article|confotur-explained]]."
      ],
      [
        "p",
        "Para invertir en alquiler, pide registros anuales de reservas pagadas y gastos desglosados. Separa modelos de largo y corto plazo y no supongas apreciación. El [[modelo de ROI|article|punta-cana-airbnb-roi]] organiza escenarios propios sin importar supuestos promedios de otra zona."
      ],
      [
        "cta",
        {
          "label": "Explora propiedades en la costa norte",
          "page": "search"
        }
      ],
      [
        "h",
        "Las desventajas, con honestidad"
      ],
      [
        "ol",
        [
          "Prueba vivienda y entorno en distintos horarios, incluidos ruido y acceso.",
          "Visita la ruta real al trabajo, compras y actividades, no solo el centro.",
          "Compara transporte y gastos de tu rutina antes de decidir si necesitas automóvil.",
          "Obtén revisión jurídica y técnica independiente; consulta la [[guía de debida diligencia|article|dr-real-estate-safe]]."
        ]
      ],
      [
        "h",
        "¿Es la costa norte para ti?"
      ],
      [
        "p",
        "Elige la dirección que cubra necesidades y presupuesto documentado. Al comparar regiones, aplica iguales criterios a [[Punta Cana|article|living-punta-cana]] y [[Las Terrenas|article|las-terrenas]], en vez de depender de una clasificación sin respaldo sobre precio o servicios."
      ],
      [
        "cta",
        {
          "label": "Habla con nuestro equipo",
          "page": "contact"
        }
      ]
    ],
    "faqs": [
      {
        "q": "¿Es mejor Cabarete o Sosúa para los expatriados?",
        "a": "Compara direcciones según actividades, transporte, trabajo, atención médica y presupuesto. Visita ambas y prueba la rutina sin suponer que una sea inherentemente mejor para cierto grupo."
      },
      {
        "q": "¿Cuánto cuesta vivir en la costa norte de la RD?",
        "a": "Usa cotizaciones fechadas de vivienda, suministros, transporte, comida, seguros y servicios de tu hogar. Indica plazo, inclusiones y moneda y separa depósitos y mudanza."
      },
      {
        "q": "¿Cómo se llega a Cabarete y Sosúa?",
        "a": "Consulta vuelos y cotiza traslados reales desde aeropuertos adecuados, incluidos POP o STI cuando corresponda. No presupongas tiempos fijos ni rutas estacionales."
      },
      {
        "q": "¿Cuánto cuestan las propiedades en Cabarete y Sosúa?",
        "a": "Compara anuncios y ventas realizadas fechados de propiedades equivalentes. Incluye superficie legal, estado, gastos y restricciones; esta guía no ofrece un rango actual verificado."
      },
      {
        "q": "¿Es la costa norte una buena zona para practicar kitesurf?",
        "a": "Cabarete es conocido por deportes acuáticos, pero la idoneidad depende de playa, condiciones y capacidad. Consulta instructores, pronóstico y orientación local; aquí no se garantizan viento diario ni fechas de eventos."
      }
    ]
  }
}

// ─────────────────────────────────────────────────────────────────
// Spanish card text for the blog index (featured + editor picks + grid),
// keyed by slug. Only the translated posts appear; Blog.tsx falls back
// to the English card text for everything else.
// ─────────────────────────────────────────────────────────────────
export const CARDS_ES: Record<string, { title: string; desc: string; tag?: string; read?: string; role?: string }> = {
  "can-americans-buy": {
    "title": "¿Pueden los estadounidenses comprar propiedades en la República Dominicana? (Guía 2026)",
    "desc": "Los estadounidenses generalmente pueden comprar inmuebles dominicanos sin ser residentes. Usa esta guía para organizar la revisión del título, un presupuesto escrito de cierre y las preguntas que debes resolver antes de comprometer fondos.",
    "tag": "GUÍA DEL COMPRADOR · 2026",
    "read": "14 min de lectura",
    "role": "Guías de bienes raíces"
  },
  "closing-costs-dr": {
    "title": "Costos de cierre en la República Dominicana, explicados a fondo (2026)",
    "desc": "Prepara un presupuesto escrito con impuesto de transferencia, servicios jurídicos, notaría e inscripción, un ejemplo claramente hipotético y gastos recurrentes separados."
  },
  "punta-cana-airbnb-roi": {
    "title": "Inversión de alquiler en Punta Cana: modelo práctico de ROI (2026)",
    "desc": "Construye un modelo de alquiler por inmueble con ingresos documentados, noches disponibles y gastos desglosados. Separa resultados medidos y supuestos y evalúa qué pasa si bajan las reservas."
  },
  "can-canadians-buy": {
    "title": "¿Pueden los canadienses comprar propiedades en la República Dominicana? (Guía 2026)",
    "desc": "Un comprador canadiense debe planificar dos revisiones conectadas: la operación inmobiliaria dominicana y las obligaciones fiscales y de declaración canadienses. Estos son los documentos y preguntas que conviene organizar antes de comprometer fondos."
  },
  "property-taxes-ipi": {
    "title": "Impuestos sobre la propiedad e IPI en la República Dominicana, explicados a fondo (2026)",
    "desc": "Entiende la base general del IPI para personas físicas en 2026, la exención anual, fechas de pago y un cálculo en pesos. Separa el impuesto de transferencia y cualquier beneficio aprobado para el caso."
  },
  "las-terrenas": {
    "title": "Vivir en Las Terrenas: guía para expatriados (2026)",
    "desc": "Explora Las Terrenas mediante las preguntas prácticas de una mudanza: recorridos diarios, acceso a playa, servicios, presupuesto personal y pruebas de una compra."
  },
  "best-places-to-retire": {
    "title": "Jubilarse en la República Dominicana: lugares y requisitos (2026)",
    "desc": "Compara posibles lugares de retiro según tus necesidades de atención médica, transporte, vivienda y presupuesto. Revisa los requisitos publicados para pensionados y rentistas por separado de la decisión inmobiliaria."
  },
  "dr-real-estate-safe": {
    "title": "¿Es seguro el mercado inmobiliario de la República Dominicana? Estafas que evitar (2026)",
    "desc": "Evalúa por separado riesgos legales, físicos, financieros y de seguridad personal. Esta guía organiza documentos, controles de pago y revisiones independientes antes de comprometerte con un inmueble."
  },
  "living-punta-cana": {
    "title": "Vivir en Punta Cana: guía completa para expatriados (2026)",
    "desc": "Compara comunidades de Bávaro–Punta Cana con recorridos reales, servicios, reglas de asociación y un presupuesto por inmueble. Separa la experiencia vacacional de las necesidades de vivir o invertir allí."
  },
  "confotur-explained": {
    "title": "CONFOTUR explicado: incentivos fiscales por proyecto en la RD (2026)",
    "desc": "Entiende qué acredita la clasificación de un proyecto y qué no. Revisa unidad, adquisición, autorización tributaria y período aprobado restante antes de incluir beneficios en el presupuesto."
  },
  "dr-vs-miami": {
    "title": "República Dominicana frente a Miami: argumentos para el inversor en 2026",
    "desc": "Compara inmuebles concretos de dos jurisdicciones con igual base de precio, período de alquiler, definición de gastos y preguntas de riesgo. Separa reglas tributarias, cálculos hipotéticos y promedios de mercado sin respaldo."
  },
  "living-cabarete-sosua": {
    "title": "Vivir en Cabarete y Sosúa: guía para expatriados de la costa norte (2026)",
    "desc": "Compara Cabarete y Sosúa mediante preguntas de vida e inmuebles: acceso a playa, deportes acuáticos, transporte, servicios, gastos reales y pruebas antes de alquilar o comprar."
  }
}
