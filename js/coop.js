// Co-op weighting for the squad builder. Tweak freely — these are opinions, not game data.
//   power    1–5  how easily this character wins a run (a "carry" for teammates)
//   support  0–5  how much the character's effect helps the *other* players
//   friction 0–3  how much it gets in the team's way (steals loot, chaotic, hard to track)
window.COOP = {
  isaac:         { power: 3, support: 0, friction: 0, note: 'Solid all-rounder; unlocks the D6 to reroll bad items.' },
  magdalene:     { power: 3, support: 1, friction: 0, note: 'Extra health and Yum Heart keep her alive; slow.' },
  cain:          { power: 3, support: 1, friction: 0, note: 'Lucky Foot and bonus drops feed the whole run.' },
  judas:         { power: 3, support: 0, friction: 0, note: 'High damage glass cannon with Book of Belial.' },
  bluebaby:      { power: 2, support: 0, friction: 0, note: 'Soul hearts only; no red-heart healing.' },
  eve:           { power: 2, support: 0, friction: 0, note: 'Weak start; Whore of Babylon needs low health.' },
  samson:        { power: 3, support: 0, friction: 0, note: 'Gets stronger the more he gets hit; decent tank.' },
  azazel:        { power: 5, support: 0, friction: 0, note: 'Flight + short Brimstone. The easiest carry in the game.' },
  lazarus:       { power: 3, support: 0, friction: 0, note: 'Built-in extra life makes runs forgiving.' },
  eden:          { power: 3, support: 0, friction: 0, note: 'Random start: can be amazing or awful.' },
  lost:          { power: 1, support: 0, friction: 1, note: 'Dies in one hit. Needs strong teammates.' },
  lilith:        { power: 3, support: 0, friction: 0, note: 'Incubus does the shooting from a safe spot.' },
  keeper:        { power: 2, support: 0, friction: 1, note: 'Coins are health; competes with teammates for coins.' },
  apollyon:      { power: 4, support: 0, friction: 0, note: 'Void eats active items for big stat gains.' },
  forgotten:     { power: 3, support: 0, friction: 1, note: 'Melee club; body/soul swap is awkward in a crowd.' },
  bethany:       { power: 4, support: 0, friction: 0, note: 'Book of Virtues wisps give strong defence and damage.' },
  jacob:         { power: 3, support: 0, friction: 2, note: 'Two bodies to steer; hard to track on a busy screen.' },

  't-isaac':     { power: 2, support: 5, friction: 0, note: 'Every item pedestal cycles between two picks for the whole party. God tier support.' },
  't-magdalene': { power: 4, support: 4, friction: 0, note: 'Hits drop temporary hearts anyone can grab; very tanky.' },
  't-cain':      { power: 3, support: 0, friction: 3, note: 'Bag of Crafting eats pickups and turns items into pickups, taking loot from teammates.' },
  't-judas':     { power: 2, support: 0, friction: 1, note: 'Dark Arts dash takes practice; low health.' },
  't-bluebaby':  { power: 2, support: 0, friction: 1, note: 'Poop juggling; poops get in teammates\' way.' },
  't-eve':       { power: 3, support: 0, friction: 0, note: 'Blood clots are good damage at a health cost.' },
  't-samson':    { power: 4, support: 0, friction: 0, note: 'Berserk turns him into a strong melee carry.' },
  't-azazel':    { power: 4, support: 0, friction: 0, note: 'Hemoptysis sneeze + short Brimstone; strong.' },
  't-lazarus':   { power: 2, support: 0, friction: 1, note: 'Flips between two forms; a lot to manage.' },
  't-eden':      { power: 2, support: 0, friction: 0, note: 'Build rerolls whenever hit; unreliable.' },
  't-lost':      { power: 1, support: 0, friction: 1, note: 'One-hit death, offensive items only. Bring carries.' },
  't-lilith':    { power: 2, support: 0, friction: 1, note: 'Gello whip is clunky to aim.' },
  't-keeper':    { power: 3, support: 4, friction: 1, note: 'Shops everywhere and enemies drop coins: more item options for the lobby.' },
  't-apollyon':  { power: 3, support: 0, friction: 0, note: 'Abyss turns items into locust familiars.' },
  't-forgotten': { power: 1, support: 0, friction: 2, note: 'Throwing the body around is slow and awkward with others.' },
  't-bethany':   { power: 3, support: 1, friction: 0, note: 'Lemegeton item wisps; needs soul hearts to charge.' },
  't-jacob':     { power: 1, support: 0, friction: 2, note: 'Dark Esau keeps charging at you; chaotic for everyone.' },
};

// ---- Squad scoring ----
// A run pays out marks to everyone only if the team wins, so:
//   expected value = win chance × Σ (player priority × marks that player can still get on their character)
// Win chance grows with the best carry and the average power, plus support from teammates,
// minus friction. That makes the optimizer pair a hard target (e.g. Tainted Lost) with carries.
window.SQUAD_MODEL = {
  RUN_CAP: 5,                                   // marks one run can realistically add
  ROLE_WEIGHT: { auto: 1, carry: 0.2, pick: 1.5 }, // pick = player chose a character to hunt

  winChance(chars) {
    const n = chars.length;
    const r = chars.map((c) => COOP[c.id]);
    const maxP = Math.max(...r.map((x) => x.power));
    const avgP = r.reduce((s, x) => s + x.power, 0) / n;
    const uniq = [...new Set(chars.map((c) => c.id))].map((id) => COOP[id]);
    const support = n > 1 ? 0.25 * uniq.reduce((s, x) => s + x.support, 0) : 0;
    const friction = n > 1 ? 0.2 * r.reduce((s, x) => s + x.friction, 0) : 0;
    const w = 0.55 * maxP + 0.45 * avgP + support - friction; // ≈ 1..7
    return Math.max(0.08, Math.min(0.95, 0.12 + 0.14 * w));
  },
};
