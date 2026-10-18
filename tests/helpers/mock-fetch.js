// mock-fetch.js — preload (node --import) that replaces fetch for tracker tests, so no test touches a network
//
// Routes come from the MockRoutes env var, a JSON array of { method, path, json, status?, once? }.
// The first route whose method matches and whose path is a substring of the URL answers; `once` routes
// are consumed, which lets one path answer differently on a second call. Every request is appended to
// the file named by MockLog as one JSON line { method, url, body }, so tests assert on what was sent.

import { appendFileSync } from "node:fs";

/** @type {{ method: string, path: string, json?: unknown, status?: number, once?: boolean }[]} */
const routes = JSON.parse(process.env.MockRoutes ?? "[]");

globalThis.fetch = /** @type {typeof fetch} */ (
  async (url, init) => {
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    appendFileSync(String(process.env.MockLog), `${JSON.stringify({ method, url: String(url), body })}\n`);

    const index = routes.findIndex((route) => route.method === method && String(url).includes(route.path));
    if (index === -1) return new Response(`no mock route for ${method} ${url}`, { status: 500 });

    const [route] = routes[index].once ? routes.splice(index, 1) : [routes[index]];
    const status = route.status ?? (route.json === undefined ? 204 : 200);
    return new Response(status === 204 ? null : JSON.stringify(route.json), { status });
  }
);
