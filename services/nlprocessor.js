// ============================================================
// nlprocessor.js - Server-side (Cloudflare Worker)
// ============================================================

import { vinDecoder } from './vinDecoder.js';
import { getServiceConfigDB } from './serviceConfigDB.js';
import { executeStepApiActions, executeFieldApiActions } from './apiTasks.js';
import { detectIntent } from './intent.js';

// ============================================================
// LANGUAGE
// ============================================================
let currentLanguage = 'en';

function getLanguage() { return currentLanguage; }
function setLanguage(lang) { currentLanguage = lang === 'am' ? 'am' : 'en'; }

function getLocalized(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object' && obj !== null) {
    const lang = getLanguage();
    return obj[lang] !== undefined && obj[lang] !== '' ? obj[lang] : obj.en || '';
  }
  return obj;
}

function getLocalizedOptions(optionsObj) {
  if (!optionsObj) return [];
  if (Array.isArray(optionsObj)) return optionsObj;
  if (typeof optionsObj === 'object' && optionsObj !== null) {
    const lang = getLanguage();
    return optionsObj[lang] || optionsObj.en || [];
  }
  return optionsObj;
}

// ============================================================
// DEFAULT SERVICES (seed / fallback)
// ============================================================
const DEFAULT_SERVICES = {
  iftms: {
    id: 'iftms',
    name: { en: 'IFTMS - Freight Transport', am: 'IFTMS - የጭነት ትራንስፖርት' },
    description: { en: 'Register freight transport operators, vehicles, and drivers', am: 'የጭነት ትራንስፖርት ኦፕሬተሮችን፣ ተሽከርካሪዎችን እና አሽከርካሪዎችን ይመዝገቡ' },
    initStep: 1,
    collectedData: { operator: {}, vehicles: [], drivers: [] },
    steps: {
      1: {
        type: 'form',
        title: { en: 'Operator Registration', am: 'የኦፕሬተር ምዝገባ' },
        fields: [
          { name: 'businessLicenseNumber', question: { en: 'Business License Number? (Example: 12345678)', am: 'የንግድ ፈቃድ ቁጥር? (ምሳሌ: 12345678)' }, validation: 'license', regex: '^[0-9]{6,10}$', example: { en: '12345678', am: '12345678' }, error: { en: 'Invalid. Use 6-10 digits.', am: 'ልክ ያልሆነ። 6-10 አሃዞችን ይጠቀሙ።' } },
          { name: 'operatorName', question: { en: 'Operator Name? (Example: Ethio Transport)', am: 'የኦፕሬተር ስም? (ምሳሌ: ኢትዮ ትራንስፖርት)' }, validation: 'text', regex: '^.+$', example: { en: 'Ethio Transport', am: 'ኢትዮ ትራንስፖርት' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' } },
          { name: 'phoneNumber', question: { en: 'Phone Number? (Example: 0912345678 or +251912345678)', am: 'ስልክ ቁጥር? (ምሳሌ: 0912345678 ወይም +251912345678)' }, validation: 'phone', regex: '^(0?[79][0-9]{8}|\\+251[79][0-9]{8})$', example: { en: '0912345678', am: '0912345678' }, error: { en: 'Invalid phone number.', am: 'ልክ ያልሆነ ስልክ ቁጥር።' } },
          { name: 'password', question: { en: 'IFMTS Password?', am: 'IFMTS ይለፍ ቃል?' }, validation: 'text', example: { en: 'your_password', am: 'ይለፍ_ቃልዎ' }, error: { en: 'Password is required.', am: 'ይለፍ ቃል ያስፈልጋል።' } }
        ],
        apiActions: [
          {
            id: 'register_operator',
            endpoint: 'https://iftms.motl.gov.et/api/operator/register',
            method: 'POST',
            data: { licenseNumber: '{{businessLicenseNumber}}', name: '{{operatorName}}', phone: '{{phoneNumber}}', password: '{{password}}' },
            onSuccess: { nextStep: 2, message: { en: '✅ Operator registered! Proceeding to vehicle management.', am: '✅ ኦፕሬተር ተመዝግቧል! ወደ ተሽከርካሪ አስተዳደር በመቀጠል ላይ።' } },
            onFailure: { message: { en: '❌ Operator registration failed.', am: '❌ የኦፕሬተር ምዝገባ አልተሳካም።' } }
          }
        ],
        onValid: { nextStep: 2 }
      },
      2: {
        type: 'subprocess',
        title: { en: 'Vehicle Management', am: 'የተሽከርካሪ አስተዳደር' },
        subprocess: {
          itemName: { en: 'Vehicle', am: 'ተሽከርካሪ' },
          addPrompt: { en: 'Add a vehicle? (yes/no)', am: 'ተሽከርካሪ ማከል ይፈልጋሉ? (አዎ/አይ)' },
          continuePrompt: { en: 'Continue to drivers? (yes/no)', am: 'ወደ አሽከርካሪዎች መቀጠል? (አዎ/አይ)' },
          fields: [
            { name: 'plateNumber', question: { en: 'Plate Number? (Example: AA-1234)', am: 'የሰሌዳ ቁጥር? (ምሳሌ: AA-1234)' }, validation: 'plate', regex: '^[A-Z]{2,3}-?[0-9]{3,4}$', example: { en: 'AA-1234', am: 'AA-1234' }, error: { en: 'Invalid plate format.', am: 'ልክ ያልሆነ የሰሌዳ ቅርጸት።' } },
            { name: 'plateCode', question: { en: 'Plate Code? (Example: AA)', am: 'የሰሌዳ ኮድ? (ምሳሌ: AA)' }, validation: 'text', example: { en: 'AA', am: 'ኤኤ' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' } },
            { name: 'motorNumber', question: { en: 'Motor Number?', am: 'የሞተር ቁጥር?' }, validation: 'text', example: { en: '1SG4001234567', am: '1SG4001234567' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' } },
            { name: 'vinNumber', question: { en: 'VIN or Chassis Number? (Example: LVBS6PE123456789)', am: 'VIN ወይም የቻሲስ ቁጥር? (ምሳሌ: LVBS6PE123456789)' }, validation: 'vin', regex: '^[A-HJ-NPR-Z0-9]{10,18}$', example: { en: 'LVBS6PE123456789', am: 'LVBS6PE123456789' }, error: { en: 'Invalid VIN/Chassis (10-17 characters).', am: 'ልክ ያልሆነ VIN/ቻሲስ (10-17 ቁምፊዎች)።' } },
            { name: 'chassisNumber', question: { en: 'Chassis Number?', am: 'የቻሲስ ቁጥር?' }, validation: 'text', example: { en: 'LVBS6PE123456789', am: 'LVBS6PE123456789' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'manufacturer', question: { en: 'Manufacturer?', am: 'አምራች?' }, validation: 'text', example: { en: 'Toyota', am: 'ቶዮታ' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'vehicleModel', question: { en: 'Vehicle Model?', am: 'የተሽከርካሪ ሞዴል?' }, validation: 'text', example: { en: 'Toyota Hilux', am: 'ቶዮታ ሃይሉክስ' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'manufactureYear', question: { en: 'Year of Manufacture?', am: 'የምርት ዓመት?' }, validation: 'year', regex: '^(19|20)[0-9]{2}$', example: { en: '2020', am: '2020' }, error: { en: 'Invalid year (e.g., 2020).', am: 'ልክ ያልሆነ ዓመት (ለምሳሌ: 2020)።' }, autoFill: true },
            { name: 'vehicleType', question: { en: 'Vehicle Type?', am: 'የተሽከርካሪ አይነት?' }, validation: 'text', example: { en: 'Truck', am: 'ጭነት መኪና' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'bodyPartType', question: { en: 'Body Part Type?', am: 'የሰውነት ክፍል አይነት?' }, validation: 'text', example: { en: 'Crew Cab Truck', am: 'ክሩ ካብ መኪና' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'engineInfo', question: { en: 'Engine Information?', am: 'የሞተር መረጃ?' }, validation: 'text', example: { en: '2.8L Diesel Turbo', am: '2.8L ናፍጣ ቱርቦ' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'engineCapacity', question: { en: 'Engine Capacity (cc)?', am: 'የሞተር አቅም (ሲሲ)?' }, validation: 'number', regex: '^\\d+$', example: { en: '2800', am: '2800' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'cylinderCount', question: { en: 'Number of Cylinders?', am: 'የሲሊንደሮች ብዛት?' }, validation: 'number', regex: '^\\d+$', example: { en: '4', am: '4' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'fuelType', question: { en: 'Fuel Type?', am: 'የነዳጅ አይነት?' }, validation: 'choice', options: { en: ['Diesel', 'Petrol', 'Electric', 'Hybrid', 'LPG', 'CNG'], am: ['ናፍጣ', 'ቤንዚን', 'ኤሌክትሪክ', 'ሃይብሪድ', 'ኤልፒጂ', 'ሲኤንጂ'] }, example: { en: 'Diesel', am: 'ናፍጣ' }, error: { en: 'Please select a fuel type.', am: 'እባክዎ የነዳጅ አይነት ይምረጡ።' }, autoFill: true },
            { name: 'serviceType', question: { en: 'Service Type?', am: 'የአገልግሎት አይነት?' }, validation: 'choice', options: { en: ['Freight Transport', 'Passenger Transport', 'General Transport', 'Delivery Transport', 'Construction Transport', 'Liquid Transport', 'Cold Chain Transport'], am: ['የጭነት ትራንስፖርት', 'የተሳፋሪ ትራንስፖርት', 'አጠቃላይ ትራንስፖርት', 'የመላኪያ ትራንስፖርት', 'የግንባታ ትራንስፖርት', 'የፈሳሽ ትራንስፖርት', 'የቀዝቃዛ ሰንሰለት ትራንስፖርት'] }, example: { en: 'Freight Transport', am: 'የጭነት ትራንስፖርት' }, error: { en: 'Please select a service type.', am: 'እባክዎ የአገልግሎት አይነት ይምረጡ።' }, autoFill: true },
            { name: 'totalWeight', question: { en: 'Total Weight (kg)?', am: 'ጠቅላላ ክብደት (ኪግ)?' }, validation: 'number', regex: '^\\d+$', example: { en: '3500', am: '3500' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'unladenWeight', question: { en: 'Unladen Weight (kg)?', am: 'ባዶ ክብደት (ኪግ)?' }, validation: 'number', regex: '^\\d+$', example: { en: '2500', am: '2500' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'loadCapacity', question: { en: 'Load Capacity (kg)?', am: 'የጭነት አቅም (ኪግ)?' }, validation: 'number', regex: '^\\d+$', example: { en: '1000', am: '1000' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'cargoVolume', question: { en: 'Cargo Volume (kg)?', am: 'የጭነት መጠን (ኪግ)?' }, validation: 'number', regex: '^\\d+$', example: { en: '5000', am: '5000' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'tonnage', question: { en: 'Tonnage (T)?', am: 'ቶንነጅ (ቲ)?' }, validation: 'number', regex: '^\\d+\\.?\\d*$', example: { en: '3.5', am: '3.5' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'gvw', question: { en: 'Gross Vehicle Weight (kg)?', am: 'ጠቅላላ የተሽከርካሪ ክብደት (ኪግ)?' }, validation: 'number', regex: '^\\d+$', example: { en: '3500', am: '3500' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'payload', question: { en: 'Payload (kg)?', am: 'ጭነት (ኪግ)?' }, validation: 'number', regex: '^\\d+$', example: { en: '1000', am: '1000' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'seatingCapacity', question: { en: 'Seating Capacity?', am: 'የመቀመጫ አቅም?' }, validation: 'number', regex: '^\\d+$', example: { en: '5', am: '5' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'wheelbase', question: { en: 'Wheelbase (mm)?', am: 'የዊልቤዝ (ሚሜ)?' }, validation: 'number', regex: '^\\d+$', example: { en: '3000', am: '3000' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'axelCount', question: { en: 'Axel Count?', am: 'የአክሰል ብዛት?' }, validation: 'number', regex: '^\\d+$', example: { en: '2', am: '2' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' }, autoFill: true },
            { name: 'color', question: { en: 'Vehicle Color?', am: 'የተሽከርካሪ ቀለም?' }, validation: 'text', example: { en: 'White', am: 'ነጭ' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'bodyColor', question: { en: 'Body Color?', am: 'የሰውነት ቀለም?' }, validation: 'text', example: { en: 'White', am: 'ነጭ' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'interiorColor', question: { en: 'Interior Color?', am: 'የውስጥ ቀለም?' }, validation: 'text', example: { en: 'Black', am: 'ጥቁር' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'assemblyPlant', question: { en: 'Assembly Plant?', am: 'የመሰብሰቢያ ፋብሪካ?' }, validation: 'text', example: { en: 'China - Beijing', am: 'ቻይና - ቤዪጂንግ' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' }, autoFill: true },
            { name: 'gpsInfo', question: { en: 'GPS Info (lat, lon)?', am: 'GPS መረጃ (ላቲቱድ፣ ሎንጂቱድ)?' }, validation: 'text', example: { en: '39.9042, 116.4074', am: '39.9042, 116.4074' }, error: { en: 'Invalid GPS format.', am: 'ልክ ያልሆነ የጂፒኤስ ቅርጸት።' }, autoFill: true }
          ],
          onValid: { nextStep: 3, collectionKey: 'vehicles' }
        }
      },
      3: {
        type: 'subprocess',
        title: { en: 'Driver Management', am: 'የአሽከርካሪ አስተዳደር' },
        subprocess: {
          itemName: { en: 'Driver', am: 'አሽከርካሪ' },
          addPrompt: { en: 'Add a driver? (yes/no)', am: 'አሽከርካሪ ማከል ይፈልጋሉ? (አዎ/አይ)' },
          continuePrompt: { en: 'Continue to completion? (yes/no)', am: 'ወደ መጨረሻ መቀጠል? (አዎ/አይ)' },
          fields: [
            { name: 'driverName', question: { en: 'Driver Name? (Example: Abebe Kebede)', am: 'የአሽከርካሪ ስም? (ምሳሌ: አበበ ከበደ)' }, validation: 'text', example: { en: 'Abebe Kebede', am: 'አበበ ከበደ' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' } },
            { name: 'driverLicense', question: { en: 'Driver License Number? (Example: DL123456)', am: 'የመንጃ ፈቃድ ቁጥር? (ምሳሌ: DL123456)' }, validation: 'text', example: { en: 'DL123456', am: 'DL123456' }, error: { en: 'Cannot be empty.', am: 'ባዶ መሆን አይችልም።' } }
          ],
          onValid: { nextStep: 4, collectionKey: 'drivers' }
        }
      },
      4: {
        type: 'summary',
        title: { en: 'Registration Complete', am: 'ምዝገባ ተጠናቀቀ' },
        isFinal: true,
        actions: { en: ['Download Certificate', 'Print Summary', 'Start New Registration'], am: ['የምስክር ወረቀት አውርድ', 'ማጠቃለያ አትም', 'አዲስ ምዝገባ ጀምር'] },
        apiActions: [
          { id: 'sync_to_ifmts', endpoint: 'https://iftms.motl.gov.et/api/sync', method: 'POST',
            data: { operator: '{{operator}}', vehicles: '{{vehicles}}', drivers: '{{drivers}}' },
            onSuccess: { message: { en: '✅ All data synced to IFMTS!', am: '✅ ሁሉም መረጃ ወደ IFMTS ተመሳስሏል!' } },
            onFailure: { message: { en: '❌ Sync failed.', am: '❌ ማመሳሰል አልተሳካም።' } } }
        ]
      }
    }
  },
  documentAnalysis: {
    id: 'documentAnalysis',
    name: { en: 'Document Analysis', am: 'የሰነድ ትንተና' },
    description: { en: 'Analyze research papers, legal documents, and financial statements', am: 'የምርምር ወረቀቶችን፣ የህግ ሰነዶችን እና የፋይናንስ ሪፖርቶችን ይተንትኑ' },
    initStep: 1,
    collectedData: { document: null, analysisType: null },
    steps: {
      1: { type: 'file_upload', title: { en: 'Upload Document', am: 'ሰነድ ስቀል' }, prompt: { en: '📄 Please upload the document you want me to analyze:', am: '📄 እባክዎ መተንተን የሚፈልጉትን ሰነድ ያስገቡ:' }, onValid: { nextStep: 2 } },
      2: {
        type: 'form',
        title: { en: 'Analysis Type', am: 'የትንተና አይነት' },
        fields: [
          { name: 'analysisType', question: { en: 'What type of analysis do you want? (Example: Summarize)', am: 'ምን አይነት ትንተና ይፈልጋሉ? (ምሳሌ: ማጠቃለል)' }, validation: 'choice', options: { en: ['Summarize', 'Extract Key Points', 'Find Keywords', 'Analyze Sentiment'], am: ['ማጠቃለል', 'ቁልፍ ነጥቦችን ማውጣት', 'ቁልፍ ቃላትን መፈለግ', 'ስሜትን መተንተን'] }, example: { en: 'Summarize', am: 'ማጠቃለል' }, error: { en: 'Please select an option.', am: 'እባክዎ አማራጭ ይምረጡ።' } }
        ],
        onValid: { nextStep: 3 }
      },
      3: { type: 'result', title: { en: 'Analysis Result', am: 'የትንተና ውጤት' }, prompt: { en: '✅ Analysis complete!', am: '✅ ትንተና ተጠናቀቀ!' }, isFinal: true, actions: { en: ['New Analysis', 'Export Results', 'Start Over'], am: ['አዲስ ትንተና', 'ውጤቶችን ወደ ውጭ ላክ', 'እንደገና ጀምር'] } }
    }
  },
  videoGeneration: {
    id: 'videoGeneration',
    name: { en: 'Video Generation', am: 'ቪዲዮ ማምረት' },
    description: { en: 'Create video clips, slideshows, and advertisements', am: 'የቪዲዮ ክሊፖችን፣ ስላይድሾዎችን እና ማስታወቂያዎችን ይፍጠሩ' },
    initStep: 1,
    collectedData: { videoType: null, duration: null },
    steps: {
      1: {
        type: 'form',
        title: { en: 'Video Details', am: 'የቪዲዮ ዝርዝሮች' },
        fields: [
          { name: 'videoType', question: { en: 'What type of video? (Example: Slideshow)', am: 'ምን አይነት ቪዲዮ? (ምሳሌ: ስላይድሾው)' }, validation: 'choice', options: { en: ['Slideshow', 'Video Clip', 'Advertisement'], am: ['ስላይድሾው', 'ቪዲዮ ክሊፕ', 'ማስታወቂያ'] }, example: { en: 'Slideshow', am: 'ስላይድሾው' }, error: { en: 'Please select a video type.', am: 'እባክዎ የቪዲዮ አይነት ይምረጡ።' } },
          { name: 'duration', question: { en: 'Duration (seconds)? (Example: 30)', am: 'ቆይታ (ሰከንዶች)? (ምሳሌ: 30)' }, validation: 'number', regex: '^\\d+$', example: { en: '30', am: '30' }, error: { en: 'Please enter a number.', am: 'እባክዎ ቁጥር ያስገቡ።' } }
        ],
        onValid: { nextStep: 2 }
      },
      2: { type: 'file_upload', title: { en: 'Upload Media', am: 'ሚዲያ ስቀል' }, prompt: { en: '📷 Upload images or provide a script:', am: '📷 ምስሎችን ያስገቡ ወይም ስክሪፕት ያቅርቡ:' }, onValid: { nextStep: 3 } },
      3: { type: 'summary', title: { en: 'Video Generation Complete', am: 'ቪዲዮ ማምረት ተጠናቀቀ' }, prompt: { en: '✅ Your video is ready to generate!', am: '✅ ቪዲዮዎ ለማምረት ዝግጁ ነው!' }, isFinal: true, actions: { en: ['Generate Video', 'Edit Script', 'Start Over'], am: ['ቪዲዮ አምርት', 'ስክሪፕት አርትዕ', 'እንደገና ጀምር'] } }
    }
  }
};

// ============================================================
// STATE (per-session, in-memory)
// ============================================================
let currentService = 'iftms';
let services = {};
let servicesInitialized = false;
let db = null;

const sessionStates = new Map();           // Map<sessionId, { [serviceId]: state }>
const sessionAwaitingAnswer = new Map();   // Map<sessionId, { serviceId, since }>

function getSessionStates(sessionId) {
  if (!sessionStates.has(sessionId)) sessionStates.set(sessionId, {});
  return sessionStates.get(sessionId);
}

let activeSessionId = 'default';
function setActiveSession(sessionId) { if (sessionId) activeSessionId = sessionId; }
function getActiveStates() { return getSessionStates(activeSessionId); }

function markAwaitingAnswer(sessionId, serviceId) {
  sessionAwaitingAnswer.set(sessionId, { serviceId, since: Date.now() });
}
function clearAwaitingAnswer(sessionId) { sessionAwaitingAnswer.delete(sessionId); }
function isAwaitingAnswer(sessionId) { return sessionAwaitingAnswer.has(sessionId); }

// ============================================================
// SERVICE INIT
// ============================================================
async function initializeServices() {
  if (servicesInitialized) return true;
  try {
    console.log('📂 Initializing services from Supabase...');
    db = await getServiceConfigDB();

    try {
      const seed = await db.seedDefaultServices?.('if-empty');
      if (seed?.inserted > 0) console.log(`🌱 Seeded ${seed.inserted} service(s)`);
      else if (seed?.skipped) console.log(`🌱 Supabase already has ${seed.skipped} service(s)`);
    } catch (seedErr) {
      console.warn('⚠️ Seed skipped:', seedErr.message);
    }

    const dbConfigs = await db.getAllServiceConfigs();
    services = {};

    if (dbConfigs && dbConfigs.length > 0) {
      for (const dbConfig of dbConfigs) {
        if (dbConfig.isActive === false) continue;
        const service = {
          id: dbConfig.serviceId,
          name: dbConfig.name,
          description: dbConfig.description,
          initStep: dbConfig.initStep || 1,
          collectedData: dbConfig.collectedData || {},
          steps: dbConfig.steps || {}
        };
        if (service.id && Object.keys(service.steps).length > 0) services[service.id] = service;
      }
    }

    if (Object.keys(services).length === 0) {
      console.warn('⚠️ Falling back to DEFAULT_SERVICES');
      services = { ...DEFAULT_SERVICES };
    }

    if (!services[currentService]) {
      const keys = Object.keys(services);
      if (keys.length > 0) currentService = keys[0];
    }

    servicesInitialized = true;
    console.log(`📚 Services initialized: ${Object.keys(services).length}`);
    return true;
  } catch (error) {
    console.error('❌ Init error:', error.message);
    services = { ...DEFAULT_SERVICES };
    servicesInitialized = true;
    return true;
  }
}

export async function reloadServices() {
  servicesInitialized = false;
  return await initializeServices();
}

export async function watchServiceConfigs(onChange) {
  await initializeServices();
  if (!db || typeof db.subscribe !== 'function') {
    console.warn('⚠️ Realtime not available');
    return () => {};
  }
  return db.subscribe(async (payload) => {
    try {
      await reloadServices();
      if (typeof onChange === 'function') onChange(payload);
    } catch (e) { console.error('Reload failed:', e.message); }
  });
}

// ============================================================
// GETTERS / STATE
// ============================================================
function getState() {
  const states = getActiveStates();
  if (!states[currentService]) {
    const svc = getService();
    states[currentService] = {
      currentStep: svc?.initStep || 1,
      currentFieldIndex: 0,
      waitingForAdd: false,
      waitingForContinue: false,
      currentItem: {},
      collectedData: JSON.parse(JSON.stringify(svc?.collectedData || {})),
      isComplete: false
    };
  }
  return states[currentService];
}

function getService() {
  if (!servicesInitialized) return DEFAULT_SERVICES.iftms;
  if (!services[currentService]) {
    const keys = Object.keys(services);
    if (keys.length > 0) currentService = keys[0];
    else { services = { ...DEFAULT_SERVICES }; currentService = 'iftms'; }
  }
  return services[currentService] || DEFAULT_SERVICES.iftms;
}

function getStep() {
  const svc = getService();
  if (!svc || !svc.steps) return null;
  const state = getState();
  const step = svc.steps[state.currentStep];
  if (!step) {
    state.currentStep = 1;
    return svc.steps[1] || null;
  }
  return step;
}

function getCurrentField() {
  const step = getStep();
  if (!step) return null;
  const state = getState();
  const fields = step.subprocess?.fields || step.fields || [];
  return fields[state.currentFieldIndex] || null;
}

function isServiceComplete(serviceId) {
  const states = getActiveStates();
  return states[serviceId]?.isComplete === true;
}

function markServiceComplete(serviceId) {
  const states = getActiveStates();
  if (!states[serviceId]) {
    const svc = services[serviceId];
    states[serviceId] = {
      currentStep: svc?.initStep || 1,
      currentFieldIndex: 0, waitingForAdd: false, waitingForContinue: false,
      currentItem: {},
      collectedData: JSON.parse(JSON.stringify(svc?.collectedData || {})),
      isComplete: true
    };
  } else {
    states[serviceId].isComplete = true;
  }
}

function resetService(serviceId) {
  const svc = services[serviceId];
  if (!svc) return;
  const states = getActiveStates();
  states[serviceId] = {
    currentStep: svc.initStep || 1,
    currentFieldIndex: 0, waitingForAdd: false, waitingForContinue: false,
    currentItem: {},
    collectedData: JSON.parse(JSON.stringify(svc.collectedData || {})),
    isComplete: false
  };
}

// ============================================================
// KEYWORDS
// ============================================================
const SERVICE_KEYWORDS = {
  videoGeneration: ['video', 'clip', 'slideshow', 'advertisement', 'promo', 'animation'],
  documentAnalysis: ['analyze', 'analysis', 'research', 'document', 'paper', 'academic', 'legal', 'contract', 'financial', 'invoice'],
  iftms: ['freight', 'transport', 'cargo', 'iftms', 'operator', 'vehicle', 'driver', 'truck', 'logistics']
};

function checkServiceSwitch(message) {
  if (!message) return null;
  const lower = message.toLowerCase();
  for (const [serviceId, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) return serviceId;
  }
  return null;
}

const YES_WORDS = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'yup', 'of course', 'አዎ'];
const NO_WORDS = ['no', 'nope', 'nah', 'not yet', 'skip', 'አይ'];

function checkYesNo(message) {
  if (!message) return null;
  const lower = message.trim().toLowerCase();
  if (YES_WORDS.some(w => lower === w || lower.startsWith(w + ' '))) return 'yes';
  if (NO_WORDS.some(w => lower === w || lower.startsWith(w + ' '))) return 'no';
  return null;
}

// ============================================================
// VALIDATION
// ============================================================
function validateField(input, field) {
  const value = input?.toString().trim();
  const errorMsg = getLocalized(field.error);
  const exampleMsg = getLocalized(field.example);
  if (!value) return { valid: false, message: errorMsg || 'Cannot be empty' };

  if (field.validation === 'choice' && field.options) {
    const options = getLocalizedOptions(field.options);
    const match = options.find(opt => opt.toLowerCase() === value.toLowerCase());
    if (match) return { valid: true, value: match };
    return { valid: false, message: `${errorMsg || 'Choose from:'} ${options.join(', ')}` };
  }

  if (field.regex) {
    const re = new RegExp(field.regex, 'i');
    if (!re.test(value)) return { valid: false, message: errorMsg || `Invalid. Example: ${exampleMsg}` };
  }
  return { valid: true, value };
}

function saveToState(fieldName, value) {
  const state = getState();
  const step = getStep();
  if (!step) return;
  if (step.type === 'form') {
    if (!state.collectedData.operator) state.collectedData.operator = {};
    state.collectedData.operator[fieldName] = value;
  } else if (step.subprocess) {
    state.currentItem[fieldName] = value;
  }
}

// ============================================================
// VIN
// ============================================================
function processVIN(input) {
  try {
    if (!input) return null;
    if (!vinDecoder || typeof vinDecoder.isVIN !== 'function') return null;
    if (!vinDecoder.isVIN(input)) return null;
    let vin = input;
    if (typeof vinDecoder.extractVIN === 'function') {
      const extracted = vinDecoder.extractVIN(input);
      if (extracted) vin = extracted;
    }
    vin = vin.trim().toUpperCase();
    if (typeof vinDecoder.getCompleteVehicleData !== 'function') return null;
    return vinDecoder.getCompleteVehicleData(vin);
  } catch (error) {
    console.error('VIN error:', error);
    return null;
  }
}

function isAutoFillField(field) { return field && field.autoFill === true; }

// ============================================================
// STEP INTRO
// ============================================================
async function stepIntro() {
  const step = getStep();
  const state = getState();

  if (!step) {
    const text = getLocalized({ en: 'How can I help?', am: 'እንዴት ልረዳ?' });
    return { text, html: `<div>${text}</div>`, isStructured: true };
  }

  if (isServiceComplete(currentService)) return await buildComplete();

  if (step.isFinal || step.type === 'summary' || step.type === 'result') {
    markServiceComplete(currentService);
    return await buildComplete();
  }

  if (step.type === 'file_upload') {
    const prompt = getLocalized(step.prompt);
    return { text: prompt, html: `<div>${prompt}</div>`, isStructured: true };
  }

  if (step.subprocess && step.subprocess.fields) {
    const fields = step.subprocess.fields;
    let firstNonAutoFillIndex = -1;
    for (let i = 0; i < fields.length; i++) {
      if (!isAutoFillField(fields[i])) { firstNonAutoFillIndex = i; break; }
    }
    if (firstNonAutoFillIndex === -1) {
      state.waitingForAdd = true;
      state.currentFieldIndex = 0;
      const addPrompt = getLocalized(step.subprocess.addPrompt);
      const title = getLocalized(step.title);
      return { text: addPrompt, html: `<div><strong>${title}</strong><br>${addPrompt}</div>`, isStructured: true };
    }
    state.waitingForAdd = true;
    state.currentFieldIndex = firstNonAutoFillIndex;
    const firstField = fields[firstNonAutoFillIndex];
    const title = getLocalized(step.title);
    const question = getLocalized(firstField.question);
    return { text: question, html: `<div><strong>${title}</strong><br>${question}</div>`, isStructured: true };
  }

  const firstField = step.fields?.[0];
  if (firstField) {
    const title = getLocalized(step.title);
    const question = getLocalized(firstField.question);
    return { text: question, html: `<div><strong>${title}</strong><br>${question}</div>`, isStructured: true };
  }

  const prompt = getLocalized(step.prompt) || getLocalized({ en: 'How can I help?', am: 'እንዴት ልረዳ?' });
  return { text: prompt, html: `<div>${prompt}</div>`, isStructured: true };
}

// ============================================================
// BUILD COMPLETE
// ============================================================
async function buildComplete() {
  const state = getState();
  const svc = getService();
  const isAmharic = getLanguage() === 'am';

  if (!isServiceComplete(currentService)) {
    const step = getStep();
    const title = step ? getLocalized(step.title) : '';
    const prompt = step ? getLocalized(step.prompt) : '';
    const notCompleteMsg = getLocalized({ en: 'This service is not yet complete. Please continue.', am: 'ይህ አገልግሎት እስካሁን አልተጠናቀቀም። እባክዎ ይቀጥሉ።' });
    return {
      text: `${notCompleteMsg}\n\n${title}: ${prompt || ''}`,
      html: `<div>${notCompleteMsg}<br><br><strong>${title}</strong><br>${prompt || ''}</div>`,
      isStructured: true
    };
  }

  let summary = `${getLocalized(svc.name)} ${getLocalized({ en: 'Complete!', am: 'ተጠናቀቀ!' })}\n\n`;
  for (const [key, val] of Object.entries(state.collectedData)) {
    if (!val) continue;
    const label = isAmharic ?
      { operator: 'ኦፕሬተር', vehicles: 'ተሽከርካሪዎች', drivers: 'አሽከርካሪዎች' }[key] || key.toUpperCase() :
      key.toUpperCase();
    summary += `📋 ${label}:\n`;
    if (Array.isArray(val)) {
      val.forEach((item, i) => {
        summary += `  ${i + 1}. ${Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      });
    } else if (typeof val === 'object') {
      Object.entries(val).forEach(([k, v]) => { summary += `  • ${k}: ${v}\n`; });
    }
  }
  return {
    text: summary,
    html: `<div><pre style="white-space:pre-wrap">${summary}</pre></div>`,
    isStructured: true,
    isComplete: true,
    serviceId: currentService
  };
}

// ============================================================
// EXECUTE ACTION
// ============================================================
async function executeAction(action, rawValue, originalMessage) {
  try {
    const state = getState();
    const step = getStep();
    const currentField = getCurrentField();

    if (!step) {
      const errorMsg = getLocalized({ en: 'System error', am: 'የስርዓት ስህተት' });
      return { text: errorMsg, html: `<div>${errorMsg}</div>`, isStructured: true };
    }

    if (!originalMessage || originalMessage.trim() === '') {
      if (currentField) {
        const question = getLocalized(currentField.question);
        return { text: question, html: `<div>${question}</div>`, isStructured: true };
      }
      const prompt = getLocalized({ en: 'Please enter a value.', am: 'እባክዎ እሴት ያስገቡ።' });
      return { text: prompt, html: `<div>${prompt}</div>`, isStructured: true };
    }

    switch (action) {
      case 'save': {
        if (!currentField) {
          const received = getLocalized({ en: 'I received:', am: 'ተቀብያለሁ:' });
          return { text: `${received} ${originalMessage}`, html: `<div>${received} ${originalMessage}</div>`, isStructured: true };
        }

        if (currentField.name === 'vinNumber' || currentField.name === 'chassisNumber') {
          if (currentField.apiActions && currentField.apiActions.length > 0) {
            const context = {
              userInput: originalMessage,
              collectedData: state.collectedData,
              currentItem: state.currentItem || {},
              operator: state.collectedData.operator || {},
              ...state.currentItem
            };
            const apiResult = await executeFieldApiActions(currentField, context);
            if (apiResult.success && apiResult.message) {
              if (apiResult.result?.data) {
                for (const [key, value] of Object.entries(apiResult.result.data)) {
                  if (value && value !== 'Unknown') saveToState(key, value);
                }
              }
              state.currentFieldIndex++;
              const nextField = getCurrentField();
              const nextQuestion = nextField ? getLocalized(nextField.question) : '';
              return {
                text: `${apiResult.message}\n${nextQuestion}`,
                html: `<div class="success">✅ ${apiResult.message}</div>${nextQuestion ? `<div>${nextQuestion}</div>` : ''}`,
                isStructured: true
              };
            }
          }

          const vinResult = processVIN(originalMessage);
          if (vinResult) {
            const fields = step.subprocess?.fields || [];
            saveToState('vinNumber', vinResult.vinNumber || originalMessage.trim().toUpperCase());
            state.currentFieldIndex++;

            let autoFilledCount = 0;
            for (const field of fields) {
              if (isAutoFillField(field)) {
                const fieldValue = vinResult[field.name];
                if (fieldValue && fieldValue !== 'Unknown' && fieldValue !== '' && fieldValue != null) {
                  saveToState(field.name, fieldValue);
                  state.currentFieldIndex++;
                  autoFilledCount++;
                }
              }
            }
            while (state.currentFieldIndex < fields.length && isAutoFillField(fields[state.currentFieldIndex])) {
              state.currentFieldIndex++;
            }

            if (state.currentFieldIndex >= fields.length) {
              if (step.subprocess) {
                const key = step.subprocess.onValid.collectionKey;
                state.collectedData[key].push({ ...state.currentItem });
                state.currentItem = {};
                state.currentFieldIndex = 0;
                state.waitingForAdd = true;
                const addPrompt = getLocalized(step.subprocess.addPrompt);
                const savedMsg = getLocalized({ en: '✅ Vehicle saved!', am: '✅ ተሽከርካሪ ተቀመጠ!' });
                const autoFillMsg = getLocalized({ en: 'fields auto-filled from VIN', am: 'መስኮች ከVIN በራስ-ሰር ተሞልተዋል' });
                return {
                  text: addPrompt,
                  html: `<div>${savedMsg} (${autoFilledCount} ${autoFillMsg})<br>${addPrompt}</div>`,
                  isStructured: true
                };
              }
            }

            const nextField = getCurrentField();
            const nextQuestion = nextField ? getLocalized(nextField.question) : getLocalized({ en: 'Next:', am: 'ቀጣይ:' });
            const processedMsg = getLocalized({ en: '✅ VIN processed!', am: '✅ VIN ተሰራ!' });
            const autoFillMsg = getLocalized({ en: 'fields auto-filled', am: 'መስኮች በራስ-ሰር ተሞልተዋል' });
            return {
              text: nextQuestion,
              html: `<div>${processedMsg} ${autoFilledCount} ${autoFillMsg}.<br>${nextQuestion}</div>`,
              isStructured: true
            };
          }
        }

        const valueToTry = rawValue || originalMessage;
        const validation = validateField(valueToTry, currentField);

        if (!validation.valid) {
          const errorMsg = validation.message;
          const question = getLocalized(currentField.question);
          return {
            text: errorMsg,
            html: `<div class="error">❌ ${errorMsg}<br>${question}</div>`,
            isStructured: true
          };
        }

        saveToState(currentField.name, validation.value);
        state.currentFieldIndex++;

        const fields = step.subprocess?.fields || step.fields || [];
        while (state.currentFieldIndex < fields.length && isAutoFillField(fields[state.currentFieldIndex])) {
          state.currentFieldIndex++;
        }

        if (state.currentFieldIndex >= fields.length) {
          if (step.apiActions && step.apiActions.length > 0) {
            const context = {
              userInput: originalMessage,
              collectedData: state.collectedData,
              currentItem: state.currentItem || {},
              operator: state.collectedData.operator || {},
              vehicles: state.collectedData.vehicles || [],
              drivers: state.collectedData.drivers || [],
              ...state.collectedData.operator,
              ...state.currentItem
            };
            const apiResult = await executeStepApiActions(step, context);
            if (apiResult.success && apiResult.message) {
              if (apiResult.nextStep) {
                state.currentStep = apiResult.nextStep;
                state.currentFieldIndex = 0;
                const nextStepIntro = await stepIntro();
                return {
                  text: `${apiResult.message}\n${nextStepIntro.text}`,
                  html: `<div class="success">✅ ${apiResult.message}</div>${nextStepIntro.html}`,
                  isStructured: true
                };
              }
            }
          }

          if (step.subprocess) {
            if (Object.keys(state.currentItem).length > 0) {
              const key = step.subprocess.onValid.collectionKey;
              state.collectedData[key].push({ ...state.currentItem });
              state.currentItem = {};
            }
            state.currentFieldIndex = 0;
            state.waitingForAdd = true;
            const addPrompt = getLocalized(step.subprocess.addPrompt);
            const itemName = getLocalized(step.subprocess.itemName);
            const savedMsg = getLocalized({ en: '✅ Saved!', am: '✅ ተቀመጠ!' });
            return {
              text: addPrompt,
              html: `<div>${savedMsg} ${itemName} ${getLocalized({ en: 'saved!', am: 'ተቀመጠ!' })}<br>${addPrompt}</div>`,
              isStructured: true
            };
          } else {
            state.currentStep = step.onValid?.nextStep || state.currentStep + 1;
            state.currentFieldIndex = 0;
            return await stepIntro();
          }
        }

        const nextField = getCurrentField();
        const nextQuestion = nextField ? getLocalized(nextField.question) : getLocalized({ en: 'Next:', am: 'ቀጣይ:' });
        const savedMsg = getLocalized({ en: '✅ Saved!', am: '✅ ተቀመጠ!' });
        return {
          text: nextQuestion,
          html: `<div>${savedMsg}<br>${nextQuestion}</div>`,
          isStructured: true
        };
      }

      case 'yes': {
        if (state.waitingForAdd) {
          state.waitingForAdd = false;
          state.currentItem = {};
          state.currentFieldIndex = 0;
          const firstField = step.subprocess.fields[0];
          const question = getLocalized(firstField.question);
          return { text: question, html: `<div>${question}</div>`, isStructured: true };
        }
        if (state.waitingForContinue) {
          state.waitingForContinue = false;
          state.currentStep = step.subprocess.onValid.nextStep;
          state.currentFieldIndex = 0;
          return await stepIntro();
        }
        break;
      }

      case 'no': {
        if (state.waitingForAdd) {
          state.waitingForAdd = false;
          state.waitingForContinue = true;
          if (step.subprocess && step.subprocess.continuePrompt) {
            const continuePrompt = getLocalized(step.subprocess.continuePrompt);
            return { text: continuePrompt, html: `<div>${continuePrompt}</div>`, isStructured: true };
          } else {
            state.waitingForContinue = false;
            state.currentStep = step.subprocess?.onValid?.nextStep || state.currentStep + 1;
            state.currentFieldIndex = 0;
            return await stepIntro();
          }
        }
        if (state.waitingForContinue) {
          state.waitingForContinue = false;
          state.currentStep = step.subprocess?.onValid?.nextStep || state.currentStep + 1;
          state.currentFieldIndex = 0;
          return await stepIntro();
        }
        break;
      }

      case 'switch_service': {
        const target = rawValue;
        if (target && services[target]) {
          currentService = target;
          const states = getActiveStates();
          if (!states[target]) {
            states[target] = {
              currentStep: services[target].initStep || 1,
              currentFieldIndex: 0, waitingForAdd: false, waitingForContinue: false,
              currentItem: {},
              collectedData: JSON.parse(JSON.stringify(services[target].collectedData || {})),
              isComplete: false
            };
          } else {
            states[target].isComplete = false;
          }
          const serviceName = getLocalized(services[target].name);
          const serviceDesc = getLocalized(services[target].description);
          const welcomeMsg = getLocalized({ en: 'Welcome to', am: 'እንኳን ወደ' });
          return {
            text: `${welcomeMsg} ${serviceName}`,
            html: `<div>🔄 ${welcomeMsg} <strong>${serviceName}</strong><br>${serviceDesc}</div>`,
            isStructured: true
          };
        }
        break;
      }

      case 'help': {
        const list = Object.values(services).map(s => `• ${getLocalized(s.name)}: ${getLocalized(s.description)}`).join('\n');
        const helpTitle = getLocalized({ en: 'Available services:', am: 'የሚገኙ አገልግሎቶች:' });
        return {
          text: `${helpTitle}\n${list}`,
          html: `<div>📚 ${helpTitle}<br>${list.replace(/\n/g, '<br>')}</div>`,
          isStructured: true
        };
      }

      case 'status': {
        const collected = Object.entries(state.collectedData)
          .filter(([, v]) => v && (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0))
          .map(([k, v]) => {
            const label = getLanguage() === 'am' ?
              { operator: 'ኦፕሬተር', vehicles: 'ተሽከርካሪዎች', drivers: 'አሽከርካሪዎች' }[k] || k : k;
            return `${label}: ${Array.isArray(v) ? v.length + ' item(s)' : '✓'}`;
          })
          .join(', ') || getLocalized({ en: 'nothing yet', am: 'እስካሁን ምንም' });
        const svc = getService();
        const serviceName = getLocalized(svc?.name || { en: 'Unknown', am: 'ያልታወቀ' });
        const serviceLabel = getLocalized({ en: 'Service', am: 'አገልግሎት' });
        const stepLabel = getLocalized({ en: 'Step', am: 'ደረጃ' });
        const collectedLabel = getLocalized({ en: 'Collected', am: 'የተሰበሰበ' });
        const completeStatus = isServiceComplete(currentService)
          ? '✅ ' + getLocalized({ en: 'Complete', am: 'ተጠናቋል' })
          : '⏳ ' + getLocalized({ en: 'In Progress', am: 'በመቀጠል ላይ' });
        return {
          text: `${serviceLabel}: ${serviceName} | ${stepLabel}: ${state.currentStep} | ${collectedLabel}: ${collected} | ${completeStatus}`,
          html: `<div>📊 <strong>${serviceName}</strong><br>${stepLabel}: ${state.currentStep}<br>${collectedLabel}: ${collected}<br>${completeStatus}</div>`,
          isStructured: true
        };
      }

      case 'reset': {
        resetService(currentService);
        const resetMsg = getLocalized({ en: 'Session reset. Starting fresh.', am: 'ክፍለ ጊዜ ተጠርጓል። እንደገና በመጀመር ላይ።' });
        const intro = await stepIntro();
        return {
          text: `${resetMsg}\n\n${intro.text}`,
          html: `<div class="success">🔄 ${resetMsg}</div>${intro.html}`,
          isStructured: true
        };
      }

      case 'complete':
        return await buildComplete();

      default: {
        const understood = getLocalized({ en: 'I understood:', am: 'ተረድቻለሁ:' });
        return {
          text: `${understood} "${originalMessage}"`,
          html: `<div>${understood} "${originalMessage}"</div>`,
          isStructured: true
        };
      }
    }

    if (currentField) {
      const question = getLocalized(currentField.question);
      return { text: question, html: `<div>${question}</div>`, isStructured: true };
    }
    const defaultPrompt = getLocalized(getStep()?.prompt) || getLocalized({ en: 'How can I help?', am: 'እንዴት ልረዳ?' });
    return { text: defaultPrompt, html: `<div>${defaultPrompt}</div>`, isStructured: true };
  } catch (error) {
    console.error('❌ executeAction error:', error);
    const errorLabel = getLocalized({ en: 'Error:', am: 'ስህተት:' });
    const unknownError = getLocalized({ en: 'Unknown error', am: 'ያልታወቀ ስህተት' });
    return {
      text: `${errorLabel} ${error.message || unknownError}`,
      html: `<div class="error">❌ ${errorLabel} ${error.message || unknownError}</div>`,
      isStructured: true
    };
  }
}

// ============================================================
// PROCESS MESSAGE
// ============================================================
export async function processMessage(message, file) {
  try {
    console.log('📨 Processing:', message || '[file]');
    await initializeServices();

    if (file) {
      const step = getStep();
      if (step?.type === 'file_upload') {
        const state = getState();
        state.collectedData.document = { name: file.name, size: file.size };
        state.currentStep = step.onValid.nextStep;
        state.currentFieldIndex = 0;
        const fileReceived = getLocalized({ en: 'File received:', am: 'ፋይል ተቀብሏል:' });
        const nextPrompt = getLocalized(step?.prompt) || getLocalized({ en: 'What next?', am: 'ምን ቀጥሎ?' });
        return {
          text: `${fileReceived} "${file.name}". ${nextPrompt}`,
          html: `<div>📄 ${fileReceived} <strong>${file.name}</strong><br>${nextPrompt}</div>`,
          isStructured: true
        };
      }
      const fileReceived = getLocalized({ en: 'File received', am: 'ፋይል ተቀብሏል' });
      return { text: fileReceived, html: `<div>📎 ${fileReceived}</div>`, isStructured: false };
    }

    if (!message) return await stepIntro();

    const state = getState();

    if (state.waitingForAdd || state.waitingForContinue) {
      const yesno = checkYesNo(message);
      if (yesno) return await executeAction(yesno, null, message);
    }

    const vinPattern = /^[A-HJ-NPR-Z0-9]{10,18}$/i;
    if (vinPattern.test(message.trim())) {
      const currentField = getCurrentField();
      if (currentField && (currentField.name === 'vinNumber' || currentField.name === 'chassisNumber')) {
        return await executeAction('save', message, message);
      }
    }

    try {
      const intentResult = detectIntent(message);
      if (intentResult) {
        if (intentResult.intent === 'help')   return await executeAction('help', null, message);
        if (intentResult.intent === 'status') return await executeAction('status', null, message);
        if (intentResult.intent === 'reset')  return await executeAction('reset', null, message);
      }
    } catch (intentErr) {
      console.warn('detectIntent failed:', intentErr.message);
    }

    const switchTarget = checkServiceSwitch(message);
    if (switchTarget && switchTarget !== currentService && services[switchTarget]) {
      currentService = switchTarget;
      const states = getActiveStates();
      if (!states[switchTarget]) {
        states[switchTarget] = {
          currentStep: services[switchTarget].initStep || 1,
          currentFieldIndex: 0, waitingForAdd: false, waitingForContinue: false,
          currentItem: {},
          collectedData: JSON.parse(JSON.stringify(services[switchTarget].collectedData || {})),
          isComplete: false
        };
      } else {
        states[switchTarget].isComplete = false;
      }
      const serviceName = getLocalized(services[switchTarget].name);
      const serviceDesc = getLocalized(services[switchTarget].description);
      const welcomeMsg = getLocalized({ en: 'Welcome to', am: 'እንኳን ወደ' });
      return {
        text: `${welcomeMsg} ${serviceName}`,
        html: `<div>🔄 ${welcomeMsg} <strong>${serviceName}</strong><br>${serviceDesc}</div>`,
        isStructured: true
      };
    }

    const currentField = getCurrentField();
    if (currentField) {
      const validation = validateField(message, currentField);
      if (validation.valid) return await executeAction('save', validation.value, message);
      const errorMsg = validation.message;
      const question = getLocalized(currentField.question);
      return {
        text: errorMsg,
        html: `<div class="error">❌ ${errorMsg}<br>${question}</div>`,
        isStructured: true
      };
    }

    const received = getLocalized({ en: 'I received:', am: 'ተቀብያለሁ:' });
    const serviceList = Object.values(services).map(s => `• ${getLocalized(s.name)}`).join('\n');
    const availableServices = getLocalized({ en: 'Available services:', am: 'የሚገኙ አገልግሎቶች:' });
    return {
      text: `${received} "${message}"\n\n${availableServices}\n${serviceList}`,
      html: `<div>${received} "${message}"<br><br>📚 ${availableServices}<br>${serviceList.replace(/\n/g, '<br>')}</div>`,
      isStructured: true
    };
  } catch (error) {
    console.error('❌ processMessage error:', error);
    const errorLabel = getLocalized({ en: 'Error:', am: 'ስህተት:' });
    const unknownError = getLocalized({ en: 'Unknown error', am: 'ያልታወቀ ስህተት' });
    return {
      text: `${errorLabel} ${error.message || unknownError}`,
      html: `<div class="error">❌ ${errorLabel} ${error.message || unknownError}</div>`,
      isStructured: true
    };
  }
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * chat(msg, file, sessionId, mode, serviceId)
 *
 *   mode = "stage"  → present current step, NO validation, mark awaiting answer
 *   mode = "answer" → validate + advance
 *   mode = "chat"   → free-form (auto-promoted to "answer" if mid-flow)
 */
export async function chat(msg, file, sessionId, mode = 'chat', serviceId = null) {
  try {
    const sid = sessionId || activeSessionId;
    if (sessionId) setActiveSession(sessionId);
    await initializeServices();

    // ----- STAGE -----
    if (mode === 'stage') {
      if (serviceId && services[serviceId]) {
        currentService = serviceId;
        const states = getActiveStates();
        if (!states[serviceId] || states[serviceId].isComplete) {
          states[serviceId] = {
            currentStep: services[serviceId].initStep || 1,
            currentFieldIndex: 0,
            waitingForAdd: false,
            waitingForContinue: false,
            currentItem: {},
            collectedData: JSON.parse(JSON.stringify(services[serviceId].collectedData || {})),
            isComplete: false
          };
        }
      } else {
        getState();
      }
      markAwaitingAnswer(sid, currentService);
      return await stepIntro();
    }

    // ----- Auto-promote chat → answer when mid-flow -----
    const states = getActiveStates();
    getState(); // ← critical: materialize state before reading
    const svcState = states[currentService];
    const midFlow =
      svcState &&
      !svcState.isComplete &&
      (isAwaitingAnswer(sid) ||
        svcState.waitingForAdd ||
        svcState.waitingForContinue ||
        svcState.currentFieldIndex > 0);

    if (mode === 'chat' && !file && midFlow) {
      mode = 'answer';
    }

    if (msg || file) clearAwaitingAnswer(sid);

    return await processMessage(msg, file);
  } catch (error) {
    console.error('❌ chat error:', error);
    const errorLabel = getLocalized({ en: 'Error:', am: 'ስህተት:' });
    const unknownError = getLocalized({ en: 'Unknown error', am: 'ያልታወቀ ስህተት' });
    return {
      text: `${errorLabel} ${error.message || unknownError}`,
      html: `<div class="error">❌ ${errorLabel} ${error.message || unknownError}</div>`,
      isStructured: true
    };
  }
}

/**
 * resume(sessionId) — re-stage current prompt after navigation/reload.
 */
export async function resume(sessionId) {
  try {
    const sid = sessionId || activeSessionId;
    if (sessionId) setActiveSession(sessionId);
    await initializeServices();

    const states = getActiveStates();
    getState();

    const svcState = states[currentService];
    const step = getStep();

    markAwaitingAnswer(sid, currentService);

    if (svcState?.waitingForAdd && step?.subprocess?.addPrompt) {
      const p = getLocalized(step.subprocess.addPrompt);
      return { text: p, html: `<div>${p}</div>`, isStructured: true };
    }
    if (svcState?.waitingForContinue && step?.subprocess?.continuePrompt) {
      const p = getLocalized(step.subprocess.continuePrompt);
      return { text: p, html: `<div>${p}</div>`, isStructured: true };
    }
    return await stepIntro();
  } catch (error) {
    console.error('❌ resume error:', error);
    const errorLabel = getLocalized({ en: 'Error:', am: 'ስህተት:' });
    return {
      text: `${errorLabel} ${error.message}`,
      html: `<div class="error">❌ ${errorLabel} ${error.message}</div>`,
      isStructured: true
    };
  }
}

/**
 * getSessionStatus(sessionId) — lets the client decide fresh vs. resume.
 */
export async function getSessionStatus(sessionId) {
  const sid = sessionId || activeSessionId;
  if (sessionId) setActiveSession(sessionId);
  await initializeServices();

  const states = getActiveStates();
  getState();

  const svcState = states[currentService];
  const svc = services[currentService];

  return {
    sessionId: sid,
    serviceId: currentService,
    serviceName: svc ? getLocalized(svc.name) : null,
    currentStep: svcState?.currentStep ?? null,
    currentFieldIndex: svcState?.currentFieldIndex ?? 0,
    waitingForAdd: !!svcState?.waitingForAdd,
    waitingForContinue: !!svcState?.waitingForContinue,
    isComplete: !!svcState?.isComplete,
    awaitingAnswer: isAwaitingAnswer(sid),
    hasProgress: !!svcState && (
      svcState.currentStep > (svc?.initStep || 1) ||
      svcState.currentFieldIndex > 0 ||
      svcState.waitingForAdd ||
      svcState.waitingForContinue
    )
  };
}

export async function endSession(sessionId) {
  const sid = sessionId || activeSessionId;
  sessionStates.delete(sid);
  sessionAwaitingAnswer.delete(sid);
  return { ok: true, sessionId: sid };
}

export async function init() {
  try {
    await initializeServices();
    const serviceList = Object.keys(services);
    console.log(`✅ NLP Processor initialized: ${serviceList.length} services`);
    return true;
  } catch (error) {
    console.error('❌ Init error:', error);
    return false;
  }
}

export async function getAvailableServices() {
  await initializeServices();
  return Object.values(services);
}

export {
  setLanguage,
  getLanguage,
  resetService,
  isServiceComplete,
  markServiceComplete
};

export const nlpProcessor = {
  chat,
  resume,
  processMessage,
  init,
  getAvailableServices,
  getSessionStatus,
  endSession,
  resetService,
  isServiceComplete,
  markServiceComplete,
  setLanguage,
  getLanguage,
  reloadServices,
  watchServiceConfigs
};