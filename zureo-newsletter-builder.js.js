const input = $input.first().json;
const body = input.body?.content || [];
const imagenesDoc = input.inlineObjects || {};

// --- 1. CONFIGURACIÓN ---
const imgInicio = "https://drive.google.com/thumbnail?id=1LNBozepwA3oQhbWZgoygU5p0R74_7lDV&sz=w1000";
const imgCierre = "https://drive.google.com/thumbnail?id=1vtcoZyVxnG-aXvmbY9IuanVWyw3JLqT0&sz=w1000";

const caratulas = {
    lite: "https://drive.google.com/thumbnail?id=1VXngSuNsLOisb9SxsxOuWYWZ1yM6fkeM&sz=w1000",
    go:   "https://drive.google.com/thumbnail?id=17ZrbJgekCq4tCrVeu5rUyljuneNpLw4G&sz=w1000",
    pdv:  "https://drive.google.com/thumbnail?id=1vaFI877zHe6xEUtOeqpNCursUszWCRUI&sz=w1000",
    au:   "https://drive.google.com/thumbnail?id=1Qt5UaL4CAi5t0z_JY-Q69NYMW-ErJW2t&sz=w1000",
    on:   "https://drive.google.com/thumbnail?id=1GTXg7Jgg4h8DSpJRRCtd0SVzftSmd_C-&sz=w1000"
};

const colores = {
    lite: "#EF7D00",
    go: "#701655",
    on: "#0099BC",
    pdv: "#3d8f1a",
    au: "#0099BC",
    defecto: "#444"
};

// Ajustes de layout para estimar altura con más precisión.
// Si luego quieres afinar aún más, normalmente solo tocarías bodyWidthMm y finalSafetyMm.
const LAYOUT = {
    bodyWidthMm: 170,              // ancho útil aproximado del contenido
    listBulletWidthMm: 8,          // ancho reservado para la viñeta
    newsletterPaddingMm: pxToMm(80), // el comentario del CSS decía 80px
    blockSpacingMm: pxToMm(60),      // el comentario del CSS decía 60px
    blankSpaceMm: pxToMm(15),        // el div inline tiene 15px
    imageGapMm: pxToMm(18),          // margen visual aproximado por imagen
    paragraphGapMm: pxToMm(8),       // separación visual entre bloques de texto
    finalSafetyMm: 15                // margen de seguridad final pequeño, no 300
};

let htmlFinal = "";
let ultimoSistema = "";
let bufferBloque = "";
let bloqueAbierto = false;
let sistemasRenderizados = [];
let newsletterAbierto = false;
let primerSistemaDetectado = false;

// --- CALCULADORA DE ALTURA (MM) ---
// 2 carátulas fijas: inicio + cierre
let alturaTotalMm = 297 * 2;

function pxToMm(px) {
    return px * 0.2645833333;
}

function ptToMm(pt) {
    return pt * 0.3527777778;
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function htmlATextoPlano(texto) {
    return String(texto || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/&nbsp;/gi, " ")
        .replace(/<[^>]*>/g, "")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
}

function estimarAlturaTextoMm(texto, opciones = {}) {
    const {
        fontSizePx = 16,
        lineHeight = 1.45,
        maxWidthMm = LAYOUT.bodyWidthMm,
        charWidthFactor = 0.52,
        extraBottomMm = 0
    } = opciones;

    const limpio = htmlATextoPlano(texto);
    if (!limpio) return 0;

    const lineasTexto = limpio.split("\n").filter(x => x.trim().length > 0);
    if (!lineasTexto.length) return 0;

    const fontSizeMm = pxToMm(fontSizePx);
    const avgCharWidthMm = fontSizeMm * charWidthFactor;
    const lineHeightMm = fontSizeMm * lineHeight;

    let totalLineas = 0;

    lineasTexto.forEach(linea => {
        const longitud = linea.trim().length || 1;
        const lineasEstimadas = Math.max(1, Math.ceil((longitud * avgCharWidthMm) / maxWidthMm));
        totalLineas += lineasEstimadas;
    });

    const separacionEntreParrafosMm = Math.max(0, lineasTexto.length - 1) * pxToMm(4);

    return (totalLineas * lineHeightMm) + separacionEntreParrafosMm + extraBottomMm;
}

function abrirNewsletter() {
    if (!newsletterAbierto) {
        htmlFinal += `<div class="newsletter-body">`;
        newsletterAbierto = true;
        alturaTotalMm += LAYOUT.newsletterPaddingMm;
    }
}

function cerrarNewsletter() {
    if (newsletterAbierto) {
        cerrarBloqueSiExiste();
        htmlFinal += `</div>`;
        newsletterAbierto = false;
        alturaTotalMm += LAYOUT.newsletterPaddingMm;
    }
}

function cerrarBloqueSiExiste() {
    if (bloqueAbierto) {
        if (bufferBloque.replace(/\s/g, "").length > 0) {
            htmlFinal += `<div class="item-release">${bufferBloque}</div>`;
            alturaTotalMm += LAYOUT.blockSpacingMm;
        }
        bufferBloque = "";
        bloqueAbierto = false;
    }
}

const patronesABorrar = [
    /https?:\/\/trello\.com\/[^\s]+/gi,
    /Trello:?/gi,
    /\bMARI\b/gi,
    /\bEVE\b/gi,
    /\bJOACO\b/gi,
    /#/g
];

function limpiarTextoGeneral(texto) {
    let t = texto;
    patronesABorrar.forEach(p => t = t.replace(p, ""));
    t = t.replace(/\u000b/g, "<br>");
    t = t.replace(/\u00A0/g, " ");
    return t.replace(/\*\*/g, "");
}

let fBeta = "11-03-2026", fProd = "25-03-2026";
body.forEach(el => {
    if (!el.paragraph) return;
    const txt = el.paragraph.elements.map(e => e.textRun?.content || "").join("");
    if (txt.includes("Fecha Beta:")) fBeta = txt.split("Fecha Beta:")[1].trim();
    if (txt.includes("Fecha Prod:")) fProd = txt.split("Fecha Prod:")[1].trim();
});

// --- INICIO ---
htmlFinal += `<div class="caratula-full"><img src="${imgInicio}"></div>`;

// --- PROCESAMIENTO ---
body.forEach(elemento => {
    if (!elemento.paragraph) return;

    const textoRaw = elemento.paragraph.elements.map(e => e.textRun?.content || "").join("");

    // --- DETECCIÓN DE PÁRRAFOS VACÍOS ---
    const tieneImagen = elemento.paragraph.elements.some(e => e.inlineObjectElement);

    if (!tieneImagen && (textoRaw === "\n" || (!textoRaw.trim() && textoRaw.includes("\n")))) {
        if (primerSistemaDetectado) {
            const espacioHtml = `<div class="espacio-blanco" style="height: 15px;"></div>`;
            if (bloqueAbierto) bufferBloque += espacioHtml;
            else htmlFinal += espacioHtml;
            alturaTotalMm += LAYOUT.blankSpaceMm;
        }
        return;
    }

    const estiloDoc = elemento.paragraph.paragraphStyle?.namedStyleType || "";
    const upper = textoRaw.toUpperCase().trim();

    // A. SISTEMAS
    let sistemaEncontrado = "";
    if (["HEADING_1", "HEADING_2"].includes(estiloDoc) || textoRaw.startsWith("#")) {
        if (upper.includes("LITE")) sistemaEncontrado = "lite";
        else if (upper.includes("GO")) sistemaEncontrado = "go";
        else if (upper.includes("PUNTO DE VENTA")) sistemaEncontrado = "pdv";
        else if (upper.includes("AU")) sistemaEncontrado = "au";
        else if (/\bON\b/.test(upper) || upper.includes("ZUREO ON")) sistemaEncontrado = "on";
    }

    // Si detecto sistema, siempre consumo ese párrafo.
    if (sistemaEncontrado) {
        primerSistemaDetectado = true;

        if (sistemaEncontrado !== ultimoSistema) {
            cerrarNewsletter();
            ultimoSistema = sistemaEncontrado;

            const color = colores[ultimoSistema] || colores.defecto;
            const imgUrl = caratulas[ultimoSistema];

            if (imgUrl && !sistemasRenderizados.includes(ultimoSistema)) {
                htmlFinal += `<div class="caratula-full"><img src="${imgUrl}"></div>`;
                sistemasRenderizados.push(ultimoSistema);
                alturaTotalMm += 297;
            }

            abrirNewsletter();
            htmlFinal += `
                <div class="header-sistema" style="border-bottom: 3px solid ${color};">
                    <h1 style="color:${color}">ZUREO ${ultimoSistema.toUpperCase()}</h1>
                    <p class="fechas-header">Beta: ${fBeta} | Producción: ${fProd}</p>
                </div>`;

            alturaTotalMm +=
                estimarAlturaTextoMm(`ZUREO ${ultimoSistema.toUpperCase()}`, {
                    fontSizePx: 30,
                    lineHeight: 1.1,
                    maxWidthMm: LAYOUT.bodyWidthMm,
                    charWidthFactor: 0.56
                }) +
                estimarAlturaTextoMm(`Beta: ${fBeta} | Producción: ${fProd}`, {
                    fontSizePx: 13,
                    lineHeight: 1.2,
                    maxWidthMm: LAYOUT.bodyWidthMm,
                    charWidthFactor: 0.52
                }) +
                pxToMm(18) + ptToMm(3);
        }

        return;
    }

    if (!primerSistemaDetectado) return;

    // Detectar "Funcionalidad:" a nivel de párrafo completo
    const textoParrafoLimpio = limpiarTextoGeneral(textoRaw).replace(/\n/g, "").trim();
    const colorActualParrafo = colores[ultimoSistema] || colores.defecto;
    const regexFuncParrafo = /^Funcionalidad\s*:?\s*/i;

    if (regexFuncParrafo.test(textoParrafoLimpio)) {
        cerrarBloqueSiExiste();
        bloqueAbierto = true;

        const nombreFuncionalidad = textoParrafoLimpio.replace(regexFuncParrafo, "").trim();

        if (nombreFuncionalidad) {
            bufferBloque += `<h2 class="titulo-funcionalidad" style="color:${colorActualParrafo}">${nombreFuncionalidad}</h2>`;
            alturaTotalMm += estimarAlturaTextoMm(nombreFuncionalidad, {
                fontSizePx: 24,
                lineHeight: 1.2,
                maxWidthMm: LAYOUT.bodyWidthMm,
                charWidthFactor: 0.55,
                extraBottomMm: pxToMm(10)
            });
        }

        return;
    }

    // B. SECCIONES (Subtítulos)
    if (estiloDoc === "HEADING_3" || textoRaw.includes("###")) {
        let t = textoRaw.replace(/###/g, "").trim();
        t = limpiarTextoGeneral(t).trim();
        t = toTitleCase(t);

        if (t) {
            if (!bloqueAbierto) bloqueAbierto = true;
            bufferBloque += `<h3 class="subtitulo-tipo">¡${t}!</h3>`;
            alturaTotalMm += estimarAlturaTextoMm(`¡${t}!`, {
                fontSizePx: 28,
                lineHeight: 1.12,
                maxWidthMm: LAYOUT.bodyWidthMm,
                charWidthFactor: 0.57,
                extraBottomMm: pxToMm(8)
            });
        }
        return;
    }

    // C. CONTENIDO
    const esLista = !!elemento.paragraph.bullet;

    let textosAcumulados = "";
    let imagenesAcumuladas = "";
    let esDetalle = false;

    elemento.paragraph.elements.forEach(el => {
        // PROCESAMIENTO DE IMÁGENES
        if (el.inlineObjectElement) {
            const id = el.inlineObjectElement.inlineObjectId;
            if (imagenesDoc[id]) {
                const embeddedObj = imagenesDoc[id].inlineObjectProperties.embeddedObject;
                const imgProps = embeddedObj.imageProperties;
                const url = imgProps.contentUri;
                const crop = imgProps.cropProperties || {};
                const size = embeddedObj.size || {};
                const cropT = crop.offsetTop || 0;
                const cropL = crop.offsetLeft || 0;
                const cropB = crop.offsetBottom || 0;
                const cropR = crop.offsetRight || 0;
                const isCropped = (cropT + cropL + cropB + cropR) > 0.001;

                if (!bloqueAbierto) bloqueAbierto = true;

                let alturaImgMm = 20;
                if (size.height && size.height.magnitude) {
                    alturaImgMm = ptToMm(size.height.magnitude);
                }

                if (isCropped) {
                    const visFracY = 1 - cropT - cropB;
                    alturaImgMm = alturaImgMm * visFracY;
                }

                alturaTotalMm += (alturaImgMm + LAYOUT.imageGapMm);

                if (isCropped && size.width && size.height) {
                    const dispW = size.width.magnitude;
                    const dispH = size.height.magnitude;
                    const visFracX = 1 - cropL - cropR;
                    const visFracY = 1 - cropT - cropB;
                    const bgSizeX = (visFracX > 0 ? 1 / visFracX : 1) * 100;
                    const bgSizeY = (visFracY > 0 ? 1 / visFracY : 1) * 100;
                    const hSpace = cropL + cropR;
                    const vSpace = cropT + cropB;
                    const posX = hSpace > 0 ? (cropL / hSpace) * 100 : 0;
                    const posY = vSpace > 0 ? (cropT / vSpace) * 100 : 0;

                    imagenesAcumuladas += `
                    <div class="img-doc-container cropped">
                        <div class="img-crop-canvas" style="
                            width: 100%;
                            max-width: ${dispW}pt;
                            aspect-ratio: ${dispW} / ${dispH};
                            background-image: url('${url}');
                            background-size: ${bgSizeX}% ${bgSizeY}%;
                            background-position: ${posX}% ${posY}%;
                        "></div>
                    </div>`;
                } else {
                    imagenesAcumuladas += `<div class="img-doc-container standard"><img src="${url}"></div>`;
                }
            }
        }

        // PROCESAMIENTO DE TEXTOS
        if (el.textRun) {
            let t = el.textRun.content;
            t = limpiarTextoGeneral(t);

            t = t.replace(/^ +/g, match => "&nbsp;".repeat(match.length));
            t = t.replace(/ +$/g, match => "&nbsp;".repeat(match.length));

            const esNegrita = el.textRun.textStyle?.bold;
            const regexDet = /^[\s*]*\*?Detalle\s*:?\*?\s*[\s*]*/i;

            if (regexDet.test(t)) {
                esDetalle = true;
                let v = t.replace(regexDet, "").trim();
                if (v) textosAcumulados += esNegrita ? `<strong>${v}</strong>` : v;
            } else {
                if (t.length > 0) {
                    textosAcumulados += esNegrita ? `<strong>${t}</strong>` : t;
                }
            }
        }
    });

    if (textosAcumulados.trim() || imagenesAcumuladas.trim()) {
        const colorActual = colores[ultimoSistema] || colores.defecto;
        let itemHtml = "";

        if (textosAcumulados.trim()) {
            let textoFormateado = textosAcumulados;
            if (esDetalle) textoFormateado = `<span class="det-txt">${textoFormateado}</span>`;

            if (esLista) {
                itemHtml += `
                <div class="bloque-item lista" style="display: flex; align-items: baseline;">
                    <span class="bullet" style="color:${colorActual}; margin-right: 8px;">•</span>
                    <div style="flex: 1;">${textoFormateado.trim()}</div>
                </div>`;

                alturaTotalMm += estimarAlturaTextoMm(textoFormateado, {
                    fontSizePx: 16,
                    lineHeight: 1.45,
                    maxWidthMm: LAYOUT.bodyWidthMm - LAYOUT.listBulletWidthMm,
                    charWidthFactor: 0.52,
                    extraBottomMm: pxToMm(4)
                });
            } else {
                itemHtml += `<div class="bloque-item">${textoFormateado}</div>`;

                alturaTotalMm += estimarAlturaTextoMm(textoFormateado, {
                    fontSizePx: 16,
                    lineHeight: 1.45,
                    maxWidthMm: LAYOUT.bodyWidthMm,
                    charWidthFactor: 0.52,
                    extraBottomMm: pxToMm(4)
                });
            }
        }

        if (imagenesAcumuladas) itemHtml += imagenesAcumuladas;

        if (bloqueAbierto) {
            bufferBloque += itemHtml;
        } else {
            if (!newsletterAbierto && sistemaEncontrado === "") abrirNewsletter();
            htmlFinal += itemHtml;
        }
    }
});

cerrarNewsletter();
htmlFinal += `<div class="caratula-full"><img src="${imgCierre}"></div>`;

// Margen de seguridad final pequeño
const alturaFinal = Math.ceil(alturaTotalMm + LAYOUT.finalSafetyMm) + "mm";

return [{ json: { htmlFinal, alturaFinal } }];