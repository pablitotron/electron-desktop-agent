// const string = require("");
// import unicodedata
// from ComandoInterface import ComandoInterface, ComandoException, ValidationError, FiscalPrinterError, formatText
// from ConectorDriverComando import ConectorDriverComando
// from datetime import datetime
// import time

exports.PrinterException = class PrinterException extends Exception {

}

exports.BematechComandos = class BematechComandos extends ComandoInterface {
	// el traductor puede ser: TraductorFiscal o TraductorReceipt
	// path al modulo de traductor que este comando necesita
	traductorModule = "Traductores.TraductorReceipt";

	INICIAR = 0x40; // @
	RETORNO_DE_CARRO = 0x0D;
	CORTAR_PAPEL = 0x69; // i
	CORTAR_PAPEL_PARCIAL = 0x6D; // m
	ENFATIZADO_ON = 0x45;
	ENFATIZADO_OFF = 0x46;
	SUPERSCRIPT_ON = 0x53;
	SUPERSCRIPT_ON_TOP = 0x00;
	SUPERSCRIPT_ON_BOTTOM = 0x01;
	SUPERSCRIPT_OFF = 0x54;
	DOBLE_ANCHO_ON = 0x0E;
	DOBLE_ANCHO_OFF = 0x14;
	DOBLE_ALTO_LINE = 0x56; //toda la linea
	DOBLE_ALTO = 0x64; // por caracter
	DOBLE_ALTO_ON = 0x01;
	DOBLE_ALTO_OFF = 0x00;
	ITALIC_ON = 0x34;
	ITALIC_OFF = 0x35;
	BUZZER = 0x28;
	ALIGN = 0x61;
	ALIGN_LEFT = 0x00;
	ALIGN_CENTER = 0x01;
	ALIGN_RIGHT = 0x02;
	TEXT = 0x02;

	AVAILABLE_MODELS = [];

	init(path = null, driver = "ReceipDirectJet", *args) {
	// "path indica la IP o puerto donde se encuentra la impresora"
	ComandoInterface.init(args);
	this.conector = ConectorDriverComando(driver, path);
}

init_defaults() {
	this.sendCommand(this.INICIAR);
}

cortar_papel() {
	this.sendCommand(this.CORTAR_PAPEL_PARCIAL);
}

doble_alto_x_linea(this, text) {
	this.sendCommand(this.DOBLE_ALTO_LINE, text + chr(this.TEXT));
}

doble_alto(text) {
	this.sendCommand(this.DOBLE_ALTO, [chr(this.DOBLE_ALTO_ON)]);
	this.sendCommand("", text);
	this.sendCommand(this.DOBLE_ALTO, [chr(this.DOBLE_ALTO_OFF)]);
}

doble_ancho(text) {
	this.sendCommand(this.DOBLE_ANCHO_ON);
	this.sendCommand("", text);
	this.sendCommand(this.DOBLE_ANCHO_OFF);
}

super_script(text) {
	this.sendCommand(this.SUPERSCRIPT_ON);
	this.sendCommand(this.SUPERSCRIPT_ON_TOP);
	this.sendCommand("", text);
	this.sendCommand(this.SUPERSCRIPT_OFF);
}

sub_script(text) {
	this.sendCommand(this.SUPERSCRIPT_ON);
	this.sendCommand(this.SUPERSCRIPT_ON_BOTTOM);
	this.sendCommand("", text);
	this.sendCommand(this.SUPERSCRIPT_OFF);
}

italic(text) {
	this.sendCommand(this.ITALIC_ON);
	this.sendCommand("", text);
	this.sendCommand(this.ITALIC_OFF);
}

buzzer_on() {
	this.sendCommand(this.BUZZER, [chr(0x41), chr(0x04), "001991"]);
}

buzzer_off() {
	this.sendCommand(this.BUZZER, [chr(0x41), chr(0x04), "000111"]);
}

sendCommand(comando, skipStatusErrors = false) {
	try {
		ret = this.conector.sendCommand(comando, skipStatusErrors);
		return ret;
	} catch (PrinterException, e) {
		console.log('Saved!');
		//logging.getLogger().error("PrinterException: %s" % str(e))
		throw new ComandoException("Error de la impresora: %s.\nComando enviado: %s" % \(str(e), commandString));
	}
}

align_left(texto) {
	this.sendCommand(this.ALIGN);
	this.sendCommand(this.ALIGN_LEFT, [texto]);
}


align_center(texto) {
	this.sendCommand(this.ALIGN);
	this.sendCommand(this.ALIGN_CENTER, [texto]);
	//# volver a alinear a la izquierda
	this.sendCommand(this.ALIGN);
	this.sendCommand(this.ALIGN_LEFT);
}

align_right(texto) {
	this.sendCommand(this.ALIGN);
	this.sendCommand(this.ALIGN_RIGHT, [texto]);

	// volver a alinear a la izquierda
	this.sendCommand(this.ALIGN);
	this.sendCommand(this.ALIGN_LEFT);
}

print_mesa_mozo(mesa, mozo) {
	this.doble_alto_x_linea("Mesa: %s" % mesa);
	this.doble_alto_x_linea("Mozo: %s" % mozo);
}

printRemito(mesa, items, cliente = None) {
	return true;
}

printComanda(comanda, mesa, mozo, entrada, platos) {
	// "observacion, entradas{observacion, cant, nombre, sabores}, platos{observacion, cant, nombre, sabores}"
	fecha = time.mktime(time.strptime(comanda['created'], '%Y-%m-%d %H:%M:%S'));

	print_plato(plato) {
		// "Imprimir platos"
		this.sendCommand(this.TEXT, "%s) %s \n" % (plato['cant'], plato['nombre']));
		if ('observacion' in plato) {
			this.sendCommand(this.TEXT, "OBS: " % plato['observacion']);
		}
		if ('sabores' in plato) {
			this.sendCommand(this.TEXT, "(");
			for (sabor in plato['sabores']) {
				this.sendCommand(this.TEXT, sabor);
			}
			this.sendCommand(this.TEXT, ")");
		}
	}
	this.buzzer_on();
	this.buzzer_off();
	this.align_center("Comanda #%s" % comanda['id']);
	this.align_center(str(fecha));
	if ('observacion' in comanda) {
		this.align_center(this.doble_alto_x_linea("OBSERVACION"));
		this.sendCommand(this.TEXT, comanda['observacion']);
		this.sendCommand(this.TEXT, "\n\n");
	}
	if ('entradas' in comanda) {
		this.align_center(this.doble_alto_x_linea("ENTRADA"));
		this.sendCommand(this.TEXT, "\n");
		for (entrada in comanda['entradas']) {
			print_plato(entrada);
		}
	}
	if ('platos' in comanda) {
		this.align_center(this.doble_alto_x_linea("- PRINCIPAL -"));
		this.sendCommand(this.TEXT, "\n");
		for (plato in comanda['platos']) {
			print_plato(plato);
		}
	}
	// plato principal
	this.print_mesa_mozo(mesa, mozo);
	this.sendCommand(this.TEXT, "\n");
	this.sendCommand(this.TEXT, "\n");
	this.sendCommand(this.TEXT, "\n");
	this.sendCommand(this.TEXT, "\n");
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

