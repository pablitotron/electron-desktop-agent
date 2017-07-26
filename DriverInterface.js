// Interfaz que deben cumplir las impresoras fiscales.
exports.DriverInterface = class DriverInterface {

    // Documentos no fiscales

    close() {
        // Cierra recurso de conexion con impresora
        throw new NotImplementedError();
    }

    sendCommand(commandNumber, parameters, skipStatusErrors) {
        // Envia comando a impresora
        throw new NotImplementedError();
    }

    // Retorna un número aleatorio entre low y high, incluyendolos.
    getRandomInteger(low, high) {
        return Math.floor(Math.random() * (high - low + 1) + low);
    }

    getCommandResponse(prefix, randomNumber, size) {
        let out = prefix;
        for(i = 0; i < size; i++) {
            out += randomNumber;
        }
		return out;
    }

}