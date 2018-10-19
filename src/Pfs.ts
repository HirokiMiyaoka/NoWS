import * as fs from 'fs';
import * as JSON5 from 'json5'

export function stat( path: fs.PathLike ): Promise<fs.Stats>
{
	return new Promise( ( resolve, reject ) =>
	{
		fs.stat( path, ( error, stats ) =>
		{
			if ( error ) { return reject( error ); }
			resolve( stats );
		} );
	} );
}

export function statSync( path: fs.PathLike ) { return fs.statSync( path ); }

export function readdir( path: fs.PathLike ): Promise<string[]>
{
	return new Promise( ( resolve, reject ) =>
	{
		fs.readdir( path, ( error, files ) =>
		{
			if ( error ) { return reject( error ); }
			resolve( files );
		} );
	} );
}

export function mkdir( path: fs.PathLike, mode?: string | number | null ): Promise<void>
{
	return new Promise( ( resolve, reject ) =>
	{
		fs.mkdir( path, mode, ( error ) =>
		{
			if ( error && error.code !== 'EEXIST' ) { return reject( { error: error } ); }
			resolve();
		} );
	} );
}

export function writeFile( path: fs.PathLike, data: any ): Promise<void>
{
	return new Promise( ( resolve, reject ) =>
	{
		fs.writeFile( path, data, ( error ) =>
		{
			if ( error ) { return reject( error ); }
			resolve();
		} );
	} );
}

export function readFile( path: fs.PathLike, options?: string | { encoding?: string | null, flag?: string } ): Promise<string|Buffer>
{
	return new Promise( ( resolve, reject ) =>
	{
		fs.readFile( path, options, ( error, data ) =>
		{
			if ( error ) { return reject( error ); }
			resolve( data );
		} );
	} );
}

export function readFileSync( path: fs.PathLike, options?: string | { encoding?: string | null, flag?: string } )
{
	return fs.readFileSync( path, options );
}

export function createReadStream( path: fs.PathLike, options?: string | { flags?: string, encoding?: string, fd?: number, mode?: number, autoClose?: boolean, start?: number, end?: number, highWaterMark?: number } )
{
	return fs.createReadStream( path, options );
}

export function readJson5<T>( path: fs.PathLike, options?: string | { encoding?: string | null, flag?: string }, receiver?: ( key: any, value: any ) => any )
{
	return readFile( path, options ).then( ( data ) =>
	{
		return <T>JSON5.parse( typeof data === 'string' ? data : data.toString( 'utf-8', 0, data.length ), receiver );
	} );
}
