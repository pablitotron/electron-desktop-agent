class TraductorInterface {    

    constructor() {
        this.isRunning = false;
        this.colaImpresion = [];
    }

    /**
     * Puede recibir una cantidad variable de parámetros.
     * 
     * @param comando: parámetro fijo.
     * @param args: parámetros variables.
     */
    init(comando, args) {
        this.comando = comando;
    }

    run(jsonTicket) {
        actions = jsonTicket.keys();
        respuesta = [];
        for (action in actions) {
            fnAction = getattr(action);
            if (isinstance(jsonTicket[action], list)) {
                res = fnAction(jsonTicket[action]);
                respuesta.append({ "action": action, "respuesta": res });
            } else if (isinstance(jsonTicket[action], dict)) {
                res = fnAction(jsonTicket[action]);
                respuesta.append({ "action": action, "respuesta": res });
            } else {
                res = fnAction(jsonTicket[action]);
                respuesta.append({ "action": action, "respuesta": res });
            }
        }
        // Vuelvo a poner la impresora que estaba por default inicializada.
        return respuesta;
    }

}