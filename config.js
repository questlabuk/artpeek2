// Shared, server-authoritative config. Exposed to the client via GET /api/config.
const GROUPS = [
  { id: 'doodles',    name: 'Doodle Club',      emoji: '✏️', color: '#ffd166', desc: 'Quick sketches & silly scribbles' },
  { id: 'digital',    name: 'Digital Dreams',   emoji: '🖱️', color: '#80ffb9', desc: 'Made on screens & tablets' },
  { id: 'pixel',      name: 'Pixel Land',       emoji: '👾', color: '#a0c4ff', desc: 'Tiny squares, big worlds' },
  { id: 'characters', name: 'Characters & OCs', emoji: '🦊', color: '#ff8b5e', desc: 'Original characters & friends' },
  { id: 'nature',     name: 'Nature & Animals', emoji: '🌿', color: '#9bf6c0', desc: 'Plants, pets & critters' },
  { id: 'comics',     name: 'Comic Corner',     emoji: '💬', color: '#ffadad', desc: 'Panels, strips & stories' }
];

const BIO_QUESTIONS = [
  { id: 'style',  q: 'My art style is…',  opts: ['Doodly & loose', 'Anime / manga', 'Cartoony', 'Realistic', 'Abstract', 'Pixel art', 'Cute & kawaii'] },
  { id: 'medium', q: 'My go-to tool is…', opts: ['Pencil & paper', 'Digital tablet', 'Watercolour', 'Markers', 'Crayons', 'Paint', 'Anything I find!'] },
  { id: 'when',   q: 'I draw best when…', opts: ['It\u2019s late at night', 'The sun is up', 'Music is playing', 'I\u2019m super bored', 'I have a snack', 'It\u2019s raining'] },
  { id: 'mood',   q: 'My art mood is…',   opts: ['Chaotic & fun', 'Calm & cozy', 'Bold & bright', 'Dark & moody', 'Soft & dreamy', 'Weird & wild'] }
];

const BADGES = [
  { min: 1,  emoji: '🌱', name: 'First Post' },
  { min: 3,  emoji: '✏️', name: 'Doodler' },
  { min: 6,  emoji: '🎨', name: 'Artist' },
  { min: 12, emoji: '⭐', name: 'Star Creator' },
  { min: 20, emoji: '🔥', name: 'On Fire' },
  { min: 35, emoji: '👑', name: 'Art Legend' }
];

const GROUP_IDS = GROUPS.map(g => g.id);
function validBio(bio) {
  if (!bio || typeof bio !== 'object') return false;
  return BIO_QUESTIONS.every(b => {
    const v = bio[b.id];
    return typeof v === 'string' && b.opts.indexOf(v) >= 0;
  });
}

module.exports = { GROUPS, BIO_QUESTIONS, BADGES, GROUP_IDS, validBio };
