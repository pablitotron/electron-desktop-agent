// import json
// import Configberry
// import logging
// import importlib
// import socket
// import threading

function set_interval(func, sec) {
	function func_wrapper() {
		set_interval(func, sec);
		func();
	}
	t = threading.Timer(sec, func_wrapper);
	t.start();
	return t;
}

exports.TraductorException = class TraductorException extends Error {

}

exports.TraductoresHandler = class TraductoresHandler {
	// Convierte un JSON a Comando Fiscal Para Cualquier tipo de Impresora fiscal

	constructor() {

		// RG1785/04

		// Es un diccionario como clave va el nombre de la impresora que funciona como cola
		// cada KEY es una printerName y contiene un a instancia de TraductorReceipt o TraductorFiscal dependiendo
		// si la impresora es fiscal o receipt
		this.traductores = {}

		this.cbte_fiscal_map = {
			1: 'FA',
			2: 'NDA',
			3: 'NCA',
			6: 'FB',
			7: 'NDB',
			8: 'NCB',
			11: 'FC',
			12: 'NDC',
			13: 'NCC',
			81: 'FA', // tiquet factura A
			82: 'FB', // tiquet factura B
			83: 'T' // tiquets
		}

		this.pos_fiscal_map = {
			1: "IVA_TYPE_RESPONSABLE_INSCRIPTO",
			2: "IVA_TYPE_RESPONSABLE_NO_INSCRIPTO",
			3: "IVA_TYPE_NO_RESPONSABLE",
			4: "IVA_TYPE_EXENTO",
			5: "IVA_TYPE_CONSUMIDOR_FINAL",
			6: "IVA_TYPE_RESPONSABLE_MONOTRIBUTO",
			7: "IVA_TYPE_NO_CATEGORIZADO",
			12: "IVA_TYPE_PEQUENIO_CONTRIBUYENTE_EVENTUAL",
			13: "IVA_TYPE_MONOTRIBUTISTA_SOCIAL",
			14: "IVA_TYPE_PEQUENIO_CONTRIBUYENTE_EVENTUAL_SOCIAL"
		}

		this.doc_fiscal_map = {
			96: "DOC_TYPE_DNI",
			80: "DOC_TYPE_CUIT",
			89: "DOC_TYPE_LIBRETA_ENROLAMIENTO",
			90: "DOC_TYPE_LIBRETA_CIVICA",
			00: "DOC_TYPE_CEDULA",
			94: "DOC_TYPE_PASAPORTE",
			99: "DOC_TYPE_SIN_CALIFICADOR"
		}

		this.config = Configberry.Configberry();
	}

	init() {
		this.init_cola_traductores_printer();
	}

	json_to_comando(jsonTicket) {
		// leer y procesar una factura en formato JSON
		// global traductores
		// logging.info("Iniciando procesamiento de json...");
		console.info("Iniciando procesamiento de json...");
		console.log(jsonTicket);
		let rta = { "rta": "" };
		// seleccionar impresora
		// esto se debe ejecutar antes que cualquier otro comando
		if ('printerName' in jsonTicket) {
			printerName = jsonTicket.pop('printerName');
			traductor = traductores.get(printerName);
			if (traductor) {
				if (traductor.comando.conector != null) {
					try {
						rta["rta"] = traductor.run(jsonTicket);
					} catch (error) {
						this.manejar_socket_error(error, jsonTicket, traductor);
					}
				} else {
					// logging.info("el Driver no esta inicializado para la impresora " + printerName);
					console.info("el Driver no esta inicializado para la impresora " + printerName);
				}
			} else {
				throw new TraductorException("En el archivo de configuracion no existe la impresora: " + printerName);
			}
		} else if ('getStatus' in jsonTicket) {
			// Aciones de comando genericos de Ststus y control
			rta["rta"] = this.getStatus();
		} else if ('restart' in jsonTicket) {
			rta["rta"] = this.restartFiscalberry();
		} else if ('getAvaliablePrinters' in jsonTicket) {
			rta["rta"] = this.getAvaliablePrinters();
		} else if ('configure' in jsonTicket) {
			rta["rta"] = this.configure(jsonTicket["configure"]);
		} else {
			rta["err"] = "No se paso un comando de accion generico ni el nombre de la impresora printerName";
		}
		return rta;
	}

	getWarnings() {
		//Recolecta los warning que puedan ir arrojando las impresoraas
		// devuelve un listado de warnings
		// global traductores
		collect_warnings = {};
		for (trad in traductores) {
			if (traductores[trad]) {
				warn = traductores[trad].comando.getWarnings();
				if (warn) {
					collect_warnings[trad] = warn;
				}
			}
		}
		return collect_warnings;
	}

	getDeviceData(device_list) {
		// import nmap;
		return_dict = {};  // lo retornado
		device_list_len = len(device_list);
		device_list_identifier_pos = device_list_len - 1;
		index = 0;
		separator = 'abcdefghijklmnopqrstuvwxyz';
		nm = nmap.PortScanner();
		nm.scan('-sP 192.168.1.0/24')  // parametros a nmap, se pueden mejorar mucho
		if (device_list[device_list_identifier_pos] == 0) {
			device_list.pop(device_list_identifier_pos);
			for (h in nm.all_hosts()) {
				if ('mac' in nm[h]['addresses']) {
					for (x in device_list) {
						if (x in nm[h]['addresses']['mac']) {
							return_dict[nm[h]['vendor'][nm[h]['addresses']['mac']] + '_' + separator[index]] = { 'host': nm[h]['addresses']['ipv4'], 'marca': 'EscP', 'driver': 'ReceiptDirectJet' };
							index += 1;
						}
					}
				}
			}
			return return_dict;
		} else if (device_list[device_list_identifier_pos] == 1) {
			device_list.pop(device_list_identifier_pos);
			for (h in nm.all_hosts()) {
				if ('mac' in nm[h]['addresses']) {
					for (x in device_list) {
						if (x in nm[h]['vendor'][nm[h]['addresses']['mac']]) {
							return_dict[nm[h]['vendor'][nm[h]['addresses']['mac']] + '_' + separator[index]] = { 'host': nm[h]['addresses']['ipv4'], 'marca': 'EscP', 'driver': 'ReceiptDirectJet' };
							index += 1;
						}
					}
				}
			}
			return return_dict;
		} else {
			console.log('identificador erroneo');
			quit();
		}
	}

	getPrintersAndWriteConfig() {
		vendors = ['Bematech', 1];  // vendors: 1 as vendor identifier
		macs = ['00:07:25', 0];  // macs: 0 as mac identifier
		printer = this.getDeviceData(macs);
		i = 0;
		for (printerName in printer) {
			listadoNames = printer.keys();
			printerName = listadoNames[i];
			listadoItems = printer.values();
			kwargs = printer[printerName]; //Items de la impresora
			this.config.writeSectionWithKwargs(printerName, kwargs);
			i += 1;
		}
		return 1;
	}

	init_keep_looking_for_device_connected() {
		function recorrer_traductores_y_comprobar() {
			// global traductores
			// logging.info("Iniciando procesamiento de json...");
			console.info("Iniciando procesamiento de json...");
			for (t in traductores) {
				console.log("estoy por verificando conexion de " + t);
				if (!traductores[t].comando.conector) {
					console.log("*** NO conectada");
					// logging.info("la impresora %s esta desconectada y voy a reintentar conectarla " + t);
					console.info("la impresora " + t + " esta desconectada y voy a reintentar conectarla.");
					this.init_printer_traductor(t);
				} else {
					console.log("ya estaba conectado");
				}
			}
		}
		set_interval(recorrer_traductores_y_comprobar, 10);
	}

	init_printer_traductor(printerName) {
		// global traductores
		dictSectionConf = this.config.get_config_for_printer(printerName);
		marca = dictSectionConf.get("marca");
		// del dictSectionConf['marca']
		// instanciar los comandos dinamicamente
		libraryName = "Comandos." + marca + "Comandos";
		comandoModule = importlib.import_module(libraryName);
		comandoClass = getattr(comandoModule, marca + "Comandos");
		comando = comandoClass(dictSectionConf);
		traductorComando = comando.traductor;
		// Inicializo la cola por cada seccion o sea cada impresora.
		traductores.setdefault(printerName, traductorComando);
	}

	init_cola_traductores_printer() {
		secs = this.config.sections();
		// Para cada impresora le voy a crear su juego de comandos con sui respectivo traductor.
		for (s in secs) {
			// Si la seccion es "SERVIDOR", no hacer caso y continuar con el resto.
			if (s != "SERVIDOR") {
				this.init_printer_traductor(s);
			}
		}
	}

	restartFiscalberry() {
		// "reinicia el servicio fiscalberry"
		// from subprocess import call;
		resdict = {
			"action": "restartFIscalberry",
			"rta": call(["service", "fiscalberry-server-rc", "restart"])
		};
		return resdict;
	}

	/**
     * Puede recibir una cantidad variable de parámetros.
     */
	configure(printerName, kwargs) {
		// "Configura generando o modificando el archivo configure.ini"
		this.config.writeSectionWithKwargs(printerName, kwargs);
		return {
			"action": "configure",
			"rta": "ok"
		}
	}

	getAvaliablePrinters() {
		// Esta función llama a otra que busca impresoras. Luego se encarga de escribir el config.ini con las impresoras encontradas.
		// this.getPrintersAndWriteConfig();
		// La primer seccion corresponde a SERVER, el resto son las impresoras.
		rta = {
			"action": "getAvaliablePrinters",
			// "rta": this.config.sections()[1:] };
			"rta": this.config.sections().substring(1) };
		return rta;
	}

	/**
     * Puede recibir una cantidad variable de parámetros.
     */
	getStatus(args) {
		// Global traductores.
		resdict = {
			"action": "getStatus",
			"rta": {}
		};
		for (tradu in traductores) {
			if (traductores[tradu]) {
				resdict["rta"][tradu] = "ONLINE";
			} else {
				resdict["rta"][tradu] = "OFFLINE";
			}
		}
		return resdict;
	}

	manejar_socket_error(err, jsonTicket, traductor) {
		print(format(err));
		traductor.comando.conector.driver.reconnect();
		// Volver a intententar el mismo comando.
		try {
			rta["rta"] = traductor.run(jsonTicket);
		} catch (error) {
			// Ok, no quiere conectar, continuar sin hacer nada.
			print("No hay caso, probe de reconectar pero no se pudo");
		}
	}

}