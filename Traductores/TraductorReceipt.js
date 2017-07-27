class TraductorReceipt extends TraductorInterface {

    /**
     * Puede recibir una cantidad variable de parámetros
     */
    printRemito(args) {
        // "Imprime un Remito, comando de accion valido solo para Comandos de Receipt".
        return this.comando.printRemito(args);
    }

    printComanda(comanda, setHeader=null, setTrailer=null) {
        // "Imprime una Comanda, comando de accion valido solo para Comandos de Receipt".
        return this.comando.printComanda(comanda, setHeader, setTrailer);
    }

    /**
     * Puede recibir una cantidad variable de parámetros
     */
    setHeader(args) {
        // "SetHeader"
        let ret = this.comando.setHeader(list(args));
        return ret;
    }

    /**
     * Puede recibir una cantidad variable de parámetros
     */
    setTrailer(args) {
        // "SetTrailer"
        let ret = this.comando.setTrailer(list(args));
        return ret;
    }
    
}