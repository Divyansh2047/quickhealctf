export const trainingCatalog = [
  { id: 'lottery', name: 'Lottery notice', category: 'Prize claims', overview: 'An unexpected prize notice asks for a fee before releasing the award.', clue: 'The recipient never entered the draw, and an advance fee is requested.', advice: 'Verify through the published lottery operator before taking any action.', keywords: /lottery|jackpot|prize|raffle/ },
  { id: 'holiday', name: 'Summer vacation tickets', category: 'Travel offers', overview: 'An unexpected vacation award asks the recipient to confirm a booking.', clue: 'The message claims a booking exists although the recipient made none.', advice: 'Open the travel provider independently to check whether the booking exists.', keywords: /vacation|holiday|ticket|travel/ },
  { id: 'coworker', name: 'Coworker impersonation', category: 'Identity verification', overview: 'A message claiming to be from a teammate asks to switch to a personal messaging account.', clue: 'The display name is familiar, but the address and requested channel are unfamiliar.', advice: 'Contact the teammate through the company directory or an existing conversation.', keywords: /coworker|colleague|employee|impersonat|teammate/ },
  { id: 'invoice', name: 'Supplier payment change', category: 'Payment requests', overview: 'A supplier notice says its bank details have changed.', clue: 'A payment destination changed without the normal approval process.', advice: 'Call the supplier using the number already in your records.', keywords: /invoice|supplier|payment|billing/ },
  { id: 'document', name: 'Unexpected shared document', category: 'Document sharing', overview: 'A document notice claims that a file was shared with the recipient.', clue: 'The document is unexpected and the sender cannot be verified from the message.', advice: 'Check the approved document portal and verify with the sender separately.', keywords: /document|file|shared|sign/ },
  { id: 'account', name: 'Account verification notice', category: 'Account security', overview: 'An account notice claims that access will end unless the recipient verifies their account.', clue: 'The notice pressures the recipient to act before checking the account portal.', advice: 'Open the account portal from a known bookmark and check for a real notification.', keywords: /account|password|login/ },
];

export function makeTrainingDraft(entry: typeof trainingCatalog[number], difficulty: 'easy' | 'medium' | 'hard') {
  const exercises = {
    easy: 'Identify the main warning sign.',
    medium: 'Choose how you would independently verify this request.',
    hard: 'Identify what evidence would establish whether the request is legitimate.',
  };
  return {
    name: entry.name,
    category: entry.category,
    difficulty,
    subject: `Training exercise: ${entry.name}`,
    senderName: 'PhishGuard Training',
    senderEmail: 'training@mail.securelab.test',
    bodyHtml: `<h2>${entry.name}</h2><p>Internal awareness exercise</p><p>${entry.overview}</p><p>${exercises[difficulty]}</p><p><a href="#">Open exercise</a></p>`,
    redFlags: [entry.clue],
    landingMessage: entry.advice,
    aiGenerated: false,
  };
}
