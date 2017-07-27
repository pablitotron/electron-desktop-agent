class TraductorFiscal extends TraductorInterface {

    dailyClose(type) {
        // "Comando X o Z"
        // cancelar y volver a un estado conocido
        this.comando.cancelAnyDocument();
        let ret = this.comando.dailyClose(type);
        return ret;
    }

    /**
     * Puede recibir una cantidad variable de parámetros.
     */
    setHeader(args) {
        // "SetHeader"
        let ret = this.comando.setHeader(list(args));
        return ret;
    }

    /**
     * Puede recibir una cantidad variable de parámetros.
     */
    setTrailer(args) {
        // "SetTrailer"
        let ret = this.comando.setTrailer(list(args));
        return ret;
    }

    /**
     * Puede recibir una cantidad variable de parámetros.
     */
    openDrawer(args) {
        // "Abrir caja registradora"
        return this.comando.openDrawer();
    }

    getLastNumber(tipo_cbte) {
        // "Devuelve el último número de comprobante".
        // letra_cbte = (len(tipo_cbte) > 1) ? tipo_cbte[-1] : null;
        letra_cbte = (len(tipo_cbte) > 1) ? tipo_cbte[tipo_cbte.length - 1] : null;
        return this.comando.getLastNumber(letra_cbte);
    }

    cancelDocument() {
        // "Cancelar comprobante en curso".
        return this.comando.cancelDocument();
    }

    printTicket(encabezado=null, items = [], pagos = [], addAdditional=null, setHeader=null, setTrailer=null) {
        if (setHeader) {
            this.setHeader(setHeader);
        }
        if (setTrailer) {
            this.setTrailer(setTrailer);
        }
        if (encabezado) {
            this.abrirComprobante(encabezado);
        } else {
            this.abrirComprobante();
        }
        for (item in items) {
            this.imprimirItem(item);
        }
        if (pagos) {
            for (pago in pagos) {
                this.imprimirPago(pago);
            }
        }
        if (addAdditional) {
            this.comando.addAdditional(addAdditional);
        }
        rta = this.cerrarComprobante();
        return rta;
    }

    /**
     * Puede recibir una cantidad variable de parámetros.
     */
    abrirComprobante(tipo_cbte = "T", tipo_responsable = "CONSUMIDOR_FINAL", tipo_doc = "SIN_CALIFICADOR", nro_doc = " ", nombre_cliente = " ", domicilio_cliente = " ", referencia=null, kwargs) {
        // Parametros: tiquet - responsable - tipo y numero doc - nombre - domicilio - comprobante original (ND/NC)
        // "Creo un objeto factura (internamente) e imprime el encabezado"
        // crear la estructura interna
        this.factura = { "encabezado": dict(tipo_cbte = tipo_cbte, tipo_responsable = tipo_responsable, tipo_doc = tipo_doc, nro_doc = nro_doc, nombre_cliente = nombre_cliente, domicilio_cliente = domicilio_cliente, referencia = referencia), "items": [], "pagos": [] };
        printer = this.comando;
        // letra_cbte = (len(tipo_cbte) > 1) ? tipo_cbte[-1] : null;
        letra_cbte = (len(tipo_cbte) > 1) ? tipo_cbte[tipo_cbte.length - 1] : null;
        // Mapear el tipo de cliente (posicion/categoria).
        pos_fiscal = printer.ivaTypes.get(tipo_responsable);
        // Mapear el numero de documento según RG1361.
        doc_fiscal = printer.docTypes.get(tipo_doc);
        let ret = false;
        // Enviar los comandos de apertura de comprobante fiscal:
        if (tipo_cbte.startswith('T')) {
            if (letra_cbte) {
                ret = printer.openTicket(letra_cbte);
            } else {
                ret = printer.openTicket();
            }
        } else if (tipo_cbte.startswith("F")) {
            ret = printer.openBillTicket(letra_cbte, nombre_cliente, domicilio_cliente, nro_doc, doc_fiscal, pos_fiscal);
        } else if (tipo_cbte.startswith("ND")) {
            ret = printer.openDebitNoteTicket(letra_cbte, nombre_cliente, domicilio_cliente, nro_doc, doc_fiscal, pos_fiscal);
        } else if (tipo_cbte.startswith("NC")) {
            ret = printer.openBillCreditTicket(letra_cbte, nombre_cliente, domicilio_cliente, nro_doc, doc_fiscal, pos_fiscal, referencia);
        }
        return ret;
    }

    imprimirItem(ds, qty, importe, alic_iva = 21.0) {
        // "Envia un item (descripcion, cantidad, etc.) a una factura".
        this.factura["items"].append(dict(ds = ds, qty = qty, importe = importe, alic_iva = alic_iva));
        // ds = unicode(ds, "latin1") // convierto a latin1
        // Nota: no se calcula neto, iva, etc (deben venir calculados!)
        discount = discountDescription = null;
        return this.comando.addItem(ds, float(qty), float(importe), float(alic_iva), discount, discountDescription);
    }

    imprimirPago(ds, importe) {
        // "Imprime una linea con la forma de pago y monto".
        this.factura["pagos"].append(dict(ds = ds, importe = importe));
        return this.comando.addPayment(ds, float(importe));
    }

    cerrarComprobante() {
        // "Envia el comando para cerrar un comprobante Fiscal".
        return this.comando.closeDocument();
    }

}