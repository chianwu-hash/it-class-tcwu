import fs from 'node:fs';
import {buildFoundationMilestoneMigration} from './lib/foundation-milestone-migration.mjs';
const source=fs.readFileSync('automation/fixtures/foundation-milestones/garden-growth-before.sql','utf8');
fs.writeFileSync('supabase/foundation_milestones.sql',buildFoundationMilestoneMigration(source));
console.log('Generated foundation milestone migration; not applied to production.');
