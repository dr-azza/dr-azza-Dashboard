/**
 * Quick-pick list of medicines commonly prescribed in obstetrics and gynecology, with typical
 * starting directions. These are editable suggestions to speed up writing a prescription:
 * the prescribing doctor always decides the final drug, dose and duration.
 */
export interface DrugSuggestion {
  drugName: string
  dose: string
  frequency: string
  duration?: string
  /** Search words, including common brand and Arabic names. */
  keywords: string[]
}

export const COMMON_DRUGS: DrugSuggestion[] = [
  {
    drugName: 'Folic acid',
    dose: '5 mg',
    frequency: 'Once daily',
    duration: 'Until 12 weeks',
    keywords: ['folic', 'فوليك'],
  },
  {
    drugName: 'Ferrous sulfate',
    dose: '200 mg',
    frequency: 'Once daily',
    duration: '30 days',
    keywords: ['iron', 'حديد', 'ferrous'],
  },
  {
    drugName: 'Calcium carbonate + Vitamin D3',
    dose: '1 tablet',
    frequency: 'Twice daily',
    duration: '30 days',
    keywords: ['calcium', 'كالسيوم', 'vitamin d'],
  },
  {
    drugName: 'Prenatal multivitamin',
    dose: '1 tablet',
    frequency: 'Once daily',
    duration: 'Until delivery',
    keywords: ['vitamin', 'فيتامين', 'multivitamin'],
  },
  {
    drugName: 'Dydrogesterone',
    dose: '10 mg',
    frequency: 'Twice daily',
    duration: '14 days',
    keywords: ['duphaston', 'دوفاستون', 'progesterone'],
  },
  {
    drugName: 'Progesterone vaginal pessary',
    dose: '400 mg',
    frequency: 'Once daily at night',
    duration: '14 days',
    keywords: ['cyclogest', 'prontogest', 'بروجستيرون'],
  },
  {
    drugName: 'Low-dose aspirin',
    dose: '81 mg',
    frequency: 'Once daily at night',
    duration: 'Until 36 weeks',
    keywords: ['aspirin', 'أسبرين'],
  },
  {
    drugName: 'Methyldopa',
    dose: '250 mg',
    frequency: 'Three times daily',
    keywords: ['aldomet', 'ألدوميت', 'blood pressure'],
  },
  {
    drugName: 'Nifedipine (modified release)',
    dose: '30 mg',
    frequency: 'Once daily',
    keywords: ['nifedipine', 'epilat', 'blood pressure'],
  },
  {
    drugName: 'Labetalol',
    dose: '100 mg',
    frequency: 'Twice daily',
    keywords: ['labetalol', 'trandate', 'blood pressure'],
  },
  {
    drugName: 'Metformin',
    dose: '500 mg',
    frequency: 'Twice daily with meals',
    keywords: ['metformin', 'glucophage', 'سكر'],
  },
  {
    drugName: 'Doxylamine + Pyridoxine',
    dose: '1 tablet',
    frequency: 'At bedtime',
    duration: '14 days',
    keywords: ['nausea', 'غثيان', 'diclegis'],
  },
  {
    drugName: 'Paracetamol',
    dose: '500 mg',
    frequency: 'Every 6–8 hours as needed',
    duration: '5 days',
    keywords: ['panadol', 'بنادول', 'pain'],
  },
  {
    drugName: 'Omeprazole',
    dose: '20 mg',
    frequency: 'Once daily before breakfast',
    duration: '14 days',
    keywords: ['heartburn', 'حموضة'],
  },
  {
    drugName: 'Metronidazole',
    dose: '500 mg',
    frequency: 'Twice daily',
    duration: '7 days',
    keywords: ['flagyl', 'فلاجيل'],
  },
  {
    drugName: 'Clotrimazole vaginal tablet',
    dose: '500 mg',
    frequency: 'Once at night',
    duration: '1 day',
    keywords: ['canesten', 'كانستين', 'fungal'],
  },
  {
    drugName: 'Cefalexin',
    dose: '500 mg',
    frequency: 'Every 8 hours',
    duration: '7 days',
    keywords: ['uti', 'antibiotic', 'مضاد حيوي'],
  },
  {
    drugName: 'Letrozole',
    dose: '2.5 mg',
    frequency: 'Once daily, cycle days 3–7',
    duration: '5 days',
    keywords: ['femara', 'فيمارا', 'ovulation'],
  },
  {
    drugName: 'Clomiphene citrate',
    dose: '50 mg',
    frequency: 'Once daily, cycle days 2–6',
    duration: '5 days',
    keywords: ['clomid', 'كلوميد', 'ovulation'],
  },
  {
    drugName: 'Tranexamic acid',
    dose: '500 mg',
    frequency: 'Three times daily during bleeding',
    duration: '5 days',
    keywords: ['kapron', 'bleeding', 'نزيف'],
  },
]

export function searchDrugs(query: string, limit = 8): DrugSuggestion[] {
  const q = query.trim().toLowerCase()
  if (!q) return COMMON_DRUGS.slice(0, limit)
  return COMMON_DRUGS.filter(
    (d) => d.drugName.toLowerCase().includes(q) || d.keywords.some((k) => k.toLowerCase().includes(q)),
  ).slice(0, limit)
}
