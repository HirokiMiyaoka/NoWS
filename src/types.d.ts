interface ServerConfig
{
	// Web server settings.
	host: string,
	port: number,
	ssl?: { key: string, cert: string },//TODO: http redirect
	// Change user( username or uid )
	user?: string| number,

	// true = Cannot up web server.
	disable?: boolean,
	mime?: { [ key: string ]: string },
	log?: { err?: string | null, out?: string | null },

	// Static server.
	docs?: string,
	replace?: { pattern: string, substr: string },
	// Default files.
	//: string[],
	// Exec cgi.

	// Original server.
	module?: string,
	option?: any,
}

interface ChildServer
{
	setOnMessage( onmsg: ( message: any ) => void ): void;
	send<T extends keyof NoWSToParentMessageMap>( command: T, data: NoWSToParentMessageMap[ T ] ): void;
}

interface NodeWebServer
{
	init( conf: ServerConfig, server: ChildServer ): Promise<void>;
	start(): Promise<void>;
	stop(): Promise<void>;
	alive(): Promise<boolean>;
}

// Message

interface NoWSToParentMessageMap
{
	prepare: {},
	aborted: Error,
	servers: {},
	stop: {},
}

interface NoWSToParentMessage<T extends keyof NoWSToParentMessageMap>
{
	command: T,
	data: NoWSToParentMessageMap[ T ],
}

interface NoWSToChildMessageMap
{
	start: ServerConfig,
	stop: {},
	servers: ResponseServerList,
}

interface NoWSToChildMessage<T extends keyof NoWSToChildMessageMap>
{
	command: T,
	data: NoWSToChildMessageMap[ T ],
}

// API

interface ResponseServerList
{
	max: number,
	list: { url: string, alive: boolean }[],
}

interface ResponseServerStop
{
	url: { [ key: string ]: boolean },
}

interface RequestServerStop
{
	url: string[],
}
