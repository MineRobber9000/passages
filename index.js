const ws = require("ws");
const { init } = require("@paralleldrive/cuid2");
const cuid = init({});

let wss = new ws.WebSocketServer({port:8080});

const validateChannel = (channel) => {
	if (typeof channel !== "string" && typeof channel !== "number") throw new Error("Invalid type for channel!");
};

const broadcast = (sender,msg) => {
	validateChannel(msg.channel);
	const full = {
		...msg,
		type: "message",
		ID: cuid(),
		time: new Date().getTime()
	};
	wss.clients.forEach(ws => {
		let send = ws.readyState===ws.OPEN && ws!==sender && (ws.channels.includes(msg.channel)||ws.channels.includes("*"));
		if (send) {
			ws.send(JSON.stringify(full));
		}
	});
	return full;
};

let commands = {
	open(ws,sendBack,msg) {
		const channel = msg.channel;
		validateChannel(channel);
		if (!ws.channels.includes(channel)) ws.channels.push(channel);
		sendBack({channels:ws.channels});
	},
	close(ws,sendBack,msg) {
		const channel = msg.channel;
		validateChannel(channel);
		if (!ws.channels.includes(channel)) throw new Error("Channel "+channel+" not open.");
		const index = ws.channels.indexOf(channel);
		ws.channels.splice(index,1);
		sendBack({channels:ws.channels});
	},
	message(ws,sendBack,msg) {
		sendBack(broadcast(ws,msg));
	}
};

wss.on("connection",function(ws) {
	console.log("new connection");
	ws.channels=[];
	let send = (msg) => ws.send(JSON.stringify(msg));
	ws.on("message",function(raw) {
		try {
			const msg = JSON.parse(raw);
			if (typeof msg === "object" && msg !== null && msg !== undefined) {
				const cmd = msg.type;
				const func = commands[cmd];
				if (!func) throw new Error("No such command "+cmd+"!");
				const sendBack = (msg) => send({...msg,type:"result",from:cmd});
				func(ws,sendBack,msg);
			} else {
				throw new Error("Invalid message!");
			}
		} catch (e) {
			send({error:e.toString()});
			return;
		}
	});
	ws.on("close",function(code,reason) {
		console.log("closed");
	});
});
