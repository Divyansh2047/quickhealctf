import { db } from '../src/lib/db'
import { makeTrainingDraft, trainingCatalog } from '../src/lib/training-catalog'

async function installTraining() {
  for (const entry of trainingCatalog) {
    const id = `training-catalog-${entry.id}`;
    const draft = makeTrainingDraft(entry, 'medium');
    await db.template.upsert({
      where: { id },
      update: {},
      create: { ...draft, id, isBuiltIn: true, redFlags: JSON.stringify(draft.redFlags) },
    });
  }
  console.log('Training catalog ready.');
}

installTraining().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
