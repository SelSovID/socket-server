import "dotenv/config"
import { WebSocketServer, WebSocket } from "ws"
import logger from "./log.js"

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
logger.info({ port: PORT }, `server started on port ${PORT}`)

wss.on("connection", ws => {
  logger.trace("new connection")
  ws.on("message", message => {
    logger.trace({ message: message.toString() }, "new message")
    try {
      const data: WsMessage = JSON.parse(message.toString())
      const { channel, type } = data
      if (type === "open") {
        logger.trace({ channel }, "open channel")
        channelListeners[channel] = channelListeners[channel] ?? []
        channelListeners[channel].push(ws)
      } else if (channelListeners[channel] == null) {
        logger.error({ channel }, "channel not found")
        ws.send(JSON.stringify({ type: "error", payload: "channel not found" }))
      } else if (type === "close") {
        logger.trace({ channel }, "close channel")
        for (const sock of channelListeners[channel]) {
          sock.send(JSON.stringify({ type: "close" }))
          sock.close()
        }
        delete channelListeners[channel]
      } else if (type === "message") {
        const { payload } = data
        logger.trace({ channel, payload }, "new message in channel")
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
