import { WebSocketServer, WebSocket } from "ws"

const PORT = isNaN(parseInt(process.env.PORT ?? "")) ? 80 : parseInt(process.env.PORT as string)

const channelListeners: Record<string, WebSocket[]> = {}

type WsMessage = WsOpenMessage | WsCloseMessage | WsMessgaeMessage

type WsOpenMessage = {
  type: "open"
  channel: string
}

type WsCloseMessage = {
  type: "close"
  channel: string
}

type WsMessgaeMessage = {
  type: "message"
  channel: string
  payload: string
}

const wss = new WebSocketServer({ port: PORT })

wss.on("connection", ws => {
  ws.on("message", message => {
    try {
      const data: WsMessage = JSON.parse(message.toString())
      const { channel, type } = data
      if (type === "open") {
        channelListeners[channel] = channelListeners[channel] ?? []
        channelListeners[channel].push(ws)
      } else if (channelListeners[channel] == null) {
        ws.send(JSON.stringify({ type: "error", payload: "channel not found" }))
      } else if (type === "close") {
        for (const sock of channelListeners[channel]) {
          sock.send(JSON.stringify({ type: "close" }))
          sock.close()
        }
        delete channelListeners[channel]
      } else if (type === "message") {
        const { payload } = data
        for (const sock of channelListeners[channel]) {
          if (sock !== ws) {
            sock.send(JSON.stringify({ type: "message", payload }))
          }
        }
      } else {
        ws.send(JSON.stringify({ type: "error", payload: "unknown message type" }))
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", payload: "invalid message" }))
    }
  })
})
