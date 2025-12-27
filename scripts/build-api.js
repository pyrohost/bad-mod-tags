#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'mods.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const API_DIR = path.join(DIST_DIR, 'api', 'v1');
const MODRINTH_DIR = path.join(API_DIR, 'modrinth');
const CURSEFORGE_DIR = path.join(API_DIR, 'curseforge');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getRecommendation(mod) {
  const client = mod.correct_tags.client !== 'unsupported';
  const server = mod.correct_tags.server !== 'unsupported';
  return { client, server };
}

function generateStats(data) {
  const mods = data.mods;
  const loaderCounts = {};

  mods.forEach(mod => {
    if (mod.loaders) {
      mod.loaders.forEach(loader => {
        loaderCounts[loader] = (loaderCounts[loader] || 0) + 1;
      });
    }
  });

  return {
    version: data.version,
    updated: data.updated,
    generated: new Date().toISOString(),
    total_mods: mods.length,
    by_platform: {
      modrinth_only: mods.filter(m => m.modrinth_id && !m.curseforge_id).length,
      curseforge_only: mods.filter(m => !m.modrinth_id && m.curseforge_id).length,
      both_platforms: mods.filter(m => m.modrinth_id && m.curseforge_id).length
    },
    by_loader: loaderCounts,
    by_correct_tags: {
      client_only: mods.filter(m => m.correct_tags.client !== 'unsupported' && m.correct_tags.server === 'unsupported').length,
      server_only: mods.filter(m => m.correct_tags.client === 'unsupported' && m.correct_tags.server !== 'unsupported').length,
      both_sides: mods.filter(m => m.correct_tags.client !== 'unsupported' && m.correct_tags.server !== 'unsupported').length
    }
  };
}

function createModEntry(mod) {
  return {
    name: mod.name,
    modrinth_id: mod.modrinth_id || null,
    curseforge_id: mod.curseforge_id || null,
    correct_tags: mod.correct_tags,
    recommendation: getRecommendation(mod),
    loaders: mod.loaders || [],
    notes: mod.notes || null
  };
}

function build() {
  console.log('Building API...');

  if (!fs.existsSync(DATA_FILE)) {
    console.error('Error: Data file not found:', DATA_FILE);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Error parsing data file:', error.message);
    process.exit(1);
  }

  console.log(`Loaded ${data.mods.length} mods`);

  ensureDir(API_DIR);
  ensureDir(MODRINTH_DIR);
  ensureDir(CURSEFORGE_DIR);

  writeJson(path.join(API_DIR, 'mods.json'), data);
  writeJson(path.join(API_DIR, 'stats.json'), generateStats(data));

  let modrinthCount = 0;
  let curseforgeCount = 0;

  data.mods.forEach(mod => {
    const entry = createModEntry(mod);

    if (mod.modrinth_id) {
      writeJson(path.join(MODRINTH_DIR, `${mod.modrinth_id}.json`), entry);
      modrinthCount++;
    }

    if (mod.curseforge_id) {
      writeJson(path.join(CURSEFORGE_DIR, `${mod.curseforge_id}.json`), entry);
      curseforgeCount++;
    }
  });

  const modrinthIndex = data.mods
    .filter(m => m.modrinth_id)
    .map(m => ({ id: m.modrinth_id, name: m.name, recommendation: getRecommendation(m) }));
  writeJson(path.join(MODRINTH_DIR, 'index.json'), modrinthIndex);

  const curseforgeIndex = data.mods
    .filter(m => m.curseforge_id)
    .map(m => ({ id: m.curseforge_id, name: m.name, recommendation: getRecommendation(m) }));
  writeJson(path.join(CURSEFORGE_DIR, 'index.json'), curseforgeIndex);

  console.log(`Done: ${data.mods.length} mods, ${modrinthCount} Modrinth, ${curseforgeCount} CurseForge`);
}

try {
  build();
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
