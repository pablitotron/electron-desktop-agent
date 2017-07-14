// import string
// import types
// import logging
// import unicodedata
// from ComandoInterface import ComandoInterface, ComandoException, ValidationError, FiscalPrinterError, formatText
// from ConectorDriverComando import ConectorDriverComando
// import time
// import datetime
// from math import ceil


exports.PrinterException = class PrinterException extends Error {

}

exports.EscPComandos = class EscPComandos extends ComandoInterface {
    /* el traductor puede ser: TraductorFiscal o TraductorReceipt
     * path al modulo de traductor que este comando necesita
    */
	traductorModule="Traductores.TraductorReceipt";

	DEFAULT_DRIVER="ReceipDirectJet";

	preFillTrailer = null;

	tipoCbte = {
			"T": "Consumidor Final",
			"FA":  "A", 
			"FB": "Consumidor Final", 
			"NDA": "NDA", 
			"NCA": "NCA", 
			"NDB": "NDB", 
			"NCB": "NCB", 
			"FC": "C", 
			"NDC": "NCC",
			"NDC": "NDC"
	}
	
	sendCommand(comando, skipStatusErrors=false) {
        try {
            ret = this.conector.sendCommand(comando, skipStatusErrors);
			return ret;
        } catch (PrinterException) {
            logging.getLogger().error("PrinterException: %s" % str(e));
			throw new ComandoException("Error de la impresora: %s.\nComando enviado: %s" % \ (str(e), commandString));
        }
    }
	
	print_mesa_mozo(mesa, mozo) {
        this.doble_alto_x_linea("Mesa: %s"%mesa);
		this.doble_alto_x_linea("Mozo: %s"%mozo);
    }

	printRemito(**kwargs) {
        // "imprimir remito"
		printer = this.conector.driver;
		encabezado = kwargs.get("encabezado", null);
		items = kwargs.get("items", []);
		addAdditional = kwargs.get("addAdditional", null);
		setTrailer = kwargs.get("setTrailer", null);
		printer.start();
		printer.set("CENTER", "A", "A", 1, 1);		
		// colocar en modo ESC P
		printer.raw(chr(0x1D)+chr(0xF9)+chr(0x35)+"1");
		printer.set("CENTER", "A", "A", 1, 1);
		printer.text( "Verifique su cuenta por favor\n" );
		printer.text( "COMPROBANTE NO VALIDO COMO FACTURA\n\n" );
		if (encabezado) {
            printer.set("CENTER", "A", "A", 1, 2);
			if (encabezado.has_key("nombre_cliente")) {
                printer.text( '\n%s\n'% encabezado.get("nombre_cliente") );
            }				
			if (encabezado.has_key("telefono")) {
                printer.text( '\n%s\n'% encabezado.get("telefono") );
            }				
			if (encabezado.has_key("domicilio_cliente")) {
                printer.text( '\n%s\n'% encabezado.get("domicilio_cliente") );
            }
			if ("fecha" in encabezado) {
                printer.set("LEFT", "A", "A", 1, 1);
				fff_aux = time.strptime( encabezado['fecha'], "%Y-%m-%d %H:%M:%S");
				fecha = time.strftime('%H:%M %x', fff_aux);
				printer.text( fecha +"\n");
            }
        }
		printer.set("LEFT", "A", "A", 1, 1);
		printer.text("CANT\tDESCRIPCION\t\tPRECIO\n");
		printer.text("------------------------------------------\n");
		tot_chars = 40;
		tot_importe = 0.0;
		for (item in items) {
            desc = item.get('ds')[0:24];
			cant = float(item.get('qty'));
			precio = cant * float(item.get('importe'));
			tot_importe += precio;
			cant_tabs = 3;
			can_tabs_final = cant_tabs - ceil( len(desc)/8 );
			strTabs = desc.ljust( int(len(desc) + can_tabs_final), '\t');
			printer.text("%g\t%s$%g\n" % (cant, strTabs, precio));
        }
		printer.text("------------------------------------------\n");
		if (addAdditional) {
            // imprimir subtotal
			printer.set("RIGHT", "A", "A", 1, 1);
			printer.text("SUBTOTAL: $%g\n" % tot_importe);
			// imprimir descuento
			sAmount = float( addAdditional.get('amount',0) );
			tot_importe = tot_importe - sAmount;
			printer.set("RIGHT", "A", "A", 1, 1);
			printer.text("%s $%g\n" % (addAdditional.get('description'), sAmount ));
        }
		// imprimir total
		printer.set("RIGHT", "A", "A", 2, 2);
		printer.text("\t\tTOTAL: $%g\n" % tot_importe);
		printer.text("\n\n\n");
		extra = kwargs.get("extra", null);
		if (extra && "mesa_id" in extra) {
            mesa_id = extra.get("mesa_id");
			printer.barcode(str(mesa_id).rjust(8,"0"),'EAN13');
        }
		printer.set("CENTER", "A", "B", 1, 1);
		// plato principal
		if (this.preFillTrailer) {
            this.setTrailer(this.preFillTrailer);
        }
		if (setTrailer) {
            this.setTrailer(setTrailer);
        }
		printer.cut("PART");
		// volver a poner en modo ESC Bematech, temporal para testing
		printer.raw(chr(0x1D)+chr(0xF9)+chr(0x35)+"0");
		printer.end();
    }

	setTrailer(setTrailer) {
        this.preFillTrailer = setTrailer;
    }

	setTrailer(setTrailer) {
        console.log(this.conector.driver);
		printer = self.conector.driver;
		for (trailerLine in setTrailer) {
            if (trailerLine) {
                printer.text( trailerLine );
            }
			printer.text( "\n" );
        }
    }

	printComanda(comanda, setHeader=null, setTrailer=null) {
        // "observacion, entradas{observacion, cant, nombre, sabores}, platos{observacion, cant, nombre, sabores}"
		printer = this.conector.driver;
		printer.start();
		// 0x1D 0xF9 0x35 1
		// colocar en modo ESC P
		printer._raw(chr(0x1D)+chr(0xF9)+chr(0x35)+"1");
		if (setHeader) {
            for (headerLine in setHeader) {
                printer.text( headerLine );
            }
        }
		printer.set("CENTER", "A", "A", 1, 1);
		if ("id" in comanda) {
            if ("nuevaComanda" in comanda) {
                printer.text("Nueva Comanda\n");
				printer.text("Comanda #%s\n" % comanda['id']);
            } else {
                printer.text("- REIMPRESION -\n");
				printer.text("Comanda #%s\n" % comanda['id']);
            }
        } else {
            printer.text("Nueva Comanda\n");
        }
		if ("created" in comanda) {
            fff_aux = time.strptime( comanda['created'], "%Y-%m-%d %H:%M:%S");
			fecha = time.strftime('%H:%M %x', fff_aux);
			printer.text( fecha +"\n");
        } else {
            fecha = datetime.datetime.strftime(datetime.datetime.now(), '%H:%M %x');
			printer.text( fecha +"\n");
        }
		print_plato(plato) {
            // "Imprimir platos"
			printer.set("LEFT", "A", "B", 1, 2);
			printer.text( "%s) %s"%( plato['cant'], plato['nombre']) );
			if ('sabores' in plato) {
                printer.set("LEFT", "A", "B", 1, 1);
				text = "(%s)" % ", ".join(plato['sabores']);
				printer.text( text );
            }
			printer.text("\n");
			if ('observacion' in plato) {
                printer.set("LEFT", "B", "B", 1, 1);
				printer.text( "   OBS: %s\n" % plato['observacion'] );
            }
        }
		printer.text( "\n");
		if ('observacion' in comanda) {
            printer.set( "CENTER", "B", "B", 2, 2);
			printer.text( "OBSERVACION\n");
			printer.text( comanda['observacion'] );
			printer.text( "\n");
			printer.text( "\n");
        }
		if ('entradas' in comanda) {
            printer.set("CENTER", "A", "B", 1, 1);
			printer.text( "** ENTRADA **\n" );
			for (entrada in comanda['entradas']) {
                print_plato(entrada);
            }
			printer.text( "\n\n" );
        }
		if ('platos' in comanda) {
            printer.set("CENTER", "A", "B", 1, 1);
			printer.text( "----- PRINCIPAL -----\n" );
			for (plato in comanda['platos']) {
                print_plato(plato);
            }
			printer.text( "\n\n" );
        }
		// plato principal
		if (setTrailer) {
            self._setTrailer(setTrailer);
        }
		printer.cut("PART");
		/* volver a poner en modo ESC Bematech, temporal para testing
		 * printer._raw(chr(0x1D)+chr(0xF9)+chr(0x35)+"0")
         */		
		printer.end()
    }
    
}