// import string
// import types
// import logging
// from ComandoInterface import ComandoInterface, ComandoException, ValidationError, FiscalPrinterError, formatText
// from ConectorDriverComando import ConectorDriverComando
// from Drivers.FiscalPrinterDriver import PrinterException

exports.FiscalPrinterError = class FiscalPrinterError extends Error {

}

exports.EpsonComandos = class EpsonComandos extends ComandoInterface {
    /* el traductor puede ser: TraductorFiscal o TraductorReceipt
    * path al modulo de traductor que este comando necesita
    */
    traductorModule="Traductores.TraductorFiscal";
    
    currentDocument = null;
    currentDocumentType = null;

    DEFAULT_DRIVER="Epson";

    DEBUG = true;

    CMD_OPEN_FISCAL_RECEIPT = 0x40;
    CMD_OPEN_BILL_TICKET = 0x60;
//    CMD_PRINT_TEXT_IN_FISCAL = (0x41, 0x61)
    CMD_PRINT_TEXT_IN_FISCAL = 0x41;
    CMD_PRINT_LINE_ITEM = (0x42, 0x62);
    CMD_PRINT_SUBTOTAL = (0x43, 0x63);
    CMD_ADD_PAYMENT = (0x44, 0x64);
    CMD_CLOSE_FISCAL_RECEIPT = (0x45, 0x65);
    CMD_DAILY_CLOSE = 0x39;
    CMD_STATUS_REQUEST = 0x2a;
    CMD_OPEN_DRAWER = 0x7b;
    CMD_SET_HEADER_TRAILER = 0x5d;
    CMD_OPEN_NON_FISCAL_RECEIPT = 0x48;
    CMD_PRINT_NON_FISCAL_TEXT = 0x49;
    CMD_CLOSE_NON_FISCAL_RECEIPT = 0x4a;

    CURRENT_DOC_TICKET = 1;
    CURRENT_DOC_BILL_TICKET = 2;
    CURRENT_DOC_CREDIT_TICKET = 4;
    CURRENT_DOC_NON_FISCAL = 3;

    models = ["tickeadoras", "epsonlx300+", "tm-220-af"];

    ivaTypes = {
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

    sendCommand(self, commandNumber, parameters, skipStatusErrors=False) {
        console.log("sendCommand - commandNumber: " + commandNumber + " - parameters: " + parameters);
        try {
            logging.getLogger().info("sendCommand: SEND|0x%x|%s|%s" % (commandNumber, skipStatusErrors and "T" or "F", str(parameters)));
            return this.conector.sendCommand(commandNumber, parameters, skipStatusErrors);
        } catch (PrinterException) {
            logging.getLogger().error("PrinterException: %s" % str(e));
            throw new ComandoException("Error de la impresora fiscal: " + str(e));
        }
    }

    openNonFiscalReceipt() {
        status = this.sendCommand(this.CMD_OPEN_NON_FISCAL_RECEIPT, []);
        this.currentDocument = self.CURRENT_DOC_NON_FISCAL;
        this.currentDocumentType = null;
        return status;
    }

    printNonFiscalText(text) {
        return this.sendCommand(self.CMD_PRINT_NON_FISCAL_TEXT, [formatText(text[:40] or " ")]);
    }

    ADDRESS_SIZE = 30;

    setHeaderTrailer(line, text) {
        this.sendCommand(this.CMD_SET_HEADER_TRAILER, (str(line), text));
    }

    setHeader(header=null) {
        // "Establecer encabezados"
        if (!header) {
            header = [];
        }            
        line = 3;
        // Agrego chr(0x7f) (DEL) al final para limpiar las líneas no utilizadas
        for text in (header + [chr(0x7f)]*3)[:3] {
            self._setHeaderTrailer(line, text);
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

    openBillCreditTicket(type, name, address, doc, docType, ivaType, reference="NC") {
        return this.openBillCreditTicket(type, name, address, doc, docType, ivaType, isCreditNote=null);
    }

    openBillTicket(type, name, address, doc, docType, ivaType) {
        return self._openBillCreditTicket(type, name, address, doc, docType, ivaType, isCreditNote=false);
    }

    openBillCreditTicket(type, name, address, doc, docType, ivaType, isCreditNote, reference=null) {
        if (!doc or filter(lambda x: x not in string.digits + "-.", doc or "") or not \ docType in this.docTypeNames) {
            doc, docType = "", "";
        } else {
            doc = doc.replace("-", "").replace(".", "");
            docType = this.docTypeNames[docType];
        }            
        this.type = type;
        if (this.model == "epsonlx300+") {
            parameters = [isCreditNote and "N" or "F", // Por ahora no soporto ND, que sería "D"
                "C",
                type, // Tipo de FC (A/B/C)
                "1",  // Copias - Ignorado
                "P",  // "P" la impresora imprime la lineas(hoja en blanco) o "F" preimpreso
                "17", // Tamaño Carac - Ignorado
                "I",  // Responsabilidad en el modo entrenamiento - Ignorado
                this.ivaTypes.get(ivaType, "F"),   // Iva Comprador
                formatText(name[:40]), // Nombre
                formatText(name[40:80]), // Segunda parte del nombre - Ignorado
                formatText(docType) or (isCreditNote and "-" or ""),
                 // Tipo de Doc. - Si es NC obligado pongo algo
                doc or (isCreditNote and "-" or ""), // Nro Doc - Si es NC obligado pongo algo
                "N", // No imprime leyenda de BIENES DE USO
                formatText(address[:this.ADDRESS_SIZE] or "-"), // Domicilio
                formatText(address[this.ADDRESS_SIZE:this.ADDRESS_SIZE * 2]), // Domicilio 2da linea
                formatText(address[this.ADDRESS_SIZE * 2:this.ADDRESS_SIZE * 3]), // Domicilio 3ra linea
                (isCreditNote or this.ivaTypes.get(ivaType, "F") != "F") and "-" or "",
                // Remito primera linea - Es obligatorio si el cliente no es consumidor final
                "", // Remito segunda linea
                "C", // No somos una farmacia
                ]
        } else {
            parameters = [isCreditNote and "M" or "T", // Ticket NC o Factura
                "C",  // Tipo de Salida - Ignorado
                type, // Tipo de FC (A/B/C)
                "1",  // Copias - Ignorado
                "P",  // Tipo de Hoja - Ignorado
                "17", // Tamaño Carac - Ignorado
                "E",  // Responsabilidad en el modo entrenamiento - Ignorado
                this.ivaTypes.get(ivaType, "F"),   // Iva Comprador
                formatText(name[:40]), // Nombre
                formatText(name[40:80]), // Segunda parte del nombre - Ignorado
                formatText(docType) or (isCreditNote and "-" or ""),
                 // Tipo de Doc. - Si es NC obligado pongo algo
                doc or (isCreditNote and "-" or ""), // Nro Doc - Si es NC obligado pongo algo
                "N", // No imprime leyenda de BIENES DE USO
                formatText(address[:this.ADDRESS_SIZE] or "-"), // Domicilio
                formatText(address[this.ADDRESS_SIZE:this.ADDRESS_SIZE * 2]), // Domicilio 2da linea
                formatText(address[this.ADDRESS_SIZE * 2:this.ADDRESS_SIZE * 3]), // Domicilio 3ra linea
                (isCreditNote or this.ivaTypes.get(ivaType, "F") != "F") and "-" or "",
                // Remito primera linea - Es obligatorio si el cliente no es consumidor final
                "", // Remito segunda linea
                "C", // No somos una farmacia
                ]
        }
        if (isCreditNote) {
            this.currentDocument = this.CURRENT_DOC_CREDIT_TICKET;
        } else {
            this.currentDocument = this.CURRENT_DOC_BILL_TICKET;
        }
        // guardo el tipo de FC (A/B/C)
        this.currentDocumentType = type;
        return this.sendCommand(this.CMD_OPEN_BILL_TICKET, parameters);
    }

    getCommandIndex() {
        if (this.currentDocument == this.CURRENT_DOC_TICKET) {
            return 0;
        } else if (this.currentDocument in (this.CURRENT_DOC_BILL_TICKET, this.CURRENT_DOC_CREDIT_TICKET)) {
            return 1;
        } else if (this.currentDocument == this.CURRENT_DOC_NON_FISCAL) {
            return 2;
        }
        throw new Error("Invalid currentDocument");
    }

    openTicket(defaultLetter='B') {
        if (this.model == "epsonlx300+") {
            return this.openBillTicket(defaultLetter, "CONSUMIDOR FINAL", "", null, null, this.IVA_TYPE_CONSUMIDOR_FINAL);
        } else {
            this.sendCommand(this.CMD_OPEN_FISCAL_RECEIPT, ["C"]);
            this.currentDocument = this.CURRENT_DOC_TICKET;
        }
    }        

    openDrawer() {
        this.sendCommand(this.CMD_OPEN_DRAWER, []);
    }

    closeDocument() {
        if (this.currentDocument == this.CURRENT_DOC_TICKET) {
            reply = this.sendCommand(this.CMD_CLOSE_FISCAL_RECEIPT[this.getCommandIndex()], ["T"]);
            return reply[2];
        }
        if (this.currentDocument == this.CURRENT_DOC_BILL_TICKET) {
            reply = this.sendCommand(this.CMD_CLOSE_FISCAL_RECEIPT[this.getCommandIndex()], [this.model == "epsonlx300+" and "F" or "T", this._type, "FINAL"]);
            // del this.type;
            return reply[2];
        }
        if (this.currentDocument == this.CURRENT_DOC_CREDIT_TICKET) {
            reply = this.sendCommand(this.CMD_CLOSE_FISCAL_RECEIPT[this.getCommandIndex()], [this.model == "epsonlx300+" and "N" or "M", this.type, "FINAL"]);
            // del this.type;
            return reply[2];
        }
        if (this.currentDocument in (this.CURRENT_DOC_NON_FISCAL, )) {
            return this.sendCommand(this.CMD_CLOSE_NON_FISCAL_RECEIPT, ["T"]);
        }
        throw new Error(NotImplementedError);
    }

    cancelDocument() {
        if (this.currentDocument in (this.CURRENT_DOC_TICKET, this.CURRENT_DOC_BILL_TICKET, this.CURRENT_DOC_CREDIT_TICKET)) {
            status = this.sendCommand(this.CMD_ADD_PAYMENT[this._getCommandIndex()], ["Cancelar", "0", 'C']);
            return status;
        }            
        if (this.currentDocument in (this.CURRENT_DOC_NON_FISCAL, null)) {
            this.printNonFiscalText("CANCELADO");
            return this.closeDocument();
        }
        throw new Error(NotImplementedError);
    }

    addItem(description, quantity, price, iva, discount, discountDescription, negative=false) {
        if (type(description) in types.StringTypes) {
            description = [description];
        }            
        if (negative) {
            sign = 'R';
        } else {
            sign = 'M';
        }
        quantityStr = str(int(quantity * 1000));
        if (this.model == "epsonlx300+") {
            bultosStr = str(int(quantity));
        } else {
            bultosStr = "0" * 5;  // No se usa en TM220AF ni TM300AF ni TMU220AF;
        }            
        if (this.currentDocumentType != 'A') {
            // enviar con el iva incluido
            priceUnitStr = str(int(round(price * 100, 0)));
        } else {
            if (this.model == "tm-220-af") {
                // enviar sin el iva (factura A)
                priceUnitStr =  "%0.4f" % (price / ((100.0 + iva) / 100.0));
            } else {
                // enviar sin el iva (factura A)
                priceUnitStr = str(int(round((price / ((100 + iva) / 100)) * 100, 0)));
            }                
        }            
        ivaStr = str(int(iva * 100));
        extraparams = this.currentDocument in (this.CURRENT_DOC_BILL_TICKET, this.CURRENT_DOC_CREDIT_TICKET) and ["", "", ""] or [] if this.getCommandIndex() == 0 {
            for (d in description[:-1]) {
                this.sendCommand(this.CMD_PRINT_TEXT_IN_FISCAL, [formatText(d)[:20]]);
            }
        }
        reply = this.sendCommand(this.CMD_PRINT_LINE_ITEM[this._getCommandIndex()], [formatText(description[-1][:20]), quantityStr, priceUnitStr, ivaStr, sign, bultosStr, "0" * 8] + extraparams);
        if (discount) {
            discountStr = str(int(discount * 100));
            this.sendCommand(this.CMD_PRINT_LINE_ITEM[this.getCommandIndex()], [formatText(discountDescription[:20]), "1000", discountStr, ivaStr, 'R', "0", "0"] + extraparams);
        }            
        return reply;
    }

    addPayment(description, payment) {
        paymentStr = str(int(payment * 100));
        status = this.sendCommand(this.CMD_ADD_PAYMENT[this.getCommandIndex()], [formatText(description)[:20], paymentStr, 'T']);
        return status;
    }

    addAdditional(description, amount, iva, negative=false) {
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
            priceUnitStr = str(int(round(priceUnit * 100, 0)));
        } else {
            // enviar sin el iva (factura A)
            priceUnitStr = str(int(round((priceUnit / ((100 + iva) / 100)) * 100, 0)));
        }
        ivaStr = str(int(iva * 100));
        extraparams = this.currentDocument in (this.CURRENT_DOC_BILL_TICKET, this.CURRENT_DOC_CREDIT_TICKET) and ["", "", ""] or [];
        reply = this.sendCommand(this.CMD_PRINT_LINE_ITEM[this.getCommandIndex()], [formatText(description[:20]), quantityStr, priceUnitStr, ivaStr, sign, bultosStr, "0"] + extraparams);
        return reply;
    }

    dailyClose(type) {
        reply = this.sendCommand(this.CMD_DAILY_CLOSE, [type, "P"]);
        return reply[2:];
    }

    getLastNumber(letter) {
        reply = this.sendCommand(this.CMD_STATUS_REQUEST, ["A"], true);
        if (len(reply) < 3) {
            // La respuesta no es válida. Vuelvo a hacer el pedido y si hay algún error que se reporte como excepción
            reply = this.sendCommand(this.CMD_STATUS_REQUEST, ["A"], false);
        }
        if (letter == "A") {
            return int(reply[6]);
        } else {
            return int(reply[4]);
        }
    }

    getLastCreditNoteNumber(letter) {
        reply = this.sendCommand(this.CMD_STATUS_REQUEST, ["A"], true);
        if (len(reply) < 3) {
            // La respuesta no es válida. Vuelvo a hacer el pedido y si hay algún error que se reporte como excepción
            reply = this.sendCommand(this.CMD_STATUS_REQUEST, ["A"], false);
        }            
        if (letter == "A") {
            return int(reply[10]);
        } else {
            return int(reply[11]);
        }
    }

    cancelAnyDocument() {
        try {
            this.sendCommand(this.CMD_ADD_PAYMENT[0], ["Cancelar", "0", 'C']);
            return true;
        } catch (error) {
            console.log("Error al enviar el comando ADD_PAYMENT");
        }
        try {
            this.sendCommand(this.CMD_ADD_PAYMENT[1], ["Cancelar", "0", 'C']);
            return true;
        } catch (error) {
            console.log("Error al enviar el comando ADD_PAYMENT");
        }
        try {
            this.sendCommand(this.CMD_CLOSE_NON_FISCAL_RECEIPT, ["T"]);
            return true;
        } catch (error) {
            console.log("Error al enviar el comando CLOSE_NON_FISCAL_RECEIPT");
        }
        return false;
    }

    getWarnings() {
        ret = [];
        reply = this.sendCommand(this.CMD_STATUS_REQUEST, ["N"], true);
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