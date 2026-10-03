// One shared Prisma client for the whole app. Creating a client per request
// would open a new connection pool each time. See docs/05-database-prisma.md.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

// Prisma 7 talks to Postgres through a "driver adapter" built on the `pg` package.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
