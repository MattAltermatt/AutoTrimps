export const HUD_ROOT_ID = 'wrapper'
export const SHELL_ID = 'atWrapper'

export type RegionStatus = 'adopted' | 'at-styled' | 'at-native'
export interface Region {
  id: string
  containerId: string
  status: RegionStatus
  /** For at-native regions: the game container ids this region hides + replaces. */
  natives?: string[]
}

// Phase 1: the entire HUD is one adopted region (#wrapper moved intact).
// Phase 2: the resource tiles graduated to AT-native rendering inside #resourceColumn.
// Later phases split further and graduate more regions.
export const REGIONS: Region[] = [
  { id: 'hud', containerId: HUD_ROOT_ID, status: 'adopted' },
  { id: 'resources', containerId: 'resourceColumn', status: 'at-native', natives: ['food', 'wood', 'metal', 'science', 'fragments', 'gems', 'helium'] },
]
