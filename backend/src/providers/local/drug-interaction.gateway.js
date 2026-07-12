const KNOWN_WARNINGS = [
  { terms: ['ibuprofen', 'naproxen', 'aspirin'], warning: 'NSAIDs may increase bleeding or kidney risk with some current therapies.' },
  { terms: ['potassium'], warning: 'Potassium products may require monitoring with ACE inhibitors.' },
  { terms: ['warfarin'], warning: 'Warfarin has clinically significant interactions and requires pharmacist or prescriber review.' },
];

export const drugInteractionGateway = {
  name: 'local-informational',

  async check({ medicationName, currentMedications = [] }) {
    const normalized = String(medicationName || '').toLowerCase();
    const matches = KNOWN_WARNINGS.filter((entry) => entry.terms.some((term) => normalized.includes(term)));
    return {
      provider: 'local-informational',
      medicationName,
      currentMedications: currentMedications.map((item) => item.name || item),
      severity: matches.length ? 'Review required' : 'No local rule matched',
      warnings: matches.map((entry) => entry.warning),
      disclaimer: 'Informational local screening only. A clinician or pharmacist must make treatment decisions.',
      checkedAt: new Date().toISOString(),
    };
  },
};
