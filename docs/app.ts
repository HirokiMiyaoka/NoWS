/// <reference path="../src/types.d.ts" />

function FetchJSON<T>( input: RequestInfo, init?: RequestInit )
{
	return fetch( input, init ).then( ( response ) =>
	{
		if ( response.ok ) { return <Promise<T>>response.json(); }
		return response.json().then( ( error ) => { throw error; } );
	} );
}

function Get<T>( api: string, data?: { [ key: string ]: string | number | boolean } )
{
	if ( data !== undefined ) { api += '?' + Object.keys( data ).map( ( key ) => { return key + '=' + encodeURIComponent( data[ key ] + '' ); } ).join( '&' ); }
	return FetchJSON<T>( api );
}

function Post<T>( api: string, data?: any )
{
	const option: RequestInit =
	{
		method: 'POST',
		headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
	};
	if ( data !== undefined ) { option.body = JSON.stringify( data ); }
	return FetchJSON<T>( api, option );
}

const API =
{
	server:
	{
		list: () => { return Get<ResponseServerList>( '/api/server/list' ); },
		stop: ( url: string | string[] ) =>
		{
			const data: RequestServerStop = { url: [] };
			if ( typeof url === 'string' ) { data.url.push( url ); } else { data.url = url; }
			return Post<ResponseServerStop>( '/api/server/stop', data );
		},
	},
};

class MyWebComponents extends HTMLElement {
	protected shadow: ShadowRoot;

	constructor()
	{
		super();

		this.shadow = this.attachShadow( { mode: 'open' } );

		const template = this.loadTemplate();

		this.shadow.appendChild( document.importNode( template.content, true ) );

		this.init();
	}

	protected loadTemplate() { return document.createElement( 'template' ); }

	protected init() {}
}

class ServerList extends MyWebComponents
{
	protected list: HTMLElement;

	protected loadTemplate() { return <HTMLTemplateElement>document.getElementById( 'template_serverlist' ); }

	protected init()
	{
		this.list = <HTMLElement>this.shadow.querySelector( 'div' );
	}

	public add( item: ServerListItem )
	{
		const children = this.list.children;
		for ( let i = 0 ; i < children.length ; ++i )
		{
			const child = <ServerListItem>children[ i ];
			if ( child.url !== item.url ) { continue; }
			this.list.insertBefore( item, child );
			this.list.removeChild( child );
			return;
		}
		this.list.appendChild( item );
	}

	public update()
	{
		const children = this.list.children;
		for ( let i = 0 ; i < children.length ; ++i )
		{
			const child = <ServerListItem>children[ i ];
			if ( child.alive !== undefined ) { child.alive = false; }
		}
		API.server.list().then( ( res ) =>
		{
			res.list.forEach( ( server ) =>
			{
				const item = new ServerListItem();
				item.url = server.url;
				item.alive = server.alive;
				this.add( item );
			} );
		} );
	}
}

class ServerListItem extends MyWebComponents
{
	static get observedAttributes()
	{
		return [ 'url', 'alive' ];
	}

	protected loadTemplate() { return <HTMLTemplateElement>document.getElementById( 'template_serverlist_item' ); }

	protected alivedata: HTMLElement;
	protected urldata: HTMLElement;

	protected init()
	{
		this.alivedata = <HTMLElement>this.shadow.querySelector( '.alive' );
		this.urldata = <HTMLElement>this.shadow.querySelector( '.url' );
	}

	get url() { return this.getAttribute( 'url' ); }
	set url( value ) { this.setAttribute( 'url', value + '' ); }

	get alive() { return this.hasAttribute( 'alive' ); }
	set alive( value ) { if ( value ) { this.setAttribute( 'alive', '' ); } else { this.removeAttribute( 'alive' ); } }

	public attributeChangedCallback( name: string, oldValue: string, newValue: string )
	{
		switch ( name )
		{
			case 'alive':
				this.alivedata.classList[ this.alive ? 'add' : 'remove' ]( 'on' );
				break;
			case 'url':
				this.urldata.textContent = newValue;
				break;
		}
	}
}

document.addEventListener( 'DOMContentLoaded', () =>
{
	customElements.define( 'server-list', ServerList );
	customElements.define( 'server-listitem', ServerListItem );

	const serverlist = <ServerList>document.querySelector( 'server-list' );
	serverlist.update();
} );
