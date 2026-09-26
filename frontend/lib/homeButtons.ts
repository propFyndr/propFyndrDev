export interface HomeButtonSubItem {
  label: string;
  prompt: string;
}

export interface HomeButtonGroup {
  id: string;
  title: string;
  primaryPrompt: string;
  icon: string;
  colorClass: string;
  options: HomeButtonSubItem[];
}

export const HOME_BUTTON_GROUPS: HomeButtonGroup[] = [
  {
    id: 'sec10_gn',
    title: 'Sector 10 Gr. Noida West',
    primaryPrompt: 'Show me affordable 2 BHK & 3 BHK apartments in Sector 10 Greater Noida West.',
    icon: 'MapPin',
    colorClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover/main:bg-indigo-600 group-hover/main:text-white',
    options: [
      {
        label: 'Affordable 2 BHK & 3 BHK',
        prompt: 'Show me affordable 2 BHK and 3 BHK apartments in Sector 10 Greater Noida West.'
      },
      {
        label: 'Under construction projects',
        prompt: 'Find family-sized 3 BHK flats under construction in Sector 10 Greater Noida West.'
      },
      {
        label: 'Top builder projects',
        prompt: 'Which top builders have ongoing residential projects in Sector 10 Greater Noida West?'
      }
    ]
  },
  {
    id: 'budget_3bhk',
    title: 'Is ₹2 Cr fair for 3 BHK?',
    primaryPrompt: 'Is 2 crore too much for a 3 BHK in Noida right now?',
    icon: 'CurrencyInr',
    colorClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 group-hover/main:bg-amber-600 group-hover/main:text-white',
    options: [
      {
        label: '3 BHK price benchmark',
        prompt: 'Give me a sector-wise benchmark table for 3 BHK prices in Noida and Greater Noida.'
      },
      {
        label: 'Best 3 BHK under 2 crore',
        prompt: 'Show me the best verified 3 BHK options in Noida under 2 crore budget.'
      },
      {
        label: 'Is 2 Cr fair for Sector 75?',
        prompt: 'Is 2 crore a fair price for a 3 BHK in Sector 75 Noida?'
      }
    ]
  },
  {
    id: 'sec150_sports',
    title: 'Sector 150 Sports City',
    primaryPrompt: 'Show me top residential projects in Sector 150 Noida with low density and sports facilities.',
    icon: 'Trees',
    colorClass: 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 group-hover/main:bg-teal-600 group-hover/main:text-white',
    options: [
      {
        label: 'Low-density 3 & 4 BHK flats',
        prompt: 'Show me low-density 3 BHK and 4 BHK apartments in Sector 150 Noida.'
      },
      {
        label: 'Godrej & ATS Sports projects',
        prompt: 'Show Godrej and ATS residential projects in Sector 150 Noida.'
      },
      {
        label: 'Sector 150 RERA delivery status',
        prompt: 'What is the RERA possession timeline for projects in Sector 150 Noida?'
      }
    ]
  },
  {
    id: 'sec75_metro',
    title: 'Sector 75 metro flats',
    primaryPrompt: 'Show me 3 BHK ready to move flats in Sector 75 within walking distance to metro.',
    icon: 'Building2',
    colorClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 group-hover/main:bg-blue-600 group-hover/main:text-white',
    options: [
      {
        label: 'Immediate possession 3 BHK',
        prompt: 'Show me ready to move 3 BHK apartments in Sector 75 Noida.'
      },
      {
        label: 'Flats near Sector 76 Metro station',
        prompt: 'Find residential flats in Sector 75 and 76 within 500m of Aqua Line metro.'
      },
      {
        label: 'Sector 75 vs Sector 137 comparison',
        prompt: 'Compare Sector 75 vs Sector 137 for family living and commute.'
      }
    ]
  }
];
