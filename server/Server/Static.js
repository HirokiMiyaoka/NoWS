"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("../Pfs");
const path = require("path");
const http = require("http");
const https = require("https");
exports.MIME = {
    'css': 'text/css',
    'gif': 'image/gif',
    'gz': 'application/gzip',
    'html': 'text/html',
    'ico': 'image/x-icon',
    'jpg': 'image/jpeg',
    'js': 'text/javascript',
    'json': 'application/json',
    'jsonp': 'application/javascript',
    'png': 'image/png',
    'svg': 'image/svg+xml',
    'svgz': 'image/svg+xml',
    'txt': 'text/plain',
    'zip': 'application/zip',
    'wasm': 'application/wasm',
};
function CreateServer(conf) {
    const server = new Server();
    server.init(conf);
    return server;
}
exports.CreateServer = CreateServer;
class Server {
    constructor() {
    }
    init(conf) {
        this.ssl = false;
        this.host = conf.host;
        this.port = conf.port;
        this.docroot = conf.docs;
        this.mime = Object.assign({}, exports.MIME);
        this.defFile = 'index.html';
        const option = { key: '', cert: '' };
        if (conf.ssl) {
            this.ssl = !!(option.key && option.cert);
            option.key = this.loadPemFile(conf.ssl.key);
            option.cert = this.loadPemFile(conf.ssl.cert);
        }
        this.server = this.ssl ? https.createServer(option) : http.createServer();
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
    e404(res) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.write('404: page not found.');
        res.end();
    }
    responseText(res, filepath, mime) {
        return fs.readFile(filepath, 'utf-8').then((data) => {
            res.writeHead(200, { 'Content-Type': mime });
            res.write(data);
            res.end();
        }).catch((error) => {
            this.e404(res);
        });
    }
    responseBinary(res, filepath, mime) {
        return fs.readFile(filepath).then((data) => {
            res.writeHead(200, { 'Content-Type': mime });
            res.write(data);
            res.end();
        }).catch(() => {
            this.e404(res);
        });
    }
    fileExists(filepath) {
        try {
            return fs.statSync(filepath).isFile();
        }
        catch (err) { }
        return false;
    }
    checkFile(filepath) {
        if (filepath.match(/\/$/)) {
            filepath += this.defFile;
        }
        filepath = path.join(this.docroot, filepath);
        if (this.fileExists(filepath)) {
            return filepath;
        }
        return '';
    }
    onRequest(req, res) {
        console.log(this);
        const filepath = this.checkFile((req.url || '/').split('?')[0]);
        if (!filepath) {
            return this.e404(res);
        }
        var extname = path.extname(filepath).replace('.', '');
        var mime = this.mime[extname] || 'text/plain';
        if (mime.indexOf('text/') === 0) {
            this.responseText(res, filepath, mime);
        }
        else {
            this.responseBinary(res, filepath, mime);
        }
    }
    start() {
        return new Promise((resolve, reject) => {
            this.server.on('close', () => { });
            this.server.on('request', (req, res) => { this.onRequest(req, res); });
            console.log(this.host + ':' + this.port);
            this.server.listen(this.port, this.host, () => { resolve(); });
        }).then(() => {
        });
    }
    stop() {
        this.server.close();
        return Promise.resolve();
    }
    alive() { return Promise.resolve(this.server.listening); }
}
exports.Server = Server;
class ReplaceServer extends Server {
    checkFile(filepath) {
        filepath = path.join(this.docroot, filepath);
        if (this.fileExists(filepath)) {
            return filepath;
        }
        if (filepath.match(/\.[^\.]+$/)) {
            return '';
        }
        filepath = path.join(this.docroot, this.defFile);
        if (this.fileExists(filepath)) {
            return filepath;
        }
        return '';
    }
}
exports.ReplaceServer = ReplaceServer;
