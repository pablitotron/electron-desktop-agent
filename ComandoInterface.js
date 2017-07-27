// import ConectorDriverComando
// import unicodedata
// import importlib
// import logging
// import string
// import types
// from array import array

exports.ValidationError = class ValidationError extends Error {

}

exports.FiscalPrinterError = class FiscalPrinterError extends Error {

}

exports.ComandoException = class ComandoException extends RuntimeError {

}

const DEFAULT_DRIVER = null;

const NON_FISCAL_TEXT_MAX_LENGTH = 40 // Redefinir

function valid_utf8_bytes(s) {
    if (isinstance(s, unicode)) {
        s = s.encode('utf-8');
    }
    bytearray = array('B', s);
    return str_skip_bytes(s, invalid_utf8_indexes(bytearray));
}

function str_skip_bytes(s, dels) {
    if (!dels) {
        return s;
    }
    // return ''.join(c for i, c in enumerate(s) if i ! in dels);
    return filtrar(s, dels).join("");

    function filtrar(s, dels) {
        let filtrados = new List();
        for (i = 0; i < s.length; i++) {
            if (s[i]! in dels) {
                filtrados.addItem(s[i]);
            }
        }
        return filtrados;
    }
}

function invalid_utf8_indexes(bytes) {
    skips = [];
    i = 0;
    len_bytes = bytes.length;
    while (i < len_bytes) {
        c1 = bytes[i];
        if (c1 < 0x80) {
            // U+0000 - U+007F - 7 bits
            i += 1;
            continue;
        }
        try {
            c2 = bytes[i + 1];
            if (((c1 & 0xE0 == 0xC0) && (c2 & 0xC0 == 0x80))) {
                // U+0080 - U+07FF - 11 bits
                c = (((c1 & 0x1F) << 6) | (c2 & 0x3F));
                if (c < 0x80) {
                    // Overlong encoding
                    skips.extend([i, i + 1]);
                }
                i += 2;
                continue;
            }
            c3 = bytes[i + 2];
            if ((c1 & 0xF0 == 0xE0) && (c2 & 0xC0 == 0x80) && (c3 & 0xC0 == 0x80)) {
                // U+0800 - U+FFFF - 16 bits
                c = (((((c1 & 0x0F) << 6) | (c2 & 0x3F)) << 6) | (c3 & 0x3f));
                if ((c < 0x800) || (0xD800 <= c <= 0xDFFF)) {
                    // Overlong encoding or surrogate.
                    skips.extend([i, i + 1, i + 2]);
                }
                i += 3;
                continue;
            }
            c4 = bytes[i + 3];
            if ((c1 & 0xF8 == 0xF0) && (c2 & 0xC0 == 0x80) && (c3 & 0xC0 == 0x80) && (c4 & 0xC0 == 0x80)) {
                // U+10000 - U+10FFFF - 21 bits
                c = (((((((c1 & 0x0F) << 6) | (c2 & 0x3F)) << 6) | (c3 & 0x3F)) << 6) | (c4 & 0x3F));
                if ((c < 0x10000) || (c > 0x10FFFF)) {
                    // Overlong encoding or invalid code point.
                    skips.extend([i, i + 1, i + 2, i + 3]);
                }
                i += 4;
                continue;
            }
        } catch (indexError) {
            console.log("Error de indexado");
        }
        skips.append(i);
        i += 1;
    }
    return skips;
}

function formatText(text) {
    text = valid_utf8_bytes(text);
    text = text.replace('á', 'a');
    text = text.replace('é', 'e');
    text = text.replace('í', 'i');
    text = text.replace('ó', 'o');
    text = text.replace('ú', 'u');
    text = text.replace('Á', 'A');
    text = text.replace('É', 'E');
    text = text.replace('Í', 'I');
    text = text.replace('Ó', 'O');
    text = text.replace('Ú', 'U');
    text = text.replace('Ä', 'A');
    text = text.replace('Ë', 'E');
    text = text.replace('Ï', 'I');
    text = text.replace('Ö', 'O');
    text = text.replace('Ü', 'U');
    text = text.replace('ä', 'a');
    text = text.replace('ë', 'e');
    text = text.replace('ï', 'i');
    text = text.replace('ö', 'o');
    text = text.replace('ü', 'u');
    text = text.replace('ñ', 'n');
    text = text.replace('Ñ', 'N');
    text = text.replace('\\', ' ');
    text = text.replace('\'', ' ');
    text = text.replace('º', ' ');
    text = text.replace('"', ' ');
    text = text.replace('|', ' ');
    text = text.replace('¿', ' ');
    text = text.replace('¡', ' ');
    text = text.replace('ª', ' ');
    return text;
}

exports.ComandoInterface = class ComandoInterface {
    // Interfaz que deben cumplir las impresoras fiscales.

    constructor() {
        this.docTypeNames = {
            "DOC_TYPE_CUIT": "CUIT",
            "DOC_TYPE_LIBRETA_ENROLAMIENTO": 'L.E.',
            "DOC_TYPE_LIBRETA_CIVICA": 'L.C.',
            "DOC_TYPE_DNI": 'DNI',
            "DOC_TYPE_PASAPORTE": 'PASAP',
            "DOC_TYPE_CEDULA": 'CED',
            "DOC_TYPE_SIN_CALIFICADOR": 'S/C'
        };

        this.docTypes = {
            "CUIT": 'C',
            "LIBRETA_ENROLAMIENTO": '0',
            "LIBRETA_CIVICA": '1',
            "DNI": '2',
            "PASAPORTE": '3',
            "CEDULA": '4',
            "SIN_CALIFICADOR": ' '
        };

        this.ivaTypes = {
            "RESPONSABLE_INSCRIPTO": 'I',
            "RESPONSABLE_NO_INSCRIPTO": 'N',
            "EXENTO": 'E',
            "NO_RESPONSABLE": 'A',
            "CONSUMIDOR_FINAL": 'C',
            "RESPONSABLE_NO_INSCRIPTO_BIENES_DE_USO": 'B',
            "RESPONSABLE_MONOTRIBUTO": 'M',
            "MONOTRIBUTISTA_SOCIAL": 'S',
            "PEQUENIO_CONTRIBUYENTE_EVENTUAL": 'V',
            "PEQUENIO_CONTRIBUYENTE_EVENTUAL_SOCIAL": 'W',
            "NO_CATEGORIZADO": 'T'
        };
    }

    // args puede ser una lista, kwargs es un mapa
    init(args, kwargs) {
        this.model = kwargs.pop("modelo", null);
        driver = kwargs.pop("driver", DEFAULT_DRIVER);
        if (driver) {
            try {
                this.conector = ConectorDriverComando.ConectorDriverComando(driver, kwargs);
            } catch (error) {
                // logging.info("No se pudo conectar con el driver: " + driver);
                console.info("No se pudo conectar con el driver: " + driver);
                this.conector = null;
            }
        }
        traductorModule = importlib.import_module(this.traductorModule);
        // traductorClass = getattr(traductorModule, this.traductorModule[12:]);
        traductorClass = getattr(traductorModule, this.traductorModule.substring(12));
        this.traductor = traductorClass(args);
    }

    sendCommand(commandNumber, parameters, skipStatusErrors = false) {
        console.log("sendCommand", commandNumber, parameters);
        try {
            // logging.getLogger().info("sendCommand: SEND|0x%x|%s|%s" % (commandNumber, skipStatusErrors && "T" || "F", str(parameters)));
            console.log("sendCommand: SEND|0x" + commandNumber + "|" + skipStatusErrors && "T" || "F" + "|" + parameters.toString());
            return this.conector.sendCommand(commandNumber, parameters, skipStatusErrors);
        } catch (e) {
            if (e instanceof ComandoException) {
                console.error("epsonFiscalDriver.ComandoException: " + e.toString());
                throw new ComandoException("Error de la impresora fiscal: " + e.toString());
            } else {
                console.log(e.name);
                console.log(e.message);
                console.log(e.stack);
            }
        }
    }

    close() {
        // Cierra la impresora
        this.conector.close();
    }

    // Documentos no fiscales

    openNonFiscalReceipt() {
        // Abre documento no fiscal
        throw new NotImplementedError();
    }


    printNonFiscalText(text) {
        // Imprime texto fiscal. Si supera el límite de la linea se trunca.
        throw new NotImplementedError();
    }

    closeDocument() {
        // Cierra el documento que esté abierto
        throw new NotImplementedError();
    }

    cancelDocument() {
        // Cancela el documento que esté abierto
        throw new NotImplementedError();
    }

    addItem(description, quantity, price, iva, discount, discountDescription, negative = false) {
        /* Agrega un item a la FC.
            @param description          Descripción del item. Puede ser un string o una lista.
                Si es una lista cada valor va en una línea.
            @param quantity             Cantidad
            @param price                Precio (incluye el iva si la FC es B o C, si es A no lo incluye)
            @param iva                  Porcentaje de iva
            @param negative             True->Resta de la FC
            @param discount             Importe de descuento
            @param discountDescription  Descripción del descuento
            */
        throw new NotImplementedError();
    }

    addPayment(description, payment) {
        /*Agrega un pago a la FC.
            @param description  Descripción
            @param payment      Importe
        */

        throw new NotImplementedError();
    }

    // Ticket fiscal (siempre es a consumidor final, no permite datos del cliente)

    openTicket() {
        // Abre documento fiscal
        throw new NotImplementedError();
    }

    openBillTicket(type, name, address, doc, docType, ivaType) {
        /* Abre un ticket-factura
            @param  type        Tipo de Factura "A", "B", o "C"
            @param  name        Nombre del cliente
            @param  address     Domicilio
            @param  doc         Documento del cliente según docType
            @param  docType     Tipo de documento
            @param  ivaType     Tipo de IVA
        */
        throw new NotImplementedError();
    }

    openBillCreditTicket(type, name, address, doc, docType, ivaType, reference = "NC") {
        /* Abre un ticket-NC
            @param  type        Tipo de Factura "A", "B", o "C"
            @param  name        Nombre del cliente
            @param  address     Domicilio
            @param  doc         Documento del cliente según docType
            @param  docType     Tipo de documento
            @param  ivaType     Tipo de IVA
            @param  reference
        */
        throw new NotImplementedError();
    }

    openDebitNoteTicket(type, name, address, doc, docType, ivaType) {
        /* Abre una Nota de Débito
            @param  type        Tipo de Factura "A", "B", o "C"
            @param  name        Nombre del cliente
            @param  address     Domicilio
            @param  doc         Documento del cliente según docType
            @param  docType     Tipo de documento
            @param  ivaType     Tipo de IVA
            @param  reference
        */
        throw new NotImplementedError();
    }

    openRemit(name, address, doc, docType, ivaType) {
        /* Abre un remito
            @param  name        Nombre del cliente
            @param  address     Domicilio
            @param  doc         Documento del cliente según docType
            @param  docType     Tipo de documento
            @param  ivaType     Tipo de IVA
        */
        throw new NotImplementedError();
    }

    openReceipt(name, address, doc, docType, ivaType, number) {
        /* Abre un recibo
            @param  name        Nombre del cliente
            @param  address     Domicilio
            @param  doc         Documento del cliente según docType
            @param  docType     Tipo de documento
            @param  ivaType     Tipo de IVA
            @param  number      Número de identificación del recibo (arbitrario)
        */
        throw new NotImplementedError();
    }

    addRemitItem(description, quantity) {
        /* Agrega un item al remito
            @param description  Descripción
            @param quantity     Cantidad
        */
        throw new NotImplementedError();
    }

    addReceiptDetail(descriptions, amount) {
        /* Agrega el detalle del recibo
            @param descriptions Lista de descripciones (lineas)
            @param amount       Importe total del recibo
        */
        throw new NotImplementedError();
    }

    addAdditional(description, amount, iva, negative = false) {
        /* Agrega un adicional a la FC.
            @param description  Descripción
            @param amount       Importe (sin iva en FC A, sino con IVA)
            @param iva          Porcentaje de Iva
            @param negative True->Descuento, False->Recargo
        */
        throw new NotImplementedError();
    }

    getLastNumber(letter) {
        /* Obtiene el último número de FC*/
        throw new NotImplementedError();
    }

    getLastCreditNoteNumber(letter) {
        /* Obtiene el último número de FC */
        throw new NotImplementedError();
    }

    getLastRemitNumber() {
        /* Obtiene el último número de Remtio */
        throw new NotImplementedError();
    }

    cancelAnyDocument() {
        /* Cancela cualquier documento abierto, sea del tipo que sea.
           No requiere que previamente se haya abierto el documento por este objeto.
           Se usa para destrabar la impresora.
           */
        throw new NotImplementedError();
    }

    dailyClose(type) {
        /* Cierre Z (diario) o X (parcial)
            @param type     Z (diario), X (parcial)
        */
        throw new NotImplementedError();
    }

    getWarnings() {
        return [];
    }

    openDrawer() {
        /* Abrir cajón del dinero - No es mandatory implementarlo
        */
    }

}