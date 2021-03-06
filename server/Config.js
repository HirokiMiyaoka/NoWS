"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("./Pfs");
const path = require("path");
const child_process_1 = require("child_process");
function ExecCommand(command) {
    return new Promise((resolve, reject) => {
        child_process_1.exec(command, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }
            resolve({ stdout: stdout, stderr: stderr });
        });
    });
}
class Config {
    constructor(dir) {
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
    toAbsolutePath(dir) {
        return path.normalize(path.join(__dirname, '../', dir));
    }
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
                return fs.readJson5(path.join(dir, file)).then((config) => {
                    const p = [];
                    if (typeof config !== 'object' || typeof config.port !== 'number' ||
                        typeof config.host !== 'string' || !config.host) {
                        throw new Error('Invalid config.');
                    }
                    config.port = Math.floor(config.port);
                    if (config.port < 0 || 65535 < config.port) {
                        throw new Error('Invalid port.');
                    }
                    const newconf = {
                        host: config.host,
                        port: config.port,
                        ssl: { key: '', cert: '' },
                        user: 0,
                        allow: [],
                        deny: [],
                        disable: config.disable === true,
                        docs: '',
                        errs: '',
                        mime: {},
                        replace: { pattern: '', substr: '' },
                        dir_index: ['index.html'],
                        headers: {},
                        log: {},
                        module: './Server/Static',
                        option: config.option,
                    };
                    if (typeof process.getuid === 'function') {
                        newconf.user = process.getuid();
                    }
                    if (config.docs && typeof config.docs === 'string') {
                        const dir = path.normalize(config.docs);
                        newconf.docs = path.isAbsolute(dir) ? dir : this.toAbsolutePath(dir);
                    }
                    if (config.errs && typeof config.errs === 'string') {
                        const dir = path.normalize(config.errs);
                        newconf.errs = path.isAbsolute(dir) ? dir : path.join(newconf.docs, dir);
                    }
                    if (typeof config.ssl === 'object' && typeof config.ssl.key === 'string' && typeof config.ssl.cert === 'string') {
                        newconf.ssl.key = config.ssl.key;
                        newconf.ssl.cert = config.ssl.cert;
                    }
                    if (typeof config.user === 'string') {
                        p.push(ExecCommand('id -u ' + config.user).then((result) => {
                            const uid = parseInt(result.stdout);
                            if (isNaN(uid)) {
                                return;
                            }
                            config.user = uid;
                        }).catch(() => { }));
                    }
                    if (config.allow) {
                        (Array.isArray(config.allow) ? config.allow : [config.allow]).forEach((ipaddress) => {
                            if (typeof ipaddress !== 'string') {
                                return;
                            }
                            newconf.allow.push(ipaddress);
                        });
                    }
                    if (config.deny) {
                        (Array.isArray(config.deny) ? config.deny : [config.deny]).forEach((ipaddress) => {
                            if (typeof ipaddress !== 'string') {
                                return;
                            }
                            newconf.deny.push(ipaddress);
                        });
                    }
                    if (typeof config.mime === 'object') {
                        const mime = config.mime;
                        Object.keys(mime).forEach((ext) => {
                            if (ext.match(/[^A-Za-z0-9]/) || typeof mime[ext] !== 'string') {
                                return;
                            }
                            newconf.mime[ext] = mime[ext];
                        });
                    }
                    if (typeof config.replace === 'object' && typeof config.replace.pattern === 'string' && config.replace.substr === 'string') {
                        newconf.replace.pattern = config.replace.pattern;
                        newconf.replace.substr = config.replace.substr;
                    }
                    if (config.dir_index) {
                        if (typeof config.dir_index === 'string') {
                            newconf.dir_index = [config.dir_index];
                        }
                        if (Array.isArray(config.dir_index)) {
                            newconf.dir_index = config.dir_index.concat();
                        }
                    }
                    if (typeof config.headers === 'object') {
                        const headers = config.headers;
                        Object.keys(headers).forEach((key) => {
                            if (typeof headers[key] !== 'string') {
                                return;
                            }
                            newconf.headers[key] = headers[key];
                        });
                    }
                    if (config.log) {
                        if (config.log.default === null || typeof config.log.default === 'string') {
                            newconf.log.default = config.log.default;
                        }
                        if (config.log.assert === null || typeof config.log.assert === 'string') {
                            newconf.log.assert = config.log.assert;
                        }
                        if (config.log.debug === null || typeof config.log.debug === 'string') {
                            newconf.log.debug = config.log.debug;
                        }
                        if (config.log.error === null || typeof config.log.error === 'string') {
                            newconf.log.error = config.log.error;
                        }
                        if (config.log.info === null || typeof config.log.info === 'string') {
                            newconf.log.info = config.log.info;
                        }
                        if (config.log.log === null || typeof config.log.log === 'string') {
                            newconf.log.log = config.log.log;
                        }
                        if (config.log.warn === null || typeof config.log.warn === 'string') {
                            newconf.log.warn = config.log.warn;
                        }
                        if (typeof config.log.size === 'number' && 0 < config.log.size) {
                            newconf.log.size = config.log.size;
                        }
                    }
                    if (typeof config.module === 'string') {
                        newconf.module = path.isAbsolute(config.module) ? config.module : this.toAbsolutePath(path.join('server/Server', config.module));
                    }
                    return Promise.all(p).then(() => { return newconf; });
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
