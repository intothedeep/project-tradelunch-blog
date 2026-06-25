// api/index.ts
// Vercel serverless adapter — re-exports the Express app without calling listen().
// @vercel/node calls this as a handler for every inbound request.
import { app } from '../src/server';

export default app;
