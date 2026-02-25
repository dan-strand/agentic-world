// Renderer entry point -- Plan 03 will add PixiJS world here
console.log('Agent World renderer loaded');

// Verify IPC bridge works
window.agentWorld.getInitialSessions().then(sessions => {
  console.log('Initial sessions:', sessions);
});

window.agentWorld.onSessionsUpdate((sessions) => {
  console.log('Sessions updated:', sessions);
});
