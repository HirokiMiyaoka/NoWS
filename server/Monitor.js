"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Static = require("./Static");
class Monitor extends Static.Server {
    constructor(conf, server) {
        super(conf);
        this.mserver = server;
    }
    responseJSON(res, data, statusCode = 200) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.write(JSON.stringify(data));
        res.end();
    }
    apiServerList(req, res) {
        const data = { max: 0, list: [] };
        const servers = this.mserver.getServers();
        const urls = Object.keys(servers);
        urls.sort();
        data.max = urls.length + 1;
        data.list.push({
            alive: true,
            url: (this.ssl ? 'https://' : 'http://') + this.host + ':' + this.port,
        });
        urls.forEach((url) => {
            data.list.push({ url: url, alive: servers[url].alive() });
        });
        this.responseJSON(res, data);
    }
    onAPI(req, res) {
        const api = (req.url || '').replace(/^\/api\/([^\?]*).*$/, '$1');
        switch (api) {
            case 'server/list':
                this.apiServerList(req, res);
                break;
            default:
                this.responseJSON(res, { message: 'No API' }, 404);
                break;
        }
    }
    start() {
        this.server.on('request', (req, res) => {
            const url = req.url || '/';
            console.log(url);
            if (url.match(/^\/api\//)) {
                this.onAPI(req, res);
            }
            else {
                this.onRequest(req, res);
            }
        });
        console.log(this.host + ':' + this.port);
        this.server.listen(this.port, this.host);
    }
    stop() { this.server.close(); }
}
exports.default = Monitor;
