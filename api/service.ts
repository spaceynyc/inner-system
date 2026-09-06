import type { IncomingMessage, ServerResponse } from 'node:http'
import { service } from '../server/service.ts'
export default function handler(req: IncomingMessage, res: ServerResponse) { return service(req, res) }
