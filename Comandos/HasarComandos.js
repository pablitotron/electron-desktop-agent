// import string
// import types
// import logging
// import unicodedata
// from ComandoInterface import ComandoInterface, ComandoException, ValidationError, FiscalPrinterError, formatText
// from ConectorDriverComando import ConectorDriverComando
// from Drivers.FiscalPrinterDriver import PrinterException


const NUMBER = 999990;


exports.HasarComandos = class HasarComandos extends ComandoInterface {
    /* el traductor puede ser: TraductorFiscal o TraductorReceipt
    * path al modulo de traductor que este comando necesita
    */
    traductorModule="Traductores.TraductorFiscal";

    const DEFAULT_DRIVER="Hasar";
    
    savedPayments= null;
    currentDocument = null;
    currentDocumentType = null;

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

    textSizeDict = {
        "615": {'nonFiscalText': 40,
                 'customerName': 30,
                 'custAddressSize': 40,
                 'paymentDescription': 30,
                 'fiscalText': 20,
                 'lineItem': 20,
                 'lastItemDiscount': 20,
                 'generalDiscount': 20,
                 'embarkItem': 108,
                 'receiptText': 106,
                },
        "320": {'nonFiscalText': 120,
                  'customerName': 50,
                  'custAddressSize': 50,
                  'paymentDescription': 50,
                  'fiscalText': 50,
                  'lineItem': 50,
                  'lastItemDiscount': 50,
                  'generalDiscount': 50,
                  'embarkItem': 108,
                 'receiptText': 106,
                },
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
                'receiptText': 106,
                }
        }


    docTypeNames = {
        "DOC_TYPE_CUIT": "CUIT",
        "DOC_TYPE_LIBRETA_ENROLAMIENTO": 'L.E.',
        "DOC_TYPE_LIBRETA_CIVICA": 'L.C.',
        "DOC_TYPE_DNI": 'DNI',
        "DOC_TYPE_PASAPORTE": 'PASAP',
        "DOC_TYPE_CEDULA": 'CED',
        "DOC_TYPE_SIN_CALIFICADOR": 'S/C'
    }

    docTypes = {
        "CUIT": 'C',
        "LIBRETA_ENROLAMIENTO": '0',
        "LIBRETA_CIVICA": '1',
        "DNI": '2',
        "PASAPORTE": '3',
        "CEDULA": '4',
        "SIN_CALIFICADOR": ' ',
    }

    ivaTypes = {
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
        "NO_CATEGORIZADO": 'T',
    }

    sendCommand(commandNumber, parameters, skipStatusErrors=false) {
        try {
            commandString = "SEND|0x%x|%s|%s" % (commandNumber, skipStatusErrors and "T" or "F", str(parameters));
            logging.getLogger().info("sendCommand: %s" % commandString);       
            ret = this.conector.sendCommand(commandNumber, parameters, skipStatusErrors);
            logging.getLogger().info("reply: %s" % ret);
            return ret;
        } catch (PrinterException) {
            logging.getLogger().error("PrinterException: %s" % str(e));
            throw new ComandoException("Error de la impresora fiscal: %s.\nComando enviado: %s" % \ (str(e), commandString));
        }
    }

    openNonFiscalReceipt() {
        status = this.sendCommand(this.CMD_OPEN_NON_FISCAL_RECEIPT, []);
        checkStatusInComprobante(x) {
            fiscalStatus = int(x, 16);
            return (fiscalStatus & (1 << 13)) == (1 << 13);
        }
        if (!checkStatusInComprobante(status[1])) {
            // No tomó el comando, el status fiscal dice que no hay comprobante abierto, intento de nuevo
            status = this.sendCommand(this.CMD_OPEN_NON_FISCAL_RECEIPT, []);
            if (!checkStatusInComprobante(status[1])) {
                throw new ComandoException("Error de la impresora fiscal, no acepta el comando de iniciar ", "un ticket no fiscal");
            }
        }
        this.currentDocument = this.CURRENT_DOC_NON_FISCAL;
        return status;
    }

    formatText(text, context) {
        sizeDict = this.textSizeDict.get(this.model);
        if (!sizeDict) {
            sizeDict = self.textSizeDict["615"];
        }            
        return formatText(text)[:sizeDict.get(context, 20)];
    }

    printNonFiscalText(text) {
        return this.sendCommand(this.CMD_PRINT_NON_FISCAL_TEXT, [this.formatText(text, 'nonFiscalText') or " ", "0"]);
    }

    const ADDRESS_SIZE = 40;

    setHeaderTrailer(line, text) {
        if (text) {
            this.sendCommand(this.CMD_SET_HEADER_TRAILER, (str(line), text));
        }
    }

    setHeader(header=null) {
        // "Establecer encabezados"
        if (!header) {
            header = [];
        }
        line = 3;
        // Agrego chr(0x7f) (DEL) al final para limpiar las líneas no utilizadas
        for (text in (header + [chr(0x7f)]*3)[:3]) {
            this.setHeaderTrailer(line, text);
            line += 1;
        }
    }

    setTrailer(trailer=null) {
        // "Establecer pie"
        if (!trailer) {
            trailer = [];
        }            
        line = 11;
        for (text in (trailer + [chr(0x7f)] * 9)[:9]) {
            this.setHeaderTrailer(line, text);
            line += 1;
        }
    }

    setCustomerData(name=" ", address=" ", doc=" ", docType=" ", ivaType="T") {
        // limpio el header y trailer:
        // this.setHeader();
        // this.setTrailer();
        doc = str(doc);
        doc = doc.replace("-", "").replace(".", "");
        if doc && docType != "3" && filter(lambda x: x not in string.digits, doc) {
            // Si tiene letras se blanquea el DNI para evitar errores, excepto que sea
            // docType="3" (Pasaporte)
            doc, docType = " ", " ";
        }
        if (!doc.strip()) {
            docType = " ";
        }
        if (ivaType != "C" && (not doc or docType != "C" )) {
            throw new ValidationError("Error, si el tipo de IVA del cliente NO es consumidor final, debe ingresar su número de CUIT.");
        }
        parameters = [this.formatText(name, 'customerName'),
                       doc or " ",
                       ivaType,   // Iva Comprador
                       docType or " ", // Tipo de Doc.
                       address or " ",
                       ]
        if (this.model in ["715v1", "715v2", "320"]) {
            parameters.append(this.formatText(address, 'custAddressSize') or " "); // Domicilio
        }
        return this.sendCommand(this.CMD_SET_CUSTOMER_DATA, parameters);
    }

    openBillTicket(type, name, address, doc, docType, ivaType) {
        this.setCustomerData(name, address, doc, docType, ivaType);
        if (type == "A") {
            type = "A";
        } else {
            type = "B";
        }
        this.currentDocument = this.CURRENT_DOC_BILL_TICKET;
        this.savedPayments = [];
        return this.sendCommand(this.CMD_OPEN_FISCAL_RECEIPT, [type, "T"]);
    }

    openTicket(defaultLetter="B") {
        if (this.model == "320") {
            this.sendCommand(this.CMD_OPEN_FISCAL_RECEIPT, [defaultLetter, "T"]);
        } else {
            this.sendCommand(this.CMD_OPEN_FISCAL_RECEIPT, ["T", "T"]);
        }
        this.currentDocument = this.CURRENT_DOC_TICKET;
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
        this.currentDocument = this.CURRENT_DOC_BILL_TICKET;
        this.savedPayments = [];
        return this.sendCommand(this.CMD_OPEN_FISCAL_RECEIPT, [type, "T"]);
    }

    openBillCreditTicket(type, name, address, doc, docType, ivaType, reference="NC") {
        this.setCustomerData(name, address, doc, docType, ivaType);
        if (type == "A") {
            type = "R";
        } else {
            type = "S";
        }
        reference = str(reference);
        this.currentDocument = this.CURRENT_DOC_CREDIT_BILL_TICKET;
        this.savedPayments = [];
        this.sendCommand(this.CMD_CREDIT_NOTE_REFERENCE, ["1", reference]);
        this.sendCommand(this.CMD_OPEN_CREDIT_NOTE, [type, "T", reference]);
    }        

    openRemit(name, address, doc, docType, ivaType, copies=1) {
        this.setCustomerData(name, address, doc, docType, ivaType);
        this.currentDocument = this.CURRENT_DOC_DNFH;
        this.savedPayments = [];
        this.copies = copies;
        return this.sendCommand(this.CMD_OPEN_DNFH, ["r", "T"])
    }

    openReceipt(name, address, doc, docType, ivaType, number, copies=1) {
        this.setCustomerData(name, address, doc, docType, ivaType);
        this.currentDocument = this.CURRENT_DOC_DNFH;
        this.savedPayments = [];
        this.copies = copies;
        return this.sendCommand(this.CMD_OPEN_DNFH, ["x", "T", number[:20]]);
    }

    closeDocument() {
        if (this.currentDocument in (this.CURRENT_DOC_TICKET, this.CURRENT_DOC_BILL_TICKET)) {
            for (desc, payment in this.savedPayments) {
                this._sendCommand(this.CMD_ADD_PAYMENT, [this._formatText(desc, "paymentDescription"), payment, "T", "1"]);
            }
            // del this.savedPayments
            reply = this.sendCommand(this.CMD_CLOSE_FISCAL_RECEIPT);
            return reply[2];
        }            
        if (this.currentDocument in (this.CURRENT_DOC_NON_FISCAL, )) {
            return this.sendCommand(this.CMD_CLOSE_NON_FISCAL_RECEIPT);
        }            
        if (this.currentDocument in (this.CURRENT_DOC_CREDIT_BILL_TICKET, this.CURRENT_DOC_CREDIT_TICKET)) {
            reply = this._sendCommand(this.CMD_CLOSE_CREDIT_NOTE);
            return reply[2];
        }            
        if (this.currentDocument in (this.CURRENT_DOC_DNFH, )) {
            reply = this._sendCommand(this.CMD_CLOSE_DNFH);
            // Reimprimir copias (si es necesario)
            for (copy in range(self._copies - 1)) {
                self._sendCommand(self.CMD_REPRINT);
            }                
            return reply[2];
        }
        throw new NotImplementedError();
    }

    cancelDocument() {
        if (!hasattr("_currentDocument")) {
            return;
        }
        if (this.currentDocument in (this.CURRENT_DOC_TICKET, this.CURRENT_DOC_BILL_TICKET, this.CURRENT_DOC_CREDIT_BILL_TICKET, this.CURRENT_DOC_CREDIT_TICKET)) {
            try {
                status = this.sendCommand(this.CMD_ADD_PAYMENT, ["Cancelar", "0.00", 'C', "1"]);
            } catch (error) {
                this.cancelAnyDocument();
                status = [];
            }
            return status;
        }
        if (this.currentDocument in (this.CURRENT_DOC_NON_FISCAL, )) {
            this.printNonFiscalText("CANCELADO");
            return this.closeDocument();
        }
        if (this.currentDocument in (this.CURRENT_DOC_DNFH, )) {
            this.cancelAnyDocument();
            status = [];
            return status;
        }
        throw new NotImplementedError();
    }

    addItem(description, quantity, price, iva, discount=0, discountDescription='', negative=false) {
        if (type(description) in types.StringTypes) {
            description = [description];
        }
        if (negative) {
            sign = 'm';
        } else {
            sign = 'M';
        }
        quantityStr = str(float(quantity)).replace(',', '.');
        priceUnit = price;
        priceUnitStr = str(priceUnit).replace(",", ".");
        ivaStr = str(float(iva)).replace(",", ".");
        for (d in description[:-1]) {
            this.sendCommand(this.CMD_PRINT_TEXT_IN_FISCAL, [this.formatText(d, 'fiscalText'), "0"]);
        }
        reply = this.sendCommand(this.CMD_PRINT_LINE_ITEM, [this.formatText(description[-1], 'lineItem'), quantityStr, priceUnitStr, ivaStr, sign, "0.0", "1", "T"]);
        if (discount) {
            discountStr = str(float(discount)).replace(",", ".");
            this.sendCommand(this.CMD_LAST_ITEM_DISCOUNT, [this.formatText(discountDescription, 'discountDescription'), discountStr, "m", "1", "T"]);
        }
        return reply;
    }

    addPayment(description, payment) {
        paymentStr = ("%.2f" % round(payment, 2)).replace(",", ".");
        this.savedPayments.append((description, paymentStr));
    }

    addAdditional(description, amount, iva, negative=false) {
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
        priceUnitStr = str(priceUnit).replace(",", ".");
        reply = this.sendCommand(this.CMD_GENERAL_DISCOUNT, [this.formatText(description, 'generalDiscount'), priceUnitStr, sign, "1", "T"]);
        return reply;
    }

    addRemitItem(description, quantity) {
        quantityStr = str(float(quantity)).replace(',', '.');
        return this.sendCommand(this.CMD_PRINT_EMBARK_ITEM, [this.formatText(description, 'embarkItem'), quantityStr, "1"]);
    }

    addReceiptDetail(descriptions, amount) {
        // Acumula el importe (no imprime)
        sign = 'M';
        quantityStr = str(float(1)).replace(',', '.');
        priceUnitStr = str(amount).replace(",", ".");
        ivaStr = str(float(0)).replace(",", ".");
            reply = this.sendCommand(this.CMD_PRINT_LINE_ITEM, ["Total", quantityStr, priceUnitStr, ivaStr, sign, "0.0", "1", "T"]);
        // Imprimir textos        
        for (d in descriptions[:9]) {
            // hasta nueve lineas
            reply = this.sendCommand(this.CMD_PRINT_RECEIPT_TEXT, [this.formatText(d, 'receiptText')]);
        }
        return reply;
    }

    openDrawer() {
        if (!this.model in ("320", "615")) {
            this.sendCommand(this.CMD_OPEN_DRAWER, []):
        }
    }

    dailyClose(type) {
        reply = self._sendCommand(self.CMD_DAILY_CLOSE, [type]);        
        datos =  [
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
             ]
        rta = {};
        for (i, val in enumerate(datos)) {
            if (len(reply) > i) {
                rta[val] = reply[i];
            } else {
                break;
            }
        }
        return rta;
    }

    getLastNumber(letter) {
        reply = this.sendCommand(this.CMD_STATUS_REQUEST, [], true);
        if (len(reply) < 3) {
            // La respuesta no es válida. Vuelvo a hacer el pedido y
            // si hay algún error que se reporte como excepción
            reply = this.sendCommand(this.CMD_STATUS_REQUEST, [], false);
        }
        if (letter == "A") {
            return int(reply[4]);
        } else {
            return int(reply[2]);
        }
    }

    getLastCreditNoteNumber(letter) {
        reply = this.sendCommand(this.CMD_STATUS_REQUEST, [], true);
        if (len(reply) < 3) {
            // La respuesta no es válida. Vuelvo a hacer el pedido y
            // si hay algún error que se reporte como excepción
            reply = this.sendCommand(this.CMD_STATUS_REQUEST, [], false);
        }
        if (letter == "A") {
            return int(reply[7]);
        } else {
            return int(reply[6]);
        }
    }

    getLastRemitNumber() {
        reply = this.sendCommand(this.CMD_STATUS_REQUEST, [], true);
        if (len(reply) < 3) {
            // La respuesta no es válida. Vuelvo a hacer el pedido y si
            // hay algún error que se reporte como excepción
            reply = this.sendCommand(this.CMD_STATUS_REQUEST, [], false);
        }
        return int(reply[8]);
    }

    cancelAnyDocument() {
        try {
            this.sendCommand(this.CMD_CANCEL_ANY_DOCUMENT);
            // return true;
        } catch (error) {
            console.log("Error al enviar al comando CMD_CANCEL_ANY_DOCUMENT");
        }
        try {
            this.sendCommand(this.CMD_ADD_PAYMENT, ["Cancelar", "0.00", 'C', '1']);
            return true;
        } catch (error) {
            console.log("Error al enviar al comando CMD_ADD_PAYMENT");
        }
        try {
            this.sendCommand(this.CMD_CLOSE_NON_FISCAL_RECEIPT);
            return true;
        } catch (error) {
            console.log("Error al enviar al comando CMD_CLOSE_NON_FISCAL_RECEIPT");
        }
        try {
            logging.getLogger().info("Cerrando comprobante con CLOSE");
            this.sendCommand(this.CMD_CLOSE_FISCAL_RECEIPT);
            return true;
        } catch (error) {
            console.log("Error al enviar al comando CMD_CLOSE_FISCAL_RECEIPT");
        }
        return false;
    }

    getWarnings() {
        ret = [];
        reply = this.sendCommand(this.CMD_STATUS_REQUEST, [], true);
        printerStatus = reply[0];
        x = int(printerStatus, 16);
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