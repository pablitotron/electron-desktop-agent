// const string = require("");
// import unicodedata
// from ComandoInterface import ComandoInterface, ComandoException, ValidationError, FiscalPrinterError, formatText
// from ConectorDriverComando import ConectorDriverComando
// from datetime import datetime
// import time

const moment = require("moment");

exports.PrinterException = class PrinterException extends Exception {

}

const INICIAR = 0x40; // @
const RETORNO_DE_CARRO = 0x0D;
const CORTAR_PAPEL = 0x69; // i
const CORTAR_PAPEL_PARCIAL = 0x6D; // m
const ENFATIZADO_ON = 0x45;
const ENFATIZADO_OFF = 0x46;
const SUPERSCRIPT_ON = 0x53;
const SUPERSCRIPT_ON_TOP = 0x00;
const SUPERSCRIPT_ON_BOTTOM = 0x01;
const SUPERSCRIPT_OFF = 0x54;
const DOBLE_ANCHO_ON = 0x0E;
const DOBLE_ANCHO_OFF = 0x14;
const DOBLE_ALTO_LINE = 0x56; //toda la linea
const DOBLE_ALTO = 0x64; // por caracter
const DOBLE_ALTO_ON = 0x01;
const DOBLE_ALTO_OFF = 0x00;
const ITALIC_ON = 0x34;
const ITALIC_OFF = 0x35;
const BUZZER = 0x28;
const ALIGN = 0x61;
const ALIGN_LEFT = 0x00;
const ALIGN_CENTER = 0x01;
const ALIGN_RIGHT = 0x02;
const TEXT = 0x02;

const AVAILABLE_MODELS = [];

class BematechComandos extends ComandoInterface {

	constructor() {
		// el traductor puede ser: TraductorFiscal o TraductorReceipt
		// path al modulo de traductor que este comando necesita
		this.traductorModule = "Traductores.TraductorReceipt";
	}

	/**
     * Puede recibir una cantidad variable de parámetros
     */
	init(path = null, driver = "ReceipDirectJet", args) {
		// "path indica la IP o puerto donde se encuentra la impresora"
		ComandoInterface.init(args);
		this.conector = ConectorDriverComando(driver, path);
	}

	init_defaults() {
		this.sendCommand(INICIAR);
	}

	cortar_papel() {
		this.sendCommand(CORTAR_PAPEL_PARCIAL);
	}

	doble_alto_x_linea(text) {
		this.sendCommand(DOBLE_ALTO_LINE, text + String.fromCharCode(TEXT));
	}

	doble_alto(text) {
		this.sendCommand(DOBLE_ALTO, [String.fromCharCode(DOBLE_ALTO_ON)]);
		this.sendCommand("", text);
		this.sendCommand(DOBLE_ALTO, [String.fromCharCode(DOBLE_ALTO_OFF)]);
	}

	doble_ancho(text) {
		this.sendCommand(DOBLE_ANCHO_ON);
		this.sendCommand("", text);
		this.sendCommand(DOBLE_ANCHO_OFF);
	}

	super_script(text) {
		this.sendCommand(SUPERSCRIPT_ON);
		this.sendCommand(SUPERSCRIPT_ON_TOP);
		this.sendCommand("", text);
		this.sendCommand(SUPERSCRIPT_OFF);
	}

	sub_script(text) {
		this.sendCommand(SUPERSCRIPT_ON);
		this.sendCommand(SUPERSCRIPT_ON_BOTTOM);
		this.sendCommand("", text);
		this.sendCommand(SUPERSCRIPT_OFF);
	}

	italic(text) {
		this.sendCommand(ITALIC_ON);
		this.sendCommand("", text);
		this.sendCommand(ITALIC_OFF);
	}

	buzzer_on() {
		this.sendCommand(BUZZER, [String.fromCharCode(0x41), String.fromCharCode(0x04), "001991"]);
	}

	buzzer_off() {
		this.sendCommand(BUZZER, [String.fromCharCode(0x41), String.fromCharCode(0x04), "000111"]);
	}

	sendCommand(comando, skipStatusErrors = false) {
		try {
			ret = this.conector.sendCommand(comando, skipStatusErrors);
			return ret;
		} catch (e) {
			if (e instanceof PrinterException) {
				console.log('Saved!');
				//logging.getLogger().error("PrinterException: %s" % str(e))
				// throw new ComandoException("Error de la impresora: %s.\nComando enviado: %s" % \(str(e), commandString));
			} else {
				console.log(e.name);
				console.log(e.message);
				console.log(e.stack);
			}
		}
	}

	align_left(texto) {
		this.sendCommand(ALIGN);
		this.sendCommand(ALIGN_LEFT, [texto]);
	}

	align_center(texto) {
		this.sendCommand(ALIGN);
		this.sendCommand(ALIGN_CENTER, [texto]);
		// Volver a alinear a la izquierda.
		this.sendCommand(ALIGN);
		this.sendCommand(ALIGN_LEFT);
	}

	align_right(texto) {
		this.sendCommand(ALIGN);
		this.sendCommand(ALIGN_RIGHT, [texto]);
		// Volver a alinear a la izquierda.
		this.sendCommand(ALIGN);
		this.sendCommand(ALIGN_LEFT);
	}

	print_mesa_mozo(mesa, mozo) {
		this.doble_alto_x_linea("Mesa: " + mesa);
		this.doble_alto_x_linea("Mozo: " + mozo);
	}

	printRemito(mesa, items, cliente = null) {
		return true;
	}

	printComanda(comanda, mesa, mozo, entrada, platos) {
		// "observacion, entradas{observacion, cant, nombre, sabores}, platos{observacion, cant, nombre, sabores}"
		let fecha_moment = moment(comanda['created'], "YY-MM-DD HH:mm:ss");
		// fecha = time.mktime(time.strptime(comanda['created'], '%Y-%m-%d %H:%M:%S'));
		// let fecha = time.mktime(fecha_moment);
		function print_plato(plato) {
			// "Imprimir platos"
			this.sendCommand(TEXT, "%s) %s \n" % (plato['cant'], plato['nombre']));
			if ('observacion' in plato) {
				this.sendCommand(TEXT, "OBS: " % plato['observacion']);
			}
			if ('sabores' in plato) {
				this.sendCommand(TEXT, "(");
				for (sabor in plato['sabores']) {
					this.sendCommand(TEXT, sabor);
				}
				this.sendCommand(TEXT, ")");
			}
		}
		this.buzzer_on();
		this.buzzer_off();
		this.align_center("Comanda #" + comanda['id']);
		this.align_center(fecha_moment.toString());
		if ('observacion' in comanda) {
			this.align_center(this.doble_alto_x_linea("OBSERVACION"));
			this.sendCommand(TEXT, comanda['observacion']);
			this.sendCommand(TEXT, "\n\n");
		}
		if ('entradas' in comanda) {
			this.align_center(this.doble_alto_x_linea("ENTRADA"));
			this.sendCommand(TEXT, "\n");
			for (entrada in comanda['entradas']) {
				print_plato(entrada);
			}
		}
		if ('platos' in comanda) {
			this.align_center(this.doble_alto_x_linea("- PRINCIPAL -"));
			this.sendCommand(TEXT, "\n");
			for (plato in comanda['platos']) {
				print_plato(plato);
			}
		}
		// Plato principal
		this.print_mesa_mozo(mesa, mozo);
		this.sendCommand(TEXT, "\n");
		this.sendCommand(TEXT, "\n");
		this.sendCommand(TEXT, "\n");
		this.sendCommand(TEXT, "\n");
		this.cortar_papel();
	}

	del() {
		try {
			this.close();
		} catch (error) {
			console.log("Error");
		}
	}

}