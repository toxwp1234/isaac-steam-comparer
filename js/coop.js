// Co-op character analysis used by the squad builder. Opinionated — edit freely.
//
// Every stat is 0–5 and answers one question:
//   dmg   Damage     — how fast does this character kill rooms and bosses with its starting kit?
//   surv  Survival   — how hard is this character to kill (health pool, invulnerability, extra lives)?
//   help  Team help  — how much does the character's kit directly help the OTHER players?
//   cost  Team cost  — how much does it take from or get in the way of the other players?
//   skill Skill      — how much practice and attention does it need to play well?
//
// good / bad are shown on the Squad page. Co-op facts come from the Isaac wiki
// (e.g. Yum Heart heals teammates, Tainted Keeper makes everyone buy items, dead players keep fighting as ghosts).
window.STAT_INFO = {
  dmg:   { label: 'Damage',    q: 'How fast they kill rooms and bosses with their starting kit.' },
  surv:  { label: 'Survival',  q: 'How hard they are to kill: health, invulnerability, extra lives.' },
  help:  { label: 'Team help', q: 'How much their kit directly helps the other players.' },
  cost:  { label: 'Team cost', q: 'How much they take from, or get in the way of, the other players.' },
  skill: { label: 'Skill',     q: 'How much practice and attention they need to play well.' },
};

window.COOP = {
  isaac: { dmg: 2, surv: 2, help: 0, cost: 0, skill: 1,
    good: ['The D6 (once unlocked) rerolls any item, so he finds a strong build more often than anyone'],
    bad: ['Average stats and no damage or health bonus'] },
  magdalene: { dmg: 2, surv: 4, help: 1, cost: 0, skill: 1,
    good: ['4 red hearts and Yum Heart to heal herself', 'Yum Heart also heals every other player for half a heart'],
    bad: ['Slow (0.85 speed), so fast bullets are hard to dodge'] },
  cain: { dmg: 3, surv: 1, help: 1, cost: 0, skill: 1,
    good: ['×1.2 damage and high luck', 'Lucky Foot means more room drops and better machine payouts for the team'],
    bad: ['Only 2 red hearts, so early devil deals are risky'] },
  judas: { dmg: 4, surv: 1, help: 0, cost: 0, skill: 2,
    good: ['×1.35 damage plus Book of Belial for big boss burst'],
    bad: ['Starts with a single red heart'] },
  bluebaby: { dmg: 2, surv: 3, help: 0, cost: 0, skill: 2,
    good: ['3 soul hearts and a guaranteed devil/angel room chance', 'Can\'t use red hearts, so red heart drops go to teammates'],
    bad: ['Soul hearts can\'t be refilled, so every hit is permanent'] },
  eve: { dmg: 2, surv: 1, help: 0, cost: 0, skill: 3,
    good: ['Whore of Babylon and Dead Bird kick in at low health'],
    bad: ['×0.75 damage until she is down to one heart', 'Has to play at low health on purpose'] },
  samson: { dmg: 3, surv: 2, help: 0, cost: 0, skill: 2,
    good: ['Bloody Lust: damage grows every time he is hit (up to +6)'],
    bad: ['Needs to take hits to get strong'] },
  azazel: { dmg: 5, surv: 3, help: 0, cost: 0, skill: 2,
    good: ['Flight plus a charged mini Brimstone: huge boss damage', '3 black hearts', 'His ghost still fires Brimstone if he dies'],
    bad: ['Very short range, so he has to get close'] },
  lazarus: { dmg: 2, surv: 4, help: 0, cost: 0, skill: 1,
    good: ['Built-in extra life; comes back as Lazarus Risen with more damage'],
    bad: ['Weak until he dies once'] },
  eden: { dmg: 3, surv: 3, help: 0, cost: 0, skill: 2,
    good: ['Random items and stats can start a run already strong'],
    bad: ['Can also start weak', 'Each run uses an Eden token'] },
  lost: { dmg: 2, surv: 0, help: 0, cost: 0, skill: 5,
    good: ['Flight, spectral tears and free devil deals', 'Holy Mantle blocks one hit per room'],
    bad: ['Dies to a second hit in a room', 'Can\'t take free devil deals if a Keeper is in the lobby'] },
  lilith: { dmg: 3, surv: 2, help: 0, cost: 0, skill: 2,
    good: ['Incubus does 100% of her damage from a safe spot', 'Box of Friends doubles familiars'],
    bad: ['Can\'t shoot herself, and Incubus lags behind her'] },
  keeper: { dmg: 2, surv: 1, help: 0, cost: 3, skill: 3,
    good: ['Triple shot; a teammate\'s pennies keep him healed'],
    bad: ['Heals only from coins, so he eats the shared money for shops', 'Slow fire rate and speed; max 3 coin hearts'] },
  apollyon: { dmg: 3, surv: 1, help: 0, cost: 1, skill: 2,
    good: ['Void eats active items and pedestals for permanent stat ups'],
    bad: ['Wants to Void items a teammate might want', '2 red hearts'] },
  forgotten: { dmg: 4, surv: 2, help: 0, cost: 0, skill: 3,
    good: ['Bone club deals 3× damage and picks up pickups', 'Can swap to his flying soul'],
    bad: ['Melee range in crowded co-op rooms', 'Bone hearts only'] },
  bethany: { dmg: 3, surv: 2, help: 0, cost: 2, skill: 3,
    good: ['Book of Virtues wisps block shots and add damage'],
    bad: ['Soul and black hearts become book charges, so she takes the soul hearts teammates use as a buffer'] },
  jacob: { dmg: 3, surv: 2, help: 0, cost: 1, skill: 5,
    good: ['Two bodies shooting at once; can grab two items from a choice room'],
    bad: ['One player steering two bodies is hard to follow on a busy screen', 'Takes loot for two bodies'] },

  't-isaac': { dmg: 2, surv: 2, help: 5, cost: 1, skill: 2,
    good: ['Every item pedestal, shop and devil item cycles between two items, and teammates can take either', 'Even boss items get a second choice in co-op'],
    bad: ['Can only hold 8 passive items himself', 'Items he drops for a teammate stop counting toward transformations'] },
  't-magdalene': { dmg: 3, surv: 5, help: 4, cost: 0, skill: 2,
    good: ['Big health pool with double healing, plus an automatic melee hug', 'Enemies drop flickering half red hearts that anyone can grab', 'Yum Heart heals every player'],
    bad: ['Tears deal ×0.75 damage; she has to get close', 'Health above 2 hearts slowly drains'] },
  't-cain': { dmg: 2, surv: 1, help: 1, cost: 3, skill: 4,
    good: ['Crafts exactly the items he wants with the Bag of Crafting', 'Teammates can still take pedestal items normally'],
    bad: ['Needs lots of pickups for crafting and competes for the shared ones', 'Touching an item pedestal breaks it into pickups'] },
  't-judas': { dmg: 4, surv: 1, help: 0, cost: 0, skill: 5,
    good: ['Dark Arts dash makes him invulnerable and deals big damage'],
    bad: ['Only black hearts (2 to start)', 'Hard to time well'] },
  't-bluebaby': { dmg: 2, surv: 2, help: 0, cost: 1, skill: 4,
    good: ['Poop spells give lots of utility; teammates can pick up poops for him'],
    bad: ['Bombs are replaced by poops', 'Juggling poop types takes attention'] },
  't-eve': { dmg: 3, surv: 1, help: 0, cost: 0, skill: 3,
    good: ['Sumptorium blood clots fight for her', 'Her clots keep fighting after she dies'],
    bad: ['Making clots costs her health'] },
  't-samson': { dmg: 4, surv: 3, help: 0, cost: 0, skill: 3,
    good: ['Berserk: +3 damage melee rampage that lasts longer the more he kills', 'Several Tainted Samsons share rage'],
    bad: ['Must fight up close to build rage'] },
  't-azazel': { dmg: 5, surv: 3, help: 0, cost: 0, skill: 3,
    good: ['Hemoptysis sneeze curses enemies so his Brimstone deals full damage (+3)', '3 black hearts', 'His ghost keeps Brimstone and the sneeze'],
    bad: ['No flight, unlike Azazel', 'Short range'] },
  't-lazarus': { dmg: 3, surv: 3, help: 0, cost: 1, skill: 4,
    good: ['Two forms with separate health bars; Flip gives each form its own item'],
    bad: ['Collects items for two forms, so he takes more loot', 'Managing Flip is a lot to think about'] },
  't-eden': { dmg: 2, surv: 2, help: 0, cost: 0, skill: 3,
    good: ['Every hit rerolls the build, so bad runs can turn good'],
    bad: ['Good builds get rerolled away too'] },
  't-lost': { dmg: 3, surv: 0, help: 0, cost: 0, skill: 5,
    good: ['×1.3 damage and Holy Card shields', 'Mostly offensive items'],
    bad: ['Dies to any hit without a shield', 'Usually ends up a ghost; bring carries'] },
  't-lilith': { dmg: 3, surv: 1, help: 0, cost: 0, skill: 4,
    good: ['Gello whip hits hard; it keeps fighting after she dies'],
    bad: ['Launching and aiming Gello is clunky'] },
  't-keeper': { dmg: 3, surv: 1, help: 4, cost: 2, skill: 3,
    good: ['Enemies drop coins for everyone, no matter who kills them', 'Quad shot', 'Extra items to buy'],
    bad: ['With him in the lobby every player has to buy items with coins', 'Only 2 coin hearts'] },
  't-apollyon': { dmg: 3, surv: 1, help: 0, cost: 1, skill: 2,
    good: ['Abyss turns items into locust familiars that keep fighting after he dies'],
    bad: ['Eating items means fewer pedestals for teammates', '2 red hearts'] },
  't-forgotten': { dmg: 4, surv: 2, help: 0, cost: 0, skill: 5,
    good: ['The thrown body hits hard and can\'t be hurt; only the soul takes damage'],
    bad: ['Carrying and throwing the body is slow and awkward'] },
  't-bethany': { dmg: 2, surv: 2, help: 0, cost: 2, skill: 3,
    good: ['Lemegeton summons item wisps that copy item effects', 'Great with Tainted Magdalene\'s heart drops'],
    bad: ['Red hearts become her blood charges, so she takes the hearts teammates heal with', 'Stat ups are reduced to 75%'] },
  't-jacob': { dmg: 3, surv: 2, help: 0, cost: 0, skill: 4,
    good: ['Dark Esau deals huge damage and ignores other players'],
    bad: ['Dark Esau keeps charging at him too'] },
};

// ---- Squad scoring ----
// 1. Win chance: the run pays out marks only if the team wins.
//      Kill speed   = 0.6 × best Damage   + 0.4 × average Damage
//      Staying alive= 0.5 × best Survival + 0.5 × average Survival   (dead players keep going as ghosts)
//      Team help    = total Team help of the squad, each character once, max 6   (only with 2+ players)
//      Team cost    = total Team cost of the squad                                (only with 2+ players)
//      Skill load   = how far the average Skill is above 2.5
//      rating = 0.45·Kill + 0.35·Alive + 0.3·Help − 0.2·Cost − 0.25·Skill load
//      win chance = 10% + 17% × rating, kept between 5% and 95%
// 2. Squad value = win chance × Σ (goal weight × marks each player can still get, max 5 per run)
window.SQUAD_MODEL = {
  RUN_CAP: 5,
  ROLE_WEIGHT: { auto: 1, carry: 0.2, pick: 1.5 },

  breakdown(chars) {
    const n = chars.length;
    const r = chars.map((c) => COOP[c.id]);
    const avg = (k) => r.reduce((s, x) => s + x[k], 0) / n;
    const max = (k) => Math.max(...r.map((x) => x[k]));
    const uniq = [...new Set(chars.map((c) => c.id))].map((id) => COOP[id]);
    const parts = {
      kill: 0.6 * max('dmg') + 0.4 * avg('dmg'),
      alive: 0.5 * max('surv') + 0.5 * avg('surv'),
      help: n > 1 ? Math.min(6, uniq.reduce((s, x) => s + x.help, 0)) : 0,
      cost: n > 1 ? r.reduce((s, x) => s + x.cost, 0) : 0,
      skill: Math.max(0, avg('skill') - 2.5),
    };
    const rating = 0.45 * parts.kill + 0.35 * parts.alive + 0.3 * parts.help - 0.2 * parts.cost - 0.25 * parts.skill;
    return { ...parts, rating, win: Math.max(0.05, Math.min(0.95, 0.1 + 0.17 * rating)) };
  },
};
