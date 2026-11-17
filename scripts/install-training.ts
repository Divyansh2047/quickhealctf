import { db } from '../src/lib/db'
import { makeTrainingDraft, trainingCatalog } from '../src/lib/training-catalog'

const demoPeople = [
  { name: 'Demo Finance Learner', email: 'finance@learners.securelab.test', department: 'Finance' },
  { name: 'Demo Operations Learner', email: 'operations@learners.securelab.test', department: 'Operations' },
  { name: 'Demo People Learner', email: 'people@learners.securelab.test', department: 'People' },
  { name: 'Demo Engineering Learner', email: 'engineering@learners.securelab.test', department: 'Engineering' },
];

async function installDemoParticipants() {
  const key = 'starterDemoParticipantsInstalled';
  return db.$transaction(async tx => {
    if (await tx.setting.findUnique({ where: { key } })) return false;
    if (await tx.participant.count()) return false;

    for (const domain of ['learners.securelab.test', 'mail.securelab.test']) {
      await tx.allowedDomain.upsert({
        where: { domain },
        update: {},
        create: { domain, approvedBy: 'fictional-demo-fixture' },
      });
    }

    // Fictional demo records only. Invitations still govern real participant consent.
    const now = new Date();
    await tx.participant.createMany({
      data: demoPeople.map((person, index) => ({
        ...person,
        consented: index !== demoPeople.length - 1,
        consentedAt: index !== demoPeople.length - 1 ? now : null,
      })),
    });
    await tx.setting.create({ data: { key, value: 'true' } });
    return true;
  });
}

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
  console.log(`Training catalog ready (${trainingCatalog.length} built-in templates).`);
  if (process.argv.includes('--with-demo')) {
    const installed = await installDemoParticipants();
    console.log(installed
      ? 'Four fictional demo participants added, including one pending consent.'
      : 'Existing participant data and consent left unchanged.');
  }
}

installTraining().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
