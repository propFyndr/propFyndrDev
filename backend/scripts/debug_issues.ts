import { detectOpenQuery } from '../src/lib/discovery/openQuery'

const msg = "its elite x by elite group sector 10 greater noida west."
const openDetection = detectOpenQuery(msg, false)
console.log('openDetection:', openDetection)
