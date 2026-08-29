import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createStatementHistory, deleteStatementHistory, ensureRenderStagingSchema, getRenderSnapshot, getStatementHistory, listStatementHistory, saveRenderSnapshot, updateStatementHistory } from "./renderPg";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  staging: router({
    health: publicProcedure.query(async () => {
      const schema = await ensureRenderStagingSchema();
      return { database: "ready" as const, tableCount: schema.tableCount };
    }),
    loadSnapshot: publicProcedure
      .input(z.object({ workspaceKey: z.string().min(16).max(160) }))
      .query(({ input }) => getRenderSnapshot(input.workspaceKey)),
    saveSnapshot: publicProcedure
      .input(z.object({ workspaceKey: z.string().min(16).max(160), payload: z.record(z.string(), z.unknown()) }))
      .mutation(({ input }) => saveRenderSnapshot(input.workspaceKey, input.payload)),
    listHistory: publicProcedure.query(() => listStatementHistory()),
    getHistory: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => getStatementHistory(input.id)),
    createHistory: publicProcedure.input(z.object({ title: z.string().min(1).max(240), reference: z.string().max(120), customerName: z.string().max(500), accountNumber: z.string().max(120), payload: z.record(z.string(), z.unknown()) })).mutation(({ input }) => createStatementHistory(input.payload, input.title, input.reference, input.customerName, input.accountNumber)),
    updateHistory: publicProcedure.input(z.object({ id: z.number().int().positive(), title: z.string().min(1).max(240), reference: z.string().max(120), customerName: z.string().max(500), accountNumber: z.string().max(120), payload: z.record(z.string(), z.unknown()) })).mutation(({ input }) => updateStatementHistory(input.id, input.payload, input.title, input.reference, input.customerName, input.accountNumber)),
    deleteHistory: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteStatementHistory(input.id)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
