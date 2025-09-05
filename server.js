const server = Bun.serve({
  port: 3000,
  fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === "/") {
      return new Response(Bun.file("index.html"));
    }
    
    if (url.pathname === "/style.css") {
      return new Response(Bun.file("style.css"), {
        headers: { "Content-Type": "text/css" }
      });
    }
    
    if (url.pathname === "/game.js") {
      return new Response(Bun.file("game.js"), {
        headers: { "Content-Type": "application/javascript" }
      });
    }
    
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🎮 Pongdriaan server running at http://localhost:${server.port}`);
console.log(`📱 Open your browser and navigate to http://localhost:${server.port} to play!`);