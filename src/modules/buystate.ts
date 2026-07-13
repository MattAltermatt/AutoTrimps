// Buy-state save/restore. The 4 saved values are module-private (previously
// AutoTrimps2.js globals with no external reader — perks.js uses its own local
// shadows; only other.js calls preBuy/postBuy). preBuy/postBuy are a matched pair;
// preBuy2/postBuy2 pass the snapshot explicitly via an array. Bodies verbatim from
// legacy; only param/var type annotations added (no logic change).
let preBuyAmt: any, preBuyFiring: any, preBuyTooltip: any, preBuymaxSplit: any

// oxlint-disable-next-line no-unused-expressions -- faithful legacy port: comma sequence — de-comma behind the live net (#92)
export function preBuy(){preBuyAmt=game.global.buyAmt,preBuyFiring=game.global.firing,preBuyTooltip=game.global.lockTooltip,preBuymaxSplit=game.global.maxSplit}
// oxlint-disable-next-line no-unused-expressions -- faithful legacy port: comma sequence — de-comma behind the live net (#92)
export function postBuy(){game.global.buyAmt=preBuyAmt,game.global.firing=preBuyFiring,game.global.lockTooltip=preBuyTooltip,game.global.maxSplit=preBuymaxSplit}
export function preBuy2(){return[game.global.buyAmt,game.global.firing,game.global.lockTooltip,game.global.maxSplit]}
// oxlint-disable-next-line no-unused-expressions -- faithful legacy port: comma sequence — de-comma behind the live net (#92)
export function postBuy2(a: any[]){game.global.buyAmt=a[0],game.global.firing=a[1],game.global.lockTooltip=a[2],game.global.maxSplit=a[3]}
