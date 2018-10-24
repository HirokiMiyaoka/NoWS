import * as http from 'http'
import * as https from 'https'
import * as stream from 'stream'
import * as Static from './Static'

export default function CreateServer( conf: ServerConfig ) { return new Server(); }

export class Server extends Static.Server
{
	protected child: ChildServer;
	private p:
	{
		servers: (( value: ResponseServerList ) => void)[],
	};

	public init( conf: ServerConfig, server: ChildServer )
	{
		this.child = server;
		return super.init( conf, server ).then( () =>
		{
			this.p =
			{
				servers: [],
			};
			server.setOnMessage( ( message ) => { this.onMessage( message ); } );
		} );
	}

	private onMessage( message: any )
	{
		switch( message.command )
		{
			case 'servers': return this.getServerList( (<NoWSToChildMessage<'servers'>>message).data );
		}
	}

	private responseJSON( res: http.ServerResponse, data: any, statusCode = 200 )
	{
		res.writeHead( statusCode, { 'Content-Type': 'application/json' } );
		res.write( JSON.stringify( data ) );
		res.end();
	}

	private analysisData( src: string )
	{
		const data: { [ key: string ]: string } = {};

		src.split( '&' ).forEach( ( dataset ) =>
		{
			const kv = dataset.split( '=' );
			if ( !kv[ 0 ] ) { return; }
			data[ kv[ 0 ] ] = kv[ 1 ] || '';
		} );

		return data;
	}

	private requestGet( request: http.IncomingMessage )
	{
		const get = (<string>request.url).split( '?' );
		return this.analysisData( get[ 1 ] || '' );
	}

	private requestPost( request: http.IncomingMessage )
	{
		return new Promise<string>( ( resolve, reject ) =>
		{
			//const buftrans = new stream.Transform( { transform( chunk, encoding, callback ) { callback( undefined, chunk ); } } );
			//request.pipe( buftrans );
			const bufs: Buffer[] = [];

			request.on( 'data', ( data: string|Buffer ) =>{
				//request.connection.destroy();
				bufs.push( ( typeof data === 'string' ) ? Buffer.from( data, 'utf-8' ) : data );
			} );
			request.on('end', () =>
			{
				resolve( Buffer.concat( bufs ).toString( 'utf-8' ) );
			} );
			request.on( 'error', ( error ) => { reject( error ); } );
			request.on( 'aborted', ( error ) => { reject( error ); } );
		} );
	}

	private requestPostJSON<T>( request: http.IncomingMessage )
	{
		return this.requestPost( request ).then( ( data ) => { return <T>JSON.parse( data ); } )
	}

	private getServerList( data: ResponseServerList )
	{
		this.p.servers.forEach( ( resolve ) => { resolve( data ); } );
		this.p.servers = [];
	}

	public apiServerList( req: http.IncomingMessage, res: http.ServerResponse )
	{
		return new Promise<ResponseServerList>( ( resolve, reject ) =>
		{
			this.p.servers.push( resolve );
			this.child.send( 'servers', {} );
		} ).then( ( data ) =>
		{
			this.responseJSON( res, data );
		} );
	}

	public apiServerStop( req: http.IncomingMessage, res: http.ServerResponse )
	{
		let p: Promise<void> = Promise.resolve();
		const urls: string[] = [];
		switch ( req.method )
		{
			case 'GET':
				const data = this.requestGet( req );
				if ( data.url ) { urls.push( data.url ); }
				break;
			case 'POST':
				p = this.requestPostJSON<RequestServerStop>( req ).then( ( data ) =>
				{
					if ( data && Array.isArray( data.url ) )
					{
						urls.push( ... data.url );
					}
				} );
				break;
		}
		return p.then( () =>
		{
		/*	const data: ResponseServerStop = { url: {} };
			urls.forEach( ( url ) =>
			{
				data.url[ url ] = this.mserver.stopServer( url );
			} );
			this.responseJSON( res, data );*/
		} );
	}

	public onAPI( req: http.IncomingMessage, res: http.ServerResponse )
	{
		const api = ( req.url || '' ).replace( /^\/api\/([^\?]*).*$/, '$1' );

		switch ( api )
		{
			case 'server/list': this.apiServerList( req, res ); break;
			case 'server/stop': this.apiServerStop( req, res ); break;
			default: this.responseJSON( res, { message: 'No API' }, 404 ); break;
		}
	}

	public start()
	{
		this.server.on( 'request', ( req: http.IncomingMessage, res: http.ServerResponse ) =>
		{
			const url = req.url || '/';
console.log(url);
			if ( url.match( /^\/api\// ) )
			{
				this.onAPI( req, res );
			} else
			{
				this.onRequest( req, res );
			}
		} );

console.log( this.host + ':' + this.port );
		this.server.listen( this.port, this.host );
return Promise.resolve();
	}

	public stop() { this.server.close();return Promise.resolve(); }
}
