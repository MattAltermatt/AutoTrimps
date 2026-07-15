// IMPURE data-capture layer for the graphs feature (ported from legacy/Graphs.js, the
// "Portal and Game data handling" section). Reads live game state (game.*, getGameTime,
// getTotalPortals, getCurrentChallengePane, getIndividualSquaredReward, countChallengeSquaredReward,
// recycleAllExtraHeirlooms, Fluffy) as ambient free identifiers typed in src/game/*.d.ts.
// The pure GRAPH_LIST conditionals are injected the `gameDataReader` below so graph-defs stays pure.
import type { PortalData, PerZoneData, GameDataReader } from './types'
import { GRAPH_LIST } from './graph-defs'
import { graphState, GRAPHSETTINGS } from './state'
import { savePortalData, clearData } from './storage'

// --------- Game data accessors (verbatim from legacy/Graphs.js:799-866) ---------
export const getGameData = {
  currentTime: () => { return getGameTime() - game.global.portalTime }, // portalTime changes on pause, 'when a portal started' is not a static concept
  timeOnMap: () => {
    // TODO this time is wrong if the player sits in map chamber.  Then again, they might want that time included in 'map' time.
    let annoyingRemainder = 0;
    if (game.global.mapStarted < game.global.zoneStarted) {
      annoyingRemainder = getGameTime() - game.global.mapStarted;
    }
    return getGameTime() - game.global.mapStarted - annoyingRemainder;
  },
  world: () => { return game.global.world },
  challengeActive: () => { return game.global.challengeActive },
  voids: () => { return game.global.totalVoidMaps },
  totalVoids: () => { return game.stats.totalVoidMaps.value },
  nullifium: () => { return recycleAllExtraHeirlooms(true) },
  coord: () => { return game.upgrades.Coordination.allowed - game.upgrades.Coordination.done },
  overkill: () => {
    // Count overkilled cells from the game's own per-cell state (cell.overkilled, set during
    // combat in main.js) rather than DOM cellColorOverkill classes: those classes only exist
    // when the player's overkillColor option is enabled, so the old code force-enabled AND
    // persisted that setting just to count. A data reader must never mutate the player's save.
    if (game.options.menu.liquification.enabled && game.talents.liquification.purchased && !game.global.mapsActive && game.global.gridArray && game.global.gridArray[0] && game.global.gridArray[0].name == "Liquimp")
      return 100;
    var grid = game.global.mapsActive ? game.global.mapGridArray : game.global.gridArray;
    if (!grid) return 0;
    return grid.filter((cell: any) => cell && cell.overkilled).length;
  },
  zoneTime: () => { return Math.round((getGameTime() - game.global.zoneStarted) * 100) / 100 }, // rounded to x.xs, not used
  mapbonus: () => { return game.global.mapBonus },
  empower: () => { return game.global.challengeActive == "Daily" && typeof game.global.dailyChallenge.empower !== "undefined" ? game.global.dailyChallenge.empower.stacks : 0 },
  lastWarp: () => { return game.global.lastWarp },
  essence: () => { return game.global.spentEssence + game.global.essence },
  heliumOwned: () => { return game.resources.helium.owned },
  //magmite: () => { return game.global.magmite },
  //magmamancers: () => { return game.jobs.Magmamancer.owned },
  fluffy: () => {
    // cap exp at maximum for an evo, because Trimps doesn't do it and it causes horrible horrible bugs
    let maxExp = Math.floor((1000 * Math.pow(5, Fluffy.getCurrentPrestige())) * ((Math.pow(4, 10) - 1) / (4 - 1)))
    let exp = Math.min(game.global.fluffyExp, maxExp);
    //sum of all previous evo costs + current exp, because Trimps doesn't store this
    for (var evo = 0; evo < Fluffy.getCurrentPrestige(); evo++) {
      exp += Math.floor((1000 * Math.pow(5, evo)) * ((Math.pow(4, 10) - 1) / (4 - 1)));;
    }
    return exp
  },
  //nursery: () => { return game.buildings.Nursery.purchased },
  amals: () => { return game.jobs.Amalgamator.owned },
  wonders: () => { return game.challenges.Experience.wonders },
  scruffy: () => { return game.global.fluffyExp2 },
  smithies: () => { return game.buildings.Smithy.owned },
  radonOwned: () => { return game.resources.radon.owned },
  worshippers: () => { return game.jobs.Worshipper.owned },
  bonfires: () => { return game.challenges.Hypothermia.bonfires },
  embers: () => { return game.challenges.Hypothermia.embers },
  cruffys: () => { return game.challenges.Nurture.level },
  universe: () => { return game.global.universe },
  s3: () => { return game.global.lastRadonPortal },
  u1hze: () => { return game.global.highestLevelCleared },
  u2hze: () => { return game.global.highestRadonLevelCleared },
  c23increase: () => {
    if (game.global.challengeActive !== "" && game.global.runningChallengeSquared) {
      return Math.max(0, getIndividualSquaredReward(game.global.challengeActive, game.global.world) - getIndividualSquaredReward(game.global.challengeActive));
    }
    else { return 0; }
  },
  cinf: () => { return countChallengeSquaredReward(false, false, true) },
  mutatedSeeds: () => { return game.global.mutatedSeedsSpent + game.global.mutatedSeeds },
  // #135 additions — universe-agnostic progression metrics.
  population: () => { return game.resources.trimps.realMax() }, // max Trimps (housing + breeding)
  gearLevels: () => { // total equipment levels across all unlocked pieces (gear progression)
    let total = 0;
    for (const item in game.equipment) total += game.equipment[item].level || 0;
    return total;
  },
  playerDamage: () => { return calcOurDmg('avg') || 0 }, // effective damage vs the zone's scaling enemy health
}

// The reader injected into the pure GRAPH_LIST conditionals (graph-defs stays pure). Delegates the
// six shared accessors to getGameData; the extra four read game.global directly (legacy inlined
// these expressions inside the conditional closures — see graph-defs.ts).
export const gameDataReader: GameDataReader = {
  u1hze: () => getGameData.u1hze(),
  u2hze: () => getGameData.u2hze(),
  fluffy: () => getGameData.fluffy(),
  essence: () => getGameData.essence(),
  challengeActive: () => getGameData.challengeActive(),
  universe: () => getGameData.universe(),
  totalHeliumEarned: () => game.global.totalHeliumEarned,
  heliumLeftover: () => game.global.heliumLeftover,
  runningChallengeSquared: () => game.global.runningChallengeSquared,
  empowerDefined: () => typeof game.global.dailyChallenge.empower !== 'undefined',
}

// --------- Portal (verbatim port of legacy/Graphs.js:729-780) ---------
// Stores and updates data for an individual portal. Values are stored as Portal instances in
// graphState.portalSaveData; the pure builders read them as the PortalData data shape.
export class Portal implements PortalData {
  universe: 1 | 2
  totalPortals: number
  challenge: string
  perZoneData: PerZoneData
  initialNullifium?: number
  totalNullifium?: number
  totalVoidMaps?: number
  cinf?: [number, number]
  totalHelium?: number
  initialFluffy?: number
  initialDE?: number
  totalRadon?: number
  initialScruffy?: number
  initialMutes?: number
  s3?: number
  hehrSamples: [number, number][] = [] // #135 — [runTimeMs, totalResourceEarned] samples for the He/hr curve

  constructor() {
    this.universe = getGameData.universe() as 1 | 2;
    this.totalPortals = getTotalPortals();
    this.challenge = getGameData.challengeActive() === 'Daily'
      ? getCurrentChallengePane().split('.')[0].substr(13).slice(0, 16) // names dailies by their start date, only moderately cursed
      : getGameData.challengeActive();
    this.initialNullifium = game.global.nullifium;
    this.totalNullifium = getGameData.nullifium();
    this.totalVoidMaps = getGameData.totalVoids();
    this.cinf = getGameData.cinf();
    if (this.universe === 1) {
      this.totalHelium = game.global.totalHeliumEarned;
      this.initialFluffy = getGameData.fluffy() - game.stats.bestFluffyExp.value; // adjust for mid-run graph start
      this.initialDE = getGameData.essence();
    }
    if (this.universe === 2) {
      this.totalRadon = game.global.totalRadonEarned;
      this.initialScruffy = getGameData.scruffy() - game.stats.bestFluffyExp2.value; // adjust for mid-run graph start
      this.initialMutes = getGameData.mutatedSeeds();
      this.s3 = getGameData.s3();
    }
    // create an object to collect only the relevant data per zone, without fromEntries because old JS
    this.perZoneData = {};
    var perZoneItems = GRAPH_LIST.filter((graph) =>
      (graph.universe == this.universe || !graph.universe) // only save data relevant to the current universe
      && graph.conditional(gameDataReader) && graph.dataVar) // and for relevant challenges, with datavars
      .map((graph) => graph.dataVar as string)
      .concat(["currentTime", "mapCount", "timeOnMap"]); // always graph time vars
    perZoneItems.forEach((name) => this.perZoneData[name] = []);
  }

  // update per zone data and special totals
  update(fromMap?: boolean) { // check source of the update
    const world = getGameData.world();
    this.totalNullifium = game.global.nullifium - this.initialNullifium! + getGameData.nullifium();
    this.totalVoidMaps = getGameData.totalVoids();
    for (const [name, data] of Object.entries(this.perZoneData) as [string, number[]][]) {
      if (world + 1 < data.length) { // FENCEPOSTING (zones are 1 indexed)
        data.splice(world + 1) // trim 'future' zones on reload
      }
      if (name === "timeOnMap") {
        let timeOnMap = getGameData.timeOnMap();
        if (fromMap) { data[world] = data[world] + timeOnMap || timeOnMap; } // additive per map within a zone
        continue;
      }
      if (name === "mapCount") {
        if (fromMap && game.global.mapsActive) { data[world] = data[world] + 1 || 1; } // start at 1 because the hook in is before the map is started/finished
        continue;
      }
      data[world] = (getGameData as Record<string, () => number>)[name]();
    }
    // #135 He/hr efficiency curve: unlike the per-zone data above (one overwritten value per zone), this
    // is TIME-sampled — append [runTime, totalResourceEarned] once ≥15 min of run-time has passed since the
    // last sample, so a zone that takes over an hour still gets intermediate points. update() runs on every
    // pushData (zone + map events), which fires often enough to land near each 15-min mark.
    const t = getGameData.currentTime();
    const earned = this.universe === 1 ? game.global.totalHeliumEarned : game.global.totalRadonEarned;
    const lastSample = this.hehrSamples[this.hehrSamples.length - 1];
    if (!lastSample || t - lastSample[0] >= HEHR_SAMPLE_MS) this.hehrSamples.push([t, earned]);
  }
}

/** He/hr curve base sampling interval: 15 minutes of run-time (currentTime is in ms). */
export const HEHR_SAMPLE_MS = 15 * 60 * 1000

// legacy/Graphs.js:782
export function getportalID() { return `u${getGameData.universe()} p${getTotalPortals()}` }

// legacy/Graphs.js:784-797
export function pushData(fromMap?: boolean) {
  //debug("Starting Zone " + getGameData.world(), "graphs");
  const portalID = getportalID();
  if (!graphState.portalSaveData[portalID] || getGameData.world() === 1) { // reset portal data if restarting a portal
    savePortalData(true) // save old portal to history
    graphState.portalSaveData[portalID] = new Portal();
  }
  (graphState.portalSaveData[portalID] as Portal).update(fromMap);
  clearData(GRAPHSETTINGS.maxGraphs);
  savePortalData(false) // save current portal
  if (GRAPHSETTINGS.live && GRAPHSETTINGS.open) {
    graphState.requestRedraw?.();
  }
}
