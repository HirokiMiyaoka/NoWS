import * as fs from '../Pfs'
import * as path from 'path'
import * as http from 'http'
import * as https from 'https'
import * as process from 'process'

export const MIME: { [ key: string ]: string } =
{
	css:	'text/css',
	gif:	'image/gif',
	gz:	'application/gzip',
	html:	'text/html',
	ico:	'image/x-icon',
	jpg:	'image/jpeg',
	js:	'text/javascript',
	json:	'application/json',
	jsonp:	'application/javascript',
	png:	'image/png',
	svg:	'image/svg+xml',
	svgz:	'image/svg+xml',
	txt:	'text/plain',
	zip:	'application/zip',
	wasm:	'application/wasm',
	webp:	'image/webp',
};

export default function CreateServer( conf: ServerConfig )
{
	// TODO: switch
	// TODO: throw
	const server = new Server();

	return server;
}

export class Server implements NodeWebServer
{
	protected ssl: boolean;
	protected host: string;
	protected port: number;
	protected docroot: string;
	protected defFile: string;
	protected mime: { [ key: string ]: string };
	protected server: http.Server | https.Server;

	constructor()
	{
	}

	public init( conf: ServerConfig, server: ChildServer )
	{
		this.ssl = false;
		this.host = conf.host;
		this.port = conf.port;
		this.docroot = path.join( conf.docs || '' );
		this.mime = Object.assign( {}, MIME );
		this.defFile = 'index.html';

		const option = { key: '', cert: '' };
		if ( conf.ssl && option.key && option.cert )
		{
			this.ssl = true;
			option.key = this.loadPemFile( conf.ssl.key );
			option.cert = this.loadPemFile( conf.ssl.cert );
		}

		this.server = this.ssl ? https.createServer( option ) : http.createServer();

		return Promise.resolve();
	}

	private loadPemFile( file: string )
	{
		if ( !file || !file.match( /\.pem$/ ) ) { return file; }
		try
		{
			const data = fs.readFileSync( file );
			if ( typeof data === 'string' ) { return data; }
			return data.toString( 'utf-8' );
		} catch( error ) {}
		return '';
	}

	protected e404( res: http.ServerResponse )
	{
		res.writeHead( 404, { 'Content-Type': 'text/plain' } );
		res.write( '404: page not found.' );
		res.end();
	}

	protected responseText( res: http.ServerResponse, filepath: string, mime: string )
	{
		return fs.readFile( filepath, 'utf-8' ).then( ( data ) =>
		{
			res.writeHead( 200, { 'Content-Type': mime } );
			res.write( data );
			res.end();
		} ).catch( ( error ) =>
		{
			this.e404( res );
		} );
	}

	protected responseBinary( res: http.ServerResponse, filepath: string, mime: string )
	{
		return fs.readFile( filepath ).then( ( data ) =>
		{
			res.writeHead( 200, { 'Content-Type': mime } );
			res.write( data );
			res.end();
		} ).catch( () =>
		{
			this.e404( res );
		} );
	}

	protected fileExists( filepath: string )
	{
		try
		{
			return fs.statSync( filepath ).isFile();
		} catch( err ) {}
		return false;
	}

	protected checkFile( filepath: string )
	{
		if ( filepath.match( /\/$/ ) ) { filepath += this.defFile; }
		filepath = path.join( this.docroot, filepath );

		// TODO: check up docs

		if ( this.fileExists( filepath ) ) { return filepath; }

		return '';
	}

	public onRequest( req: http.IncomingMessage, res: http.ServerResponse )
	{
		const filepath = this.checkFile( ( req.url || '/' ).split( '?' )[ 0 ] );

		if ( !filepath ) { return this.e404( res ); }

		var extname = path.extname( filepath ).replace( '.', '' );
		var mime = this.mime[ extname ] || 'text/plain';

		if ( mime.indexOf( 'text/' ) === 0 )
		{
			this.responseText( res, filepath, mime );
		} else
		{
			this.responseBinary( res, filepath, mime );
		}
	}

	public start()
	{
		return new Promise( ( resolve, reject ) =>
		{
//this.server.on( 'checkContinue', ( req: http.IncomingMessage, res: http.ServerResponse ) => { console.log( '', arguments ); } );
//this.server.on( 'checkExpectation', ( req: http.IncomingMessage, res: http.ServerResponse ) => { console.log( '', arguments ); } );
//this.server.on( 'clientError', ( exception: Error, socket: net.Socket ) => { console.log( '', arguments ); } );
			this.server.on( 'close', () => {} );
//this.server.on( 'connect', ( request: http.IncomingMessage, socket: net.Socket, head: Buffer ) => { console.log( '', arguments ); } );
//this.server.on( 'connection', ( socket: net.Socket ) => { console.log( '', arguments ); } );
			this.server.on( 'request', ( req, res ) => { this.onRequest( req, res ); } );
//this.server.on( 'upgrade', ( request: http.IncomingMessage, socket: net.Socket, head: Buffer ) => { console.log( '', arguments ); } );

console.log( this.host + ':' + this.port );
			this.server.listen( this.port, this.host, () => { resolve(); } );
		} ).then( () =>
		{
			//if (  ){}
		} );
	}

	public stop()
	{
		this.server.close();
		return Promise.resolve();
	}

	public alive() { return Promise.resolve( this.server.listening ); }
}

export class ReplaceServer extends Server
{

	protected checkFile( filepath: string )
	{
		filepath = path.join( this.docroot, filepath );

		if ( this.fileExists( filepath ) ) { return filepath; }

		// Not found.
		if ( filepath.match( /\.[^\.]+$/ ) ) { return ''; }

		// SPA && path is not file( e.g: /, /test/, /hoge/fuga, ...)
		filepath = path.join( this.docroot, this.defFile );
		if ( this.fileExists( filepath ) ) { return filepath; }

		return '';
	}

}
