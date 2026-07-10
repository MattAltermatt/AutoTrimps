export function snapshot(game) {
  const r = game.resources
  return {
    world: game.global.world,
    food: Math.floor(r.food.owned),
    wood: Math.floor(r.wood.owned),
    metal: Math.floor(r.metal.owned),
    science: Math.floor(r.science?.owned ?? 0),
    trimps: Math.floor(r.trimps.owned),
    maxTrimps: Math.floor(r.trimps.realMax?.() ?? 0),
    scientists: game.jobs.Scientist?.owned ?? 0,
    farmers: game.jobs.Farmer?.owned ?? 0,
  }
}
