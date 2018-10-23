interface ServerConfig
{
	host: string,
	port: number,
	ssl?: { key: string, cert: string },//TODO: http redirect
	user?: string| number,
	disable?: boolean,
	docs?: string,
	mime?: { [ key: string ]: string },
	replace?: { pattern: string, substr: string },
	log?: { err?: string | null, out?: string | null },
	option?: any,
}

interface NodeWebServer
{
	init( conf: ServerConfig ): Promise<void>;
	start(): Promise<void>;
	stop(): Promise<void>;
	alive(): Promise<boolean>;
}

// Message

interface NoWSToParentMessageMap
{
	prepare: {},
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
