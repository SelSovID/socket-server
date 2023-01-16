import "dotenv/config"
import { WebSocketServer, WebSocket } from "ws"
import logger from "./log.js"

const PORT = isNaN(parseInt(process.env.PORT ?? "")) ? 80 : parseInt(process.env.PORT as string)

const rooms = new Map<string, Set<WebSocket>>()
const socketToRooms = new Map<WebSocket, Set<string>>()

type WsMessage = WsOpenMessage | WsCloseMessage | WsMessageMessage

type WsOpenMessage = {
  type: "open"
  channel: string
}

type WsCloseMessage = {
  type: "close"
  channel: string
}

type WsMessageMessage = {
  type: "message"
  channel: string
  payload: string
}

type WsJoinMessage = {
  type: "join"
  channel: string
}

const wss = new WebSocketServer({ port: PORT })
logger.info({ port: PORT }, `server started on port ${PORT}`)

wss.on("connection", ws => {
  logger.trace("new connection")
  ws.on("message", message => {
    logger.trace({ message: message.toString() }, "new message")
    try {
      const data: WsMessage = JSON.parse(message.toString())
      const { channel: roomId, type } = data
      if (type === "open") {
        logger.trace({ channel: roomId }, "open channel")
        if (rooms.has(roomId)) {
          const room = rooms.get(roomId)!
          const joinMessage: WsJoinMessage = { type: "join", channel: roomId }
          for (const client of room) {
            client.send(JSON.stringify(joinMessage))
          }
          rooms.get(roomId)!.add(ws)
        } else {
          const channelList = new Set([ws])
          rooms.set(roomId, channelList)
        }
        if (socketToRooms.has(ws)) {
          socketToRooms.get(ws)!.add(roomId)
        } else {
          const socketList = new Set([roomId])
          socketToRooms.set(ws, socketList)
        }
      } else if (type === "close") {
        if (rooms.has(roomId)) {
          logger.trace({ channel: roomId }, "close channel")
          for (const sock of rooms.get(roomId)!) {
            socketToRooms.get(ws)!.delete(roomId)
            if (socketToRooms.get(ws)!.size === 0) {
              socketToRooms.delete(ws)
            }
            sock.send(JSON.stringify({ type: "close", channel: roomId }))
            sock.close()
          }
          rooms.delete(roomId)
        } else {
          logger.error({ channel: roomId }, "channel not found")
          ws.send(JSON.stringify({ type: "error", payload: "channel not found" }))
        }
      } else if (type === "message") {
        if (rooms.has(roomId)) {
          const { payload } = data
          logger.trace({ channel: roomId, payload }, "new message in channel")
          for (const sock of rooms.get(roomId)!) {
            if (sock !== ws) {
              sock.send(JSON.stringify({ type: "message", channel: roomId, payload }))
            }
          }
        } else {
          logger.error({ channel: roomId }, "channel not found")
          ws.send(JSON.stringify({ type: "error", payload: "channel not found" }))
        }
      } else {
        ws.send(JSON.stringify({ type: "error", channel: roomId, payload: "unknown message type" }))
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", payload: "invalid message" }))
    }
  })

  ws.on("close", () => {
    logger.trace("connection closed")
    if (socketToRooms.has(ws)) {
      for (const roomId of socketToRooms.get(ws)!) {
        rooms.get(roomId)!.delete(ws)
        if (rooms.get(roomId)!.size === 0) {
          rooms.delete(roomId)
        }
      }
      socketToRooms.delete(ws)
    }
  })
})
