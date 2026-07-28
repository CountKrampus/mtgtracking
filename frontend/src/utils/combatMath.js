// Resolves a single combat between one attacker and its blockers, correctly
// handling first strike / double strike combat steps, deathtouch, trample
// damage assignment, and lifelink — the interactions new players most often
// get wrong (e.g. a first-strike blocker killing the attacker before it can
// deal damage back).
//
// attacker: { power, toughness, firstStrike, doubleStrike, deathtouch, trample, lifelink }
// blockers: [{ id, name, power, toughness, firstStrike, doubleStrike, deathtouch }]
export function resolveCombat({ attacker, blockers }) {
  const log = [];
  const blockerStates = blockers.map(b => ({ ...b, damage: 0, alive: true }));
  let attackerDamage = 0;
  let attackerAlive = true;
  let damageToPlayer = 0;
  let lifeGained = 0;

  const firstStepParticipant = (c) => c.firstStrike || c.doubleStrike;
  const regularStepParticipant = (c) => !c.firstStrike || c.doubleStrike;
  const hasFirstStrikeStep = firstStepParticipant(attacker) || blockerStates.some(firstStepParticipant);

  function dealAttackerDamage(power) {
    const aliveBlockers = blockerStates.filter(b => b.alive);
    let totalDealt = 0;

    if (aliveBlockers.length === 0) {
      if (attacker.trample) {
        damageToPlayer += power;
        totalDealt = power;
        log.push(`No blockers remain — ${power} damage tramples through to the player.`);
      } else if (power > 0) {
        log.push(`No blockers remain and the attacker has no trample — ${power} damage has nowhere to go.`);
      }
      if (attacker.lifelink && totalDealt > 0) lifeGained += totalDealt;
      return totalDealt;
    }

    let remaining = power;
    for (const b of aliveBlockers) {
      if (remaining <= 0) break;
      const lethal = attacker.deathtouch ? 1 : Math.max(0, b.toughness - b.damage);
      const assign = Math.min(lethal, remaining);
      if (assign > 0) {
        b.damage += assign;
        remaining -= assign;
        totalDealt += assign;
        log.push(`Attacker assigns ${assign} damage to ${b.name}.`);
        if (b.damage >= b.toughness || attacker.deathtouch) {
          b.alive = false;
          log.push(`${b.name} is destroyed.`);
        }
      }
    }
    if (remaining > 0) {
      if (attacker.trample) {
        damageToPlayer += remaining;
        totalDealt += remaining;
        log.push(`${remaining} damage tramples through to the player.`);
      } else {
        totalDealt += remaining;
        log.push(`${remaining} extra damage is absorbed by blockers (no trample).`);
      }
    }
    if (attacker.lifelink && totalDealt > 0) lifeGained += totalDealt;
    return totalDealt;
  }

  function dealBlockerDamage(participants) {
    const acting = participants.filter(b => b.alive && b.power > 0);
    if (acting.length === 0) return;
    const total = acting.reduce((sum, b) => sum + b.power, 0);
    attackerDamage += total;
    acting.forEach(b => log.push(`${b.name} deals ${b.power} damage to the attacker.`));
    const anyDeathtouch = acting.some(b => b.deathtouch);
    if (attackerAlive && (attackerDamage >= attacker.toughness || anyDeathtouch)) {
      attackerAlive = false;
      log.push('Attacker is destroyed.');
    }
  }

  // Combat damage within a single step is dealt simultaneously: a blocker that
  // the attacker's damage happens to kill this same step still deals its own
  // damage back. So the set of blockers dealing damage this step must be
  // snapshotted BEFORE the attacker's assignment (which mutates blockerStates),
  // not re-filtered afterward.
  function runStep(participantFilter, stepLabel) {
    log.push(stepLabel);
    const blockersDealingThisStep = blockerStates.filter(b => b.alive && participantFilter(b));
    if (attackerAlive && participantFilter(attacker)) {
      dealAttackerDamage(attacker.power);
    } else if (!attackerAlive) {
      log.push('Attacker was already destroyed and deals no damage this step.');
    }
    dealBlockerDamage(blockersDealingThisStep);
  }

  if (hasFirstStrikeStep) {
    runStep(firstStepParticipant, '--- First Strike Step ---');
  }
  runStep(regularStepParticipant, '--- Regular Damage Step ---');

  return {
    attackerDied: !attackerAlive,
    attackerDamageTaken: attackerDamage,
    damageToPlayer,
    lifeGained,
    blockerResults: blockerStates.map(b => ({
      id: b.id,
      name: b.name,
      damageTaken: b.damage,
      died: !b.alive,
    })),
    log,
  };
}
