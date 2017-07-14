// from Drivers.FiscalPrinterDriver import FiscalPrinterDriver, ComunicationError
// import random
// import time

const name = "HasarDriver";

const ACK = chr(0x06);

const NAK = chr(0x15);

const STATPRN = chr(0xa1);

const fiscalStatusErrors = [
    (1 << 0 + 1 << 7, "Memoria Fiscal llena"),
    (1 << 0, "Error en memoria fiscal"),
    (1 << 1, "Error de comprobación en memoria de trabajo"),
    (1 << 2, "Poca batería"),
    (1 << 3, "Comando no reconocido"),
    (1 << 4, "Campo de datos no válido"),
    (1 << 5, "Comando no válido para el estado fiscal"),
    (1 << 6, "Desbordamiento de totales"),
    (1 << 7, "Memoria Fiscal llena"),
    (1 << 8, "Memoria Fiscal casi llena"),
    (1 << 11, "Es necesario hacer un cierre de la jornada fiscal o se superó la cantidad máxima de tickets en una factura.") ];

const printerStatusErrors = [
    (1 << 2, "Error y/o falla de la impresora"),
    (1 << 3, "Impresora fuera de linea"),
    // (1<<4, "Poco papel para la cinta de auditoría"),
    // (1<<5, "Poco papel para comprobantes o tickets"),
    (1 << 6, "Buffer de impresora lleno"),
    (1 << 8, "Tapa de impresora abierta") ];

exports.HasarDriver = class HasarDriver extends FiscalPrinterDriver {

    initSequenceNumber() {
        this.sequenceNumber = random.randint(0x20, 0x7f);
        if (this.sequenceNumber % 2) {
            this.sequenceNumber -= 1;
        }
    }

    incrementSequenceNumber() {
        // Avanzo el número de sequencia, volviendolo a 0x20 si pasó el limite
        this.sequenceNumber += 2;
        if (this.sequenceNumber > 0x7f) {
            this.sequenceNumber = 0x20;
        }
    }

    sendAndWaitAck(message, count = 0) {
        if (count > 10) {
            throw new ComunicationError("Demasiados NAK desde la impresora. Revise la conexión.");
        }
        this.write(message);
        timeout = time.time() + this.WAIT_TIME;
        while (1) {
            if (time.time() > timeout) {
                throw new ComunicationError("Expiró el tiempo de espera para una respuesta de la impresora. Revise la conexión.");
            }
            c = this.read(1);
            if (len(c) == 0) {
                continue;
            }
            if (c == this.ACK) {
                return true;
            }
            if (c == this.NAK) {
                return this.sendAndWaitAck(message, count + 1);
            }
        }
    }

    sendMessage(message) {
        // Envía el mensaje
        // @return reply Respuesta (sin el checksum)
        this.sendAndWaitAck(message);
        timeout = time.time() + this.WAIT_TIME;
        retries = 0;
        while (1) {
            if (time.time() > timeout) {
                throw new ComunicationError("Expiró el tiempo de espera para una respuesta de la impresora. Revise la conexión.");
            }
            c = this.read(1);
            if (len(c) == 0) {
                continue;
            }
            // DC2 o DC4
            if (ord(c) in (0x12, 0x14)) {
                // incrementar timeout
                timeout += this.WAIT_TIME;
                continue;
            }
            // NAK
            // if ord(c) == this.NAK {
            // if retries > this.RETRIES {
            // raise ComunicationError, "Falló el envío del comando a la impresora luego de varios reintentos";
            // }
            // // Reenvío el mensaje
            // this._write( message );
            // timeout = time.time() + this.WAIT_TIME;
            // retries +=1;
            // continue;
            // }
            // STX - Comienzo de la respuesta
            if (c == chr(0x02)) {
                reply = c;
                noreplyCounter = 0;
                // ETX (Fin de texto)
                while (c != chr(0x03)) {
                    c = this.read(1);
                    if (!c) {
                        noreplyCounter += 1;
                        time.sleep(this.WAIT_CHAR_TIME);
                        if (noreplyCounter > this.NO_REPLY_TRIES) {
                            throw new ComunicationError("Fallo de comunicación mientras se recibía la respuesta de la impresora.");
                        }
                    } else {
                        noreplyCounter = 0;
                        reply += c;
                    }
                }
                // Leo BCC
                bcc = this.read(4);
                if (!this.checkReplyBCC(reply, bcc)) {
                    // Mando un NAK y espero la respuesta de nuevo.
                    this.write(this.NAK);
                    timeout = time.time() + this.WAIT_TIME;
                    retries += 1;
                    if (retries > this.RETRIES) {
                        throw new ComunicationError("Fallo de comunicación, demasiados paquetes inválidos (bad bcc).");
                    }
                    continue;
                    // Los número de seq no coinciden
                } else if (reply[1] != chr(this.sequenceNumber)) {
                    // Reenvío el mensaje
                    this.write(this.ACK);
                    //this._sendAndWaitAck( message );
                    timeout = time.time() + this.WAIT_TIME;
                    retries += 1;
                    if (retries > this.RETRIES) {
                        throw new ComunicationError("Fallo de comunicación, demasiados paquetes inválidos (bad sequenceNumber).");
                    }
                    continue;
                } else {
                    // Respuesta OK
                    this.write(this.ACK);
                    break;
                }
            }
        }
        return reply;
    }

}