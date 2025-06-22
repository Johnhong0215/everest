export const SPORTS = [
  {
    id: 'badminton',
    name: 'Badminton',
    color: 'sport-badminton',
    icon: 'racket'
  },
  {
    id: 'basketball',
    name: 'Basketball',
    color: 'sport-basketball',
    icon: 'basketball'
  },
  {
    id: 'soccer',
    name: 'Soccer',
    color: 'sport-soccer',
    icon: 'soccer'
  },
  {
    id: 'tennis',
    name: 'Tennis',
    color: 'sport-tennis',
    icon: 'tennis'
  },
  {
    id: 'volleyball',
    name: 'Volleyball',
    color: 'sport-volleyball',
    icon: 'volleyball'
  },
  {
    id: 'tabletennis',
    name: 'Table Tennis',
    color: 'sport-tabletennis',
    icon: 'ping-pong'
  }
];

export const SPORT_CONFIGS = {
  badminton: {
    format: ['Singles', 'Doubles'],
    courtType: ['Indoor wood', 'Outdoor concrete'],
    shuttlecock: ['Feather (slow)', 'Feather (medium)', 'Feather (fast)', 'Nylon'],
    lighting: ['Daylight', 'Evening floodlights'],
    equipment: ['BYO racket', 'Host-provided rental'],
  },
  basketball: {
    format: ['3×3 half-court', '5×5 full-court'],
    venue: ['Outdoor public court', 'Indoor gym'],
    hoopHeight: ['Standard 10′', 'Adjustable'],
    ballSupply: ['BYO ball', 'Host-provided'],
    skillDivision: ['Casual pickup', 'Competitive'],
    referee: ['Self-officiated', 'Paid official'],
    duration: ['Timed quarters', 'First to X points'],
  },
  soccer: {
    format: ['5-a-side', '7-a-side', '11-a-side'],
    pitchSurface: ['Grass', 'Turf', 'Indoor dome'],
    goalType: ['Portable', 'Regulation goals'],
    ballSize: ['Size 3', 'Size 4', 'Size 5'],
    referee: ['None', 'Certified referee'],
    matchLength: ['2×30 min', '2×45 min', 'Custom'],
    cleatsRequirement: ['Turf shoes', 'Studs'],
  },
  tennis: {
    format: ['Singles', 'Doubles'],
    courtSurface: ['Hard', 'Clay', 'Grass', 'Indoor carpet'],
    ballType: ['Pressurized', 'Pressureless'],
    scoring: ['Standard sets', 'Pro-sets', 'Tiebreak-only'],
    equipmentRental: ['None', 'Racquets', 'Ball machine'],
    courtLighting: ['Day play', 'Night play'],
  },
  volleyball: {
    discipline: ['Indoor 6×6', 'Beach 2×2', 'Beach 4×4'],
    surface: ['Gym floor', 'Sand'],
    netHeight: ['Men\'s regulation', 'Women\'s regulation'],
    ballSupply: ['Indoor volleyballs', 'Beach volleyballs'],
    skillLevel: ['Recreational', 'Competitive'],
    rotationRules: ['Casual', 'Strict'],
    weatherBackup: ['None', 'Indoor alternative'],
  },
  tabletennis: {
    format: ['Singles', 'Doubles', 'Mini-tournament'],
    tableType: ['Regulation', 'Portable'],
    ballGrade: ['3-star', 'Training'],
    paddleRental: ['BYO', 'Host-provided'],
    scoring: ['Best-of-5 to 11', 'Best-of-7 to 11'],
    spaceAndLighting: ['Standard clearance', 'Professional setup'],
  },
};

export const SKILL_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'any', label: 'Any Level' },
];

export const GENDER_MIX = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'mens', label: 'Men\'s' },
  { value: 'womens', label: 'Women\'s' },
];
