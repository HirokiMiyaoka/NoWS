"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("./Pfs");
const path = require("path");
class Config {
    constructor(dir) {
        this.conf =
            {
                host: 'localhost',
                port: 18080,
                ssl: { key: '', cert: '' },
                disable: true,
                docs: path.join(path.dirname(process.argv[1]), '../docs'),
                mime: {},
                replace: { pattern: '', substr: '' },
                option: {},
                log: {},
            };
        this.confs = {};
        this.event =
            {
                add: [],
                remove: [],
                modify: [],
                updated: [],
            };
        this.dir = dir;
    }
    get() { return this.conf; }
    gets() {
        return Object.keys(this.confs).map((key) => { return this.confs[key]; });
    }
    diff(confs) {
        const diff = { add: {}, remove: {}, modify: {} };
        Object.keys(this.confs).forEach((file) => {
            if (!confs[file]) {
                diff.remove[file] = this.confs[file];
                return;
            }
            const a = confs[file];
            const b = this.confs[file];
            if (a.host === b.host && a.port === b.port && a.ssl === b.ssl && a.disable === b.disable) {
                return;
            }
            diff.modify[file] = confs[file];
        });
        Object.keys(confs).forEach((file) => {
            if (this.confs[file]) {
                return;
            }
            diff.add[file] = confs[file];
        });
        return diff;
    }
    load() {
        return this.loadConfigs(this.dir).then((confs) => {
            const diff = this.diff(confs);
            let update = false;
            Object.keys(diff.add).forEach((file) => {
                update = true;
                this.confs[file] = confs[file];
                const data = { type: 'add', data: confs[file] };
                this.event.add.forEach((listener) => { listener(data); });
            });
            Object.keys(diff.modify).forEach((file) => {
                update = true;
                this.confs[file] = confs[file];
                const data = { type: 'modify', data: confs[file] };
                this.event.modify.forEach((listener) => { listener(data); });
            });
            Object.keys(diff.remove).forEach((file) => {
                update = true;
                delete this.confs[file];
                const data = { type: 'remove', data: confs[file] };
                this.event.remove.forEach((listener) => { listener(data); });
            });
            if (!update) {
                return;
            }
            const data = { type: 'updated', data: null };
            this.event.updated.forEach((listener) => { listener(data); });
        });
    }
    loadConfigs(dir) {
        return fs.readdir(dir).then((files) => {
            return files.filter((file) => {
                if (!file.match(/\.json5?$/)) {
                    return false;
                }
                const stat = fs.statSync(path.join(dir, file));
                return stat && stat.isFile();
            });
        }).then((files) => {
            return Promise.all(files.map((file) => {
                return fs.readJson5(path.join(dir, file)).then((conf) => {
                    console.log(file, conf);
                    if (typeof conf !== 'object' ||
                        typeof conf.host !== 'string' || !conf.host ||
                        typeof conf.port !== 'number') {
                        return null;
                    }
                    conf.port = Math.floor(conf.port);
                    if (conf.port < 0 || 65535 < conf.port) {
                        return null;
                    }
                    const newconf = {
                        host: conf.host,
                        port: conf.port,
                        ssl: { key: '', cert: '' },
                        disable: conf.disable === false,
                        docs: '',
                        mime: {},
                        replace: { pattern: '', substr: '' },
                        option: conf.option,
                    };
                    if (conf.docs && typeof conf.docs === 'string') {
                        const dir = path.normalize(conf.docs);
                        newconf.docs = path.isAbsolute(dir) ? dir : path.normalize(path.join(path.dirname(process.argv[1]), '../', dir));
                    }
                    if (typeof conf.ssl === 'object' && typeof conf.ssl.key === 'string' && typeof conf.ssl.cert === 'string') {
                        newconf.ssl.key = conf.ssl.key;
                        newconf.ssl.cert = conf.ssl.cert;
                    }
                    if (typeof conf.mime === 'object') {
                        const mime = conf.mime;
                        Object.keys(mime).forEach((ext) => {
                            if (ext.match(/[^A-Za-z0-9]/) || typeof mime[ext] !== 'string') {
                                return;
                            }
                            newconf.mime[ext] = mime[ext];
                        });
                    }
                    if (typeof conf.replace === 'object' && typeof conf.replace.pattern === 'string' && conf.replace.substr === 'string') {
                        newconf.replace.pattern = conf.replace.pattern;
                        newconf.replace.substr = conf.replace.substr;
                    }
                    if (file !== 'config.json' && file !== 'config.json5') {
                        return newconf;
                    }
                    this.conf = Object.assign(newconf, { log: {} });
                    const nconf = conf;
                    if (nconf.log) {
                        if (nconf.log.err === null || typeof nconf.log.err === 'string') {
                            this.conf.log.err = nconf.log.err;
                        }
                        if (nconf.log.out === null || typeof nconf.log.out === 'string') {
                            this.conf.log.out = nconf.log.out;
                        }
                    }
                    return null;
                }).catch((error) => { return null; }).then((conf) => { return { file: file, conf: conf }; });
            })).then((p) => {
                const confs = {};
                p.forEach((data) => { if (data.conf) {
                    confs[data.file] = data.conf;
                } });
                return confs;
            });
        });
    }
    addEventListener(type, listener) {
        if (this.event[type]) {
            return;
        }
        this.event[type].push(listener);
    }
    removeEventListener(type, listener) {
        if (this.event[type]) {
            return;
        }
        const array = this.event[type];
        const index = array.indexOf(listener);
        if (index < 0) {
            return;
        }
        array.splice(index, 1);
    }
}
exports.default = Config;