// palettes.js — named palettes. Each is harmonious on its own; Clocked lime is always the accent.
// Keys every palette must have: ink, paper, sky (far background), wall, wall2, floor, floor2, warm (light colour),
// cool, accent (a second accent), card (card paper), cardInk, capBg, capInk, glow.
const PALETTES = {
  // 1 · late-night break room: sage walls, fluorescent mint, mustard notes
  breakRoom: { ink: '#25302D', paper: '#F1EBDA', sky: '#3F5B57', wall: '#A9C3A4', wall2: '#86A88A', floor: '#6F6A5B', floor2: '#59554A', warm: '#F3C95B', cool: '#5E8C93', accent: '#E58B5A', card: '#FBF4E3', cardInk: '#25302D', capBg: '#FBF4E3', capInk: '#25302D', glow: '#EAF7D8' },
  // 2 · diner at night: indigo, neon rose, amber pendant light
  nightDiner: { ink: '#211B2B', paper: '#F3EADB', sky: '#1C2149', wall: '#3B3F78', wall2: '#2A2D5E', floor: '#5B3A4A', floor2: '#43293A', warm: '#F5B44E', cool: '#59C3C3', accent: '#EE6B86', card: '#FFF3E0', cardInk: '#211B2B', capBg: '#FFF3E0', capInk: '#211B2B', glow: '#FFD89A' },
  // 3 · bedroom at 1 AM: deep navy, violet, phone-glow cyan, notes yellow
  midnight: { ink: '#16122A', paper: '#EDE7DD', sky: '#121633', wall: '#2B2E63', wall2: '#22244F', floor: '#3A2F5E', floor2: '#2C2449', warm: '#FFD45C', cool: '#9FE6F2', accent: '#B49CF0', card: '#F7F3FF', cardInk: '#16122A', capBg: '#F7F3FF', capInk: '#16122A', glow: '#BDF0F7' },
  // 4 · bus stop in the rain: slate blues, wet teal, sodium-lamp amber, coral
  rainyBus: { ink: '#1E2933', paper: '#EEF0EC', sky: '#40566B', wall: '#5D7890', wall2: '#4A637A', floor: '#34495A', floor2: '#2A3A48', warm: '#F6BC62', cool: '#86AECB', accent: '#EC7458', card: '#F9F6EE', cardInk: '#1E2933', capBg: '#F9F6EE', capInk: '#1E2933', glow: '#FFE2A6' },
  // 5 · two jobs: sunny peach, butter, coral and sky — bouncy and warm
  sunnyJuggle: { ink: '#2B2131', paper: '#FBF0E1', sky: '#8CCBE6', wall: '#F7B98E', wall2: '#F29A72', floor: '#C97B5C', floor2: '#B0674C', warm: '#FAD976', cool: '#7FC6B0', accent: '#EE6C5D', card: '#FFF8EC', cardInk: '#2B2131', capBg: '#FFF8EC', capInk: '#2B2131', glow: '#FFF0BE' },
  // 6 · first job: chalkboard green, terracotta, cream and mustard
  chalkCafe: { ink: '#231A17', paper: '#F6EAD3', sky: '#2E4A40', wall: '#C9603F', wall2: '#A84B31', floor: '#7B4A35', floor2: '#5F3828', warm: '#EBAE3C', cool: '#88B9A6', accent: '#E05A42', card: '#FDF3DF', cardInk: '#231A17', capBg: '#FDF3DF', capInk: '#231A17', glow: '#FFE3A8' },
  // neutral studio palette for the end card when a video doesn't set one
  studio: { ink: '#1F1D26', paper: '#F3ECDF', sky: '#24262F', wall: '#2F3240', wall2: '#262834', floor: '#3A3D4C', floor2: '#2E3140', warm: '#F5C25E', cool: '#8FC9D9', accent: '#EF7A63', card: '#FBF6EC', cardInk: '#1F1D26', capBg: '#FBF6EC', capInk: '#1F1D26', glow: '#E9FFC2' },
};
// Fixed character colours (the same in every palette so characters stay on-model)
const CAST_COL = {
  lime: LIME, limeDk: '#93BD2F', limeLt: '#E4FF9C', face: '#23262F', faceLt: '#353A48', eye: '#FFFBEF', pupil: '#16141C',
  skin: '#E9B38E', skinDk: '#C98B68', hair: '#3A2A2C', shirt: '#4E6489', shirtDk: '#3B4D6C', apron: '#EADBB9', apronDk: '#CDB98F', pants: '#2F3142', shoe: '#2A2324',
  notes: '#FFD95A', notesDk: '#E9B53B', notesLine: '#E7C77E', cheek: '#F29C8B',
  env: '#FBF5E6', envDk: '#DCCFB2', shadowMan: '#1B1824', shadowRim: '#8E86C8',
  coin: '#F2C04B', coinDk: '#C9922C', phone: '#22232B', screen: '#FAF7EE',
};
let PAL = PALETTES.studio;
const INK = () => PAL.ink;
function usePalette(name) { PAL = PALETTES[name] || (typeof name === 'object' ? name : PALETTES.studio); }
