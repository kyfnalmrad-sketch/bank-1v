import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { ensureRenderStagingSchema, getRenderSnapshot, saveRenderSnapshot } from "./renderPg";
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
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
