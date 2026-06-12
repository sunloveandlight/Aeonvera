alter table public.lab_biomarkers
  drop constraint if exists lab_biomarkers_canonical_key_check;

alter table public.lab_biomarkers
  add constraint lab_biomarkers_canonical_key_check
  check (
    canonical_key in (
      'albumin',
      'creatinine',
      'fasting_glucose',
      'fasting_insulin',
      'hba1c',
      'triglycerides',
      'hdl_cholesterol',
      'ldl_cholesterol',
      'total_cholesterol',
      'apob',
      'blood_pressure_systolic',
      'blood_pressure_diastolic',
      'hscrp',
      'homocysteine',
      'ferritin',
      'esr',
      'fibrinogen',
      'lymphocyte_pct',
      'mean_cell_volume',
      'red_cell_distribution_width',
      'alkaline_phosphatase',
      'white_blood_cell_count',
      'tsh',
      'free_t3',
      'free_t4',
      'morning_cortisol',
      'total_testosterone',
      'free_testosterone',
      'shbg',
      'estradiol',
      'progesterone',
      'lh',
      'fsh',
      'vitamin_d'
    )
  );

notify pgrst, 'reload schema';
