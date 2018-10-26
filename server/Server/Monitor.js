"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream = require("stream");
const Static = require("./Static");
function CreateServer(conf) { return new Server(); }
exports.default = CreateServer;
class Server extends Static.Server {
    init(conf, server) {
        this.child = server;
        this.p =
            {
                servers: [],
            };
        return super.init(conf, server).then(() => {
            server.setOnMessage((message) => { this.onMessage(message); });
        });
    }
    onMessage(message) {
        switch (message.command) {
            case 'servers': return this.getServerList(message.data);
        }
    }
    responseJSON(res, data, statusCode = 200) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.write(JSON.stringify(data));
        res.end();
    }
    analysisData(src) {
        const data = {};
        src.split('&').forEach((dataset) => {
            const kv = dataset.split('=');
            if (!kv[0]) {
                return;
            }
            data[kv[0]] = kv[1] || '';
        });
        return data;
    }
    requestGet(request) {
        const get = request.url.split('?');
        return this.analysisData(get[1] || '');
    }
    requestPost(request) {
        return new Promise((resolve, reject) => {
            const buftrans = new stream.Transform({ transform(chunk, encoding, callback) { callback(undefined, chunk); } });
            request.pipe(buftrans);
            const bufs = [];
            buftrans.on('data', (data) => { bufs.push(data); });
            buftrans.on('end', () => {
                resolve(Buffer.concat(bufs).toString('utf-8'));
            });
            buftrans.on('error', (error) => { reject(error); });
            buftrans.on('aborted', (error) => { reject(error); });
        });
    }
    requestPostJSON(request) {
        return this.requestPost(request).then((data) => { return JSON.parse(data); });
    }
    getServerList(data) {
        this.p.servers.forEach((resolve) => { resolve(data); });
        this.p.servers = [];
    }
    apiServerList(req, res) {
        return new Promise((resolve, reject) => {
            this.p.servers.push(resolve);
            this.child.send('servers', {});
        }).then((data) => {
            this.responseJSON(res, data);
        });
    }
    apiServerStop(req, res) {
        let p = Promise.resolve();
        const urls = [];
        switch (req.method) {
            case 'GET':
                const data = this.requestGet(req);
                if (data.url) {
                    urls.push(data.url);
                }
                break;
            case 'POST':
                p = this.requestPostJSON(req).then((data) => {
                    if (data && Array.isArray(data.url)) {
                        urls.push(...data.url);
                    }
                });
                break;
        }
        return p.then(() => {
        });
    }
    onAPIRequest(req, res) {
        const api = (req.url || '').replace(/^\/api\/([^\?]*).*$/, '$1');
        switch (api) {
            case 'server/list':
                this.apiServerList(req, res);
                break;
            case 'server/stop':
                this.apiServerStop(req, res);
                break;
            default:
                this.responseJSON(res, { message: 'No API' }, 404);
                break;
        }
        return Promise.resolve();
    }
    onRequest(req, res) {
        const url = req.url || '/';
        if (url.match(/^\/api\//)) {
            return this.onAPIRequest(req, res);
        }
        return super.onRequest(req, res);
    }
}
exports.Server = Server;
