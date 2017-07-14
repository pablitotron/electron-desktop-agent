//const DriverInterface = require('driverInterface').DriverInterface;

exports.DummyDriver = class DummyDriver extends DriverInterface {

    constructor() {
        super();
    }

    init() {
    }

    close() {
        // Cerrar
    }

    start() {
        // Iniciar
    }

    end() {
        // Finalizar
    }

    reconnect() {
        // Reconectar
    }

    set() {
    }

    sendCommand(commandNumber, parameters, skipStatusErrors) {
        console.log("Enviando Comando DUMMY");
        console.log("commandNumber: " + commandNumber + "parameters: " + parameters + "skipStatusErrors: " + skipStatusErrors);
        // Toma un número aleatorio entre 0 y 99999999
        let randomNumber = getRandomInteger(0, 99999999);
        return getCommandResponse("0000", randomNumber, 11);
    }

}

exports.DummyDriver