import { installOriginalTemplates } from './original-templates'
import { installModules } from '../src/lib/training-modules'
import { db } from '../src/lib/db'
import { makeTrainingDraft, trainingCatalog } from '../src/lib/training-catalog'

import { seedDemo } from './seed'

async function installTraining() {
  for (const entry of trainingCatalog) {
    const id = `training-catalog-${entry.id}`;
    const difficulty = entry.id === 'recovery' ? 'hard' : entry.id === 'qr-notice' ? 'easy' : entry.id === 'app-access' ? 'hard' : 'medium';
    const draft = makeTrainingDraft(entry, difficulty);
    await db.template.upsert({
      where: { id },
      update: {},
      create: { ...draft, id, isBuiltIn: true, redFlags: JSON.stringify(draft.redFlags) },
    });
  }
  console.log(`Training catalog ready (${trainingCatalog.length} built-in templates).`);
  if (process.argv.includes('--with-demo')) {
    await db.$transaction(tx => seedDemo(tx, true), { timeout: 15000 });
    console.log('Original demo catalog ready. Existing records were kept.');
  }
  await db.$transaction(installOriginalTemplates, { timeout: 15000 });
  await db.$transaction(installModules);
  console.log('Core training lessons ready.');
}

installTraining().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
