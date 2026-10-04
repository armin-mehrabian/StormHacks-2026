// Imported first by server/index.ts so .env is loaded before any route module
// reads process.env at import time.
import { config } from 'dotenv'

config({ quiet: true })
