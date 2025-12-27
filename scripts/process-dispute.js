#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const MODS_FILE = path.join(__dirname, '..', 'data', 'mods.json');

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

async function processDispute() {
  const issueDataStr = process.env.ISSUE_DATA;
  const issueNumber = process.env.ISSUE_NUMBER;

  if (!issueDataStr) {
    console.error('ISSUE_DATA not set');
    setOutput('valid', 'false');
    setOutput('error', 'No issue data provided');
    process.exit(1);
  }

  let issueData;
  try {
    issueData = JSON.parse(issueDataStr);
  } catch (e) {
    console.error('Failed to parse ISSUE_DATA:', e.message);
    setOutput('valid', 'false');
    setOutput('error', 'Invalid issue data format');
    process.exit(1);
  }

  const modName = issueData['mod-name']?.trim();
  const modrinthId = issueData['modrinth-id']?.trim() || null;
  const curseforgeIdStr = issueData['curseforge-id']?.trim();
  const curseforgeId = curseforgeIdStr ? parseInt(curseforgeIdStr, 10) : null;
  const disputeType = issueData['dispute-type'] || '';
  const explanation = issueData['explanation']?.trim() || '';

  const errors = [];

  if (!modName) errors.push('Mod name is required');
  if (!modrinthId && !curseforgeId) errors.push('At least one platform ID is required');
  if (!explanation) errors.push('Explanation is required');

  let modsData;
  try {
    modsData = JSON.parse(fs.readFileSync(MODS_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to read mods.json:', e.message);
    setOutput('valid', 'false');
    setOutput('error', 'Failed to read mods.json');
    process.exit(1);
  }

  // Find the mod entry
  const modIndex = modsData.mods.findIndex(mod => {
    if (modrinthId && mod.modrinth_id?.toLowerCase() === modrinthId.toLowerCase()) return true;
    if (curseforgeId && mod.curseforge_id === curseforgeId) return true;
    return false;
  });

  if (modIndex === -1) {
    errors.push(`Mod not found in database (Modrinth: ${modrinthId || 'N/A'}, CurseForge: ${curseforgeId || 'N/A'})`);
  }

  if (errors.length > 0) {
    console.log('Validation failed:', errors.join('; '));
    setOutput('valid', 'false');
    setOutput('error', errors.join('; '));
    process.exit(1);
  }

  const removedMod = modsData.mods[modIndex];
  modsData.mods.splice(modIndex, 1);
  modsData.updated = new Date().toISOString();

  fs.writeFileSync(MODS_FILE, JSON.stringify(modsData, null, 2) + '\n');

  console.log('Removed:', removedMod.name);

  setOutput('valid', 'true');
  setOutput('mod_name', removedMod.name);
  setOutput('mod_slug', slugify(removedMod.name));
  setOutput('dispute_type', disputeType);
  setOutput('issue_number', issueNumber || '');
}

processDispute().catch(e => {
  console.error('Error:', e.message);
  setOutput('valid', 'false');
  setOutput('error', e.message);
  process.exit(1);
});
