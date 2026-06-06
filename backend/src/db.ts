import { pongoClient } from '@event-driven-io/pongo';
import { connectionString } from './config.ts';

/**
 * Pongo client for querying read-model documents (the catalog, etc.) on the
 * read side of the API. The write side goes through `eventStore`, never here.
 */
export const pongo = pongoClient(connectionString);
export const documents = pongo.db();
