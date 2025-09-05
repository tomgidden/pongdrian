import { watch } from "fs";
import { spawn } from "child_process";
import { existsSync } from "fs";

// Initial build
console.log("📦 Building initial files...");
await buildFiles();

// Watch for changes
console.log("👀 Watching for changes...");
watch(".", { recursive: true }, async (eventType, filename) => {
  if (filename && (filename.endsWith('.js') || filename.endsWith('.html') || filename.endsWith('.css'))) {
    console.log(`🔄 File changed: ${filename}, rebuilding...`);
    await buildFiles();
  }
});

// Start server
const server = Bun.serve({
  port: 3000,
  fetch(request) {
    const url = new URL(request.url);
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    
    const publicFile = `public${filePath}`;
    if (existsSync(publicFile)) {
      return new Response(Bun.file(publicFile));
    }
    
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🎮 Pongdriaan dev server running at http://localhost:${server.port}`);
console.log(`📱 Open your browser and navigate to http://localhost:${server.port} to play!`);

async function buildFiles() {
  // Build JS
  await Bun.build({
    entrypoints: ["./game.js"],
    outdir: "./public",
    target: "browser",
  });
  
  // Copy static files
  await Bun.write("public/index.html", Bun.file("index.html"));
  await Bun.write("public/style.css", Bun.file("style.css"));
}