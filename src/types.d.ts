interface LogConfig
{
	err?: string | null,
	out?: string | null,
}

interface ServerConfig
{
	// Web server settings.
	host: string,
	port: number,
	ssl?: { key: string, cert: string },//TODO: http redirect
	// Change user( username or uid )
	user?: string| number,
	// Auth. Digest,Basic
	// if allow:[A] and deny[B] => use allow[ A ] (Default static server.)
	allow?: string | string[],
	deny?: string | string[],

	// true = Do not start web server.
	disable?: boolean,
	mime?: { [ key: string ]: string },
	log?: LogConfig,

	// Static server.
	docs?: string,
	// Error pages. 404.html ...
	errs?: string,
	replace?: { pattern: string, substr: string },
	// Default files.
	dir_index?: string | string[],
	// Exec cgi.
	// Chache control.

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
	aborted: any,
	stop: {},
	alive: boolean,
	// Monitor
	servers: {},
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
	alive: {},
	// Monitor
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
