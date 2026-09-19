// ============================================================
// vinDecoder.js - Complete Vehicle Identification Number Decoder
// ============================================================

export class VinDecoder {
  constructor() {
    this.manufacturerMap = {
      'LVB': 'Foton Motor', 'LVS': 'FAW Toyota', 'LVV': 'Chery Automobile',
      'LGB': 'Dongfeng Nissan', 'JT1': 'Toyota', 'KMH': 'Hyundai',
      '1FA': 'Ford', '1G1': 'Chevrolet', '1G4': 'Buick', 'WBA': 'BMW',
      'WDB': 'Mercedes-Benz', 'WVW': 'Volkswagen', 'JHM': 'Honda',
      'JN1': 'Nissan', 'JTE': 'Toyota', 'JTG': 'Toyota', 'JTH': 'Toyota',
      'JTL': 'Toyota', 'JTM': 'Toyota', 'JS1': 'Suzuki', 'JAA': 'Isuzu',
      'JAB': 'Isuzu', 'JAC': 'Isuzu', 'JBA': 'Hino', 'JBB': 'Hino',
      'JBC': 'Hino', 'LBE': 'Beijing Automotive', 'LB3': 'Dongfeng Motor',
      'LDC': 'Dongfeng Peugeot-Citroen', 'LDD': 'Dongfeng Nissan',
      'LDY': 'Zhongtong Bus', 'LE4': 'Beijing Benz', 'LFM': 'FAW Toyota',
      'LFN': 'FAW-Volkswagen', 'LFP': 'FAW Car', 'LFT': 'FAW Jiefang',
      'LFV': 'FAW-Volkswagen', 'LGH': 'GAC Honda', 'LGJ': 'Dongfeng Honda',
      'LGW': 'Great Wall Motors', 'LGX': 'BYD Auto', 'LH1': 'FAW Haima',
      'LHG': 'GAC Honda', 'LJD': 'Dongfeng Peugeot-Citroen',
      'LJN': 'Zhengzhou Nissan', 'LLV': 'Lifan Motors', 'LMG': 'GAC Motor',
      'LPA': 'Changan PSA', 'LRB': 'Beijing Benz', 'LS5': 'Changan Suzuki',
      'LSG': 'SAIC General Motors', 'LSJ': 'SAIC MG', 'LSV': 'SAIC Volkswagen',
      'LSY': 'Brilliance Jinbei', 'LTV': 'FAW Toyota', 'LUC': 'Guangqi Honda',
      'LUD': 'Dongfeng Yueda Kia', 'LUX': 'Dongfeng Yulon', 'LVC': 'Beijing Benz',
      'LVD': 'Changan Ford', 'LVY': 'Volvo China', 'LZW': 'SAIC-GM-Wuling',
      'LZY': 'Yutong Bus'
    };

    this.yearMap = {
      'A': '2010', 'B': '2011', 'C': '2012', 'D': '2013', 'E': '2014',
      'F': '2015', 'G': '2016', 'H': '2017', 'J': '2018', 'K': '2019',
      'L': '2020', 'M': '2021', 'N': '2022', 'P': '2023', 'R': '2024',
      'S': '2025', 'T': '2026', 'V': '2027', 'W': '2028', 'X': '2029',
      'Y': '2030', '1': '2001', '2': '2002', '3': '2003', '4': '2004',
      '5': '2005', '6': '2006', '7': '2007', '8': '2008', '9': '2009'
    };

    this.bodyMap = {
      '1': 'Passenger Car', '2': 'Extended Cab', '3': 'Double Cab Truck',
      '4': 'Chassis Cab', '5': 'Stake Body Truck', '6': 'Crew Cab Truck',
      '7': 'Dump Truck', '8': 'Tanker Truck', '9': 'Flatbed Truck',
      'A': 'Box Truck', 'B': 'Refrigerated Truck', 'C': 'Crane Truck',
      'D': 'Bus', 'E': 'Minibus', 'F': 'SUV', 'G': 'Pickup Truck',
      'H': 'Van', 'I': 'Minivan', 'J': 'Sedan', 'K': 'Coupe',
      'L': 'Convertible', 'M': 'Wagon', 'N': 'Hatchback'
    };

    this.engineMap = {
      'P': '2.8L Diesel Turbo', 'Q': '3.0L Diesel Turbo',
      'R': '3.8L Diesel Turbo', 'S': '4.5L Diesel Turbo',
      'T': '5.2L Diesel Turbo', 'E': 'Electric Drive',
      'H': 'Hybrid System', 'D': '2.0L Diesel', 'F': '2.5L Diesel',
      'G': '3.2L Diesel', 'I': '4.0L Diesel', 'J': '6.0L Diesel',
      'K': '1.0L Petrol', 'L': '1.2L Petrol', 'M': '1.5L Petrol',
      'N': '1.8L Petrol', 'O': '2.0L Petrol', 'U': '2.5L Petrol',
      'V': '3.0L Petrol', 'W': '3.5L Petrol', 'X': '4.0L Petrol',
      'Y': '5.0L Petrol', 'Z': '6.0L Petrol'
    };

    this.serviceTypeMap = {
      'Truck': 'Freight Transport', 'Bus': 'Passenger Transport',
      'SUV/4x4': 'General Transport', 'Commercial Vehicle': 'Commercial Transport',
      'Passenger Car': 'Personal Transport', 'Van': 'Delivery Transport',
      'Pickup Truck': 'Freight Transport', 'Dump Truck': 'Construction Transport',
      'Tanker Truck': 'Liquid Transport', 'Flatbed Truck': 'Freight Transport',
      'Box Truck': 'Delivery Transport', 'Refrigerated Truck': 'Cold Chain Transport',
      'Crew Cab Truck': 'Freight Transport', 'Double Cab Truck': 'Freight Transport',
      'Stake Body Truck': 'Freight Transport'
    };

    this.vehicleSpecs = {
      'Truck': { axelCount: '2', cargoVolume: '5000', totalWeight: '3500', unladenWeight: '2500', loadCapacity: '1000', seatingCapacity: '3', wheelbase: '3000', tonnage: '3.5', gvw: '3500', payload: '1000' },
      'Bus': { axelCount: '2', cargoVolume: '0', totalWeight: '8000', unladenWeight: '6000', loadCapacity: '2000', seatingCapacity: '45', wheelbase: '6000', tonnage: '8.0', gvw: '8000', payload: '2000' },
      'SUV/4x4': { axelCount: '2', cargoVolume: '500', totalWeight: '2500', unladenWeight: '1800', loadCapacity: '700', seatingCapacity: '5', wheelbase: '2800', tonnage: '2.5', gvw: '2500', payload: '700' },
      'Commercial Vehicle': { axelCount: '3', cargoVolume: '10000', totalWeight: '12000', unladenWeight: '9000', loadCapacity: '3000', seatingCapacity: '3', wheelbase: '3500', tonnage: '12.0', gvw: '12000', payload: '3000' },
      'Passenger Car': { axelCount: '2', cargoVolume: '200', totalWeight: '1500', unladenWeight: '1200', loadCapacity: '300', seatingCapacity: '5', wheelbase: '2700', tonnage: '1.5', gvw: '1500', payload: '300' },
      'Van': { axelCount: '2', cargoVolume: '2000', totalWeight: '3000', unladenWeight: '2200', loadCapacity: '800', seatingCapacity: '8', wheelbase: '3000', tonnage: '3.0', gvw: '3000', payload: '800' },
      'Pickup Truck': { axelCount: '2', cargoVolume: '800', totalWeight: '2800', unladenWeight: '2000', loadCapacity: '800', seatingCapacity: '5', wheelbase: '3200', tonnage: '2.8', gvw: '2800', payload: '800' },
      'Dump Truck': { axelCount: '3', cargoVolume: '8000', totalWeight: '16000', unladenWeight: '12000', loadCapacity: '4000', seatingCapacity: '3', wheelbase: '4000', tonnage: '16.0', gvw: '16000', payload: '4000' },
      'Tanker Truck': { axelCount: '3', cargoVolume: '15000', totalWeight: '18000', unladenWeight: '14000', loadCapacity: '4000', seatingCapacity: '2', wheelbase: '4500', tonnage: '18.0', gvw: '18000', payload: '4000' },
      'Flatbed Truck': { axelCount: '3', cargoVolume: '6000', totalWeight: '14000', unladenWeight: '10000', loadCapacity: '4000', seatingCapacity: '3', wheelbase: '4200', tonnage: '14.0', gvw: '14000', payload: '4000' },
      'Box Truck': { axelCount: '2', cargoVolume: '3000', totalWeight: '4500', unladenWeight: '3500', loadCapacity: '1000', seatingCapacity: '3', wheelbase: '3500', tonnage: '4.5', gvw: '4500', payload: '1000' },
      'Refrigerated Truck': { axelCount: '2', cargoVolume: '2500', totalWeight: '4000', unladenWeight: '3000', loadCapacity: '1000', seatingCapacity: '3', wheelbase: '3300', tonnage: '4.0', gvw: '4000', payload: '1000' },
      'Crew Cab Truck': { axelCount: '2', cargoVolume: '4000', totalWeight: '3500', unladenWeight: '2500', loadCapacity: '1000', seatingCapacity: '5', wheelbase: '3200', tonnage: '3.5', gvw: '3500', payload: '1000' },
      'Double Cab Truck': { axelCount: '2', cargoVolume: '3500', totalWeight: '3300', unladenWeight: '2300', loadCapacity: '1000', seatingCapacity: '5', wheelbase: '3100', tonnage: '3.3', gvw: '3300', payload: '1000' },
      'Stake Body Truck': { axelCount: '2', cargoVolume: '4500', totalWeight: '3800', unladenWeight: '2800', loadCapacity: '1000', seatingCapacity: '3', wheelbase: '3100', tonnage: '3.8', gvw: '3800', payload: '1000' }
    };

    this.colorMap = {
      'LVB': 'White', 'LVS': 'Blue', 'LVV': 'Silver', 'LGB': 'White',
      'JT1': 'White', 'KMH': 'White', '1FA': 'Black', '1G1': 'Silver',
      'WBA': 'Black', 'WDB': 'Silver', 'WVW': 'Black', 'JHM': 'Blue', 'JN1': 'Silver'
    };
  }

  isVIN(input) {
    if (!input || typeof input !== 'string') return false;
    const cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleaned.length >= 10 && cleaned.length <= 18;
  }

  extractVIN(text) {
    if (!text) return null;
    const vinPattern = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
    const match = text.match(vinPattern);
    if (match) return match[1].toUpperCase();
    const chassisPattern = /\b([A-Z0-9]{10,18})\b/i;
    const chassisMatch = text.match(chassisPattern);
    if (chassisMatch) return chassisMatch[1].toUpperCase();
    return null;
  }

  decode(vin) {
    if (!vin || typeof vin !== 'string') return null;
    const cleaned = vin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length < 10 || cleaned.length > 18) return null;

    try {
      const wmi = cleaned.substring(0, 3);
      const manufacturer = this.manufacturerMap[wmi] || 'Unknown Manufacturer';

      let manufactureYear = 'Unknown';
      if (cleaned.length >= 17) {
        const yearChar = cleaned.charAt(9);
        manufactureYear = this.yearMap[yearChar] || 'Unknown';
      }

      let bodyStyle = 'Commercial Vehicle';
      if (cleaned.length >= 17) {
        const bodyChar = cleaned.charAt(4);
        bodyStyle = this.bodyMap[bodyChar] || 'Commercial Vehicle';
      }

      let engineInfo = 'Standard Engine';
      if (cleaned.length >= 17) {
        const engineChar = cleaned.charAt(6);
        engineInfo = this.engineMap[engineChar] || 'Standard Engine';
      }

      let vehicleType = 'Commercial Vehicle';
      if (cleaned.length >= 9) {
        const vds = cleaned.substring(3, 8);
        if (vds.match(/[A-Z]{2}1[A-Z0-9]{2}/)) vehicleType = 'Truck';
        else if (vds.match(/[A-Z]{2}2[A-Z0-9]{2}/)) vehicleType = 'Bus';
        else if (vds.match(/[A-Z]{2}3[A-Z0-9]{2}/)) vehicleType = 'Passenger Car';
        else if (vds.match(/[A-Z]{2}4[A-Z0-9]{2}/)) vehicleType = 'MPV/Minivan';
        else if (vds.match(/[A-Z]{2}5[A-Z0-9]{2}/)) vehicleType = 'SUV/4x4';
        else if (vds.match(/[A-Z]{2}6[A-Z0-9]{2}/)) vehicleType = 'Van';
        else if (vds.match(/[A-Z]{2}7[A-Z0-9]{2}/)) vehicleType = 'Crossover';
        else if (vds.match(/[A-Z]{2}8[A-Z0-9]{2}/)) vehicleType = 'Commercial Vehicle';
        else if (vds.match(/[A-Z]{2}9[A-Z0-9]{2}/)) vehicleType = 'Pickup Truck';
      }

      let vehicleModel = 'Unknown Model';
      if (wmi === 'LVB' && cleaned.includes('S6PE')) vehicleModel = 'Foton Aumark S6';
      else if (wmi === 'LVB') vehicleModel = 'Foton Commercial Truck';
      else if (wmi === 'LVS') vehicleModel = 'FAW Jiefang';
      else if (wmi === 'LVV') vehicleModel = 'Chery Automobile';
      else if (wmi === 'LGB') vehicleModel = 'Dongfeng';
      else if (wmi === 'JT1') vehicleModel = 'Toyota Hilux';
      else if (wmi === 'KMH') vehicleModel = 'Hyundai Porter';
      else if (wmi === '1FA') vehicleModel = 'Ford F-Series';
      else if (wmi === '1G1') vehicleModel = 'Chevrolet Silverado';
      else vehicleModel = `${manufacturer} Commercial Vehicle`;

      let serviceType = this.serviceTypeMap[vehicleType] || 'General Transport';
      const specs = this.vehicleSpecs[vehicleType] || this.vehicleSpecs['Commercial Vehicle'];
      const color = this.colorMap[wmi] || 'Silver';

      return {
        vinNumber: cleaned,
        chassisNumber: cleaned,
        isComplete: cleaned.length === 17,
        wmi: wmi,
        vds: cleaned.length >= 9 ? cleaned.substring(3, 9) : '',
        vis: cleaned.length >= 17 ? cleaned.substring(9, 17) : '',
        manufacturer: manufacturer,
        vehicleModel: vehicleModel,
        modelCode: cleaned.substring(3, 7) || '',
        manufactureYear: manufactureYear,
        vehicleType: vehicleType,
        bodyStyle: bodyStyle,
        bodyPartType: bodyStyle,
        engineInfo: engineInfo,
        engineCapacity: this.getEngineCapacity(engineInfo),
        cylinderCount: this.getCylinderCount(engineInfo),
        fuelType: this.getFuelType(engineInfo),
        motorNumber: '',
        totalWeight: specs.totalWeight || '2500',
        unladenWeight: specs.unladenWeight || '1800',
        loadCapacity: specs.loadCapacity || '700',
        cargoVolume: specs.cargoVolume || '0',
        tonnage: specs.tonnage || '2.5',
        gvw: specs.gvw || '2500',
        payload: specs.payload || '700',
        seatingCapacity: specs.seatingCapacity || '5',
        wheelbase: specs.wheelbase || '2800',
        axelCount: specs.axelCount || '2',
        color: color,
        bodyColor: color,
        interiorColor: color,
        serviceType: serviceType,
        gpsInfo: '0.0000, 0.0000',
        assemblyPlant: 'Unknown Plant',
        plateNumber: '',
        plateCode: '',
        insuranceInfo: '',
        registrationDate: '',
        expiryDate: '',
        summary: this.buildSummary(manufacturer, vehicleModel, manufactureYear, vehicleType, bodyStyle, engineInfo, serviceType, specs, color)
      };
    } catch (error) {
      console.error('VIN decode error:', error);
      return this.getDefaultVehicleData(cleaned);
    }
  }

  getEngineCapacity(engineInfo) {
    const match = engineInfo.match(/(\d+\.?\d*)\s*L/);
    if (match) return Math.round(parseFloat(match[1]) * 1000).toString();
    return 'Unknown';
  }

  getCylinderCount(engineInfo) {
    if (engineInfo.includes('4-cylinder') || engineInfo.includes('4 Cyl')) return '4';
    if (engineInfo.includes('6-cylinder') || engineInfo.includes('6 Cyl')) return '6';
    if (engineInfo.includes('8-cylinder') || engineInfo.includes('8 Cyl')) return '8';
    return 'Unknown';
  }

  getFuelType(engineInfo) {
    const info = engineInfo.toLowerCase();
    if (info.includes('diesel')) return 'Diesel';
    if (info.includes('petrol') || info.includes('gasoline')) return 'Petrol';
    if (info.includes('electric')) return 'Electric';
    if (info.includes('hybrid')) return 'Hybrid';
    return 'Unknown';
  }

  buildSummary(manufacturer, model, year, type, body, engine, service, specs, color) {
    const parts = [];
    if (manufacturer && manufacturer !== 'Unknown') parts.push(`🏭 ${manufacturer}`);
    if (model && model !== 'Unknown Model') parts.push(`🚗 ${model}`);
    if (year && year !== 'Unknown') parts.push(`📅 ${year}`);
    if (type && type !== 'Unknown') parts.push(`📋 ${type}`);
    if (body && body !== 'Commercial Vehicle') parts.push(`🔧 ${body}`);
    if (engine && engine !== 'Standard Engine') parts.push(`⚡ ${engine}`);
    if (service) parts.push(`📦 ${service}`);
    if (color) parts.push(`🎨 ${color}`);
    if (specs) {
      if (specs.axelCount) parts.push(`🔢 Axels: ${specs.axelCount}`);
      if (specs.tonnage) parts.push(`⚖️ ${specs.tonnage}T`);
      if (specs.cargoVolume && specs.cargoVolume !== '0') parts.push(`📦 ${specs.cargoVolume}kg`);
      if (specs.seatingCapacity) parts.push(`💺 ${specs.seatingCapacity} seats`);
    }
    return parts.join(' • ') || 'VIN decoded';
  }

  getDefaultVehicleData(vin) {
    return {
      vinNumber: vin || '',
      chassisNumber: vin || '',
      isComplete: false,
      wmi: vin ? vin.substring(0, 3) : '',
      vds: '', vis: '',
      manufacturer: 'Unknown Manufacturer',
      vehicleModel: 'Unknown Model',
      modelCode: '',
      manufactureYear: 'Unknown',
      vehicleType: 'Commercial Vehicle',
      bodyStyle: 'Commercial Vehicle',
      bodyPartType: 'Commercial Vehicle',
      engineInfo: 'Standard Engine',
      engineCapacity: 'Unknown',
      cylinderCount: 'Unknown',
      fuelType: 'Unknown',
      motorNumber: '',
      totalWeight: '2500', unladenWeight: '1800', loadCapacity: '700',
      cargoVolume: '0', tonnage: '2.5', gvw: '2500', payload: '700',
      seatingCapacity: '5', wheelbase: '2800', axelCount: '2',
      color: 'Silver', bodyColor: 'Silver', interiorColor: 'Silver',
      serviceType: 'General Transport',
      gpsInfo: '0.0000, 0.0000',
      assemblyPlant: 'Unknown Plant',
      plateNumber: '', plateCode: '', insuranceInfo: '',
      registrationDate: '', expiryDate: '',
      summary: 'VIN decoded with default values'
    };
  }

  getCompleteVehicleData(vin) {
    const decoded = this.decode(vin);
    if (!decoded) return this.getDefaultVehicleData(vin);
    return {
      vinNumber: decoded.vinNumber || '',
      chassisNumber: decoded.chassisNumber || '',
      plateNumber: '', plateCode: '',
      manufacturer: decoded.manufacturer || '',
      vehicleModel: decoded.vehicleModel || '',
      manufactureYear: decoded.manufactureYear || '',
      vehicleType: decoded.vehicleType || '',
      bodyStyle: decoded.bodyStyle || '',
      bodyPartType: decoded.bodyPartType || '',
      engineInfo: decoded.engineInfo || '',
      engineCapacity: decoded.engineCapacity || '',
      cylinderCount: decoded.cylinderCount || '',
      fuelType: decoded.fuelType || '',
      motorNumber: '',
      totalWeight: decoded.totalWeight || '2500',
      unladenWeight: decoded.unladenWeight || '1800',
      loadCapacity: decoded.loadCapacity || '700',
      cargoVolume: decoded.cargoVolume || '0',
      tonnage: decoded.tonnage || '2.5',
      gvw: decoded.gvw || '2500',
      payload: decoded.payload || '700',
      seatingCapacity: decoded.seatingCapacity || '5',
      wheelbase: decoded.wheelbase || '2800',
      axelCount: decoded.axelCount || '2',
      color: decoded.color || 'Silver',
      bodyColor: decoded.bodyColor || 'Silver',
      interiorColor: decoded.interiorColor || 'Silver',
      serviceType: decoded.serviceType || 'General Transport',
      gpsInfo: decoded.gpsInfo || '0.0000, 0.0000',
      assemblyPlant: decoded.assemblyPlant || 'Unknown Plant',
      insuranceInfo: '', registrationDate: '', expiryDate: '',
      summary: decoded.summary || 'Vehicle data from VIN'
    };
  }
}

export const vinDecoder = new VinDecoder();
export default vinDecoder;
