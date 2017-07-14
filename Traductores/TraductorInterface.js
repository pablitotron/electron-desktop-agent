exports.TraductorInterface = class TraductorInterface {

    isRunning = false;
    colaImpresion = [];

    init(comando, *args) {
    this.comando = comando;
}

run(jsonTicket) {
    actions = jsonTicket.keys();
    rta = [];
    for (action in actions) {
        fnAction = getattr(action);
        if (isinstance(jsonTicket[action], list)) {
            res = fnAction( *jsonTicket[action]);
            rta.append({ "action": action, "rta": res });
        } else if (isinstance(jsonTicket[action], dict)) {
            res = fnAction( **jsonTicket[action]);
            rta.append({ "action": action, "rta": res });
        } else {
            res = fnAction(jsonTicket[action]);
            rta.append({ "action": action, "rta": res });
        }
    }
    // Vuelvo a poner la impresora que estaba por default inicializada
    return rta;
}

}