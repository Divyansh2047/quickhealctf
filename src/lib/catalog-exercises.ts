type Exercise =
  | { kind: 'choice'; heading: string; action: string; details: string[]; label: string; options: string[] }
  | { kind: 'checklist'; heading: string; action: string; details: string[]; checks: string[] }
  | { kind: 'review'; heading: string; action: string; details: string[]; reveal: string; evidence: string };

export const catalogExercises: Record<string, Exercise> = {
  lottery: {
    kind: 'review', heading: 'Prize claim receipt', action: 'Simulate proceeding with the claim',
    details: ['Draw entry: no record', 'Processing fee: required'],
    reveal: 'Inspect fee policy', evidence: 'The requester wants an advance fee before confirming eligibility. This exercise cannot move money.',
  },
  holiday: {
    kind: 'choice', heading: 'Travel reservation calendar', action: 'Simulate confirming the booking',
    details: ['Reservation status: unverified', 'Booking source: unexpected award notice'],
    label: 'Select a fictional departure', options: ['June 12', 'June 19', 'July 3'],
  },
  coworker: {
    kind: 'choice', heading: 'Workplace chat request', action: 'Simulate switching channels',
    details: ['Display name: Example colleague', 'Requested channel: personal messaging'],
    label: 'Choose a dummy channel destination', options: ['Example personal chat', 'Example private group'],
  },
  invoice: {
    kind: 'checklist', heading: 'Supplier change approval', action: 'Simulate approving the change',
    details: ['Supplier record: Example vendor', 'Change requested: a new payment destination'],
    checks: ['I reviewed the fictional supplier record', 'I acknowledge the payment destination changed'],
  },
  document: {
    kind: 'review', heading: 'Attachment download preview', action: 'Simulate downloading the attachment',
    details: ['File: demo-document.txt', 'Handling: preview only'],
    reveal: 'Inspect attachment details', evidence: 'Unverified sender. The simulated download records a decision; no file transfers or executes.',
  },
  account: {
    kind: 'choice', heading: 'Practice sign-in screen', action: 'Simulate signing in',
    details: ['Fictional account picker', 'This screen does not accept passwords'],
    label: 'Select a practice identity', options: ['Demo learner', 'Demo reviewer'],
  },
  'qr-notice': {
    kind: 'review', heading: 'QR destination inspection', action: 'Simulate opening the destination',
    details: ['Source: fictional office notice', 'Destination: hidden until inspected'],
    reveal: 'Preview decoded destination', evidence: 'Example destination: office-check.example. It is displayed as text and cannot be opened from this exercise.',
  },
  'meeting-change': {
    kind: 'choice', heading: 'Calendar update', action: 'Apply simulated RSVP',
    details: ['Original organizer: Example Operations', 'Update organizer: unrecognized'],
    label: 'Choose a practice RSVP', options: ['Accept updated time', 'Tentatively accept updated time'],
  },
  'app-access': {
    kind: 'checklist', heading: 'Permissions consent screen', action: 'Simulate granting permissions',
    details: ['App purpose: view a team calendar', 'Requested access: read files and manage shared resources'],
    checks: ['I reviewed the read permission', 'I reviewed the manage permission'],
  },
  recovery: {
    kind: 'review', heading: 'Recovery question review', action: 'Simulate continuing with recovery',
    details: ['Support case: fictional', 'Prompt expects personal history'],
    reveal: 'Read the example prompts', evidence: 'Example prompts ask for a childhood street or a pet’s name. These are examples to identify. There are no answer fields.',
  },
};
