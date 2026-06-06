/**
 * Runtime configuration, sourced from the environment.
 * Defaults match docker-compose.yml + .env.example for local dev.
 */
export const connectionString =
  process.env.POSTGRESQL_CONNECTION_STRING ??
  'postgresql://event_modeler:event_modeler@localhost:5432/event_modeler';

export const port = Number(process.env.PORT ?? 3000);
