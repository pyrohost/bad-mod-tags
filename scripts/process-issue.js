#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const MODS_FILE = path.join(__dirname, '..', 'data', 'mods.json');

function parseTag(value) {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('required')) return 'required';
  if (lower.includes('optional')) return 'optional';
  if (lower.includes('unsupported')) return 'unsupported';
  return null;
}

function parseLoaders(loaderData) {
  if (!loaderData) return [];

  if (Array.isArray(loaderData)) {
    return loaderData
      .map(item => {
        if (typeof item === 'string') return item.toLowerCase();
        if (item.label) return item.label.toLowerCase();
        return null;
      })
      .filter(Boolean);
  }

  if (typeof loaderData === 'string') {
    return loaderData
      .split(/[,\n]/)
      .map(s => s.trim().toLowerCase())
      .filter(s => ['fabric', 'forge', 'neoforge', 'quilt'].includes(s));
  }

  return [];
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

async function verifyModrinthId(projectId) {
  return new Promise((resolve) => {
    if (!projectId) {
      resolve({ valid: true, data: null });
      return;
    }

    const options = {
      hostname: 'api.modrinth.com',
      path: `/v2/project/${encodeURIComponent(projectId)}`,
      method: 'GET',
      headers: {
        'User-Agent': 'BadModTags/1.0 (https://github.com/pyrohost/bad-mod-tags)'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const project = JSON.parse(data);
            resolve({
              valid: true,
              data: {
                name: project.title,
                slug: project.slug,
                id: project.id,
                client_side: project.client_side,
                server_side: project.server_side
              }
            });
          } catch {
            resolve({ valid: false, error: 'Invalid API response' });
          }
        } else if (res.statusCode === 404) {
          resolve({ valid: false, error: `Modrinth project "${projectId}" not found` });
        } else {
          resolve({ valid: false, error: `Modrinth API returned ${res.statusCode}` });
        }
      });
    });

    req.on('error', () => resolve({ valid: true, data: null }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ valid: true, data: null });
    });

    req.end();
  });
}

function checkDuplicates(modsData, modrinthId, curseforgeId) {
  const errors = [];

  for (const mod of modsData.mods) {
    if (modrinthId && mod.modrinth_id?.toLowerCase() === modrinthId.toLowerCase()) {
      errors.push(`Mod with Modrinth ID "${modrinthId}" already exists: ${mod.name}`);
    }
    if (curseforgeId && mod.curseforge_id === curseforgeId) {
      errors.push(`Mod with CurseForge ID "${curseforgeId}" already exists: ${mod.name}`);
    }
  }

  return errors;
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

async function processIssue() {
  const issueDataStr = process.env.ISSUE_DATA;
  const issueNumber = process.env.ISSUE_NUMBER;
  const issueAuthor = process.env.ISSUE_AUTHOR;

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

  const correctClientTag = parseTag(issueData['correct-client-tag']);
  const correctServerTag = parseTag(issueData['correct-server-tag']);

  const loaders = parseLoaders(issueData['loaders']);
  const notes = issueData['notes']?.trim() || null;

  const errors = [];

  if (!modName) errors.push('Mod name is required');
  if (!modrinthId && !curseforgeId) errors.push('At least one platform ID is required');
  if (curseforgeIdStr && isNaN(curseforgeId)) errors.push(`Invalid CurseForge ID: "${curseforgeIdStr}"`);
  if (!correctClientTag) errors.push('Correct client tag is required');
  if (!correctServerTag) errors.push('Correct server tag is required');

  if (modrinthId) {
    const verification = await verifyModrinthId(modrinthId);
    if (!verification.valid) {
      errors.push(verification.error);
    }
  }

  let modsData;
  try {
    modsData = JSON.parse(fs.readFileSync(MODS_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to read mods.json:', e.message);
    setOutput('valid', 'false');
    setOutput('error', 'Failed to read mods.json');
    process.exit(1);
  }

  errors.push(...checkDuplicates(modsData, modrinthId, curseforgeId));

  if (errors.length > 0) {
    console.log('Validation failed:', errors.join('; '));
    setOutput('valid', 'false');
    setOutput('error', errors.join('; '));
    process.exit(1);
  }

  const modEntry = { name: modName };

  if (modrinthId) modEntry.modrinth_id = modrinthId;
  if (curseforgeId) modEntry.curseforge_id = curseforgeId;

  modEntry.correct_tags = {
    client: correctClientTag,
    server: correctServerTag
  };

  if (loaders.length > 0) modEntry.loaders = loaders;
  if (notes) modEntry.notes = notes;

  modEntry.reported_by = issueAuthor || 'unknown';
  modEntry.reported_date = new Date().toISOString().split('T')[0];

  modsData.mods.push(modEntry);
  modsData.updated = new Date().toISOString();

  fs.writeFileSync(MODS_FILE, JSON.stringify(modsData, null, 2) + '\n');

  console.log('Processed:', modName);

  setOutput('valid', 'true');
  setOutput('mod_name', modName);
  setOutput('mod_slug', slugify(modName));
  setOutput('issue_number', issueNumber || '');
}

processIssue().catch(e => {
  console.error('Error:', e.message);
  setOutput('valid', 'false');
  setOutput('error', e.message);
  process.exit(1);
});
