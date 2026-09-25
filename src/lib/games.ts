import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game, Category, Publisher } from '../types/game';

export type GameFilterOptions = {
    categoryIds?: number[];
    publisherIds?: number[];
};

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function normalizeFilterList(values?: number[]): number[] | undefined {
    if (!values || values.length === 0) {
        return undefined;
    }
    return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))];
}

function getFilterClauses(filters?: GameFilterOptions) {
    const categoryIds = normalizeFilterList(filters?.categoryIds);
    const publisherIds = normalizeFilterList(filters?.publisherIds);
    const clauses = [] as Array<ReturnType<typeof inArray>>;

    if (categoryIds && categoryIds.length > 0) {
        clauses.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds && publisherIds.length > 0) {
        clauses.push(inArray(games.publisherId, publisherIds));
    }

    return clauses;
}

function applyGameFilters(query: ReturnType<typeof baseGamesQuery>, filters?: GameFilterOptions) {
    const clauses = getFilterClauses(filters);

    if (clauses.length > 0) {
        return query.where(and(...clauses));
    }

    return query;
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** Return all games, optionally narrowed to a set of category and publisher IDs, ordered by title. */
export async function getAllGames(db: Database, filters?: GameFilterOptions): Promise<Game[]> {
    const query = applyGameFilters(baseGamesQuery(db), filters);
    const rows = await query.orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** Return all game ids, optionally narrowed to a set of category and publisher IDs, ordered by title. */
export async function getAllGameIds(db: Database, filters?: GameFilterOptions): Promise<number[]> {
    const baseQuery = db.select({ id: games.id }).from(games);
    const clauses = getFilterClauses(filters);
    const query = clauses.length > 0 ? baseQuery.where(and(...clauses)) : baseQuery;

    const rows = await query.orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** Return all categories ordered by name so the filter control stays deterministic. */
export async function getAllCategories(db: Database): Promise<Category[]> {
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** Return all publishers ordered by name so the filter control stays deterministic. */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
