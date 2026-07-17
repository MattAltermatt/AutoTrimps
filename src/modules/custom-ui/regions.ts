export const HUD_ROOT_ID = 'wrapper'
export const SHELL_ID = 'atWrapper'

export type RegionStatus = 'adopted' | 'at-styled' | 'at-native'
export interface Region {
  id: string
  containerId: string
  status: RegionStatus
}

// Phase 1: the entire HUD is one adopted region (#wrapper moved intact).
// Later phases split this into per-section regions and graduate them.
export const REGIONS: Region[] = [{ id: 'hud', containerId: HUD_ROOT_ID, status: 'adopted' }]
