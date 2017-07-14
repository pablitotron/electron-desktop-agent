// import socket from escpos
// import printer,escpos
// import threading
// import time
// const TCP_PORT = 9100;

exports.ReceiptDirectJetDriver = class ReceiptDirectJetDriver extends printer.Network {
	
	connected = false;

	init(host, port = 9100, timeout = 10, codepage = "cp858", *args, **kwargs) {
		// escrito aqui solo para tener bien en claro las variables iniciales
		// :param host : Printer's hostname or IP address
		// :param port : Port to write to
		// :param timeout : timeout in seconds for the socket-library
		// :param codepage : codepage default to cp858

		escpos.Escpos.init(*args, **kwargs);
		this.host = host;
		this.port = port;
		this.timeout = timeout;
		this.codepage = codepage;
	}

	start() {
		// Iniciar
		this.open();
		this.connected = true;
	}


	end() {
		this.close();
		this.connected = false;
	}

	reconnect() {
		try {
			this.open();
			this.connected = true;
		} catch (error) {
			this.connected = false;
		}
	}

}