// import serial
const SerialPort = require("serialport").SerialPort;

// import sys

// debugEnabled(*args) {
//     print >> sys.stderr, " ".join(map(str, args));
// }

// debugDisabled(*args) {
//     debug = debugDisabled;
// }

class PrinterError extends Error {
}

class UnknownServerError extends PrinterError {
    errorNumber = 1;
}

class ComunicationError extends PrinterError {
    errorNumber = 2;
}

class PrinterStatusError extends PrinterError {
    errorNumber = 3;
}

class FiscalStatusError extends PrinterError {
    errorNumber = 4;
}

class ProxyError extends PrinterError {
    errorNumber = 5;
}

const ServerErrors = [UnknownServerError, ComunicationError, PrinterStatusError, FiscalStatusError];

const WAIT_TIME = 10;

const RETRIES = 4;

const WAIT_CHAR_TIME = 0.1;

const NO_REPLY_TRIES = 200;

exports.FiscalPrinterDriver = class FiscalPrinterDriver extends DriverInterface {

    init(path, speed = 9600) {        
        this.serialPort = serial.Serial(port = path, timeout = None, baudrate = speed);
        this.initSequenceNumber();
    }

    close() {
        try {
            this.serialPort.close();
        } catch (error) {
            console.log("Error el cerrar el puerto serie: " + this.serialPort.port);
        }
    }

    sendCommand(commandNumber, fields, skipStatusErrors = false) {
        fields = map(lambda x:x.encode("latin-1", 'ignore'), fields);
        message = chr(0x02) + chr(this.sequenceNumber) + chr(commandNumber);
        if (fields) {
            message += chr(0x1c);
        }
        message += chr(0x1c).join(fields);
        message += chr(0x03);
        checkSum = sum([ord(x) for x in message ] );
        checkSumHexa = ("0000" + hex(checkSum)[2:])[-4:].upper();
        message += checkSumHexa;
        reply = this.sendMessage(message);
        this.incrementSequenceNumber();
        return this.parseReply(reply, skipStatusErrors);
    }

    write(s) {
        debug("write", ", ".join(["%x" % ord(c) for c in s ] ) );
        this.serialPort.write(s);
    }

    read(count) {
        ret = this.serialPort.read(count);
        debug("read", ", ".join(["%x" % ord(c) for c in ret ] ) );
        return ret;
    }

    del() {
        if (hasattr("serialPort")) {
            try {
                this.close();
            } catch (error) {
                console.log(error.message);
            }
        }
    }

    parseReply(reply, skipStatusErrors) {
        // Saco STX < Nro Seq> <Nro Comando> <Sep> ... ETX
        r = reply[4:-1];
        fields = r.split(chr(28));
        printerStatus = fields[0];
        fiscalStatus = fields[1];
        if (!skipStatusErrors) {
            this.parsePrinterStatus(printerStatus);
            this.parseFiscalStatus(fiscalStatus);
        }
        return fields;
    }

    parsePrinterStatus(printerStatus) {
        x = int(printerStatus, 16);
        for value, message in this.printerStatusErrors {
            if ((value & x) == value) {
                raise PrinterStatusError, message;
            }
        }
    }

    parseFiscalStatus(fiscalStatus) {
        x = int(fiscalStatus, 16);
        for value, message in this.fiscalStatusErrors {
            if ((value & x) == value) {
                raise FiscalStatusError, message;
            }
        }
    }

    checkReplyBCC(reply, bcc) {
        debug("reply", reply, [ord(x) for x in reply]);
        checkSum = sum([ord(x) for x in reply ]);
        debug("checkSum", checkSum);
        checkSumHexa = ("0000" + hex(checkSum)[2:])[-4:].upper();
        debug("checkSumHexa", checkSumHexa);
        debug("bcc", bcc);
        return checkSumHexa == bcc.upper();
    }

}