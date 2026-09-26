// City-specific prompt templates — enables easy scale-out to new cities

import type { SupportedCity } from './cities'
import { SUPPORTED_CITIES } from './cities'

export interface CityPromptPack {
  // Short form: used in scope statements and quick references
  scopeShort: string // e.g., "Noida and Greater Noida"
  // Long form: used in detailed scope/coverage statements
  scopeLong: string // e.g., "Noida, Greater Noida, and Greater Noida West"
  // Out-of-scope message for other cities
  outOfScopeMessage: string
  // Area info tool description
  areaInfoDescription: string
  // Home buying domain knowledge header
  homebuyingHeader: string
  // State abbreviation for domain knowledge
  stateAbbr: string // e.g., "UP"
}

export const CITY_PROMPT_PACKS: Record<SupportedCity, CityPromptPack> = {
  Noida: {
    scopeShort: 'Noida and Greater Noida',
    scopeLong: 'Noida, Greater Noida, and Greater Noida West',
    outOfScopeMessage: 'Right now we cover Noida and Greater Noida in depth — verified projects, RERA data, and builder records. We\'re expanding to [city] soon. I can still help with general questions on home-buying, RERA, loans, or taxes for [city] — or show you what a similar budget gets in Noida.',
    areaInfoDescription: 'Wikipedia background on a Noida sector or area',
    homebuyingHeader: 'Home buying (Noida new construction)',
    stateAbbr: 'UP',
  },
  'Greater Noida': {
    scopeShort: 'Noida and Greater Noida',
    scopeLong: 'Noida, Greater Noida, and Greater Noida West',
    outOfScopeMessage: 'Right now we cover Noida and Greater Noida in depth — verified projects, RERA data, and builder records. We\'re expanding to [city] soon. I can still help with general questions on home-buying, RERA, loans, or taxes for [city] — or show you what a similar budget gets in Greater Noida.',
    areaInfoDescription: 'Wikipedia background on a Greater Noida sector or area',
    homebuyingHeader: 'Home buying (Greater Noida new construction)',
    stateAbbr: 'UP',
  },
  'Greater Noida West': {
    scopeShort: 'Noida and Greater Noida',
    scopeLong: 'Noida, Greater Noida, and Greater Noida West',
    outOfScopeMessage: 'Right now we cover Noida and Greater Noida in depth — verified projects, RERA data, and builder records. We\'re expanding to [city] soon. I can still help with general questions on home-buying, RERA, loans, or taxes for [city] — or show you what a similar budget gets in Greater Noida West.',
    areaInfoDescription: 'Wikipedia background on a Greater Noida West sector or area',
    homebuyingHeader: 'Home buying (Greater Noida West new construction)',
    stateAbbr: 'UP',
  },
  'Yamuna Expressway': {
    scopeShort: 'Noida and Greater Noida',
    scopeLong: 'Noida, Greater Noida, Greater Noida West and Yamuna Expressway',
    outOfScopeMessage: 'Right now we cover Noida and Greater Noida in depth — verified projects, RERA data, and builder records. We\'re expanding to [city] soon. I can still help with general questions on home-buying, RERA, loans, or taxes for [city] — or show you what a similar budget gets along the Yamuna Expressway.',
    areaInfoDescription: 'Wikipedia background on a Yamuna Expressway (YEIDA) sector or area',
    homebuyingHeader: 'Home buying (Yamuna Expressway new construction)',
    stateAbbr: 'UP',
  },
}

export function getCityPromptPack(city: SupportedCity | undefined): CityPromptPack {
  const validCity = city && SUPPORTED_CITIES.includes(city) ? city : 'Noida'
  return CITY_PROMPT_PACKS[validCity]
}
