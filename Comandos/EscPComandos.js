// import string
// import types
// import logging
// import unicodedata
// from ComandoInterface import ComandoInterface, ComandoException, ValidationError, FiscalPrinterError, formatText
// from ConectorDriverComando import ConectorDriverComando
// import time
// import datetime
// from math import ceil

const moment = require("moment");
// const fechaUtil = require("fecha");

exports.PrinterException = class PrinterException extends Error {

}

const DEFAULT_DRIVER = "ReceipDirectJet";

class EscPComandos extends ComandoInterface {

	constructor() {
		/* El traductor puede ser: TraductorFiscal o TraductorReceipt
		path al modulo de traductor que este comando necesita */
		this.traductorModule = "Traductores.TraductorReceipt";
		this.preFillTrailer = null;
		this.tipoCbte = {
			"T": "Consumidor Final",
			"FA": "A",
			"FB": "Consumidor Final",
			"NDA": "NDA",
			"NCA": "NCA",
			"NDB": "NDB",
			"NCB": "NCB",
			"FC": "C",
			"NDC": "NCC",
			"NDC": "NDC"
		}
	}

	sendCommand(comando, skipStatusErrors = false) {
		try {
			let ret = this.conector.sendCommand(comando, skipStatusErrors);
			return ret;
		} catch (e) {
			if (e instanceof PrinterException) {
				console.log("PrinterException: " + e.message);
				throw new ComandoException("Error de la impresora: " + e.message + ".\nComando enviado: " + comando);
			} else {
				console.log(e.name);
				console.log(e.message);
				console.log(e.stack);
			}
		}
	}

	print_mesa_mozo(mesa, mozo) {
		this.doble_alto_x_linea("Mesa: " + mesa);
		this.doble_alto_x_linea("Mozo: " + mozo);
	}

	/**
     * Puede recibir una cantidad variable de parámetros en un mapa
     */
	printRemito(kwargs) {
		// "imprimir remito"
		let printer = this.conector.driver;
		// kwargs puede ser una instancia de Map		
		let encabezado = kwargs.get("encabezado");
		let items = kwargs.has("items") ? kwargs.get("items") : [];
		let addAdditional = kwargs.get("addAdditional");
		let setTrailer = kwargs.get("setTrailer");
		printer.start();
		printer.set("CENTER", "A", "A", 1, 1);
		// colocar en modo ESC P
		printer.raw(String.fromCharCode(0x1D) + String.fromCharCode(0xF9) + String.fromCharCode(0x35) + "1");
		printer.set("CENTER", "A", "A", 1, 1);
		printer.text("Verifique su cuenta por favor\n");
		printer.text("COMPROBANTE NO VALIDO COMO FACTURA\n\n");
		if (encabezado != null) {
			printer.set("CENTER", "A", "A", 1, 2);
			if (encabezado.has("nombre_cliente")) {
				// printer.text('\n%s\n'% encabezado.get("nombre_cliente"));
				printer.text("\n" + encabezado.get("nombre_cliente") + "\n");
			}
			if (encabezado.has("telefono")) {
				// printer.text('\n%s\n'% encabezado.get("telefono"));
				printer.text("\n" + encabezado.get("telefono") + "\n");
			}
			if (encabezado.has("domicilio_cliente")) {
				// printer.text('\n%s\n'% encabezado.get("domicilio_cliente"));
				printer.text("\n" + encabezado.get("domicilio_cliente") + "\n");
			}
			if ("fecha" in encabezado) {
				printer.set("LEFT", "A", "A", 1, 1);
				// Funciones de formateo de fechas
				// strptime devuelve un datetime a partir de un string y un formato indicado.
				// let fff_aux = time.strptime(encabezado['fecha'], "%Y-%m-%d %H:%M:%S");
				// let fff_aux = fechaUtil.parse(encabezado["fecha"], "YY-MM-DD HH:mm:ss");
				let fff_aux_moment = moment(encabezado["fecha"], "YY-MM-DD HH:mm:ss");
				// strftime devuelve un string. Es la fecha pasada por parametro con el formato indicado
				// let fecha = time.strftime('%H:%M %x', fff_aux);
				// let fecha = fechaUtil.format(fff_aux, '%H:%M %x');
				let fechaMoment = fff_aux_moment.format("HH:mm");
				printer.text(fechaMoment + "\n");
			}
		}
		printer.set("LEFT", "A", "A", 1, 1);
		printer.text("CANT\tDESCRIPCION\t\tPRECIO\n");
		printer.text("------------------------------------------\n");
		let tot_chars = 40;
		let tot_importe = 0.0;
		for (item in items) {
			// Obtiene la porción de la secuencia item desde el indice 0 hasta 24 (no inclusive).
			// desc = item.get('ds')[0:24];
			let desc = item.get("ds").slice(0, 24);
			// Convierte a float el parametro obtenido
			let cant = parseFloat(item.get("qty"));
			let precio = cant * parseFloat(item.get("importe"));
			tot_importe += precio;
			let cant_tabs = 3;
			// len --> longitud de desc
			let can_tabs_final = cant_tabs - Math.ceil(desc.length / 8);
			// len: cantidad de elementos de desc
			//ljust: rellena con el caracter '\t' los espacios a la derecha del string, para completar la cantidad indicada en el primer parametro.
			// let strTabs = desc.ljust(parseInt(desc.length + can_tabs_final), '\t');
			let strTabs = ljust(desc, parseInt(desc.length + can_tabs_final), '\t');
			printer.text("%g\t%s$%g\n" % (cant, strTabs, precio));
		}
		printer.text("------------------------------------------\n");
		if (addAdditional != null) {
			// imprimir subtotal
			printer.set("RIGHT", "A", "A", 1, 1);
			printer.text("SUBTOTAL: $%g\n" % tot_importe);
			// imprimir descuento
			sAmount = parseFloat(addAdditional.get('amount', 0));
			tot_importe = tot_importe - sAmount;
			printer.set("RIGHT", "A", "A", 1, 1);
			printer.text("%s $%g\n" % (addAdditional.get("description"), sAmount));
		}
		// imprimir total
		printer.set("RIGHT", "A", "A", 2, 2);
		printer.text("\t\tTOTAL: $%g\n" % tot_importe);
		printer.text("\n\n\n");
		let extra = kwargs.get("extra");
		if (extra != null && "mesa_id" in extra) {
			let mesa_id = extra.get("mesa_id");
			printer.barcode(rjust(mesa_id.toSting(), 8, "0"), 'EAN13');
		}
		printer.set("CENTER", "A", "B", 1, 1);
		// plato principal
		if (this.preFillTrailer) {
			this.setTrailer(this.preFillTrailer);
		}
		if (setTrailer != null) {
			this.setTrailer(setTrailer);
		}
		printer.cut("PART");
		// volver a poner en modo ESC Bematech, temporal para testing
		printer.raw(String.fromCharCode(0x1D) + String.fromCharCode(0xF9) + String.fromCharCode(0x35) + "0");
		printer.end();
	}

	/**
	 * Rellena con el string "relleno" los espacios a la derecha del string "cadena", 
	 * para completar la longitud indicada en el parametro "longitud".
	 * 
	 * @param {*} cadena 
	 * @param {*} longitud 
	 * @param {*} relleno 
	 */
	ljust(cadena, longitud, relleno) {
		let salida = cadena;
		for(i = 0; i < cadena.length; i++) {
			salida += salida + relleno;
		}
		return salida;
	}

	/**
	 * Rellena con el string "relleno" los espacios a la izquierda del string "cadena", 
	 * para completar la longitud indicada en el parametro "longitud".
	 * 
	 * @param {*} cadena 
	 * @param {*} longitud 
	 * @param {*} relleno 
	 */
	rjust(cadena, longitud, relleno) {
		let salida = relleno;
		for(i = 0; i < cadena.length -1 ; i++) {
			salida += salida + relleno;
		}
		return salida + cadena;
	}

	// Revisar estos 2 métodos de misma firma!!
	setTrailer(setTrailer) {
		this.preFillTrailer = setTrailer;
	}

	setTrailer(setTrailer) {
		console.log(this.conector.driver);
		let printer = this.conector.driver;
		for (trailerLine in setTrailer) {
			if (trailerLine) {
				printer.text(trailerLine);
			}
			printer.text("\n");
		}
	}

	printComanda(comanda, setHeader = null, setTrailer = null) {
		// "observacion, entradas{observacion, cant, nombre, sabores}, platos{observacion, cant, nombre, sabores}"
		let printer = this.conector.driver;
		printer.start();
		// 0x1D 0xF9 0x35 1
		// colocar en modo ESC P
		printer.raw(String.fromCharCode(0x1D) + String.fromCharCode(0xF9) + String.fromCharCode(0x35) + "1");
		if (setHeader) {
			for (headerLine in setHeader) {
				printer.text(headerLine);
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
			// Funciones de formateos de fecha
			// let fff_aux = time.strptime(comanda['created'], "%Y-%m-%d %H:%M:%S");
			let fff_aux_moment = moment(comanda['created'], "YY-MM-DD HH:mm:ss");
			let fechaMoment = fff_aux_moment.format("HH:mm");
			printer.text(fechaMoment + "\n");
		} else {
			// let fecha = datetime.datetime.strftime(datetime.datetime.now, '%H:%M %x');
			let fechaMoment = moment().format("HH:mm");
			printer.text(fechaMoment + "\n");
		}

		function print_plato(plato) {
			// "Imprimir platos"
			printer.set("LEFT", "A", "B", 1, 2);
			printer.text("%s) %s" % (plato['cant'], plato['nombre']));
			if ('sabores' in plato) {
				printer.set("LEFT", "A", "B", 1, 1);
				text = "(%s)" % ", ".join(plato['sabores']);
				printer.text(text);
			}
			printer.text("\n");
			if ('observacion' in plato) {
				printer.set("LEFT", "B", "B", 1, 1);
				printer.text("   OBS: %s\n" % plato['observacion']);
			}
		}

		printer.text("\n");
		if ('observacion' in comanda) {
			printer.set("CENTER", "B", "B", 2, 2);
			printer.text("OBSERVACION\n");
			printer.text(comanda['observacion']);
			printer.text("\n");
			printer.text("\n");
		}
		if ('entradas' in comanda) {
			printer.set("CENTER", "A", "B", 1, 1);
			printer.text("** ENTRADA **\n");
			for (entrada in comanda['entradas']) {
				print_plato(entrada);
			}
			printer.text("\n\n");
		}
		if ('platos' in comanda) {
			printer.set("CENTER", "A", "B", 1, 1);
			printer.text("----- PRINCIPAL -----\n");
			for (plato in comanda['platos']) {
				print_plato(plato);
			}
			printer.text("\n\n");
		}
		// plato principal
		if (setTrailer) {
			this.setTrailer(setTrailer);
		}
		printer.cut("PART");
		/* volver a poner en modo ESC Bematech, temporal para testing
		 * printer._raw(String.fromCharCode(0x1D)+String.fromCharCode(0xF9)+String.fromCharCode(0x35)+"0")
         */
		printer.end();
	}

}