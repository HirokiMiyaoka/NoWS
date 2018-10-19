"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const JSON5 = require("json5");
function stat(path) {
    return new Promise((resolve, reject) => {
        fs.stat(path, (error, stats) => {
            if (error) {
                return reject(error);
            }
            resolve(stats);
        });
    });
}
exports.stat = stat;
function statSync(path) { return fs.statSync(path); }
exports.statSync = statSync;
function readdir(path) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (error, files) => {
            if (error) {
                return reject(error);
            }
            resolve(files);
        });
    });
}
exports.readdir = readdir;
function mkdir(path, mode) {
    return new Promise((resolve, reject) => {
        fs.mkdir(path, mode, (error) => {
            if (error && error.code !== 'EEXIST') {
                return reject({ error: error });
            }
            resolve();
        });
    });
}
exports.mkdir = mkdir;
function writeFile(path, data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, data, (error) => {
            if (error) {
                return reject(error);
            }
            resolve();
        });
    });
}
exports.writeFile = writeFile;
function readFile(path, options) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, options, (error, data) => {
            if (error) {
                return reject(error);
            }
            resolve(data);
        });
    });
}
exports.readFile = readFile;
function readFileSync(path, options) {
    return fs.readFileSync(path, options);
}
exports.readFileSync = readFileSync;
function createReadStream(path, options) {
    return fs.createReadStream(path, options);
}
exports.createReadStream = createReadStream;
function readJson5(path, options, receiver) {
    return readFile(path, options).then((data) => {
        return JSON5.parse(typeof data === 'string' ? data : data.toString('utf-8', 0, data.length), receiver);
    });
}
exports.readJson5 = readJson5;
