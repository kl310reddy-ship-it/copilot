import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [strategyCategory] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [puzzleCategory] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub' })
        .returning({ id: publishers.id });

    let index = 0;
    for (let i = count; i >= 1; i--) {
        const category = index % 2 === 0 ? strategyCategory : puzzleCategory;
        const publisher = index % 2 === 0 ? pubOne : pubTwo;
        index += 1;

        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('filters games by category', async () => {
        await seedGames(db, 4);
        const filtered = await getAllGames(db, { categoryIds: [1] });
        expect(filtered.map((game) => game.title)).toEqual(['Game 02', 'Game 04']);
        expect(filtered.every((game) => game.category?.name === 'Strategy')).toBe(true);
    });

    it('filters games by publisher', async () => {
        await seedGames(db, 4);
        const filtered = await getAllGames(db, { publisherIds: [1] });
        expect(filtered.map((game) => game.title)).toEqual(['Game 02', 'Game 04']);
        expect(filtered.every((game) => game.publisher?.name === 'Pub One')).toBe(true);
    });

    it('combines category and publisher filters', async () => {
        await seedGames(db, 4);
        const filtered = await getAllGames(db, { categoryIds: [1], publisherIds: [1] });
        expect(filtered.map((game) => game.title)).toEqual(['Game 02', 'Game 04']);
        expect(filtered.every((game) => game.category?.name === 'Strategy')).toBe(true);
        expect(filtered.every((game) => game.publisher?.name === 'Pub One')).toBe(true);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
