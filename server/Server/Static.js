"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("../Pfs");
const path = require("path");
const http = require("http");
const https = require("https");
const process = require("process");
exports.MIME = {
    bmp: 'image/bmp',
    css: 'text/css',
    csv: 'text/csv',
    gif: 'image/gif',
    gz: 'application/gzip',
    html: 'text/html',
    ico: 'image/x-icon',
    jpg: 'image/jpeg',
    js: 'text/javascript',
    json: 'application/json',
    jsonp: 'application/javascript',
    pdf: 'application/pdf',
    png: 'image/png',
    svg: 'image/svg+xml',
    svgz: 'image/svg+xml',
    txt: 'text/plain',
    zip: 'application/zip',
    wasm: 'application/wasm',
    webp: 'image/webp',
};
exports.HttpStatusCode = {
    100: 'Continue',
    101: 'Switching Protocols',
    102: 'Processing',
    103: 'Early Hints',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    207: 'Multi-Status',
    208: 'Already Reported',
    226: 'IM Used',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    306: '(Unused)',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Payload Too Large',
    414: 'URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Range Not Satisfiable',
    417: 'Expectation Failed',
    418: "I'm a teapot",
    421: 'Misdirected Request',
    422: 'Unprocessable Entity',
    423: 'Locked',
    424: 'Failed Dependency',
    425: 'Too Early',
    426: 'Upgrade Required',
    451: 'Unavailable For Legal Reasons',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
    506: 'Variant Also Negotiates',
    507: 'Insufficient Storage',
    508: 'Loop Detected',
    509: 'Bandwidth Limit Exceeded',
    510: 'Not Extended',
    511: 'Network Authentication Required',
};
function CreateServer(config) {
    if (config.replace && typeof config.replace.pattern === 'string' && config.replace.substr === 'string') {
        return new ReplaceServer();
    }
    return new Server();
}
exports.default = CreateServer;
function ErrorToCode(error) {
    if (!error || typeof error.code !== 'string') {
        return 404;
    }
    switch (error.code) {
        case 'EACCES':
        case 'EMFILE':
        case 'EPERM': return 403;
        case 'EISDIR':
        case 'ENOENT':
        case 'ENOTDIR': return 404;
        case 'ECONNREFUSED':
        case 'ECONNRESET':
        case 'EPIPE':
        case 'ETIMEDOUT': return 408;
    }
    return 404;
}
class Server {
    constructor() {
    }
    init(config, server) {
        this.ssl = false;
        this.host = config.host;
        this.port = config.port;
        this.docroot = path.normalize(config.docs || '');
        this.errroot = config.errs || '';
        this.mime = Object.assign({}, exports.MIME);
        this.defFile = ['index.html'];
        this.headers = config.headers || {};
        const option = { key: '', cert: '' };
        if (config.ssl && option.key && option.cert) {
            this.ssl = true;
            option.key = this.loadPemFile(config.ssl.key);
            option.cert = this.loadPemFile(config.ssl.cert);
        }
        if (config.mime) {
            const mime = config.mime;
            Object.keys(mime).forEach((key) => { this.mime[key] = mime[key]; });
        }
        if (Array.isArray(config.dir_index)) {
            this.defFile = config.dir_index;
        }
        this.server = this.ssl ? https.createServer(option) : http.createServer();
        if (config.allow) {
            this.allow = Array.isArray(config.allow) ? config.allow : [config.allow];
        }
        if (config.deny) {
            this.deny = Array.isArray(config.deny) ? config.deny : [config.deny];
        }
        if (!path.isAbsolute(this.docroot)) {
            this.docroot = path.resolve(__dirname, '../', this.docroot);
        }
        process.chdir(this.docroot);
        return Promise.resolve();
    }
    loadPemFile(file) {
        if (!file || !file.match(/\.pem$/)) {
            return file;
        }
        try {
            const data = fs.readFileSync(file);
            if (typeof data === 'string') {
                return data;
            }
            return data.toString('utf-8');
        }
        catch (error) { }
        return '';
    }
    responseError(res, code) {
        const message = exports.HttpStatusCode[code] || exports.HttpStatusCode[(code = 404)];
        const filepath = this.errroot ? path.join(this.errroot, code + '.html') : '';
        return (filepath && this.fileExists(filepath) ? fs.readFile(filepath, 'utf-8').then((data) => {
            res.writeHead(code, { 'Content-Type': 'text/html' });
            res.write(data);
            res.end();
        }) : Promise.reject()).catch(() => {
            res.writeHead(code, { 'Content-Type': 'text/plain' });
            res.write(code + ': ' + message);
            res.end();
        });
    }
    responseText(res, filepath, mime) {
        return fs.readFile(filepath, 'utf-8').then((data) => {
            res.writeHead(200, Object.assign({}, this.headers, { 'Content-Type': mime }));
            res.write(data);
            res.end();
        }).catch((error) => { this.responseError(res, ErrorToCode(error)); });
    }
    responseBinary(res, filepath, mime) {
        return fs.readFile(filepath).then((data) => {
            res.writeHead(200, Object.assign({}, this.headers, { 'Content-Type': mime }));
            res.write(data);
            res.end();
        }).catch((error) => { this.responseError(res, ErrorToCode(error)); });
    }
    fileExists(filepath) {
        try {
            return fs.statSync(filepath).isFile();
        }
        catch (err) { }
        return false;
    }
    checkFile(filepath) {
        const fullpath = path.join(this.docroot, filepath);
        if (fullpath.substr(0, this.docroot.length) !== this.docroot) {
            return '';
        }
        if (filepath.slice(-1) !== '/') {
            return this.fileExists(fullpath) ? fullpath : '';
        }
        for (let def of this.defFile) {
            const fullpath = path.join(this.docroot, filepath, def);
            if (this.fileExists(fullpath)) {
                return fullpath;
            }
        }
        return '';
    }
    onRequest(req, res) {
        const filepath = this.checkFile((req.url || '/').split('?')[0]);
        if (!filepath) {
            return this.responseError(res, 404);
        }
        var extname = path.extname(filepath).replace('.', '');
        var mime = this.mime[extname] || 'text/plain';
        if (mime.indexOf('text/') === 0) {
            return this.responseText(res, filepath, mime);
        }
        else {
            return this.responseBinary(res, filepath, mime);
        }
    }
    start() {
        return new Promise((resolve, reject) => {
            this.server.on('close', () => { });
            if (0 < this.allow.length) {
                this.server.on('request', (request, response) => {
                    if (this.allow.indexOf(request.socket.remoteAddress || '') < 0) {
                        return this.responseError(response, 403);
                    }
                    this.onRequest(request, response);
                });
            }
            else if (0 < this.deny.length) {
                this.server.on('request', (request, response) => {
                    if (0 <= this.deny.indexOf(request.socket.remoteAddress || '')) {
                        return this.responseError(response, 403);
                    }
                    this.onRequest(request, response);
                });
            }
            else {
                this.server.on('request', (request, response) => { this.onRequest(request, response); });
            }
            console.info((this.ssl ? 'https://' : 'http://') + this.host + ':' + this.port);
            this.server.listen(this.port, this.host, () => { resolve(); });
        }).then(() => {
        });
    }
    stop() {
        return new Promise((resolve, reject) => { this.server.close(resolve); });
    }
    alive() { return Promise.resolve(this.server.listening); }
}
exports.Server = Server;
class ReplaceServer extends Server {
    init(config, server) {
        return super.init(config, server).then(() => {
            const replace = config.replace;
            this.regexp = new RegExp(replace.pattern);
            this.replace = replace.substr;
        });
    }
    checkFile(filepath) {
        return super.checkFile(filepath.replace(this.regexp, this.replace));
    }
}
exports.ReplaceServer = ReplaceServer;
