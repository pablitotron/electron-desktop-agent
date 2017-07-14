// from serial import SerialException
// import importlib
// import threading

exports.ConectorError = class ConectorError extends Exception {

}

exports.ConectorDriverComando = class ConectorDriverComando {
    
    driver = null;

	init(comando, driver, *args, **kwargs) {
        this.comando = comando;
		console.log("inicializando ConectorDriverComando driver de " + driver);
		init_driver(*args) {
            // instanciar el driver dinamicamente segun el driver pasado como parametro
			libraryName = "Drivers."+driver+"Driver";
			driverModule = importlib.import_module(libraryName);
			driverClass = getattr(driverModule, driver+"Driver");
			this.driver = driverClass(**kwargs);
        }
		t = threading.Thread(target=init_driver, args = (comando, driver, args));
		t.daemon = true;
		t.start();
    }

   	sendCommand(*args) {
        return this.driver.sendCommand(*args);
    }

	close() {
        this.driver.close();
		this.driver = null;
    }

}