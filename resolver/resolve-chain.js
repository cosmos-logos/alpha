import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";

const visited = new Set();

async function loadManifest(source, baseDir) {
  if (visited.has(source)) {
    throw new Error(`Cycle detected: ${source}`);
  }
  visited.add(source);

  let raw;
  let resolvedSource = source;

  if (source.startsWith("http")) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${source}: ${res.status}`);
    }
    raw = await res.text();
  } else {
    const filePath = path.resolve(baseDir, source);
    raw = await fs.readFile(filePath, "utf8");
    resolvedSource = filePath;
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON at ${resolvedSource}`);
  }

  return { manifest, source: resolvedSource };
}

async function resolveChain(startPath) {
  const chain = [];
  let current = startPath;
  let baseDir = process.cwd();

  while (current) {
    const { manifest, source } = await loadManifest(current, baseDir);

    chain.push({
      id: manifest.id,
      role: manifest.role,
      source,
      schemaVersion: manifest.schemaVersion
    });

    if (!manifest.inheritsFrom) break;

    current = manifest.inheritsFrom;
    baseDir = path.dirname(source);
  }

  return chain.reverse(); // root → leaf
}

// ---- RUN ----
(async () => {
  try {
    const chain = await resolveChain(
      "source_of_truth/cosmos-logos.json"
    );

    console.log("\n✔ Cosmos-Logos Trust Chain\n");
    chain.forEach((node, i) => {
      console.log(`${i}. ${node.id} (${node.role})`);
      console.log(`   source: ${node.source}`);
      console.log(`   schema: ${node.schemaVersion}\n`);
    });

  } catch (err) {
    console.error("\n✖ Resolver failed:");
    console.error(err.message);
    process.exit(1);
  }
})();
