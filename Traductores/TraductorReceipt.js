exports.TraductorReceipt = class TraductorReceipt extends TraductorInterface {

    printRemito(**kwargs) {
        // "Imprime un Remito, comando de accion valido solo para Comandos de Receipt"
		return this.comando.printRemito( **kwargs );
    }		

	printComanda(comanda, setHeader, setTrailer) {
        // "Imprime una Comanda, comando de accion valido solo para Comandos de Receipt"
		return this.comando.printComanda(comanda, setHeader, setTrailer);
    }

    setHeader(*args) {
        // "SetHeader"
		ret = this.comando.setHeader(list(args));
		return ret;
    }

	setTrailer(*args) {
        // "SetTrailer"
		ret = this.comando.setTrailer(list(args));
		return ret;
    }
    
}