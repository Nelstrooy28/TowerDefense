import { SYNERGIES, type SynergyDef } from '../data/SynergyConfig';
import type { ElementTag } from '../data/UnitRegistry';
import { EventBus } from '../core/EventBus';
import { SaveManager } from '../core/SaveManager';
import { VFXManager } from '../rendering/VFXManager';
import { FloatingTextManager } from '../rendering/FloatingTextManager';
import { SynthAudio } from '../audio/SynthAudio';
import type { EnemyEntity } from './EnemyEntity';

export interface SynergyTriggerOutcome {
  synergy: SynergyDef;
  bonusDamage: number;
  extraChainCount: number;
  knockbackMult: number;
}

export class SynergySystem {
  private vfx: VFXManager;
  private popups: FloatingTextManager;

  constructor(vfx: VFXManager, popups: FloatingTextManager) {
    this.vfx = vfx;
    this.popups = popups;
  }

  public tryTrigger(
    enemy: EnemyEntity,
    incomingElement: ElementTag,
    incomingDamage: number,
    comboBonusMult = 1.0,
    allEnemies?: EnemyEntity[]
  ): SynergyTriggerOutcome | null {
    const active = new Set<ElementTag>();
    if (enemy.burnTimer > 0) active.add('burn');
    if (enemy.chillTimer > 0) active.add('chill');
    if (enemy.freezeTimer > 0) active.add('freeze');
    if (enemy.bleedTimer > 0) active.add('bleed');
    if (enemy.wetTimer > 0) active.add('wet');
    if (enemy.poisonTimer > 0) active.add('poison');
    active.add(incomingElement);

    for (const syn of SYNERGIES) {
      const [a, b] = syn.requires;
      if (!(active.has(a) && active.has(b))) continue;
      if (incomingElement !== a && incomingElement !== b) continue;

      const lastAt = enemy.synergyCooldowns[syn.id] ?? -10;
      if (enemy.ageSeconds - lastAt < 1.0) continue;

      enemy.synergyCooldowns[syn.id] = enemy.ageSeconds;
      SaveManager.markSynergySeen(syn.id);

      const pos = enemy.position;
      this.popups.spawnDamage(pos.x, pos.y + 0.9, pos.z, 0, 'synergy', '', syn.popupText);
      SynthAudio.play('synergy');

      let bonusDamage = 0;
      let extraChainCount = 0;
      let knockbackMult = 1;

      if (syn.id === 'steam_burst') {
        enemy.applySlow(1.5, 0.3);
        bonusDamage = Math.round(incomingDamage * 1.2 * comboBonusMult);
        this.vfx.spawnRecipe('steam_burst', pos.x, pos.y + 0.6, pos.z);
        EventBus.emit('quest:progress', { type: 'steam_burst', amount: 1 });
        EventBus.emit('match:killfeed', { text: `Steam Burst triggered! (${bonusDamage} dmg)`, color: '#f1f5f9' });
      } else if (syn.id === 'cauterize') {
        bonusDamage = Math.round(enemy.bleedDps * enemy.bleedTimer * comboBonusMult);
        enemy.bleedTimer = 0;
        enemy.bleedDps = 0;
        this.vfx.spawnRecipe('fire_cinders', pos.x, pos.y + 0.5, pos.z, 0xfb923c);
      } else if (syn.id === 'ice_skate') {
        knockbackMult = 2;
        this.vfx.spawnRecipe('frost_shatter', pos.x, pos.y + 0.3, pos.z);
      } else if (syn.id === 'shatter') {
        bonusDamage = Math.round(incomingDamage * 0.5 * comboBonusMult);
        enemy.freezeTimer = 0;
        this.vfx.spawnRecipe('frost_shatter', pos.x, pos.y + 0.7, pos.z);
        SynthAudio.play('ice');
      } else if (syn.id === 'conduct') {
        extraChainCount = 2;
        this.vfx.spawnRecipe('shield_shatter', pos.x, pos.y + 0.6, pos.z, 0x38bdf8);
      } else if (syn.id === 'fizzle') {
        enemy.burnTimer = 0;
        enemy.burnDps = 0;
        this.vfx.spawnRecipe('steam_burst', pos.x, pos.y + 0.5, pos.z, 0x9ca3af);
      } else if (syn.id === 'toxic_blaze') {
        bonusDamage = Math.round(incomingDamage * 2.0 * comboBonusMult);
        enemy.poisonTimer = 0;
        enemy.poisonStacks = 0;
        this.vfx.spawnRecipe('overkill_burst', pos.x, pos.y + 0.6, pos.z, 0xa3e635);
        EventBus.emit('match:killfeed', { text: `Toxic Blaze! (${bonusDamage} burst)`, color: '#a3e635' });
      } else if (syn.id === 'poison_spread' && allEnemies) {
        let spreadLeft = 2;
        for (const other of allEnemies) {
          if (spreadLeft <= 0) break;
          if (other !== enemy && !other.isDead && Math.hypot(other.position.x - pos.x, other.position.z - pos.z) <= 4.5) {
            other.applyPoison(enemy.poisonDps);
            spreadLeft--;
          }
        }
        this.vfx.spawnRecipe('poison_cloud', pos.x, pos.y + 0.5, pos.z);
      }

      return {
        synergy: syn,
        bonusDamage,
        extraChainCount,
        knockbackMult,
      };
    }

    return null;
  }
}
