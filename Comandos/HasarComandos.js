// import string
// import types
// import logging
// import unicodedata
// from ComandoInterface import ComandoInterface, ComandoException, ValidationError, FiscalPrinterError, formatText
// from ConectorDriverComando import ConectorDriverComando
// from Drivers.FiscalPrinterDriver import PrinterException

const PrinterException = require('drivers').PrinterException;

const NUMBER = 999990;
const DEFAULT_DRIVER = "Hasar";

const CMD_OPEN_FISCAL_RECEIPT = 0x40;
const CMD_OPEN_CREDIT_NOTE = 0x80;
const CMD_PRINT_TEXT_IN_FISCAL = 0x41;
const CMD_PRINT_LINE_ITEM = 0x42;
const CMD_PRINT_SUBTOTAL = 0x43;
const CMD_ADD_PAYMENT = 0x44;
const CMD_CLOSE_FISCAL_RECEIPT = 0x45;
const CMD_DAILY_CLOSE = 0x39;
const CMD_STATUS_REQUEST = 0x2a;
const CMD_CLOSE_CREDIT_NOTE = 0x81;
const CMD_CREDIT_NOTE_REFERENCE = 0x93;
const CMD_SET_CUSTOMER_DATA = 0x62;
const CMD_LAST_ITEM_DISCOUNT = 0x55;
const CMD_GENERAL_DISCOUNT = 0x54;
const CMD_OPEN_NON_FISCAL_RECEIPT = 0x48;
const CMD_PRINT_NON_FISCAL_TEXT = 0x49;
const CMD_CLOSE_NON_FISCAL_RECEIPT = 0x4a;
const CMD_CANCEL_ANY_DOCUMENT = 0x98;
const CMD_OPEN_DRAWER = 0x7b;
const CMD_SET_HEADER_TRAILER = 0x5d;

// Documentos no fiscales homologados (remitos, recibos, etc.)
const CMD_OPEN_DNFH = 0x80;
const CMD_PRINT_EMBARK_ITEM = 0x82;
const CMD_PRINT_ACCOUNT_ITEM = 0x83;
const CMD_PRINT_QUOTATION_ITEM = 0x84;
const CMD_PRINT_DNFH_INFO = 0x85;
const CMD_PRINT_RECEIPT_TEXT = 0x97;
const CMD_CLOSE_DNFH = 0x81;
const CMD_REPRINT = 0x99;

const CURRENT_DOC_TICKET = 1;
const CURRENT_DOC_BILL_TICKET = 2;
const CURRENT_DOC_NON_FISCAL = 3;
const CURRENT_DOC_CREDIT_BILL_TICKET = 4;
const CURRENT_DOC_CREDIT_TICKET = 5;
const CURRENT_DOC_DNFH = 6;

const AVAILABLE_MODELS = ["615", "715v1", "715v2", "320"];

const ADDRESS_SIZE = 40;

exports.HasarComandos = class HasarComandos extends ComandoInterface {

    constructor() {
        /* el traductor puede ser: TraductorFiscal o TraductorReceipt
         * path al modulo de traductor que este comando necesita
         */
        this.traductorModule = "Traductores.TraductorFiscal";
        this.savedPayments = null;
        this.currentDocument = null;
        this.currentDocumentType = null;

        this.textSizeDict = {
            "615": {
                'nonFiscalText': 40,
                'customerName': 30,
                'custAddressSize': 40,
                'paymentDescription': 30,
                'fiscalText': 20,
                'lineItem': 20,
                'lastItemDiscount': 20,
                'generalDiscount': 20,
                'embarkItem': 108,
                'receiptText': 106
            },
            "320": {
                'nonFiscalText': 120,
                'customerName': 50,
                'custAddressSize': 50,
                'paymentDescription': 50,
                'fiscalText': 50,
                'lineItem': 50,
                'lastItemDiscount': 50,
                'generalDiscount': 50,
                'embarkItem': 108,
                'receiptText': 106
            }
        }

        this.docTypeNames = {
            "DOC_TYPE_CUIT": "CUIT",
            "DOC_TYPE_LIBRETA_ENROLAMIENTO": 'L.E.',
            "DOC_TYPE_LIBRETA_CIVICA": 'L.C.',
            "DOC_TYPE_DNI": 'DNI',
            "DOC_TYPE_PASAPORTE": 'PASAP',
            "DOC_TYPE_CEDULA": 'CED',
            "DOC_TYPE_SIN_CALIFICADOR": 'S/C'
        }

        this.docTypes = {
            "CUIT": 'C',
            "LIBRETA_ENROLAMIENTO": '0',
            "LIBRETA_CIVICA": '1',
            "DNI": '2',
            "PASAPORTE": '3',
            "CEDULA": '4',
            "SIN_CALIFICADOR": ' '
        }

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
        }
    }

    sendCommand(commandNumber, parameters, skipStatusErrors = false) {
        try {
            commandString = "SEND|0x" + commandNumber + "|" + skipStatusErrors && "T" || "F" + "|" + parameters.toString();
            // logging.getLogger().info("sendCommand: %s" % commandString);
            console.log("sendCommand: " + commandString);
            ret = this.conector.sendCommand(commandNumber, parameters, skipStatusErrors);
            // logging.getLogger().info("reply: %s" % ret);
            console.log("reply: " + ret);
            return ret;
        } catch (e) {
			if (e instanceof PrinterException) {
				// logging.getLogger().error("PrinterException: %s" % e.toString());
                console.error("PrinterException: " + e.toString());
                throw new ComandoException("Error de la impresora fiscal: " + e.toString() + ".\nComando enviado: " + commandString);
			} else {
				console.log(e.name);
				console.log(e.message);
				console.log(e.stack);
			}
		}
    }

    openNonFiscalReceipt() {
        var status = this.sendCommand(CMD_OPEN_NON_FISCAL_RECEIPT, []);
        function checkStatusInComprobante(x) {
            let fiscalStatus = int(x, 16);
            return (fiscalStatus & (1 << 13)) == (1 << 13);
        }
        if (!checkStatusInComprobante(status[1])) {
            // No tomó el comando, el status fiscal dice que no hay comprobante abierto, intento de nuevo
            status = this.sendCommand(CMD_OPEN_NON_FISCAL_RECEIPT, []);
            if (!checkStatusInComprobante(status[1])) {
                throw new ComandoException("Error de la impresora fiscal, no acepta el comando de iniciar ", "un ticket no fiscal");
            }
        }
        this.currentDocument = CURRENT_DOC_NON_FISCAL;
        return status;
    }

    formatText(text, context) {
        sizeDict = this.textSizeDict.get(this.model);
        if (!sizeDict) {
            sizeDict = self.textSizeDict["615"];
        }
        // return formatText(text)[:sizeDict.get(context, 20)];
        return formatText(text).substring(0, sizeDict.get(context, 20) - 1);
    }

    printNonFiscalText(text) {
        return this.sendCommand(CMD_PRINT_NON_FISCAL_TEXT, [this.formatText(text, 'nonFiscalText') || " ", "0"]);
    }

    setHeaderTrailer(line, text) {
        if (text) {
            this.sendCommand(CMD_SET_HEADER_TRAILER, (line.toString(), text));
        }
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
        // for (text in (header + [String.fromCharCode(0x7f)] * 3)[:3]) {
        let headerCompleted = header + repetir(String.fromCharCode(0x7f), 3);
        // for (text in (header + repetir(String.fromCharCode(0x7f), 3)) {
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

    filtrarDigitos(cadena) {
        let salida = "";
        for (i = 0; i < cadena.length; i++) {
            if (cadena[i]! in "0123456789") {
                salida += cadena[i];
            }
        }
        return salida;
    }

    setCustomerData(name = " ", address = " ", doc = " ", docType = " ", ivaType = "T") {
        // limpio el header y trailer:
        // this.setHeader();
        // this.setTrailer();
        doc = doc.toString();
        doc = doc.replace("-", "").replace(".", "");
        // if (doc && docType != "3" && filter(lambda x: x !in string.digits, doc)) {
        if (doc && docType != "3" && filtrarDigitos(doc)) {
            // Si tiene letras se blanquea el DNI para evitar errores, excepto que sea
            // docType="3" (Pasaporte)
            doc, docType = " ", " ";
        }
        if (!doc.strip()) {
            docType = " ";
        }
        if (ivaType != "C" && (!doc || docType != "C" )) {
            throw new ValidationError("Error, si el tipo de IVA del cliente NO es consumidor final, debe ingresar su número de CUIT.");
        }
        parameters = [ this.formatText(name, 'customerName'),
                       doc || " ",
                       ivaType,   // Iva Comprador
                       docType || " " // Tipo de Doc.
                     ];
        if (this.model in ["715v1", "715v2", "320"]) {
            parameters.append(this.formatText(address, 'custAddressSize') || " "); // Domicilio
        } else {
            parameters.append(address || " ");
        }
        return this.sendCommand(CMD_SET_CUSTOMER_DATA, parameters);
    }

    openBillTicket(type, name, address, doc, docType, ivaType) {
        this.setCustomerData(name, address, doc, docType, ivaType);
        if (type == "A") {
            type = "A";
        } else {
            type = "B";
        }
        this.currentDocument = CURRENT_DOC_BILL_TICKET;
        this.savedPayments = [];
        return this.sendCommand(CMD_OPEN_FISCAL_RECEIPT, [type, "T"]);
    }

    openTicket(defaultLetter = "B") {
        if (this.model == "320") {
            this.sendCommand(CMD_OPEN_FISCAL_RECEIPT, [defaultLetter, "T"]);
        } else {
            this.sendCommand(CMD_OPEN_FISCAL_RECEIPT, ["T", "T"]);
        }
        this.currentDocument = CURRENT_DOC_TICKET;
        this.savedPayments = [];
    }

    //  NO SE PUEDE HACER
    // openCreditTicket() {
    //     this.sendCommand( this.CMD_OPEN_CREDIT_NOTE, [ "S", "T" ] );
    //     this.currentDocument = this.CURRENT_DOC_CREDIT_TICKET;
    //     this.savedPayments = [];
    // }

    openDebitNoteTicket(type, name, address, doc, docType, ivaType) {
        if (doc) {
            this.setCustomerData(name, address, doc, docType, ivaType);
        }
        if (type == "A") {
            type = "D";
        } else {
            type = "E";
        }
        this.currentDocument = CURRENT_DOC_BILL_TICKET;
        this.savedPayments = [];
        return this.sendCommand(CMD_OPEN_FISCAL_RECEIPT, [type, "T"]);
    }

    openBillCreditTicket(type, name, address, doc, docType, ivaType, reference = "NC") {
        this.setCustomerData(name, address, doc, docType, ivaType);
        if (type == "A") {
            type = "R";
        } else {
            type = "S";
        }
        reference = reference.toString();
        this.currentDocument = this.CURRENT_DOC_CREDIT_BILL_TICKET;
        this.savedPayments = [];
        this.sendCommand(CMD_CREDIT_NOTE_REFERENCE, ["1", reference]);
        this.sendCommand(CMD_OPEN_CREDIT_NOTE, [type, "T", reference]);
    }

    openRemit(name, address, doc, docType, ivaType, copies = 1) {
        this.setCustomerData(name, address, doc, docType, ivaType);
        this.currentDocument = CURRENT_DOC_DNFH;
        this.savedPayments = [];
        this.copies = copies;
        return this.sendCommand(CMD_OPEN_DNFH, ["r", "T"])
    }

    openReceipt(name, address, doc, docType, ivaType, number, copies = 1) {
        this.setCustomerData(name, address, doc, docType, ivaType);
        this.currentDocument = CURRENT_DOC_DNFH;
        this.savedPayments = [];
        this.copies = copies;
        // return this.sendCommand(CMD_OPEN_DNFH, ["x", "T", number[:20]]);
        return this.sendCommand(CMD_OPEN_DNFH, ["x", "T", number.substring(0, 19)]);
    }

    closeDocument() {
        if (this.currentDocument in (CURRENT_DOC_TICKET, CURRENT_DOC_BILL_TICKET)) {
            for (desc, payment in this.savedPayments) {
                this.sendCommand(CMD_ADD_PAYMENT, [this.formatText(desc, "paymentDescription"), payment, "T", "1"]);
            }
            // del this.savedPayments
            reply = this.sendCommand(CMD_CLOSE_FISCAL_RECEIPT);
            return reply[2];
        }
        // if (this.currentDocument in (CURRENT_DOC_NON_FISCAL, )) {
        if (this.currentDocument in (CURRENT_DOC_NON_FISCAL)) {
            return this.sendCommand(CMD_CLOSE_NON_FISCAL_RECEIPT);
        }
        if (this.currentDocument in (CURRENT_DOC_CREDIT_BILL_TICKET, CURRENT_DOC_CREDIT_TICKET)) {
            reply = this.sendCommand(CMD_CLOSE_CREDIT_NOTE);
            return reply[2];
        }
        // if (this.currentDocument in (CURRENT_DOC_DNFH, )) {
        if (this.currentDocument in (CURRENT_DOC_DNFH)) {
            reply = this.sendCommand(CMD_CLOSE_DNFH);
            // Reimprimir copias (si es necesario)
            for (copy in range(this.copies - 1)) {
                this.sendCommand(CMD_REPRINT);
            }
            return reply[2];
        }
        throw new NotImplementedError();
    }

    cancelDocument() {
        if (!hasattr("currentDocument")) {
            return;
        }
        if (this.currentDocument in (CURRENT_DOC_TICKET, CURRENT_DOC_BILL_TICKET, CURRENT_DOC_CREDIT_BILL_TICKET, CURRENT_DOC_CREDIT_TICKET)) {
            try {
                status = this.sendCommand(CMD_ADD_PAYMENT, ["Cancelar", "0.00", 'C', "1"]);
            } catch (error) {
                this.cancelAnyDocument();
                status = [];
            }
            return status;
        }
        // if (this.currentDocument in (CURRENT_DOC_NON_FISCAL, )) {
        if (this.currentDocument in (CURRENT_DOC_NON_FISCAL)) {
            this.printNonFiscalText("CANCELADO");
            return this.closeDocument();
        }
        // if (this.currentDocument in (CURRENT_DOC_DNFH, )) {
        if (this.currentDocument in (CURRENT_DOC_DNFH)) {
            this.cancelAnyDocument();
            status = [];
            return status;
        }
        throw new NotImplementedError();
    }

    addItem(description, quantity, price, iva, itemNegative=false, discount=0, discountDescription='', discountNegative=true) {
        if (type(description) in types.StringTypes) {
            description = [description];
        }
        if (itemNegative) {
            sign = 'm';
        } else {
            sign = 'M';
        }
        quantityStr = parseFloat(quantity).toString().replace(',', '.');
        priceUnit = price;
        priceUnitStr = priceUnit.toString().replace(",", ".");
        ivaStr = parseFloat(iva).toString().replace(",", ".");
        // for (d in description[:-1]) {
        for (d in description.substring(0, description.length - 2)) {
            this.sendCommand(CMD_PRINT_TEXT_IN_FISCAL, [this.formatText(d, 'fiscalText'), "0"]);
        }
        reply = this.sendCommand(CMD_PRINT_LINE_ITEM, [this.formatText(description[-1], 'lineItem'), quantityStr, priceUnitStr, ivaStr, sign, "0.0", "1", "T"]);
        if (discount) {
            if (discountNegative) {
                sign = 'm';
            } else {
                sign = 'M';
            }
            discountStr = parseFloat(discount).toString().replace(",", ".");
            this.sendCommand(CMD_LAST_ITEM_DISCOUNT, [this.formatText(discountDescription, 'discountDescription'), discountStr, sign, "1", "T"]);
        }
        return reply;
    }

    addPayment(description, payment) {
        paymentStr = ("%.2f" % Math.round(payment, 2)).replace(",", ".");
        this.savedPayments.append((description, paymentStr));
    }

    addAdditional(description, amount, iva, negative = false) {
        /* Agrega un adicional a la FC.
         *   @param description  Descripción
         *   @param amount       Importe (sin iva en FC A, sino con IVA)
         *   @param iva          Porcentaje de Iva
         *   @param negative True->Descuento, False->Recargo"""
         */
        if (negative) {
            if (!description) {
                description = "Descuento";
            }
            sign = 'm';
        } else {
            if (!description) {
                description = "Recargo";
            }
            sign = 'M';
        }
        priceUnit = amount;
        priceUnitStr = priceUnit.toString().replace(",", ".");
        reply = this.sendCommand(CMD_GENERAL_DISCOUNT, [this.formatText(description, 'generalDiscount'), priceUnitStr, sign, "1", "T"]);
        return reply;
    }

    addRemitItem(description, quantity) {
        quantityStr = parseFloat(quantity).toString().replace(',', '.');
        return this.sendCommand(CMD_PRINT_EMBARK_ITEM, [this.formatText(description, 'embarkItem'), quantityStr, "1"]);
    }

    addReceiptDetail(descriptions, amount) {
        // Acumula el importe (no imprime)
        sign = 'M';
        quantityStr = parseFloat(1).toString().replace(',', '.');
        priceUnitStr = amount.toString().replace(",", ".");
        ivaStr = parseFloat(0).toString().replace(",", ".");
        reply = this.sendCommand(CMD_PRINT_LINE_ITEM, ["Total", quantityStr, priceUnitStr, ivaStr, sign, "0.0", "1", "T"]);
        // Imprimir textos        
        // for (d in descriptions[:9]) {
        for (d in descriptions.substring(0, 8)) {
            // hasta nueve lineas
            reply = this.sendCommand(CMD_PRINT_RECEIPT_TEXT, [this.formatText(d, 'receiptText')]);
        }
        return reply;
    }

    openDrawer() {
        if (!this.model in ("320", "615")) {
            this.sendCommand(CMD_OPEN_DRAWER, []);
        }
    }

    dailyClose(type) {
        reply = this.sendCommand(CMD_DAILY_CLOSE, [type]);
        datos = [
            "status_impresora",
            "status_fiscal",
            "zeta_numero",
            "cant_doc_fiscales_cancelados",
            "cant_doc_nofiscales_homologados",
            "cant_doc_nofiscales",
            "cant_doc_fiscales",
            "RESERVADO_SIEMPRE_CERO",
            "ultimo_doc_b",
            "ultimo_doc_a",
            "monto_ventas_doc_fiscal",
            "monto_iva_doc_fiscal",
            "monto_imp_internos",
            "monto_percepciones",
            "monto_iva_no_inscripto",
            "ultima_nc_b",
            "ultima_nc_a",
            "monto_credito_nc",
            "monto_iva_nc",
            "monto_imp_internos_nc",
            "monto_percepciones_nc",
            "monto_iva_no_inscripto_nc",
            "ultimo_remito",
            "cant_nc_canceladas",
            "cant_doc_fiscales_bc_emitidos",
            "cant_doc_fiscales_a_emitidos",
            "cant_nc_bc_emitidos",
            "cant_nc_a_fiscales_a_emitidos"
        ];
        rta = {};
        for (i, val in enumerate(datos)) {
            if (reply.length > i) {
                rta[val] = reply[i];
            } else {
                break;
            }
        }
        return rta;
    }

    getLastNumber(letter) {
        reply = this.sendCommand(CMD_STATUS_REQUEST, [], true);
        if (reply.length < 3) {
            // La respuesta no es válida. Vuelvo a hacer el pedido y
            // si hay algún error que se reporte como excepción
            reply = this.sendCommand(CMD_STATUS_REQUEST, [], false);
        }
        if (letter == "A") {
            return parseInt(reply[4]);
        } else {
            return parseInt(reply[2]);
        }
    }

    getLastCreditNoteNumber(letter) {
        reply = this.sendCommand(CMD_STATUS_REQUEST, [], true);
        if (reply.length < 3) {
            // La respuesta no es válida. Vuelvo a hacer el pedido y
            // si hay algún error que se reporte como excepción
            reply = this.sendCommand(CMD_STATUS_REQUEST, [], false);
        }
        if (letter == "A") {
            return parseInt(reply[7]);
        } else {
            return parseInt(reply[6]);
        }
    }

    getLastRemitNumber() {
        reply = this.sendCommand(CMD_STATUS_REQUEST, [], true);
        if (reply.length < 3) {
            // La respuesta no es válida. Vuelvo a hacer el pedido y si
            // hay algún error que se reporte como excepción
            reply = this.sendCommand(CMD_STATUS_REQUEST, [], false);
        }
        return parseInt(reply[8]);
    }

    cancelAnyDocument() {
        try {
            this.sendCommand(CMD_CANCEL_ANY_DOCUMENT);
            // return true;
        } catch (error) {
            console.log("Error al enviar al comando CMD_CANCEL_ANY_DOCUMENT");
        }
        try {
            this.sendCommand(CMD_ADD_PAYMENT, ["Cancelar", "0.00", 'C', '1']);
            return true;
        } catch (error) {
            console.log("Error al enviar al comando CMD_ADD_PAYMENT");
        }
        try {
            this.sendCommand(CMD_CLOSE_NON_FISCAL_RECEIPT);
            return true;
        } catch (error) {
            console.log("Error al enviar al comando CMD_CLOSE_NON_FISCAL_RECEIPT");
        }
        try {
            console.log("Cerrando comprobante con CLOSE");
            // logging.getLogger().info("Cerrando comprobante con CLOSE");
            this.sendCommand(CMD_CLOSE_FISCAL_RECEIPT);
            return true;
        } catch (error) {
            console.log("Error al enviar al comando CMD_CLOSE_FISCAL_RECEIPT");
        }
        return false;
    }

    getWarnings() {
        ret = [];
        reply = this.sendCommand(CMD_STATUS_REQUEST, [], true);
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