// import string
// import types
// import logging
// from ComandoInterface import ComandoInterface, ComandoException, ValidationError, FiscalPrinterError, formatText
// from ConectorDriverComando import ConectorDriverComando
// from Drivers.FiscalPrinterDriver import PrinterException

exports.FiscalPrinterError = class FiscalPrinterError extends Error {

}

const DEFAULT_DRIVER = "Epson";

const DEBUG = true;

const CMD_OPEN_FISCAL_RECEIPT = 0x40;
const CMD_OPEN_BILL_TICKET = 0x60;
// const CMD_PRINT_TEXT_IN_FISCAL = (0x41, 0x61);
const CMD_PRINT_TEXT_IN_FISCAL = 0x41;
const CMD_PRINT_LINE_ITEM = (0x42, 0x62);
const CMD_PRINT_SUBTOTAL = (0x43, 0x63);
const CMD_ADD_PAYMENT = (0x44, 0x64);
const CMD_CLOSE_FISCAL_RECEIPT = (0x45, 0x65);
const CMD_DAILY_CLOSE = 0x39;
const CMD_STATUS_REQUEST = 0x2a;
const CMD_OPEN_DRAWER = 0x7b;
const CMD_SET_HEADER_TRAILER = 0x5d;
const CMD_OPEN_NON_FISCAL_RECEIPT = 0x48;
const CMD_PRINT_NON_FISCAL_TEXT = 0x49;
const CMD_CLOSE_NON_FISCAL_RECEIPT = 0x4a;

const CURRENT_DOC_TICKET = 1;
const CURRENT_DOC_BILL_TICKET = 2;
const CURRENT_DOC_CREDIT_TICKET = 4;
const CURRENT_DOC_NON_FISCAL = 3;

const ADDRESS_SIZE = 30;

exports.EpsonComandos = class EpsonComandos extends ComandoInterface {

    constructor() {
        /* el traductor puede ser: TraductorFiscal o TraductorReceipt
         * path al modulo de traductor que este comando necesita
         */
        this.traductorModule = "Traductores.TraductorFiscal";
        this.currentDocument = null;
        this.currentDocumentType = null;

        this.models = ["tickeadoras", "epsonlx300+", "tm-220-af"];

        this.ivaTypes = {
            "RESPONSABLE_INSCRIPTO": 'I',
            "RESPONSABLE_NO_INSCRIPTO": 'R',
            "EXENTO": 'E',
            "NO_RESPONSABLE": 'N',
            "CONSUMIDOR_FINAL": 'F',
            "RESPONSABLE_NO_INSCRIPTO_BIENES_DE_USO": 'R',
            "RESPONSABLE_MONOTRIBUTO": 'M',
            "MONOTRIBUTISTA_SOCIAL": 'M',
            "PEQUENIO_CONTRIBUYENTE_EVENTUAL": 'F',
            "PEQUENIO_CONTRIBUYENTE_EVENTUAL_SOCIAL": 'F',
            "NO_CATEGORIZADO": 'F'
        };
    }

    sendCommand(commandNumber, parameters, skipStatusErrors = false) {
        console.log("sendCommand - commandNumber: " + commandNumber + " - parameters: " + parameters);
        try {
            // logging.getLogger().info("sendCommand: SEND|0x"+ commandNumber +"|"+ skipStatusErrors && "T" || "F" +"|" + parameters.toString());
            console.log("sendCommand: SEND|0x" + commandNumber + "|" + skipStatusErrors && "T" || "F" + "|" + parameters.toString());
            return this.conector.sendCommand(commandNumber, parameters, skipStatusErrors);
        } catch (e) {
            if (e instanceof PrinterException) {
                // logging.getLogger().error("PrinterException: %s" % str(e));
                console.error("PrinterException: " + e.toString());
                throw new ComandoException("Error de la impresora fiscal: " + e.toString());
            } else {
                console.log(e.name);
                console.log(e.message);
                console.log(e.stack);
            }
        }
    }

    openNonFiscalReceipt() {
        let status = this.sendCommand(CMD_OPEN_NON_FISCAL_RECEIPT, []);
        this.currentDocument = CURRENT_DOC_NON_FISCAL;
        this.currentDocumentType = null;
        return status;
    }

    printNonFiscalText(text) {
        // return this.sendCommand(CMD_PRINT_NON_FISCAL_TEXT, [formatText(text[:40] || " ")]);
        return this.sendCommand(CMD_PRINT_NON_FISCAL_TEXT, [formatText(text.substring(0, 39) || " ")]);
    }

    setHeaderTrailer(line, text) {
        this.sendCommand(CMD_SET_HEADER_TRAILER, (line.toString(), text));
    }

    repetir(texto, cantidad) {
        let salida = texto;
        for (i = 0; i < cantidad; i++) {
            salida += texto;
        }
        return salida;
    }

    setHeader(header = null) {
        // "Establecer encabezados"
        if (!header) {
            header = [];
        }
        line = 3;
        // Agrego chr(0x7f) (DEL) al final para limpiar las líneas no utilizadas
        let headerCompleted = header + repetir(String.fromCharCode(0x7f), 3);
        // for (text in (header + [String.fromCharCode(0x7f)] * 3)[:3]) {
        for (text in headerCompleted.substring(0, 2)) {
            this.setHeaderTrailer(line, text);
            line += 1;
        }
    }

    setTrailer(trailer = null) {
        // "Establecer pie"
        if (!trailer) {
            trailer = [];
        }
        line = 11;
        let trailerCompleted = trailer + repetir(String.fromCharCode(0x7f), 9);
        // for (text in (trailer + [String.fromCharCode(0x7f)] * 9)[:9]) {
        for (text in trailer + trailerCompleted.substring(0, 8)) {
            this.setHeaderTrailer(line, text);
            line += 1;
        }
    }

    openBillCreditTicket(type, name, address, doc, docType, ivaType, reference = "NC") {
        return this.openBillCreditTicket(type, name, address, doc, docType, ivaType, isCreditNote = null);
    }

    openBillTicket(type, name, address, doc, docType, ivaType) {
        return this.openBillCreditTicket(type, name, address, doc, docType, ivaType, isCreditNote = false);
    }

    filtrarDigitos(cadena) {
        let salida = "";
        for (i = 0; i < cadena.length; i++) {
            if (cadena[i]! in "0123456789-.") {
                salida += cadena[i];
            }
        }
        return salida;
    }

    openBillCreditTicket(type, name, address, doc, docType, ivaType, isCreditNote, reference = null) {
        // Definir una funcion filtro que reemplace esta linea.
        // que hace el operador \ en Python??
        // if (!doc || filter(lambda x: x !in string.digits + "-.", doc || "") || ! \ docType in this.docTypeNames) {
        if (!doc || filtrarDigitos(doc || "") || !docType in this.docTypeNames) {
            doc = "";
            docType = "";
        } else {
            doc = doc.replace("-", "").replace(".", "");
            docType = this.docTypeNames[docType];
        }
        this.type = type;
        if (this.model == "epsonlx300+") {
            parameters = [isCreditNote && "N" || "F", // Por ahora no soporto ND, que sería "D".
                "C",
                type, // Tipo de FC (A/B/C).
                "1", // Copias - Ignorado.
                "P", // "P" la impresora imprime la lineas(hoja en blanco) o "F" preimpreso.
                "17", // Tamaño Carac - Ignorado.
                "I", // Responsabilidad en el modo entrenamiento - Ignorado.
            this.ivaTypes.get(ivaType, "F"), // Iva Comprador.
            // formatText(name[:40]), // Nombre.
            formatText(name.substring(0, 39)), // Nombre.
            // formatText(name[40:80]), // Segunda parte del nombre - Ignorado.
            formatText(name.substring(40, 79)), // Segunda parte del nombre - Ignorado.
            formatText(docType) || (isCreditNote && "-" || ""), // Tipo de Doc. - Si es NC obligado pongo algo.
            doc || (isCreditNote && "-" || ""), // Nro Doc - Si es NC obligado pongo algo.
                "N", // No imprime leyenda de BIENES DE USO.
            // formatText(address[:ADDRESS_SIZE] || "-"), // Domicilio.
            formatText(address.substring(0, ADDRESS_SIZE - 1) || "-"), // Domicilio.
            // formatText(address[ADDRESS_SIZE:ADDRESS_SIZE * 2]), // Domicilio 2da linea.
            formatText(address.substring(ADDRESS_SIZE, (ADDRESS_SIZE * 2) - 1)), // Domicilio 2da linea.
            // formatText(address[ADDRESS_SIZE * 2:ADDRESS_SIZE * 3]), // Domicilio 3ra linea.
            formatText(address.substring(ADDRESS_SIZE * 2, (ADDRESS_SIZE * 3) - 1)), // Domicilio 3ra linea.
            (isCreditNote || this.ivaTypes.get(ivaType, "F") != "F") && "-" || "",
                // Remito primera linea - Es obligatorio si el cliente no es consumidor final.
                "", // Remito segunda linea.
                "C" // No somos una farmacia.
            ];
        } else {
            parameters = [isCreditNote && "M" || "T", // Ticket NC o Factura.
                "C", // Tipo de Salida - Ignorado.
                type, // Tipo de FC (A/B/C).
                "1", // Copias - Ignorado.
                "P", // Tipo de Hoja - Ignorado.
                "17", // Tamaño Carac - Ignorado.
                "E", // Responsabilidad en el modo entrenamiento - Ignorado.
            this.ivaTypes.get(ivaType, "F"), // Iva Comprador.
            // formatText(name[:40]), // Nombre.
            formatText(name.substring(0, 39)), // Nombre.
            // formatText(name[40:80]), // Segunda parte del nombre - Ignorado.
            formatText(name.substring(40, 79)), // Segunda parte del nombre - Ignorado.
            formatText(docType) || (isCreditNote && "-" || ""), // Tipo de Doc. - Si es NC obligado pongo algo.
            doc || (isCreditNote && "-" || ""), // Nro Doc - Si es NC obligado pongo algo.
                "N", // No imprime leyenda de BIENES DE USO.
            // formatText(address[:this.ADDRESS_SIZE] || "-"), // Domicilio.
            formatText(address.substring(0, ADDRESS_SIZE - 1) || "-"), // Domicilio.
            // formatText(address[ADDRESS_SIZE:ADDRESS_SIZE * 2]), // Domicilio 2da linea.
            formatText(address.substring(ADDRESS_SIZE, (ADDRESS_SIZE * 2) - 1)), // Domicilio 2da linea.
            // formatText(address[ADDRESS_SIZE * 2:ADDRESS_SIZE * 3]), // Domicilio 3ra linea.
            formatText(address.substring(ADDRESS_SIZE * 2, (ADDRESS_SIZE * 3) - 1)), // Domicilio 3ra linea.
            (isCreditNote || this.ivaTypes.get(ivaType, "F") != "F") && "-" || "",
                // Remito primera linea - Es obligatorio si el cliente no es consumidor final.
                "", // Remito segunda linea.
                "C" // No somos una farmacia.
            ];
        }
        if (isCreditNote) {
            this.currentDocument = CURRENT_DOC_CREDIT_TICKET;
        } else {
            this.currentDocument = CURRENT_DOC_BILL_TICKET;
        }
        // guardo el tipo de FC (A/B/C).
        this.currentDocumentType = type;
        return this.sendCommand(CMD_OPEN_BILL_TICKET, parameters);
    }

    getCommandIndex() {
        if (this.currentDocument == CURRENT_DOC_TICKET) {
            return 0;
        } else if (this.currentDocument in (CURRENT_DOC_BILL_TICKET, CURRENT_DOC_CREDIT_TICKET)) {
            return 1;
        } else if (this.currentDocument == CURRENT_DOC_NON_FISCAL) {
            return 2;
        }
        throw new Error("Invalid currentDocument");
    }

    openTicket(defaultLetter = 'B') {
        if (this.model == "epsonlx300+") {
            return this.openBillTicket(defaultLetter, "CONSUMIDOR FINAL", "", null, null, IVA_TYPE_CONSUMIDOR_FINAL);
        } else {
            this.sendCommand(CMD_OPEN_FISCAL_RECEIPT, ["C"]);
            this.currentDocument = CURRENT_DOC_TICKET;
        }
    }

    openDrawer() {
        this.sendCommand(CMD_OPEN_DRAWER, []);
    }

    closeDocument() {
        if (this.currentDocument == CURRENT_DOC_TICKET) {
            reply = this.sendCommand(CMD_CLOSE_FISCAL_RECEIPT[this.getCommandIndex()], ["T"]);
            return reply[2];
        }
        if (this.currentDocument == CURRENT_DOC_BILL_TICKET) {
            reply = this.sendCommand(CMD_CLOSE_FISCAL_RECEIPT[this.getCommandIndex()], [this.model == "epsonlx300+" && "F" || "T", this.type, "FINAL"]);
            // del this.type;
            return reply[2];
        }
        if (this.currentDocument == CURRENT_DOC_CREDIT_TICKET) {
            reply = this.sendCommand(CMD_CLOSE_FISCAL_RECEIPT[this.getCommandIndex()], [this.model == "epsonlx300+" && "N" || "M", this.type, "FINAL"]);
            // del this.type;
            return reply[2];
        }
        // if (this.currentDocument in (CURRENT_DOC_NON_FISCAL, )) {
        if (this.currentDocument in (CURRENT_DOC_NON_FISCAL)) {
            return this.sendCommand(CMD_CLOSE_NON_FISCAL_RECEIPT, ["T"]);
        }
        throw new Error(NotImplementedError);
    }

    cancelDocument() {
        if (this.currentDocument in (CURRENT_DOC_TICKET, CURRENT_DOC_BILL_TICKET, CURRENT_DOC_CREDIT_TICKET)) {
            status = this.sendCommand(CMD_ADD_PAYMENT[this.getCommandIndex()], ["Cancelar", "0", 'C']);
            return status;
        }
        if (this.currentDocument in (CURRENT_DOC_NON_FISCAL, null)) {
            this.printNonFiscalText("CANCELADO");
            return this.closeDocument();
        }
        throw new Error(NotImplementedError);
    }

    addItem(description, quantity, price, iva, discount, discountDescription, negative = false) {
        if (type(description) in types.StringTypes) {
            description = [description];
        }
        if (negative) {
            sign = 'R';
        } else {
            sign = 'M';
        }
        quantityStr = parseInt(quantity * 1000).toString();
        if (this.model == "epsonlx300+") {
            bultosStr = parseInt(quantity).toString();
        } else {
            // bultosStr = "0" * 5;  // No se usa en TM220AF ni TM300AF ni TMU220AF;
            bultosStr = "00000";
        }
        if (this.currentDocumentType != 'A') {
            // enviar con el iva incluido
            priceUnitStr = parseInt(Math.round(price * 100, 0)).toString();
        } else {
            if (this.model == "tm-220-af") {
                // enviar sin el iva (factura A)
                priceUnitStr = "%0.4f" % (price / ((100.0 + iva) / 100.0));
            } else {
                // enviar sin el iva (factura A)
                priceUnitStr = parseInt(Math.round((price / ((100 + iva) / 100)) * 100, 0)).toString();
            }
        }
        ivaStr = parseInt(iva * 100).toString();
        extraparams = this.currentDocument in (CURRENT_DOC_BILL_TICKET, CURRENT_DOC_CREDIT_TICKET) && ["", "", ""] || [];
        if (this.getCommandIndex() == 0) {
            // Va del primero hasta el penúltimo.
            // for (d in description[:-1]) {
            for (d in description.substring(0, description.length - 2)) {
                // this.sendCommand(this.CMD_PRINT_TEXT_IN_FISCAL, [formatText(d)[:20]]);
                this.sendCommand(CMD_PRINT_TEXT_IN_FISCAL, [formatText(d).substring(0, 19)]);
            }
        }
        // reply = this.sendCommand(CMD_PRINT_LINE_ITEM[this.getCommandIndex()], [formatText(description[-1][:20]), quantityStr, priceUnitStr, ivaStr, sign, bultosStr, "0" * 8] + extraparams);
        reply = this.sendCommand(CMD_PRINT_LINE_ITEM[this.getCommandIndex()], [formatText(ultimoCaracter(description).substring(0, 19)), quantityStr, priceUnitStr, ivaStr, sign, bultosStr, "00000000"] + extraparams);
        if (discount) {
            discountStr = parseInt(discount * 100).toString();
            // this.sendCommand(this.CMD_PRINT_LINE_ITEM[this.getCommandIndex()], [formatText(discountDescription[:20]), "1000", discountStr, ivaStr, 'R', "0", "0"] + extraparams);
            this.sendCommand(CMD_PRINT_LINE_ITEM[this.getCommandIndex()], [formatText(discountDescription.substring(0, 19)), "1000", discountStr, ivaStr, 'R', "0", "0"] + extraparams);
        }
        return reply;
    }

    ultimoCaracter(texto) {
        return texto.charAt(texto.length - 1);
    }

    addPayment(description, payment) {
        paymentStr = parseInt(payment * 100).toString();
        // status = this.sendCommand(CMD_ADD_PAYMENT[this.getCommandIndex()], [formatText(description)[:20], paymentStr, 'T']);
        status = this.sendCommand(CMD_ADD_PAYMENT[this.getCommandIndex()], [formatText(description).substring(0, 19), paymentStr, 'T']);
        return status;
    }

    addAdditional(description, amount, iva, negative = false) {
        /* Agrega un adicional a la FC.
        *    @param description  Descripción
        *    @param amount       Importe (sin iva en FC A, sino con IVA)
        *    @param iva          Porcentaje de Iva
        *    @param negative True->Descuento, False->Recargo
        */
        if (negative) {
            if (!description) {
                description = "Descuento";
            }
            sign = 'R';
        } else {
            if (!description) {
                description = "Recargo";
            }
            sign = 'M';
        }
        quantityStr = "1000";
        bultosStr = "0";
        priceUnit = amount;
        if (this.currentDocumentType != 'A') {
            // enviar con el iva incluido
            priceUnitStr = parseInt(Math.round(priceUnit * 100, 0)).toString();
        } else {
            // enviar sin el iva (factura A)
            priceUnitStr = parseInt(Math.round((priceUnit / ((100 + iva) / 100)) * 100, 0)).toString();
        }
        ivaStr = parseInt(iva * 100).toString();
        extraparams = this.currentDocument in (CURRENT_DOC_BILL_TICKET, CURRENT_DOC_CREDIT_TICKET) && ["", "", ""] || [];
        // reply = this.sendCommand(CMD_PRINT_LINE_ITEM[this.getCommandIndex()], [formatText(description[:20]), quantityStr, priceUnitStr, ivaStr, sign, bultosStr, "0"] + extraparams);
        reply = this.sendCommand(CMD_PRINT_LINE_ITEM[this.getCommandIndex()], [formatText(description.substring(0, 19)), quantityStr, priceUnitStr, ivaStr, sign, bultosStr, "0"] + extraparams);
        return reply;
    }

    dailyClose(type) {
        reply = this.sendCommand(CMD_DAILY_CLOSE, [type, "P"]);
        // return reply[2:];
        return reply.substring(2);
    }

    getLastNumber(letter) {
        reply = this.sendCommand(CMD_STATUS_REQUEST, ["A"], true);
        if (reply.length < 3) {
            // La respuesta no es válida. Vuelvo a hacer el pedido y si hay algún error que se reporte como excepción.
            reply = this.sendCommand(CMD_STATUS_REQUEST, ["A"], false);
        }
        if (letter == "A") {
            return parseInt(reply[6]);
        } else {
            return parseInt(reply[4]);
        }
    }

    getLastCreditNoteNumber(letter) {
        reply = this.sendCommand(CMD_STATUS_REQUEST, ["A"], true);
        if (reply.length < 3) {
            // La respuesta no es válida. Vuelvo a hacer el pedido y si hay algún error que se reporte como excepción.
            reply = this.sendCommand(CMD_STATUS_REQUEST, ["A"], false);
        }
        if (letter == "A") {
            return parseInt(reply[10]);
        } else {
            return parseInt(reply[11]);
        }
    }

    cancelAnyDocument() {
        try {
            this.sendCommand(CMD_ADD_PAYMENT[0], ["Cancelar", "0", 'C']);
            return true;
        } catch (error) {
            console.log("Error al enviar el comando ADD_PAYMENT");
        }
        try {
            this.sendCommand(CMD_ADD_PAYMENT[1], ["Cancelar", "0", 'C']);
            return true;
        } catch (error) {
            console.log("Error al enviar el comando ADD_PAYMENT");
        }
        try {
            this.sendCommand(CMD_CLOSE_NON_FISCAL_RECEIPT, ["T"]);
            return true;
        } catch (error) {
            console.log("Error al enviar el comando CLOSE_NON_FISCAL_RECEIPT");
        }
        return false;
    }

    getWarnings() {
        ret = [];
        reply = this.sendCommand(CMD_STATUS_REQUEST, ["N"], true);
        printerStatus = reply[0];
        x = parseInt(printerStatus, 16);
        if (((1 << 4) & x) == (1 << 4)) {
            ret.append("Poco papel para la cinta de auditoria");
        }
        if (((1 << 5) & x) == (1 << 5)) {
            ret.append("Poco papel para comprobantes o tickets");
        }
        return ret;
    }

    del() {
        try {
            this.close();
        } catch (error) {
            console.log("Error");
        }
    }

}