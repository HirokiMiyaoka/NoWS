import * as fs from 'fs'

function GetFileSize( file: string )
{
	try
	{
		const stat = fs.statSync( file );
		return stat.size;
	} catch( error ){}
	return 0;
}

function CreateOutFileFunction( file: string, max: number )
{
	let size = GetFileSize( file );
	let stream = fs.createWriteStream( file );
	return ( ...messages: any[] ) =>
	{
		const message = messages.map( ( data ) => { return data; } ).join( ' ' ) + '\n';
		const length = Buffer.byteLength( message, 'utf-8' );
		if ( max < size + length )
		{
			stream.close();
			let count = 0;
			do
			{
				try
				{
					const stat = fs.statSync( file + '.' + count );
				} catch( error ) { if ( error.code === 'ENOENT') { break; } }
			} while ( ++count );
			fs.renameSync( file, file + '.' + count );
			size = GetFileSize( file );
			stream = fs.createWriteStream( file );
		}
		stream.write( message );
	};
}

function CreateOutStreamFunction( stream: NodeJS.WriteStream )
{
	return ( ...messages: any[] ) =>
	{
		const message = messages.map( ( data ) => { return data; } ).join( ' ' ) + '\n';
		stream.write( message );
	};
}

function SetFunctions( config: LogConfig )
{
	const logs: ('assert' | 'debug' | 'error' | 'info' | 'log' | 'warn')[] = [ 'assert', 'debug', 'error', 'info', 'log', 'warn' ];
	const funcs: { [ key: string ]: () => void } = {
		'': () => {},
		'stdout': CreateOutStreamFunction( process.stdout ),
		'stderr': CreateOutStreamFunction( process.stderr ),
	};
	// Default file size = 1M.
	const max = typeof config.size === 'number' && 0 < config.size ? config.size : 1048576;

	logs.forEach( ( type ) =>
	{
		if ( config[ type ] === undefined ) { return; }
		const logtype = config[ type ] || '';
		if ( !funcs[ type ] ) { funcs[ type ] = CreateOutFileFunction( logtype, max ); }
		console[ type ] = funcs[ type ];
	} );

	if ( config.default === undefined ) { return; }
	const logtype = config.default || '';
	const func = funcs[ logtype ] || CreateOutFileFunction( logtype, max );
	logs.forEach( ( type ) =>
	{
		if ( config[ type ] === undefined ) { console[ type ] = func; }
	} );
}

export default function Log( config: LogConfig )
{
	const prev =
	{
		assert: console.assert,
		debug: console.debug,
		error: console.error,
		info: console.info,
		log: console.log,
		warn: console.warn,
	};

	SetFunctions( config );

	const data =
	{
		reset: () =>
		{
			console.assert = prev.assert;
			console.debug = prev.debug;
			console.error = prev.error;
			console.info = prev.info;
			console.log = prev.log;
			console.warn = prev.warn;
		},
	};

	return data;
}
