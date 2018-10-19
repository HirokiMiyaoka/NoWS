function FetchJSON(input, init) {
    return fetch(input, init).then((response) => {
        if (response.ok) {
            return response.json();
        }
        return response.json().then((error) => { throw error; });
    });
}
function Get(api, data) {
    if (data !== undefined) {
        api += '?' + Object.keys(data).map((key) => { return key + '=' + encodeURIComponent(data[key] + ''); }).join('&');
    }
    return FetchJSON(api);
}
function Post(api, data) {
    const option = {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    };
    if (data !== undefined) {
        option.body = JSON.stringify(data);
    }
    return FetchJSON(api, option);
}
const API = {
    server: {
        list: () => { return Get('/api/server/list'); },
        stop: (url) => {
            const data = { url: [] };
            if (typeof url === 'string') {
                data.url.push(url);
            }
            else {
                data.url = url;
            }
            return Post('/api/server/stop', data);
        },
    },
};
class MyWebComponents extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        const template = this.loadTemplate();
        this.shadow.appendChild(document.importNode(template.content, true));
        this.init();
    }
    loadTemplate() { return document.createElement('template'); }
    init() { }
}
class ServerList extends MyWebComponents {
    loadTemplate() { return document.getElementById('template_serverlist'); }
    init() {
        this.list = this.shadow.querySelector('div');
    }
    add(item) {
        const children = this.list.children;
        for (let i = 0; i < children.length; ++i) {
            const child = children[i];
            if (child.url !== item.url) {
                continue;
            }
            this.list.insertBefore(item, child);
            this.list.removeChild(child);
            return;
        }
        this.list.appendChild(item);
    }
    update() {
        const children = this.list.children;
        for (let i = 0; i < children.length; ++i) {
            const child = children[i];
            if (child.alive !== undefined) {
                child.alive = false;
            }
        }
        API.server.list().then((res) => {
            res.list.forEach((server) => {
                const item = new ServerListItem();
                item.url = server.url;
                item.alive = server.alive;
                this.add(item);
            });
        });
    }
}
class ServerListItem extends MyWebComponents {
    static get observedAttributes() {
        return ['url', 'alive'];
    }
    loadTemplate() { return document.getElementById('template_serverlist_item'); }
    init() {
        this.alivedata = this.shadow.querySelector('.alive');
        this.urldata = this.shadow.querySelector('.url');
    }
    get url() { return this.getAttribute('url'); }
    set url(value) { this.setAttribute('url', value + ''); }
    get alive() { return this.hasAttribute('alive'); }
    set alive(value) { if (value) {
        this.setAttribute('alive', '');
    }
    else {
        this.removeAttribute('alive');
    } }
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case 'alive':
                this.alivedata.classList[this.alive ? 'add' : 'remove']('on');
                break;
            case 'url':
                this.urldata.textContent = newValue;
                break;
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    customElements.define('server-list', ServerList);
    customElements.define('server-listitem', ServerListItem);
    const serverlist = document.querySelector('server-list');
    serverlist.update();
});
