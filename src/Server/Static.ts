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

export const HttpStatusCode =
{
	100: 'Continue',
	101: 'Switching Protocols',
	102: 'Processing',
	103: 'Early Hints',

	200: 'OK',
	201: 'Created',
	202: 'Accepted',
	203: 'Non-Authoritative Information',
	204: 'No Content',
	205: 'Reset Content',
	206: 'Partial Content',
	207: 'Multi-Status',
	208: 'Already Reported',
	226: 'IM Used',

	300: 'Multiple Choices',
	301: 'Moved Permanently',
	302: 'Found',
	303: 'See Other',
	304: 'Not Modified',
	305: 'Use Proxy',
	306: '(Unused)',
	307: 'Temporary Redirect',
	308: 'Permanent Redirect',

	400: 'Bad Request',
	401: 'Unauthorized',
	402: 'Payment Required',
	403: 'Forbidden',
	404: 'Not Found',
	405: 'Method Not Allowed',
	406: 'Not Acceptable',
	407: 'Proxy Authentication Required',
	408: 'Request Timeout',
	409: 'Conflict',
	410: 'Gone',
	411: 'Length Required',
	412: 'Precondition Failed',
	413: 'Payload Too Large',
	414: 'URI Too Long',
	415: 'Unsupported Media Type',
	416: 'Range Not Satisfiable',
	417: 'Expectation Failed',
	418: "I'm a teapot",
	421: 'Misdirected Request',
	422: 'Unprocessable Entity',
	423: 'Locked',
	424: 'Failed Dependency',
	425: 'Too Early',
	426: 'Upgrade Required',
	451: 'Unavailable For Legal Reasons',

	500: 'Internal Server Error',
	501: 'Not Implemented',
	502: 'Bad Gateway',
	503: 'Service Unavailable',
	504: 'Gateway Timeout',
	505: 'HTTP Version Not Supported',
	506: 'Variant Also Negotiates',
	507: 'Insufficient Storage',
	508: 'Loop Detected',
	509: 'Bandwidth Limit Exceeded',
	510: 'Not Extended',
	511: 'Network Authentication Required',
};

export default function CreateServer( config: ServerConfig )
{
	// TODO: throw
	if ( config.replace && typeof config.replace.pattern === 'string' && config.replace.substr === 'string' )
	{
		return new ReplaceServer();
	}

	return new Server();
}

function ErrorToCode( error: any )
{
	if ( !error || typeof error.code !== 'string' ) { return 404; }
	switch ( error.code )
	{
		case 'EACCES': return 403;
		case 'ECONNREFUSED': return 408;
		case 'ECONNRESET': return 408;
		//case 'EEXIST':
		case 'EISDIR': break;
		case 'EMFILE': return 403;
		case 'ENOENT': return 404;
		case 'ENOTDIR': return 404;
		//case 'ENOTEMPTY':
		case 'EPERM': return 403;
		case 'EPIPE': return 408;
		case 'ETIMEDOUT': return 408;
	}
	return 404;
}

export class Server implements NodeWebServer
{
	protected ssl: boolean;
	protected host: string;
	protected port: number;
	protected docroot: string;
	protected defFile: string[];
	protected mime: { [ key: string ]: string };
	protected server: http.Server | https.Server;

	constructor()
	{
	}

	public init( config: ServerConfig, server: ChildServer )
	{
		this.ssl = false;
		this.host = config.host;
		this.port = config.port;
		this.docroot = path.normalize( config.docs || '' );
		this.mime = Object.assign( {}, MIME );
		this.defFile = [ 'index.html' ];

		const option = { key: '', cert: '' };
		if ( config.ssl && option.key && option.cert )
		{
			this.ssl = true;
			option.key = this.loadPemFile( config.ssl.key );
			option.cert = this.loadPemFile( config.ssl.cert );
		}

		if ( config.mime )
		{
			const mime = config.mime;
			Object.keys( mime ).forEach( ( key ) => { this.mime[ key ] = mime[ key ]; } );
		}

		if ( Array.isArray( config.dir_index ) )
		{
			this.defFile = config.dir_index;
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

	protected errorCodeToPage( res: http.ServerResponse, code: number )
	{
		const message = (<any>HttpStatusCode)[ code ] || HttpStatusCode[ (code = 404) ];

		res.writeHead( code, { 'Content-Type': 'text/plain' } );
		res.write( code + ': ' + message );
		res.end();
	}

	protected errorPage( res: http.ServerResponse, error: Error )
	{
		const code = ErrorToCode( error );
		this.errorCodeToPage( res, code );
	}

	protected responseText( res: http.ServerResponse, filepath: string, mime: string )
	{
		return fs.readFile( filepath, 'utf-8' ).then( ( data ) =>
		{
			res.writeHead( 200, { 'Content-Type': mime } );
			res.write( data );
			res.end();
		} ).catch( ( error ) => { this.errorPage( res, error ); } );
	}

	protected responseBinary( res: http.ServerResponse, filepath: string, mime: string )
	{
		return fs.readFile( filepath ).then( ( data ) =>
		{
			res.writeHead( 200, { 'Content-Type': mime } );
			res.write( data );
			res.end();
		} ).catch( ( error ) => { this.errorPage( res, error ); } );
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
		const fullpath = path.join( this.docroot, filepath );
		if ( fullpath.substr( 0, this.docroot.length ) !== this.docroot ) { return ''; }

		if ( filepath.slice( -1 ) !== '/' )
		{
			return this.fileExists( fullpath ) ? fullpath : '';
		}

		// Complement the URL.
		// /test/ => /test/index.html
		for ( let def of this.defFile )
		{
			const fullpath = path.join( this.docroot, filepath + def );
			if ( this.fileExists( filepath ) ) { return filepath; }
		}

		return '';
	}

	public onRequest( req: http.IncomingMessage, res: http.ServerResponse )
	{
		const filepath = this.checkFile( ( req.url || '/' ).split( '?' )[ 0 ] );

		if ( !filepath ) { return this.errorCodeToPage( res, 404 ); }

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
		} );
	}

	public stop()
	{
		return new Promise<void>( ( resolve, reject ) => { this.server.close( resolve ); } );
	}

	public alive() { return Promise.resolve( this.server.listening ); }
}

export class ReplaceServer extends Server
{
	private regexp: RegExp;
	private replace: string;

	public init( config: ServerConfig, server: ChildServer )
	{
		return super.init( config, server ).then( () =>
		{
			const replace = <{ pattern: string, substr: string }>config.replace;
			this.regexp = new RegExp( replace.pattern );
			this.replace = replace.substr;
		} );
	}

	protected checkFile( filepath: string )
	{
		return super.checkFile( filepath.replace( this.regexp, this.replace ) );
	}

}
