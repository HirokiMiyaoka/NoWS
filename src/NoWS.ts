import Config from './Config'
import * as fs from './Pfs'
import * as path from 'path'
import * as child from 'child_process'

// TODO:
// Proxy server

class WebServer
{
	protected config: ServerConfig;
	protected child: child.ChildProcess;
	protected p:
	{
		alive: ( ( value: boolean ) => void )[],
		stop:  ( () => void )[],
	};

	constructor( config: ServerConfig )
	{
		this.config = config;
		this.p = { alive: [], stop: [] };
		this.child = child.fork( path.join( __dirname, 'Server.js' ) );

		this.child.on( 'message', ( message ) =>
		{
console.log('parent:',message);
			if ( typeof message !== 'object' ) { return; }
			switch ( <keyof NoWSToParentMessageMap>message.command )
			{
				case 'prepare': return this.start( this.config );
				case 'alive': return this.alived( <NoWSToParentMessage<'alive'>>message );
				case 'aborted': return this.aborted( <NoWSToParentMessage<'aborted'>>message );
				case 'stop': return this.stopped();
				default: this.onMessage( message );
			}
		} );
	}

	protected onMessage( message: any )
	{
	}

	public send<T extends keyof NoWSToChildMessageMap>( command: T, data: NoWSToChildMessageMap[ T ] )
	{
		this.child.send( { command: command, data: data } );
	}

	public start( data: ServerConfig )
	{
		this.send( 'start', data );
		return Promise.resolve();
	}

	public aborted( message: any )
	{

	}

	private stopped()
	{
		this.p.stop.forEach( ( resolve ) => { resolve(); } );
		this.p.stop = [];
	}

	public stop()
	{
		return new Promise( ( resolve, reject ) =>
		{
			this.p.stop.push( resolve );
			this.send( 'stop', {} );
		} );
	}

	private alived( message: NoWSToParentMessage<'alive'> )
	{
		this.p.alive.forEach( ( resolve ) => { resolve( !!message.data ); } );
		this.p.alive = [];
	}

	public alive()
	{
		return new Promise<boolean>( ( resolve, reject ) =>
		{
			this.p.alive.push( resolve );
			this.send( 'alive', {} );
		} );
	}
}

function Timeout<T>( time: number, p: Promise<T> )
{
	return new Promise<T>( ( resolve, reject ) =>
	{
		let timeout = false;
		// I want to cancel Promise.
		const timer = setTimeout( () => { timeout = true; reject( new Error( 'timeout' ) ); }, time );
		p.then( ( data ) =>
		{
			if ( timeout ) { return; } // Rejected.
			clearTimeout( timer );
			resolve( data );
		} ).catch( ( error ) => { reject( error ); } );
	} );
}

class MonitorServer extends WebServer
{
	private nows: NoWS;

	constructor( config: ServerConfig, nows: NoWS )
	{
		super( config );
		this.nows = nows;
	}

	protected onMessage( message: any )
	{
		switch ( <keyof NoWSToParentMessageMap>message.command )
		{
			case 'servers': return this.getServerList();
		}
	}

	private getServerList()
	{
		const data: ResponseServerList = { max: 0, list: [] };

		const servers = this.nows.getServers();
		const p: Promise<void>[] = [];

		Object.keys( servers ).forEach( ( url ) =>
		{
			const server = { url: url, alive: false };
			p.push( Timeout<boolean>( 5000, servers[ url ].alive() ).catch( () => { return false } ).then( ( alive ) =>
			{
				server.alive = alive;
			} ) );
			data.list.push( server );
		} );

		return Promise.all( p ).then( () =>
		{
			data.list.sort( ( a, b ) => { return a.url < b.url ? -1 : 1; } );
			this.send( 'servers', data );
		} );
	}
}

export default class NoWS
{
	private config: Config;
	private servers: { [ key: string ]: WebServer };

	constructor( config: Config )
	{
		this.config = config;
		this.servers = {};
	}

	// API

	public getServers() { return this.servers; }
/*
	public getConfig() { return this.config; }

	public getServer( url: string ): NodeWebServer|null { return this.servers[ url ]; }

	public getServerUrls() { return Object.keys( this.servers ); }
*/
	public stopServer( url: string )
	{
		return true;
	}

	private startServer( config: ServerConfig )
	{
		if ( config.module === path.join( __dirname, './Server/Monitor' ) )
		{
			return new MonitorServer( config, this );
		}
		return new WebServer( config );
	}

	public start()
	{
		return this.config.load().then( () =>
		{
			this.config.gets().forEach( ( config ) =>
			{
				const key = ( config.ssl && config.ssl.key && config.ssl.cert ? 'https://' : 'http://' ) + config.host + ':' + config.port;

				if ( config.disable )
				{
					// TODO: stop.
					return;
				}

				this.servers[ key ] = this.startServer( config );
			} );

		} );
	}

	public stop()
	{
		const p: Promise<void>[] = [];
		Object.keys( this.servers ).forEach( ( url ) =>
		{
			p.push( this.servers[ url ].stop().then( () =>
			{
				delete this.servers[ url ];
			} ) );
		} );

		return Promise.all( p ).then( () => {} );
	}
}
