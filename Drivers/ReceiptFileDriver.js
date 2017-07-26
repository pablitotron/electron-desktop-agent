const printer = require('printer');

const TCP_PORT = 9100;

exports.ReceiptFileDriver = class ReceiptFileDriver {

    // Generic file printer
    // This class is used for parallel port printer or other printers that are directly attached to the filesystem.
    // Note that you should stay away from using USB-to-Parallel-Adapter since they are unreliable
    // and produce arbitrary errors.
    // inheritance:
    // .. inheritance-diagram:: escpos.printer.File
    //     :parts: 1    

    // args es una lista y kwargs es un mapa
	init(devfile="/dev/usb/lp0", auto_flush=true, args, kwargs) {
        printer.File.init(devfile, auto_flush, args, kwargs);
    }

}