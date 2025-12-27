#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const DATA_FILE = path.join(__dirname, '..', 'data', 'mods.json');
const SCHEMA_FILE = path.join(__dirname, '..', 'data', 'schema.json');

function checkDuplicates(mods) {
  const errors = [];
  const modrinthIds = new Map();
  const curseforgeIds = new Map();

  mods.forEach((mod, index) => {
    if (mod.modrinth_id) {
      const existing = modrinthIds.get(mod.modrinth_id.toLowerCase());
      if (existing !== undefined) {
        errors.push(`Duplicate Modrinth ID "${mod.modrinth_id}" at indices ${existing} and ${index}`);
      } else {
        modrinthIds.set(mod.modrinth_id.toLowerCase(), index);
      }
    }

    if (mod.curseforge_id) {
      const existing = curseforgeIds.get(mod.curseforge_id);
      if (existing !== undefined) {
        errors.push(`Duplicate CurseForge ID "${mod.curseforge_id}" at indices ${existing} and ${index}`);
      } else {
        curseforgeIds.set(mod.curseforge_id, index);
      }
    }
  });

  return errors;
}

function checkSemantics(mods) {
  const warnings = [];

  mods.forEach((mod) => {
    if (!mod.modrinth_id && !mod.curseforge_id) {
      warnings.push(`[${mod.name}] has neither modrinth_id nor curseforge_id`);
    }
  });

  return warnings;
}

function validate() {
  console.log('Validating database...');

  if (!fs.existsSync(DATA_FILE)) {
    console.error('Error: Data file not found:', DATA_FILE);
    process.exit(1);
  }

  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error('Error: Schema file not found:', SCHEMA_FILE);
    process.exit(1);
  }

  let data, schema;
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Error parsing data file:', error.message);
    process.exit(1);
  }

  try {
    schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  } catch (error) {
    console.error('Error parsing schema file:', error.message);
    process.exit(1);
  }

  console.log(`Loaded ${data.mods?.length || 0} mods`);

  const ajv = new Ajv({ allErrors: true, verbose: true });
  addFormats(ajv);

  const validateSchema = ajv.compile(schema);
  const valid = validateSchema(data);

  if (!valid) {
    console.error('Schema validation failed:');
    validateSchema.errors.forEach(error => {
      console.error(`  ${error.instancePath || '/'}: ${error.message}`);
    });
    process.exit(1);
  }
  console.log('Schema validation passed');

  const duplicateErrors = checkDuplicates(data.mods);
  if (duplicateErrors.length > 0) {
    console.error('Duplicate entries found:');
    duplicateErrors.forEach(error => console.error(`  ${error}`));
    process.exit(1);
  }
  console.log('No duplicates found');

  const warnings = checkSemantics(data.mods);
  if (warnings.length > 0) {
    console.warn('Warnings:');
    warnings.forEach(warning => console.warn(`  ${warning}`));
  } else {
    console.log('Semantic checks passed');
  }

  console.log(`Done: ${data.mods.length} mods validated, ${warnings.length} warnings`);
}

try {
  validate();
} catch (error) {
  console.error('Validation failed:', error.message);
  process.exit(1);
}
