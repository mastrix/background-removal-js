// @ts-nocheck
importScripts('worker-loader?inline=no-fallback!./browser.js');

const ctx: Worker = self as any;

onmessage = async (event) => {
  setTimeout(() => {
    ctx.postMessage(`[WORKER_TS] Waited ${event.data}ms`);
    console.log('hello')
  }, event.data);
};
