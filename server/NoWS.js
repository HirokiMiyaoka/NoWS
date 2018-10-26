"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const child = require("child_process");
class WebServer {
    constructor(config) {
        this.config = config;
        this.p = { alive: [], stop: [] };
        this.child = child.fork(path.join(__dirname, 'Server.js'));
        this.child.on('message', (message) => {
            console.log('parent:', message);
            if (typeof message !== 'object') {
                return;
            }
            switch (message.command) {
                case 'prepare': return this.start(this.config);
                case 'alive': return this.alived(message);
                case 'aborted': return this.aborted(message);
                case 'stop': return this.stopped();
                default: this.onMessage(message);
            }
        });
    }
    onMessage(message) {
    }
    send(command, data) {
        this.child.send({ command: command, data: data });
    }
    start(data) {
        this.send('start', data);
        return Promise.resolve();
    }
    aborted(message) {
    }
    stopped() {
        this.p.stop.forEach((resolve) => { resolve(); });
        this.p.stop = [];
    }
    stop() {
        return new Promise((resolve, reject) => {
            this.p.stop.push(resolve);
            this.send('stop', {});
        });
    }
    alived(message) {
        this.p.alive.forEach((resolve) => { resolve(!!message.data); });
        this.p.alive = [];
    }
    alive() {
        return new Promise((resolve, reject) => {
            this.p.alive.push(resolve);
            this.send('alive', {});
        });
    }
}
function Timeout(time, p) {
    return new Promise((resolve, reject) => {
        let timeout = false;
        const timer = setTimeout(() => { timeout = true; reject(new Error('timeout')); }, time);
        p.then((data) => {
            if (timeout) {
                return;
            }
            clearTimeout(timer);
            resolve(data);
        }).catch((error) => { reject(error); });
    });
}
class MonitorServer extends WebServer {
    constructor(config, nows) {
        super(config);
        this.nows = nows;
    }
    onMessage(message) {
        switch (message.command) {
            case 'servers': return this.getServerList();
        }
    }
    getServerList() {
        const data = { max: 0, list: [] };
        const servers = this.nows.getServers();
        const p = [];
        Object.keys(servers).forEach((url) => {
            const server = { url: url, alive: false };
            p.push(Timeout(5000, servers[url].alive()).catch(() => { return false; }).then((alive) => {
                server.alive = alive;
            }));
            data.list.push(server);
        });
        return Promise.all(p).then(() => {
            data.list.sort((a, b) => { return a.url < b.url ? -1 : 1; });
            this.send('servers', data);
        });
    }
}
class NoWS {
    constructor(config) {
        this.config = config;
        this.servers = {};
    }
    getServers() { return this.servers; }
    stopServer(url) {
        return true;
    }
    startServer(config) {
        if (config.module === path.join(__dirname, './Server/Monitor')) {
            return new MonitorServer(config, this);
        }
        return new WebServer(config);
    }
    start() {
        return this.config.load().then(() => {
            this.config.gets().forEach((config) => {
                const key = (config.ssl && config.ssl.key && config.ssl.cert ? 'https://' : 'http://') + config.host + ':' + config.port;
                if (config.disable) {
                    return;
                }
                this.servers[key] = this.startServer(config);
            });
        });
    }
    stop() {
        const p = [];
        Object.keys(this.servers).forEach((url) => {
            p.push(this.servers[url].stop().then(() => {
                delete this.servers[url];
            }));
        });
        return Promise.all(p).then(() => { });
    }
}
exports.default = NoWS;
