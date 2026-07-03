update public.lab_biomarkers
set unit = case canonical_key
  when 'albumin' then 'g/L'
  when 'creatinine' then 'µmol/L'
  when 'fasting_glucose' then 'mmol/L'
  when 'fasting_insulin' then 'uIU/mL'
  when 'hba1c' then '%'
  when 'triglycerides' then 'mg/dL'
  when 'hdl_cholesterol' then 'mg/dL'
  when 'ldl_cholesterol' then 'mg/dL'
  when 'total_cholesterol' then 'mg/dL'
  when 'apob' then 'mg/dL'
  when 'blood_pressure_systolic' then 'mmHg'
  when 'blood_pressure_diastolic' then 'mmHg'
  when 'hscrp' then 'mg/dL'
  when 'homocysteine' then 'µmol/L'
  when 'ferritin' then 'ng/mL'
  when 'esr' then 'mm/hr'
  when 'fibrinogen' then 'mg/dL'
  when 'lymphocyte_pct' then '%'
  when 'mean_cell_volume' then 'fL'
  when 'red_cell_distribution_width' then '%'
  when 'alkaline_phosphatase' then 'U/L'
  when 'white_blood_cell_count' then 'K/uL'
  when 'tsh' then 'mIU/L'
  when 'free_t3' then 'pg/mL'
  when 'free_t4' then 'ng/dL'
  when 'morning_cortisol' then 'ug/dL'
  when 'total_testosterone' then 'ng/dL'
  when 'free_testosterone' then 'pg/mL'
  when 'shbg' then 'nmol/L'
  when 'estradiol' then 'pg/mL'
  when 'progesterone' then 'ng/mL'
  when 'lh' then 'IU/L'
  when 'fsh' then 'IU/L'
  when 'vitamin_d' then 'ng/mL'
  else unit
end
where canonical_key in (
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
);
